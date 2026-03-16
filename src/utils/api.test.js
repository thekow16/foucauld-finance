// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { classifyError } from "./api";

describe("classifyError", () => {
  it("returns offline message when navigator.onLine is false", () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    expect(classifyError(new Error("anything"))).toContain("hors ligne");
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  });

  it("returns timeout message for timeout errors", () => {
    expect(classifyError(new Error("timeout"))).toContain("trop de temps");
    expect(classifyError(new Error("AbortError: signal timed out"))).toContain("trop de temps");
  });

  it("returns network message for fetch failures", () => {
    expect(classifyError(new Error("Failed to fetch"))).toContain("réseau");
    expect(classifyError(new Error("NetworkError when attempting..."))).toContain("réseau");
  });

  it("returns proxy message for proxy failures", () => {
    expect(classifyError(new Error("Impossible de contacter Yahoo Finance."))).toContain("proxies");
  });

  it("returns rate limit message for 429 errors", () => {
    expect(classifyError(new Error("Rate limit serveur dépassé"))).toContain("requêtes");
    expect(classifyError(new Error("HTTP 429"))).toContain("requêtes");
  });

  it("returns original message for unknown errors", () => {
    expect(classifyError(new Error("Something weird"))).toBe("Something weird");
  });

  it("returns generic message for empty error", () => {
    expect(classifyError(new Error(""))).toBe("Erreur inconnue.");
    expect(classifyError(null)).toBe("Erreur inconnue.");
    expect(classifyError({})).toBe("Erreur inconnue.");
  });
});
