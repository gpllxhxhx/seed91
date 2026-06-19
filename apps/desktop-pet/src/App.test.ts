import { describe, expect, it } from "vitest";
import { renderApp } from "./App";

describe("renderApp", () => {
  it("renders the pet surface and placeholder image", () => {
    const markup = renderApp();

    expect(markup).toContain("data-pet-surface");
    expect(markup).toContain("pet-placeholder.svg");
  });
});
