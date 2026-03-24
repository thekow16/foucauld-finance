// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { exportTableToCsv } from "./exportCsv";

describe("exportTableToCsv", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("does nothing when data is empty", () => {
    const spy = vi.spyOn(document, "createElement");
    exportTableToCsv([], [], v => v, "test");
    expect(spy).not.toHaveBeenCalled();
  });

  it("does nothing when data is null", () => {
    const spy = vi.spyOn(document, "createElement");
    exportTableToCsv(null, [], v => v, "test");
    expect(spy).not.toHaveBeenCalled();
  });

  it("creates a CSV with correct header and rows", () => {
    const mockClick = vi.fn();
    const mockAppendChild = vi.spyOn(document.body, "appendChild").mockImplementation(() => {});
    const mockRemoveChild = vi.spyOn(document.body, "removeChild").mockImplementation(() => {});

    const createObjectURL = vi.fn(() => "blob:test");
    const revokeObjectURL = vi.fn();
    globalThis.URL.createObjectURL = createObjectURL;
    globalThis.URL.revokeObjectURL = revokeObjectURL;

    const data = [
      { calendarYear: "2023", revenue: 1000, netIncome: 200 },
      { calendarYear: "2022", revenue: 800, netIncome: 150 },
    ];
    const rows = [
      ["Chiffre d'affaires", "revenue"],
      ["Résultat net", "netIncome"],
    ];
    const formatter = v => v != null ? String(v) : "—";

    exportTableToCsv(data, rows, formatter, "test-export");

    expect(createObjectURL).toHaveBeenCalledOnce();
    const blobArg = createObjectURL.mock.calls[0][0];
    expect(blobArg).toBeInstanceOf(Blob);

    expect(mockAppendChild).toHaveBeenCalledOnce();
    const anchor = mockAppendChild.mock.calls[0][0];
    expect(anchor.download).toBe("test-export.csv");

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });

  it("supports computed keys (functions)", () => {
    const createObjectURL = vi.fn(() => "blob:test");
    const revokeObjectURL = vi.fn();
    globalThis.URL.createObjectURL = createObjectURL;
    globalThis.URL.revokeObjectURL = revokeObjectURL;
    vi.spyOn(document.body, "appendChild").mockImplementation(() => {});
    vi.spyOn(document.body, "removeChild").mockImplementation(() => {});

    const data = [{ revenue: 100, cost: 40 }];
    const rows = [
      ["Marge", d => d.revenue - d.cost],
    ];

    exportTableToCsv(data, rows, v => String(v), "computed");
    expect(createObjectURL).toHaveBeenCalledOnce();
  });
});
