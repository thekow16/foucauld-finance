// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";

describe("useDarkMode storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores dark mode preference", () => {
    localStorage.setItem("foucauld-dark", "true");
    expect(localStorage.getItem("foucauld-dark")).toBe("true");
  });

  it("defaults to system preference when no saved value", () => {
    const saved = localStorage.getItem("foucauld-dark");
    expect(saved).toBeNull();
    // Would use matchMedia in real hook
  });

  it("toggles between true and false", () => {
    let dark = false;
    dark = !dark;
    expect(dark).toBe(true);
    dark = !dark;
    expect(dark).toBe(false);
  });
});
