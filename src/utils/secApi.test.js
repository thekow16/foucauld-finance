import { describe, it, expect } from "vitest";
import { parseSecFacts } from "./secApi";

// Construit un concept XBRL companyfacts avec des entrées annuelles (10-K, FY)
function concept(unit, byYear) {
  return {
    units: {
      [unit]: Object.entries(byYear).map(([fy, val]) => ({
        fy: Number(fy),
        fp: "FY",
        form: "10-K",
        filed: `${Number(fy) + 1}-02-15`,
        end: `${fy}-12-31`,
        val,
      })),
    },
  };
}

describe("parseSecFacts — couverture des tags Verizon", () => {
  // Verizon tague le capex sous PaymentsToAcquireProductiveAssets (et non
  // PaymentsToAcquirePropertyPlantAndEquipment), et la dette en non-courant + courant.
  const gaap = {
    Revenues: concept("USD", { 2018: 130863e6, 2019: 131868e6, 2020: 128292e6 }),
    NetCashProvidedByUsedInOperatingActivities: concept("USD", { 2018: 34339e6, 2019: 35746e6, 2020: 41768e6 }),
    PaymentsToAcquireProductiveAssets: concept("USD", { 2018: 16658e6, 2019: 17939e6, 2020: 18192e6 }),
    ShareBasedCompensation: concept("USD", { 2018: 500e6, 2019: 520e6, 2020: 540e6 }),
    LongTermDebtNoncurrent: concept("USD", { 2018: 105873e6, 2019: 100712e6, 2020: 123173e6 }),
    LongTermDebtCurrent: concept("USD", { 2018: 7190e6, 2019: 10777e6, 2020: 5891e6 }),
    Assets: concept("USD", { 2018: 264829e6, 2019: 291727e6, 2020: 316481e6 }),
  };

  const parsed = parseSecFacts(gaap, { gaap });

  it("calcule le free cash flow à partir du capex télécom (PaymentsToAcquireProductiveAssets)", () => {
    const cf2020 = parsed.cashflow.find((d) => d.calendarYear === "2020");
    expect(cf2020.freeCashFlow).toBe(41768e6 - 18192e6);
    // tous les exercices doivent avoir un FCF, pas seulement les récents
    expect(parsed.cashflow.every((d) => d.freeCashFlow != null)).toBe(true);
  });

  it("additionne dette non-courante et courante quand aucun total direct n'existe", () => {
    const bs2020 = parsed.balance.find((d) => d.calendarYear === "2020");
    expect(bs2020.totalDebt).toBe(123173e6 + 5891e6);
  });

  it("remonte la SBC pour tous les exercices", () => {
    expect(parsed.cashflow.every((d) => d.stockBasedCompensation != null)).toBe(true);
  });

  it("préfère un total de dette direct quand il est présent", () => {
    const withTotal = {
      LongTermDebt: concept("USD", { 2020: 130000e6 }),
      LongTermDebtNoncurrent: concept("USD", { 2020: 123173e6 }),
      LongTermDebtCurrent: concept("USD", { 2020: 5891e6 }),
    };
    const p = parseSecFacts(withTotal, { gaap: withTotal });
    expect(p.balance.find((d) => d.calendarYear === "2020").totalDebt).toBe(130000e6);
  });

  it("retourne null quand aucune donnée exploitable", () => {
    expect(parseSecFacts({}, { gaap: {} })).toBeNull();
    expect(parseSecFacts(null)).toBeNull();
  });
});
