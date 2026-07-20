import { describe, it, expect } from "vitest";
import { getChecker } from "./registry.ts";
import "./java.ts";

describe("Java export checker", () => {
  const checker = getChecker("/file.java")!;

  it("detects new public class", () => {
    const before = "";
    const after = "public class Hello {}";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "public", name: "Hello" }]);
  });

  it("detects new public interface", () => {
    const before = "";
    const after = "public interface Greeter {}";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "public", name: "Greeter" }]);
  });

  it("detects new public enum", () => {
    const before = "";
    const after = "public enum Status { ACTIVE, INACTIVE }";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "public", name: "Status" }]);
  });

  it("detects new public @interface (annotation)", () => {
    const before = "";
    const after = "public @interface MyAnnotation {}";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "public", name: "MyAnnotation" }]);
  });

  it("detects new public record", () => {
    const before = "";
    const after = "public record Point(int x, int y) {}";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "public", name: "Point" }]);
  });

  it("does not detect package-private class", () => {
    const before = "";
    const after = "class PackagePrivate {}";
    expect(checker.getNewExports(before, after)).toEqual([]);
  });

  it("returns empty when no new exports", () => {
    const code = "public class Existing {}\npublic interface Service {}";
    expect(checker.getNewExports(code, code)).toEqual([]);
  });

  it("detects multiple new exports", () => {
    const before = "public class Existing {}";
    const after = "public class Existing {}\npublic class NewOne {}\npublic interface NewTwo {}";
    expect(checker.getNewExports(before, after)).toEqual([
      { modifier: "public", name: "NewOne" },
      { modifier: "public", name: "NewTwo" },
    ]);
  });

  it("only reports exports that are genuinely new", () => {
    const before = "public class Keep {}\npublic interface Config {}";
    const after = "public class Keep {}\npublic interface Config {}\npublic record Entry(int id) {}";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "public", name: "Entry" }]);
  });

  it("handles public class with extends and implements", () => {
    const before = "";
    const after = "public class MyList extends AbstractList implements Serializable {}";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "public", name: "MyList" }]);
  });

  it("detects public final class", () => {
    const before = "";
    const after = "public final class Constants {}";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "public", name: "Constants" }]);
  });

  it("detects public abstract class", () => {
    const before = "";
    const after = "public abstract class Shape {}";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "public", name: "Shape" }]);
  });

  it("detects public sealed class with permits", () => {
    const before = "";
    const after = "public sealed class Polygon permits Triangle, Square {}";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "public", name: "Polygon" }]);
  });

  it("detects public static nested class", () => {
    const before = "";
    const after = "public static class Nested {}";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "public", name: "Nested" }]);
  });

  it("detects public class with leading annotation", () => {
    const before = "";
    const after = "@Deprecated\npublic class Legacy {}";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "public", name: "Legacy" }]);
  });
});
