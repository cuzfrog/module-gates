import { describe, it, expect } from "vitest";
import { getChecker } from "./registry.ts";
import "./go.ts";

describe("Go export checker", () => {
  const checker = getChecker("/file.go")!;

  it("detects new exported func", () => {
    const before = "";
    const after = "func Hello() {}";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Hello" }]);
  });

  it("detects new exported type struct", () => {
    const before = "";
    const after = "type Config struct { Port int }";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Config" }]);
  });

  it("detects new exported type interface", () => {
    const before = "";
    const after = "type Handler interface { Serve() error }";
    expect(checker.getNewExports(before, after)).toEqual([
      { name: "Handler" },
      { name: "Serve" },
    ]);
  });

  it("detects new exported type alias", () => {
    const before = "";
    const after = "type Stringer = fmt.Stringer";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Stringer" }]);
  });

  it("detects new exported var", () => {
    const before = "";
    const after = "var MaxRetries = 3";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "MaxRetries" }]);
  });

  it("detects new exported const", () => {
    const before = "";
    const after = "const Timeout = 30 * time.Second";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Timeout" }]);
  });

  it("does not detect unexported func (lowercase)", () => {
    const before = "";
    const after = "func helper() {}";
    expect(checker.getNewExports(before, after)).toEqual([]);
  });

  it("does not detect unexported type (lowercase)", () => {
    const before = "";
    const after = "type internal struct {}";
    expect(checker.getNewExports(before, after)).toEqual([]);
  });

  it("detects method with receiver", () => {
    const before = "";
    const after = "func (s *Server) Start() error { return nil }";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Start" }]);
  });

  it("detects method with value receiver", () => {
    const before = "";
    const after = "func (s Server) Stop() {}";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Stop" }]);
  });

  it("detects exported func with parameters and return type", () => {
    const before = "";
    const after = "func Process(input string, opts ...Option) (*Result, error) {}";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Process" }]);
  });

  it("returns empty when no new exports", () => {
    const code = "func Existing() {}\ntype Config struct {}";
    expect(checker.getNewExports(code, code)).toEqual([]);
  });

  it("detects multiple new exports", () => {
    const before = "func Existing() {}";
    const after = "func Existing() {}\nfunc NewOne() {}\ntype NewType struct {}";
    expect(checker.getNewExports(before, after)).toEqual([
      { name: "NewOne" },
      { name: "NewType" },
    ]);
  });

  it("only reports exports that are genuinely new", () => {
    const before = "func Keep() {}\ntype Config struct {}";
    const after = "func Keep() {}\ntype Config struct {}\nfunc Extra() {}";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "Extra" }]);
  });

  it("handles exported var with type annotation", () => {
    const before = "";
    const after = "var DefaultPort int = 8080";
    expect(checker.getNewExports(before, after)).toEqual([{ name: "DefaultPort" }]);
  });

  it("detects interface methods", () => {
    const before = "";
    const after = "type Reader interface {\n\tRead(p []byte) (int, error)\n\tClose() error\n}";
    expect(checker.getNewExports(before, after)).toEqual([
      { name: "Reader" },
      { name: "Read" },
      { name: "Close" },
    ]);
  });

  it("detects names inside grouped var block", () => {
    const before = "";
    const after = "var (\n\tFoo = 1\n\tBar = 2\n)";
    expect(checker.getNewExports(before, after)).toEqual([
      { name: "Foo" },
      { name: "Bar" },
    ]);
  });

  it("detects names inside grouped const block with iota", () => {
    const before = "";
    const after = "const (\n\tA = iota\n\tB\n\tC\n)";
    expect(checker.getNewExports(before, after)).toEqual([
      { name: "A" },
      { name: "B" },
      { name: "C" },
    ]);
  });
});
