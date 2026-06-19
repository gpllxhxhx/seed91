import { describe, expect, it } from "vitest";
import { renderApp } from "./App";

describe("renderApp", () => {
  it("returns the desktop startup message", () => {
    expect(renderApp()).toContain("Music Pet Desktop Started");
  });
});
