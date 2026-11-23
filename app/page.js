"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { analyse, suggestBattery, suggestKwp, PANEL_KW } from "@/lib/solar";
import { CashflowChart, EnergyChart, MONTHS, fmt } from "@/components/Charts";

const LocationMap = dynamic(() => import("@/components/LocationMap"), {
  ssr: false,
  loading: () => <div className="map map-loading">กำลังโหลดแผนที่...</div>,
});

const DEFAULTS = {
  name: "",
  lat: "13.75",
  lon: "100.50",
  usageMode: "bill",
  bill: "2500",
  units: "550",
  price: "4.5",
  dayShare: 50,
  type: "ongrid",
  kwp: "5",
  batteryKwh: "10",
  angle: "15",
  aspect: "0",
  loss: "14",
  costPerKwp: "30000",
  batteryCostPerKwh: "12000",
  exportPrice: "2.2",
  priceGrowth: "2",
  degradation: "0.5",
  maintenancePct: "1",
  replaceYear: "12",
};

const DAY_PRESETS = [
  { value: 30, label: "ออกไปทำงานกลางวัน" },
  { value: 50, label: "ครึ่งๆ" },
  { value: 70, label: "อยู่บ้าน/เปิดร้านกลางวัน" },
];

const DIRECTIONS = [
  { value: "0", label: "ใต้" },
  { value: "-90", label: "ตะวันออก" },
  { value: "90", label: "ตะวันตก" },
  { value: "180", label: "เหนือ" },
];

function SunIcon({ size = 56 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="13" fill="currentColor" />
      {Array.from({ length: 8 }).map((_, i) => (
        <rect key={i} x="30" y="4" width="4" height="11" rx="2" fill="currentColor"
          transform={`rotate(${i * 45} 32 32)`} />
      ))}
    </svg>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

function Segmented({ value, options, onChange, label }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={String(value) === String(o.value)}
          className={String(value) === String(o.value) ? "on" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.title ? <><b>{o.title}</b><span>{o.label}</span></> : o.label}
        </button>
      ))}
    </div>
  );
}

const n = (v) => Number(v) || 0;
const siteKey = (f) => [f.lat, f.lon, f.angle, f.aspect, f.loss].join("|");

