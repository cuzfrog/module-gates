#!/usr/bin/env node
/**
 * Wrapper: run `gh` as a GitHub App bot identity.
 *
 * Generates a short-lived installation token from the app's private key,
 * then executes `gh` with it. Tokens expire after 1 hour — the result is
 * cached under /tmp/ and reused until 5 minutes before expiry.
 *
 * Usage:  ./scripts/gh-bot.mjs pr comment 42 --body "Reviewed. LGTM."
 *
 * Environment (can be set via .env at project root):
 *   GH_APP_ID                — GitHub App ID
 *   GH_INSTALLATION_ID       — Installation ID (from app's install page URL)
 *   GH_APP_PRIVATE_KEY_PATH  — path to the app's .pem private key
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

/* ── Config ───────────────────────────────────────────────────────── */

const CACHE_DIR = os.tmpdir();
const EXPIRY_BUFFER_SEC = 300; // refresh 5 min before actual expiry

/* ── Helpers ──────────────────────────────────────────────────────── */

function loadEnv(projectRoot) {
  const envFile = path.join(projectRoot, ".env");
  const env = {};
  try {
    const content = fs.readFileSync(envFile, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
    }
  } catch {
    // .env doesn't exist
  }
  return env;
}

function base64UrlEncode(buf) {
  return buf.toString("base64url");
}

function createJWT(appId, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iat: now,
    exp: now + 300,
    iss: appId,
  };

  const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const message = `${headerB64}.${payloadB64}`;

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(message);
  sign.end();

  const key = crypto.createPrivateKey(privateKey);
  const signature = sign.sign(key);

  return `${message}.${base64UrlEncode(signature)}`;
}

function cachePath(installationId) {
  return path.join(CACHE_DIR, `gh-bot-${installationId}.json`);
}

function readCachedToken(cacheFile) {
  try {
    const raw = fs.readFileSync(cacheFile, "utf-8");
    const cached = JSON.parse(raw);
    if (cached.token && cached.expiresAt) {
      const expiresAt = new Date(cached.expiresAt).getTime();
      // Reuse if more than EXPIRY_BUFFER_SEC seconds left
      if (Date.now() + EXPIRY_BUFFER_SEC * 1000 < expiresAt) {
        return cached.token;
      }
    }
  } catch {
    // missing, corrupt, or expired
  }
  return null;
}

function writeCachedToken(cacheFile, token, expiresAt) {
  try {
    fs.writeFileSync(cacheFile, JSON.stringify({ token, expiresAt }), "utf-8");
  } catch {
    // non-fatal: cache is a perf optimisation
  }
}

async function fetchInstallationToken(appId, installationId, privateKey) {
  const jwt = createJWT(appId, privateKey);
  const url = `https://api.github.com/app/installations/${installationId}/access_tokens`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "pi-gh-bot",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${body}`);
  }

  const data = await response.json();
  return { token: data.token, expiresAt: data.expires_at };
}

/* ── Main ─────────────────────────────────────────────────────────── */

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(__dirname, "..");
  const env = loadEnv(projectRoot);

  const appId = env.GH_APP_ID ?? process.env.GH_APP_ID;
  const installationId = env.GH_INSTALLATION_ID ?? process.env.GH_INSTALLATION_ID;
  let privateKeyPath = env.GH_APP_PRIVATE_KEY_PATH ?? process.env.GH_APP_PRIVATE_KEY_PATH;

  if (!appId || !installationId || !privateKeyPath) {
    console.error(
      "ERROR: Missing GitHub App configuration.\n" +
        `  GH_APP_ID=${appId ?? ""}\n` +
        `  GH_INSTALLATION_ID=${installationId ?? ""}\n` +
        `  GH_APP_PRIVATE_KEY_PATH=${privateKeyPath ?? ""}\n` +
        "\n" +
        "  Set these in .env at project root, or export them.\n" +
        "  See .env.example.\n",
    );
    process.exit(1);
  }

  if (privateKeyPath.startsWith("~/")) {
    privateKeyPath = path.join(process.env.HOME || process.env.USERPROFILE || "~", privateKeyPath.slice(2));
  } else if (!path.isAbsolute(privateKeyPath)) {
    privateKeyPath = path.resolve(projectRoot, privateKeyPath);
  }

  // Try cache first
  const cacheFile = cachePath(installationId);
  let token = readCachedToken(cacheFile);

  if (token) {
    console.error("[gh-bot] using cached token");
  } else {
    console.error("[gh-bot] fetching new token");

    let privateKey;
    try {
      privateKey = fs.readFileSync(privateKeyPath, "utf-8");
    } catch (err) {
      console.error(`ERROR: Cannot read private key at ${privateKeyPath}:`, err.message);
      process.exit(1);
    }

    try {
      const result = await fetchInstallationToken(appId, installationId, privateKey);
      token = result.token;
      writeCachedToken(cacheFile, token, result.expiresAt);
    } catch (err) {
      console.error("ERROR: Failed to get installation token:", err.message);
      process.exit(1);
    }
  }

  const ghArgs = process.argv.slice(2);
  if (ghArgs.length === 0) {
    console.error("Usage: gh-bot.mjs <gh subcommand> [args...]");
    process.exit(1);
  }

  const child = spawn("gh", ghArgs, {
    stdio: "inherit",
    env: { ...process.env, GH_TOKEN: token },
  });

  child.on("exit", (code) => process.exit(code ?? 1));
}

main();
