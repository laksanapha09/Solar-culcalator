// Pure calculation helpers. PVGIS output scales linearly with system size,
// so we fetch the yield for 1 kWp once and scale it here.

export const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const YEARS = 25;
export const PANEL_KW = 0.55; // typical panel size today
export const PANEL_AREA = 2.6; // m² per panel, including spacing
const BATTERY_EFF = 0.9; // round-trip efficiency
const BATTERY_DOD = 0.9; // usable share of battery capacity

// Suggest a size: on-grid covers daytime use, hybrid covers all use.
export function suggestKwp({ yieldMonthly, monthlyKwh, dayShare, type }) {
  const annualYield = yieldMonthly.reduce((s, v) => s + v, 0);
  if (!annualYield || !monthlyKwh) return 0;
  const target = monthlyKwh * 12 * (type === "hybrid" ? 1 : dayShare);
  return Math.max(1, Math.round((target / annualYield) * 2) / 2);
}

// Suggest battery size: enough to cover an average night.
export function suggestBattery({ monthlyKwh, dayShare }) {
  const night = (monthlyKwh * 12 * (1 - dayShare)) / 365;
  return Math.max(2.5, Math.round((night / BATTERY_DOD) / 2.5) * 2.5);
}

// Energy flows for one year. degr = output factor for that year (1 = new).
export function yearEnergy({ yieldMonthly, kwp, monthlyKwh, dayShare, type, batteryKwh, degr = 1 }) {
  const months = yieldMonthly.map((y, i) => {
    const pv = y * kwp * degr;
    const use = monthlyKwh * (12 * DAYS[i]) / 365;
    const dayUse = use * dayShare;
    const nightUse = use - dayUse;
    const direct = Math.min(pv, dayUse);
    let surplus = pv - direct;
    let battery = 0;
    if (type === "hybrid" && batteryKwh > 0) {
      const maxOut = batteryKwh * BATTERY_DOD * DAYS[i];
      battery = Math.min(surplus * BATTERY_EFF, nightUse, maxOut);
      surplus -= battery / BATTERY_EFF;
    }
    const exported = Math.max(0, surplus);
    const grid = Math.max(0, use - direct - battery);
    return { month: i + 1, pv, use, direct, battery, exported, grid };
  });
  const sum = (k) => months.reduce((s, m) => s + m[k], 0);
  return {
    months,
    pv: sum("pv"),
    use: sum("use"),
    direct: sum("direct"),
    battery: sum("battery"),
    exported: sum("exported"),
    grid: sum("grid"),
  };
}

export function analyse(input) {
  const {
    kwp, type, batteryKwh, price, exportPrice, costPerKwp, batteryCostPerKwh,
    priceGrowth, degradation, maintenancePct, replaceYear, replaceCost,
  } = input;

  const pvCost = kwp * costPerKwp;
  const batteryCost = type === "hybrid" ? batteryKwh * batteryCostPerKwh : 0;
  const systemCost = pvCost + batteryCost;
  const maintenance = systemCost * (maintenancePct / 100);

  const first = yearEnergy({ ...input, batteryKwh: type === "hybrid" ? batteryKwh : 0, degr: 1 });

  let cumulative = -systemCost;
  let payback = null;
  const years = [{ year: 0, cumulative }];
  let totalSaving = 0;
  for (let y = 1; y <= YEARS; y++) {
    const e = y === 1 ? first : yearEnergy({
      ...input,
      batteryKwh: type === "hybrid" ? batteryKwh : 0,
      degr: Math.pow(1 - degradation / 100, y - 1),
    });
    const p = price * Math.pow(1 + priceGrowth / 100, y - 1);
    const saving = (e.direct + e.battery) * p + e.exported * exportPrice;
    const cost = maintenance + (y === replaceYear ? replaceCost : 0);
    const net = saving - cost;
    const before = cumulative;
    cumulative += net;
    totalSaving += saving;
    // Payback is the last time the total turns positive, so a later
    // replacement that dips it below zero again is counted.
    if (before < 0 && cumulative >= 0) payback = y - 1 + (-before / net);
    else if (cumulative < 0) payback = null;
    years.push({ year: y, cumulative, saving, cost });
  }

  const billBefore = first.use * price / 12;
  const billAfter = (first.grid * price - first.exported * exportPrice) / 12;

  return {
    systemCost, pvCost, batteryCost,
    energy: first,
    firstSaving: years[1].saving,
    payback,
    profit25: cumulative,
    roi: systemCost > 0 ? (cumulative / systemCost) * 100 : 0,
    totalSaving,
    years,
    selfUseShare: first.pv > 0 ? (first.direct + first.battery / BATTERY_EFF) / first.pv : 0,
    coverShare: first.use > 0 ? (first.direct + first.battery) / first.use : 0,
    billBefore,
    billAfter,
    panels: Math.ceil(kwp / PANEL_KW),
    roofArea: Math.ceil(kwp / PANEL_KW) * PANEL_AREA,
  };
}
