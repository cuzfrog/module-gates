import { describe, it, expect } from "vitest";
import { getChecker } from "./registry.ts";
import "./rust.ts";

describe("Rust export checker", () => {
  const checker = getChecker("/file.rs")!;

  it("detects new pub fn", () => {
    const before = "";
    const after = "pub fn hello() {}";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "pub", name: "hello" }]);
  });

  it("detects new pub struct", () => {
    const before = "";
    const after = "pub struct Config {}";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "pub", name: "Config" }]);
  });

  it("detects new pub enum", () => {
    const before = "";
    const after = "pub enum Status { Active, Inactive }";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "pub", name: "Status" }]);
  });

  it("detects new pub trait", () => {
    const before = "";
    const after = "pub trait Drawable { fn draw(&self); }";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "pub", name: "Drawable" }]);
  });

  it("detects new pub type", () => {
    const before = "";
    const after = "pub type Result<T> = std::result::Result<T, Error>;";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "pub", name: "Result" }]);
  });

  it("detects new pub const", () => {
    const before = "";
    const after = "pub const MAX: u32 = 100;";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "pub", name: "MAX" }]);
  });

  it("detects new pub mod", () => {
    const before = "";
    const after = "pub mod utils;";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "pub", name: "utils" }]);
  });

  it("handles pub(crate) modifier", () => {
    const before = "";
    const after = "pub(crate) fn internal_fn() {}";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "pub(crate)", name: "internal_fn" }]);
  });

  it("handles pub(super) modifier", () => {
    const before = "";
    const after = "pub(super) struct ParentVisible {}";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "pub(super)", name: "ParentVisible" }]);
  });

  it("returns empty when no new exports", () => {
    const code = "pub fn existing() {}\npub struct Config {}";
    expect(checker.getNewExports(code, code)).toEqual([]);
  });

  it("detects multiple new exports", () => {
    const before = "pub fn existing() {}";
    const after =
      "pub fn existing() {}\npub fn new_fn() {}\npub struct NewStruct {}";
    expect(checker.getNewExports(before, after)).toEqual([
      { modifier: "pub", name: "new_fn" },
      { modifier: "pub", name: "NewStruct" },
    ]);
  });

  it("does not detect private fn", () => {
    const before = "";
    const after = "fn private_helper() {}";
    expect(checker.getNewExports(before, after)).toEqual([]);
  });

  it("detects new pub use re-export", () => {
    const before = "";
    const after = "pub use crate::inner::Foo;";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "pub", name: "Foo" }]);
  });

  it("detects new pub use with nested path", () => {
    const before = "";
    const after = "pub use crate::a::b::Bar;";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "pub", name: "Bar" }]);
  });

  it("detects new pub use from external crate", () => {
    const before = "";
    const after = "pub use external_crate::Item;";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "pub", name: "Item" }]);
  });

  it("detects new pub use with as rename", () => {
    const before = "";
    const after = "pub use crate::inner::Foo as Bar;";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "pub", name: "Bar" }]);
  });

  it("detects new pub use with grouped re-exports", () => {
    const before = "";
    const after = "pub use crate::inner::{A, B, C};";
    expect(checker.getNewExports(before, after)).toEqual([
      { modifier: "pub", name: "A" },
      { modifier: "pub", name: "B" },
      { modifier: "pub", name: "C" },
    ]);
  });

  it("detects new pub use with mixed rename and plain in a group", () => {
    const before = "";
    const after = "pub use crate::inner::{A, B as Renamed, C};";
    expect(checker.getNewExports(before, after)).toEqual([
      { modifier: "pub", name: "A" },
      { modifier: "pub", name: "Renamed" },
      { modifier: "pub", name: "C" },
    ]);
  });

  it("ignores glob re-export names (no concrete new name)", () => {
    const before = "";
    const after = "pub use crate::inner::*;";
    expect(checker.getNewExports(before, after)).toEqual([]);
  });

  it("ignores private (non-pub) use", () => {
    const before = "";
    const after = "use crate::inner::Foo;";
    expect(checker.getNewExports(before, after)).toEqual([]);
  });

  it("handles pub(crate) use modifier", () => {
    const before = "";
    const after = "pub(crate) use crate::inner::Foo;";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "pub(crate)", name: "Foo" }]);
  });

  it("returns empty when re-export already exists", () => {
    const code = "pub use crate::inner::Foo;";
    expect(checker.getNewExports(code, code)).toEqual([]);
  });

  it("detects multiple new exports including pub use", () => {
    const before = "pub fn existing() {}";
    const after = [
      "pub fn existing() {}",
      "pub fn new_fn() {}",
      "pub use crate::inner::NewType;",
    ].join("\n");
    expect(checker.getNewExports(before, after)).toEqual([
      { modifier: "pub", name: "new_fn" },
      { modifier: "pub", name: "NewType" },
    ]);
  });

  it("detects new pub unsafe fn", () => {
    const before = "";
    const after = "pub unsafe fn danger() {}";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "pub", name: "danger" }]);
  });

  it("detects new pub async fn", () => {
    const before = "";
    const after = "pub async fn afn() {}";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "pub", name: "afn" }]);
  });

  it("detects new pub const fn (not the keyword 'fn' as name)", () => {
    const before = "";
    const after = "pub const fn cfn() {}";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "pub", name: "cfn" }]);
  });

  it("detects new pub const async fn in either order", () => {
    const before = "";
    const after1 = "pub const async fn acfn() {}";
    const after2 = "pub async const fn acfn() {}";
    expect(checker.getNewExports(before, after1)).toEqual([{ modifier: "pub", name: "acfn" }]);
    expect(checker.getNewExports(before, after2)).toEqual([{ modifier: "pub", name: "acfn" }]);
  });

  it("detects new pub static", () => {
    const before = "";
    const after = "pub static FOO: u32 = 0;";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "pub", name: "FOO" }]);
  });

  it("detects new pub unsafe extern fn", () => {
    const before = "";
    const after = 'pub unsafe extern "C" fn c_abi() {}';
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "pub", name: "c_abi" }]);
  });

  it("resolves pub use foo::{self} to the module name", () => {
    const before = "";
    const after = "pub use crate::foo::{self};";
    expect(checker.getNewExports(before, after)).toEqual([{ modifier: "pub", name: "foo" }]);
  });

  it("resolves pub use foo::{bar, self} mixing self with items", () => {
    const before = "";
    const after = "pub use crate::foo::{bar, self};";
    expect(checker.getNewExports(before, after)).toEqual([
      { modifier: "pub", name: "bar" },
      { modifier: "pub", name: "foo" },
    ]);
  });
});
