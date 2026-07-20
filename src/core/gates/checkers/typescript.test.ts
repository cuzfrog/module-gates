import { describe, it, expect } from "vitest";
import { getChecker } from "./registry.ts";
import "./typescript.ts";

describe("TypeScript export checker", () => {
  const checker = getChecker("/file.ts")!;

  it("detects new export function", () => {
    const before = "";
    const after = "export function greet() {}";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "greet" }]);
  });

  it("detects new export const", () => {
    const before = "";
    const after = "export const VALUE = 42;";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "VALUE" }]);
  });

  it("detects new export class", () => {
    const before = "";
    const after = "export class MyService {}";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "MyService" }]);
  });

  it("detects new export type", () => {
    const before = "";
    const after = "export type Config = { port: number };";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Config" }]);
  });

  it("detects new export interface", () => {
    const before = "";
    const after = "export interface Logger { log(msg: string): void; }";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Logger" }]);
  });

  it("detects export async function", () => {
    const before = "";
    const after = "export async function fetchData() {}";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "fetchData" }]);
  });

  it("detects export abstract class", () => {
    const before = "";
    const after = "export abstract class BaseService {}";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "BaseService" }]);
  });

  it("detects export function* generator", () => {
    const before = "";
    const after = "export function* generate() {}";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "generate" }]);
  });

  it("detects export async function* generator", () => {
    const before = "";
    const after = "export async function* stream() {}";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "stream" }]);
  });

  it("detects export declare function", () => {
    const before = "";
    const after = "export declare function init(): void;";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "init" }]);
  });

  it("detects export declare class", () => {
    const before = "";
    const after = "export declare class Options {}";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Options" }]);
  });

  it("detects export declare const", () => {
    const before = "";
    const after = "export declare const VERSION: string;";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "VERSION" }]);
  });

  it("detects export declare type", () => {
    const before = "";
    const after = "export declare type ID = string;";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "ID" }]);
  });

  it("detects export declare interface", () => {
    const before = "";
    const after = "export declare interface Plugin {}";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Plugin" }]);
  });

  it("detects export declare enum", () => {
    const before = "";
    const after = "export declare enum Status { Active, Inactive }";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Status" }]);
  });

  it("detects export default abstract class", () => {
    const before = "";
    const after = "export default abstract class AppBase {}";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "AppBase" }]);
  });

  it("detects export default async function", () => {
    const before = "";
    const after = "export default async function bootstrap() {}";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "bootstrap" }]);
  });

  it("detects export declare async function", () => {
    const before = "";
    const after = "export declare async function resolve(): Promise<void>;";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "resolve" }]);
  });

  it("detects export default function with name", () => {
    const before = "";
    const after = "export default function main() {}";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "main" }]);
  });

  it("returns empty array when no new exports", () => {
    const code = "export function existing() {}\nexport const VAL = 1;";
    expect(checker.getNewExports(code, code)).toEqual([]);
  });

  it("handles export let", () => {
    const before = "";
    const after = "export let counter = 0;";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "counter" }]);
  });

  it("handles export var", () => {
    const before = "";
    const after = "export var legacy = true;";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "legacy" }]);
  });

  it("handles export enum", () => {
    const before = "";
    const after = "export enum Direction { Up, Down }";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Direction" }]);
  });

  it("detects named re-export like export { Foo }", () => {
    const before = "";
    const after = 'export { Foo } from "./foo";';
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Foo" }]);
  });

  it("detects multiple named re-exports", () => {
    const before = "";
    const after = 'export { A, B, C } from "./mod";';
    expect(checker.getNewExports(before, after)).toEqual([
      { name: "A" },
      { name: "B" },
      { name: "C" },
    ]);
  });

  it("detects renamed re-export using exported name", () => {
    const before = "";
    const after = 'export { Foo as Bar } from "./foo";';
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Bar" }]);
  });

  it("detects namespace re-export", () => {
    const before = "";
    const after = 'export * as ns from "./mod";';
    expect(checker.getNewExports(before, after)).toEqual([{ name: "ns" }]);
  });

  it("detects re-export mixed with declaration exports", () => {
    const before = "export function existing() {}";
    const after =
      'export function existing() {}\nexport { Foo, Bar } from "./mod";';
    expect(checker.getNewExports(before, after)).toEqual([
      { name: "Foo" },
      { name: "Bar" },
    ]);
  });

  it("detects multiple new exports", () => {
    const before = "export function existing() {}";
    const after =
      "export function existing() {}\nexport function newFn() {}\nexport const newConst = 1;";
    expect(checker.getNewExports(before, after)).toEqual([
      { name: "newFn" },
      { name: "newConst" },
    ]);
  });

  it("only reports exports that are genuinely new", () => {
    const before = "export function keep() {}\nexport const VALUE = 1;";
    const after =
      "export function keep() {}\nexport const VALUE = 1;\nexport type NewType = string;";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "NewType" }]);
  });

  it("detects type-only re-export as new export", () => {
    const before = "";
    const after = 'export type { Foo } from "./foo";';
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Foo" }]);
  });

  it("detects multiple type-only re-exports", () => {
    const before = "";
    const after = 'export type { A, B as C } from "./mod";';
    expect(checker.getNewExports(before, after)).toEqual([
      { name: "A" },
      { name: "C" },
    ]);
  });

  it("detects star re-export as a new export surface", () => {
    const before = "";
    const after = 'export * from "./mod";';
    expect(checker.getNewExports(before, after)).toEqual([{ name: "*" }]);
  });

  it("detects default export of identifier as new export", () => {
    const before = "";
    const after = "const Foo = 1;\nexport default Foo;";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Foo" }]);
  });

  it("does not double-count default function name", () => {
    const before = "";
    const after = "export default function main() {}";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "main" }]);
  });

  it("does not count default expression without identifier", () => {
    const before = "";
    const after = "export default 42;";
    expect(checker.getNewExports(before, after)).toEqual([]);
  });

  it("detects indented export declarations", () => {
    const before = "";
    const after = "  export function nested() {}";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "nested" }]);
  });

  it("detects local export {} (no from)", () => {
    const before = "";
    const after = "const Foo = 1; const Bar = 2;\nexport { Foo, Bar };";
    expect(checker.getNewExports(before, after)).toEqual([
      { name: "Foo" },
      { name: "Bar" },
    ]);
  });

  it("detects local export { Foo as Renamed } without from", () => {
    const before = "";
    const after = "const Foo = 1;\nexport { Foo as Renamed };";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Renamed" }]);
  });

  it("detects local export { type Foo } as the type name", () => {
    const before = "";
    const after = "type Foo = string;\nexport { type Foo };";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Foo" }]);
  });

  it("detects export type * from", () => {
    const before = "";
    const after = 'export type * from "./mod";';
    expect(checker.getNewExports(before, after)).toEqual([{ name: "*" }]);
  });

  it("detects export = X (CommonJS-style)", () => {
    const before = "";
    const after = "class MyClass {}\nexport = MyClass;";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "MyClass" }]);
  });

  it("detects export with leading decorator line", () => {
    const before = "";
    const after = "@sealed\nexport class Foo {}";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Foo" }]);
  });
});
