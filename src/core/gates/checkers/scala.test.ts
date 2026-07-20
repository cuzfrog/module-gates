import { describe, it, expect } from "vitest";
import { getChecker } from "./registry.ts";
import "./scala.ts";

describe("Scala export checker", () => {
  const checker = getChecker("/file.scala")!;

  it("detects new class (default public)", () => {
    const before = "";
    const after = "class Foo(x: Int)";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Foo" }]);
  });

  it("detects new object", () => {
    const before = "";
    const after = "object Bar { def apply() = new Bar() }";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Bar" }]);
  });

  it("detects new trait", () => {
    const before = "";
    const after = "trait Baz { def qux: Int }";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Baz" }]);
  });

  it("detects new def (default public)", () => {
    const before = "";
    const after = "def greet(name: String): String = s\"Hello $name\"";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "greet" }]);
  });

  it("detects new val (default public)", () => {
    const before = "";
    const after = "val maxRetries = 3";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "maxRetries" }]);
  });

  it("detects new var (default public)", () => {
    const before = "";
    const after = "var counter = 0";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "counter" }]);
  });

  it("detects new type alias", () => {
    const before = "";
    const after = "type Str = String";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Str" }]);
  });

  it("detects private[package] class with modifier", () => {
    const before = "";
    const after = "private[core] class InternalHelper";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "private[core]", name: "InternalHelper" }]);
  });

  it("detects protected[package] def with modifier", () => {
    const before = "";
    const after = "protected[core] def restricted(): Unit = ()";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "protected[core]", name: "restricted" }]);
  });

  it("does not detect bare private class", () => {
    const before = "";
    const after = "private class Hidden";
    expect(checker.getNewExports(before, after)).toEqual([]);
  });

  it("does not detect bare protected def", () => {
    const before = "";
    const after = "protected def secret(): Int = 42";
    expect(checker.getNewExports(before, after)).toEqual([]);
  });

  it("detects new given (Scala 3)", () => {
    const before = "";
    const after = "given intOrd: Ordering[Int] with { def compare(x: Int, y: Int): Int = x - y }";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "intOrd" }]);
  });

  it("returns empty when no new exports", () => {
    const code = "class Existing\ndef util(): Unit = ()";
    expect(checker.getNewExports(code, code)).toEqual([]);
  });

  it("detects multiple new exports", () => {
    const before = "class Existing";
    const after = "class Existing\nclass NewOne\nobject NewTwo";
    expect(checker.getNewExports(before, after)).toEqual([
      { name: "NewOne" },
      { name: "NewTwo" },
    ]);
  });

  it("only reports exports that are genuinely new", () => {
    const before = "class Keep\ndef cached(): Int = 1";
    const after = "class Keep\ndef cached(): Int = 1\nval fresh = 3.14";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "fresh" }]);
  });

  it("handles .sc extension", () => {
    const scChecker = getChecker("/worksheet.sc")!;
    const before = "";
    const after = "class Point(x: Int, y: Int)";
    expect(scChecker.getNewExports(before, after)).toEqual([{ name: "Point" }]);
  });

  it("detects case class", () => {
    const before = "";
    const after = "case class Money(amount: BigDecimal)";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Money" }]);
  });

  it("detects case object", () => {
    const before = "";
    const after = "case object Empty";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Empty" }]);
  });

  it("detects sealed trait", () => {
    const before = "";
    const after = "sealed trait JsonValue";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "JsonValue" }]);
  });

  it("detects final case class", () => {
    const before = "";
    const after = "final case class Token(value: String)";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Token" }]);
  });

  it("detects abstract class", () => {
    const before = "";
    const after = "abstract class Base";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Base" }]);
  });

  it("detects explicit public class", () => {
    const before = "";
    const after = "public class Public";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "public", name: "Public" }]);
  });

  it("detects Scala 3 enum", () => {
    const before = "";
    const after = "enum Color:\n  case Red, Green, Blue";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Color" }]);
  });

  it("detects lazy val", () => {
    const before = "";
    const after = "lazy val config: Config = loadConfig()";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "config" }]);
  });

  it("does not detect class members as top-level exports", () => {
    const before = "";
    const after = "class Outer {\n  def inner(): Int = 1\n  val x = 2\n}";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Outer" }]);
  });
});
