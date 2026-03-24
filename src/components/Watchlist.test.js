// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import Watchlist from "./Watchlist";

describe("Watchlist", () => {
  it("renders nothing when watchlist is empty", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => { root.render(createElement(Watchlist, { watchlist: [], onSelect: vi.fn(), onRemove: vi.fn() })); });
    expect(container.innerHTML).toBe("");
    root.unmount();
  });

  it("renders watchlist items", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const watchlist = [
      { symbol: "AAPL", name: "Apple" },
      { symbol: "TSLA", name: "Tesla" },
    ];
    act(() => { root.render(createElement(Watchlist, { watchlist, onSelect: vi.fn(), onRemove: vi.fn() })); });
    expect(container.textContent).toContain("AAPL");
    expect(container.textContent).toContain("Apple");
    expect(container.textContent).toContain("TSLA");
    expect(container.textContent).toContain("Tesla");
    root.unmount();
  });

  it("calls onSelect when clicking a watchlist item", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onSelect = vi.fn();
    const watchlist = [{ symbol: "AAPL", name: "Apple" }];
    act(() => { root.render(createElement(Watchlist, { watchlist, onSelect, onRemove: vi.fn() })); });
    const btn = container.querySelector(".watchlist-item-btn");
    act(() => { btn.click(); });
    expect(onSelect).toHaveBeenCalledWith("AAPL");
    root.unmount();
  });

  it("calls onRemove when clicking remove button", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onRemove = vi.fn();
    const watchlist = [{ symbol: "MSFT", name: "Microsoft" }];
    act(() => { root.render(createElement(Watchlist, { watchlist, onSelect: vi.fn(), onRemove })); });
    const btn = container.querySelector(".wl-remove");
    act(() => { btn.click(); });
    expect(onRemove).toHaveBeenCalledWith("MSFT");
    root.unmount();
  });
});