export default function Home() {
  const [f, setF] = useState(DEFAULTS);
  const [kwpAuto, setKwpAuto] = useState(true);
  const [batteryAuto, setBatteryAuto] = useState(true);
  const [site, setSite] = useState(null); // { key, monthly: kWh per kWp }
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState({ configured: false, rows: [] });
  const [saveMsg, setSaveMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const setVal = (k, v) => setF((p) => ({ ...p, [k]: v }));

  async function loadHistory() {
    try {
      const res = await fetch("/api/calculations", { cache: "no-store" });
      setHistory(await res.json());
    } catch {
      setHistory({ configured: false, rows: [] });
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  function useMyLocation() {
    if (!navigator.geolocation) return setError("เบราว์เซอร์นี้หาตำแหน่งไม่ได้");
    navigator.geolocation.getCurrentPosition(
      (pos) => setF((p) => ({ ...p, lat: pos.coords.latitude.toFixed(4), lon: pos.coords.longitude.toFixed(4) })),
      () => setError("ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง")
    );
  }

  // Monthly use in kWh, from the bill or entered directly.
  const monthlyKwh = f.usageMode === "bill" ? (n(f.price) > 0 ? n(f.bill) / n(f.price) : 0) : n(f.units);
  const dayShare = n(f.dayShare) / 100;

  const suggested = useMemo(() => {
    if (!site) return null;
    return {
      kwp: suggestKwp({ yieldMonthly: site.monthly, monthlyKwh, dayShare, type: f.type }),
      battery: suggestBattery({ monthlyKwh, dayShare }),
    };
  }, [site, monthlyKwh, dayShare, f.type]);

  const kwp = kwpAuto && suggested ? suggested.kwp : n(f.kwp);
  const batteryKwh = batteryAuto && suggested ? suggested.battery : n(f.batteryKwh);

  const result = useMemo(() => {
    if (!site || kwp <= 0 || monthlyKwh <= 0) return null;
    const batteryCost = f.type === "hybrid" ? batteryKwh * n(f.batteryCostPerKwh) : 0;
    // Inverter replacement, plus a battery replacement at a lower future price.
    const replaceCost = kwp * 3000 + batteryCost * 0.6;
    return analyse({
      yieldMonthly: site.monthly,
      kwp,
      type: f.type,
      batteryKwh,
      monthlyKwh,
      dayShare,
      price: n(f.price),
      exportPrice: n(f.exportPrice),
      costPerKwp: n(f.costPerKwp),
      batteryCostPerKwh: n(f.batteryCostPerKwh),
      priceGrowth: n(f.priceGrowth),
      degradation: n(f.degradation),
      maintenancePct: n(f.maintenancePct),
      replaceYear: n(f.replaceYear),
      replaceCost,
    });
  }, [site, kwp, batteryKwh, monthlyKwh, dayShare, f]);

  const stale = site && site.key !== siteKey(f);

  async function calculate(e) {
    e?.preventDefault();
    setError("");
    setSaveMsg("");
    setLoading(true);
    try {
      const qs = new URLSearchParams({ lat: f.lat, lon: f.lon, kwp: "1", angle: f.angle, aspect: f.aspect, loss: f.loss });
      const res = await fetch(`/api/pvgis?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "คำนวณไม่สำเร็จ");
      const monthly = Array.from({ length: 12 }, (_, i) => data.monthly.find((m) => m.month === i + 1)?.kwh ?? 0);
      setSite({ key: siteKey(f), monthly });
      setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaveMsg("");
    setSaving(true);
    const res = await fetch("/api/calculations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: f.name || (f.type === "hybrid" ? "Hybrid" : "On-grid"),
        lat: f.lat, lon: f.lon, kwp,
        annual_kwh: result.energy.pv,
        system_cost: result.systemCost,
        yearly_saving: result.firstSaving,
        payback_years: result.payback,
      }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setSaving(false);
    setSaveMsg(res?.ok ? "บันทึกแล้ว ✓" : data.error || "บันทึกไม่สำเร็จ");
    if (res?.ok) loadHistory();
  }

  const r = result;

  return (
    <>
      <header className="hero">
        <div className="hero-inner">
          <div className="sun"><SunIcon /></div>
          <div>
            <h1>คำนวณโซลาร์เซลล์</h1>
            <p>บอกค่าไฟของคุณ แล้วรู้ว่าควรติดกี่ kWp ประหยัดได้เท่าไร และคืนทุนเมื่อไร</p>
          </div>
        </div>
      </header>

      <main>
        <form onSubmit={calculate} className="card form">
          <section className="group">
            <h2><span className="badge">1</span>ตำแหน่งที่ติดตั้ง</h2>
            <LocationMap
              lat={n(f.lat)}
              lon={n(f.lon)}
              onPick={(la, lo) => setF((p) => ({ ...p, lat: la.toFixed(4), lon: lo.toFixed(4) }))}
            />
            <span className="field-hint">แตะบนแผนที่เพื่อเลือกตำแหน่ง</span>
            <div className="row">
              <Field label="ละติจูด">
                <input type="number" step="any" required value={f.lat} onChange={set("lat")} />
              </Field>
              <Field label="ลองจิจูด">
                <input type="number" step="any" required value={f.lon} onChange={set("lon")} />
              </Field>
            </div>
            <div className="row">
              <button type="button" className="ghost" onClick={useMyLocation}>📍 ใช้ตำแหน่งปัจจุบันของฉัน</button>
              <Field label="ชื่อโครงการ (ไม่บังคับ)">
                <input value={f.name} onChange={set("name")} placeholder="เช่น บ้านที่เชียงใหม่" />
              </Field>
            </div>
          </section>

          <section className="group">
            <h2><span className="badge">2</span>การใช้ไฟของคุณ</h2>
            <Segmented
              label="กรอกเป็น"
              value={f.usageMode}
              onChange={(v) => setVal("usageMode", v)}
              options={[{ value: "bill", label: "ค่าไฟต่อเดือน (บาท)" }, { value: "units", label: "หน่วยไฟต่อเดือน (kWh)" }]}
            />
            <div className="row">
              {f.usageMode === "bill" ? (
                <Field label="ค่าไฟต่อเดือน (บาท)" hint={`ประมาณ ${fmt(monthlyKwh)} หน่วยต่อเดือน`}>
                  <input type="number" min="0" step="any" required value={f.bill} onChange={set("bill")} />
                </Field>
              ) : (
                <Field label="หน่วยไฟต่อเดือน (kWh)" hint={`ประมาณ ${fmt(monthlyKwh * n(f.price))} บาทต่อเดือน`}>
                  <input type="number" min="0" step="any" required value={f.units} onChange={set("units")} />
                </Field>
              )}
              <Field label="ค่าไฟเฉลี่ย (บาท/หน่วย)" hint="รวมค่า Ft และ VAT แล้ว">
                <input type="number" min="0" step="any" required value={f.price} onChange={set("price")} />
              </Field>
            </div>
            <div className="field">
              <span className="field-label">ใช้ไฟตอนกลางวัน (มีแดด) ประมาณ {f.dayShare}%</span>
              <div className="chips">
                {DAY_PRESETS.map((p) => (
                  <button key={p.value} type="button"
                    className={`chip${Number(f.dayShare) === p.value ? " on" : ""}`}
                    onClick={() => setVal("dayShare", p.value)}>
                    {p.label} {p.value}%
                  </button>
                ))}
              </div>
              <input type="range" min="10" max="90" step="5" value={f.dayShare}
                onChange={(e) => setVal("dayShare", Number(e.target.value))} aria-label="สัดส่วนการใช้ไฟกลางวัน" />
              <span className="field-hint">ไฟที่ผลิตได้จะคุ้มที่สุดเมื่อใช้เองตอนกลางวัน ส่วนที่เหลือจะขายคืนได้ในราคาที่ต่ำกว่า</span>
            </div>
          </section>

          <section className="group">
            <h2><span className="badge">3</span>ระบบโซลาร์</h2>
            <Segmented
              label="ประเภทระบบ"
              value={f.type}
              onChange={(v) => setVal("type", v)}
              options={[
                { value: "ongrid", title: "On-grid", label: "ใช้กลางวัน ขายไฟส่วนเกิน" },
                { value: "hybrid", title: "Hybrid", label: "มีแบตเตอรี่ เก็บไว้ใช้กลางคืน" },
              ]}
            />
            <div className="row">
              <Field
                label="ขนาดระบบ (kWp)"
                hint={suggested
                  ? (kwpAuto ? `ใช้ขนาดที่แนะนำ (ประมาณ ${Math.ceil(kwp / PANEL_KW)} แผง)` : `ขนาดที่แนะนำ ${fmt(suggested.kwp, 1)} kWp`)
                  : "กดคำนวณเพื่อดูขนาดที่แนะนำ"}
              >
                <input type="number" step="0.5" min="0.5" required
                  value={kwpAuto && suggested ? suggested.kwp : f.kwp}
                  onChange={(e) => { setKwpAuto(false); setVal("kwp", e.target.value); }} />
              </Field>
              {f.type === "hybrid" && (
                <Field
                  label="แบตเตอรี่ (kWh)"
                  hint={suggested
                    ? (batteryAuto ? "ขนาดที่แนะนำ พอใช้ช่วงกลางคืน" : `ขนาดที่แนะนำ ${fmt(suggested.battery, 1)} kWh`)
                    : "กดคำนวณเพื่อดูขนาดที่แนะนำ"}
                >
                  <input type="number" step="0.5" min="0" required
                    value={batteryAuto && suggested ? suggested.battery : f.batteryKwh}
                    onChange={(e) => { setBatteryAuto(false); setVal("batteryKwh", e.target.value); }} />
                </Field>
              )}
            </div>
            {suggested && (!kwpAuto || (f.type === "hybrid" && !batteryAuto)) && (
              <button type="button" className="link" onClick={() => { setKwpAuto(true); setBatteryAuto(true); }}>
                ↺ กลับไปใช้ขนาดที่แนะนำ
              </button>
            )}
            <div className="field">
              <span className="field-label">ทิศที่แผงหันไป</span>
              <Segmented label="ทิศ" value={f.aspect} onChange={(v) => setVal("aspect", v)} options={DIRECTIONS} />
            </div>
            <details className="more">
              <summary>ตั้งค่าเพิ่มเติม (มุมเอียง, การสูญเสีย)</summary>
              <div className="row">
                <Field label="มุมเอียงแผง (องศา)" hint="หลังคาบ้านในไทยมักเอียง 10 ถึง 20 องศา">
                  <input type="number" min="0" max="90" required value={f.angle} onChange={set("angle")} />
                </Field>
                <Field label="การสูญเสียของระบบ (%)" hint="สายไฟ อินเวอร์เตอร์ ฝุ่น ค่าปกติ 14%">
                  <input type="number" min="0" max="100" required value={f.loss} onChange={set("loss")} />
                </Field>
              </div>
            </details>
          </section>

          <section className="group">
            <h2><span className="badge">4</span>ราคาและการเงิน</h2>
            <div className="row">
              <Field label="ราคาติดตั้งแผง (บาท/kWp)" hint="รวมแผง อินเวอร์เตอร์ และค่าแรง">
                <input type="number" min="0" step="any" required value={f.costPerKwp} onChange={set("costPerKwp")} />
              </Field>
              <Field label="ราคาขายไฟคืน (บาท/หน่วย)" hint="ตรวจอัตราปัจจุบันกับการไฟฟ้าในพื้นที่">
                <input type="number" min="0" step="any" required value={f.exportPrice} onChange={set("exportPrice")} />
              </Field>
            </div>
            {f.type === "hybrid" && (
              <div className="row">
                <Field label="ราคาแบตเตอรี่ (บาท/kWh)">
                  <input type="number" min="0" step="any" required value={f.batteryCostPerKwh} onChange={set("batteryCostPerKwh")} />
                </Field>
              </div>
            )}
            <details className="more">
              <summary>สมมติฐานระยะยาว 25 ปี</summary>
              <div className="row">
                <Field label="ค่าไฟขึ้นปีละ (%)">
                  <input type="number" min="0" step="any" value={f.priceGrowth} onChange={set("priceGrowth")} />
                </Field>
                <Field label="แผงเสื่อมปีละ (%)">
                  <input type="number" min="0" step="any" value={f.degradation} onChange={set("degradation")} />
                </Field>
              </div>
              <div className="row">
                <Field label="ค่าบำรุงรักษาต่อปี (% ของค่าติดตั้ง)">
                  <input type="number" min="0" step="any" value={f.maintenancePct} onChange={set("maintenancePct")} />
                </Field>
                <Field label="เปลี่ยนอินเวอร์เตอร์/แบตเตอรี่ในปีที่" hint="ใช้ราคาประมาณ 3,000 บาท/kWp และ 60% ของราคาแบตเตอรี่">
                  <input type="number" min="1" max="25" value={f.replaceYear} onChange={set("replaceYear")} />
                </Field>
              </div>
            </details>
          </section>

          <button type="submit" className="primary" disabled={loading}>
            {loading ? <><span className="spinner" /> กำลังดึงข้อมูลแสงแดด...</> : site ? "☀️ คำนวณใหม่" : "☀️ คำนวณ"}
          </button>
        </form>

        {error && <p className="alert" role="alert">{error}</p>}
        {stale && !loading && (
          <p className="notice">คุณเปลี่ยนตำแหน่งหรือทิศของแผง กด “คำนวณใหม่” เพื่ออัปเดตข้อมูลแสงแดด</p>
        )}

        {r && (
          <section id="results" className="card results">
            <div className="payback">
              <div>
                <span>คืนทุนภายใน</span>
                <strong>{r.payback !== null ? fmt(r.payback, 1) : "เกิน 25"}</strong>
                <span>ปี</span>
              </div>
              <p>
                ระบบ {f.type === "hybrid" ? "Hybrid" : "On-grid"} {fmt(kwp, 1)} kWp
                {f.type === "hybrid" && <> + แบตเตอรี่ {fmt(batteryKwh, 1)} kWh</>} ·
                กำไรสุทธิ 25 ปี <b className={r.profit25 >= 0 ? "pos" : "neg"}>{fmt(r.profit25)} บาท</b>
              </p>
            </div>

            <div className="bill">
              <div>
                <span className="stat-label">ค่าไฟต่อเดือนตอนนี้</span>
                <strong>{fmt(r.billBefore)} <small>บาท</small></strong>
              </div>
              <div className="arrow" aria-hidden="true">→</div>
              <div>
                <span className="stat-label">หลังติดโซลาร์ (เฉลี่ยปีแรก)</span>
                <strong className="pos">{fmt(Math.max(r.billAfter, 0))} <small>บาท</small></strong>
                {r.billAfter < 0 && <span className="field-hint">ได้เงินจากการขายไฟเกินค่าไฟ</span>}
              </div>
            </div>

            <div className="stats">
              <div className="stat">
                <span className="stat-icon">🔆</span>
                <span className="stat-label">จำนวนแผง</span>
                <strong>{fmt(r.panels)} <small>แผง · ~{fmt(r.roofArea)} ตร.ม.</small></strong>
              </div>
              <div className="stat">
                <span className="stat-icon">🏗️</span>
                <span className="stat-label">ค่าติดตั้ง</span>
                <strong>{fmt(r.systemCost)} <small>บาท</small></strong>
              </div>
              <div className="stat">
                <span className="stat-icon">💰</span>
                <span className="stat-label">ประหยัดปีแรก</span>
                <strong>{fmt(r.firstSaving)} <small>บาท</small></strong>
              </div>
              <div className="stat">
                <span className="stat-icon">⚡</span>
                <span className="stat-label">ผลิตไฟต่อปี</span>
                <strong>{fmt(r.energy.pv)} <small>kWh</small></strong>
              </div>
              <div className="stat">
                <span className="stat-icon">🏠</span>
                <span className="stat-label">ไฟที่โซลาร์ช่วยแทน</span>
                <strong>{fmt(r.coverShare * 100)} <small>% ของไฟที่ใช้</small></strong>
              </div>
              <div className="stat">
                <span className="stat-icon">📈</span>
                <span className="stat-label">ผลตอบแทน 25 ปี</span>
                <strong>{fmt(r.roi)} <small>% ของเงินลงทุน</small></strong>
              </div>
            </div>

            <div className="chart-block">
              <h2>ไฟที่ผลิตได้รายเดือน (kWh)</h2>
              <EnergyChart months={r.energy.months} showBattery={f.type === "hybrid"} />
            </div>

            <div className="chart-block">
              <h2>เงินสะสม 25 ปี (บาท)</h2>
              <p className="muted small">เริ่มติดลบเท่ากับค่าติดตั้ง แล้วเพิ่มขึ้นทุกปีจากค่าไฟที่ประหยัดได้ จุดที่เส้นข้ามศูนย์คือปีที่คืนทุน</p>
              <CashflowChart years={r.years} payback={r.payback} />
            </div>

            <details>
              <summary>ดูตัวเลขเป็นตาราง</summary>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>เดือน</th><th className="num">ผลิต</th><th className="num">ใช้เอง</th>
                      {f.type === "hybrid" && <th className="num">แบต</th>}
                      <th className="num">ขายคืน</th><th className="num">ใช้ทั้งหมด</th></tr>
                  </thead>
                  <tbody>
                    {r.energy.months.map((m) => (
                      <tr key={m.month}>
                        <td>{MONTHS[m.month - 1]}</td><td className="num">{fmt(m.pv)}</td><td className="num">{fmt(m.direct)}</td>
                        {f.type === "hybrid" && <td className="num">{fmt(m.battery)}</td>}
                        <td className="num">{fmt(m.exported)}</td><td className="num">{fmt(m.use)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>

            {history.configured && (
              <div className="save-row">
                <button className="secondary" onClick={save} disabled={saving}>
                  {saving ? "กำลังบันทึก..." : "💾 บันทึกผลลัพธ์"}
                </button>
                <span className="muted">{saveMsg}</span>
              </div>
            )}
            <p className="muted small">
              เป็นการประมาณการจากข้อมูลแสงแดดย้อนหลังของ PVGIS และการใช้ไฟเฉลี่ยรายวัน ผลจริงขึ้นกับเงาบัง ฝุ่น และพฤติกรรมการใช้ไฟ
            </p>
          </section>
        )}

        <section className="card">
          <h2>ผลการคำนวณล่าสุด</h2>
          {!history.configured ? (
            <p className="muted">ยังไม่ได้เชื่อม Supabase จึงยังบันทึกผลไม่ได้ (เว็บยังคำนวณได้ตามปกติ)</p>
          ) : history.rows.length === 0 ? (
            <p className="muted">ยังไม่มีข้อมูลที่บันทึกไว้</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>ชื่อ</th><th className="num">kWp</th><th className="num">kWh/ปี</th><th className="num">คืนทุน (ปี)</th></tr>
                </thead>
                <tbody>
                  {history.rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name || `${fmt(row.lat, 2)}, ${fmt(row.lon, 2)}`}</td>
                      <td className="num">{fmt(row.kwp, 1)}</td>
                      <td className="num">{fmt(row.annual_kwh)}</td>
                      <td className="num">{row.payback_years ? fmt(row.payback_years, 1) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer>ข้อมูลแสงอาทิตย์จาก PVGIS (European Commission JRC) · แผนที่จาก OpenStreetMap</footer>
      </main>
    </>
  );
}
