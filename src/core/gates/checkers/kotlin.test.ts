import { describe, it, expect } from "vitest";
import { getChecker } from "./registry.ts";
import "./kotlin.ts";

describe("Kotlin export checker", () => {
  const checker = getChecker("/file.kt")!;

  it("detects new fun (default public)", () => {
    const before = "";
    const after = "fun greet() {}";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "greet" }]);
  });

  it("detects new val (default public)", () => {
    const before = "";
    const after = "val name = \"foo\"";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "name" }]);
  });

  it("detects new var (default public)", () => {
    const before = "";
    const after = "var counter = 0";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "counter" }]);
  });

  it("detects new class (default public)", () => {
    const before = "";
    const after = "class Service(val name: String)";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Service" }]);
  });

  it("detects new interface", () => {
    const before = "";
    const after = "interface Repository { fun find(): List<Any> }";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Repository" }]);
  });

  it("detects new object", () => {
    const before = "";
    const after = "object Singleton { fun doWork() {} }";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Singleton" }]);
  });

  it("detects new typealias", () => {
    const before = "";
    const after = "typealias Str = String";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Str" }]);
  });

  it("detects new data class", () => {
    const before = "";
    const after = "data class User(val name: String, val age: Int)";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "User" }]);
  });

  it("detects new sealed class", () => {
    const before = "";
    const after = "sealed class Result { data class Success(val data: Any) : Result() }";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Result" }]);
  });

  it("detects new enum class", () => {
    const before = "";
    const after = "enum class Color { RED, GREEN, BLUE }";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Color" }]);
  });

  it("detects new abstract class", () => {
    const before = "";
    const after = "abstract class Base { abstract fun init() }";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Base" }]);
  });

  it("detects new open class", () => {
    const before = "";
    const after = "open class Extensible { open fun hook() {} }";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Extensible" }]);
  });

  it("detects explicit public fun with modifier", () => {
    const before = "";
    const after = "public fun explicit() {}";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "public", name: "explicit" }]);
  });

  it("detects internal fun with modifier", () => {
    const before = "";
    const after = "internal fun internalFn() {}";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "internal", name: "internalFn" }]);
  });

  it("does not detect top-level protected (member-only visibility)", () => {
    const before = "";
    const after = "protected val hidden = 42";
    expect(checker.getNewExports(before, after)).toEqual([]);
  });

  it("does not detect private fun", () => {
    const before = "";
    const after = "private fun hidden() {}";
    expect(checker.getNewExports(before, after)).toEqual([]);
  });

  it("does not detect private class", () => {
    const before = "";
    const after = "private class InternalHelper";
    expect(checker.getNewExports(before, after)).toEqual([]);
  });

  it("returns empty when no new exports", () => {
    const code = "fun existing() {}\nclass Config(val port: Int)";
    expect(checker.getNewExports(code, code)).toEqual([]);
  });

  it("detects multiple new exports", () => {
    const before = "fun existing() {}";
    const after = "fun existing() {}\nfun newFn() {}\nclass NewClass";
    expect(checker.getNewExports(before, after)).toEqual([
      { name: "newFn" },
      { name: "NewClass" },
    ]);
  });

  it("only reports exports that are genuinely new", () => {
    const before = "fun keep() {}\nval version = 1";
    const after = "fun keep() {}\nval version = 1\nobject Registry";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Registry" }]);
  });

  it("handles .kts extension", () => {
    const ktsChecker = getChecker("/script.kts")!;
    const before = "";
    const after = "fun run() {}";
    expect(ktsChecker.getNewExports(before, after)).toEqual([{ name: "run" }]);
  });

  it("detects final class", () => {
    const before = "";
    const after = "final class Closed {}";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Closed" }]);
  });

  it("detects inline (value) class", () => {
    const before = "";
    const after = "value class Money(val cents: Long)";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Money" }]);
  });

  it("detects annotation class", () => {
    const before = "";
    const after = "annotation class Marker";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Marker" }]);
  });

  it("detects expect class (KMP)", () => {
    const before = "";
    const after = "expect class Platform()";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Platform" }]);
  });

  it("detects companion object", () => {
    const before = "";
    const after = "companion object Loader";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Loader" }]);
  });

  it("detects declaration with leading annotation", () => {
    const before = "";
    const after = "@JvmStatic\npublic fun run() {}";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "public", name: "run" }]);
  });

  it("does not detect class members as top-level exports", () => {
    const before = "";
    const after = "class Outer {\n  fun inner() {}\n  val x = 1\n}";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Outer" }]);
  });
});
