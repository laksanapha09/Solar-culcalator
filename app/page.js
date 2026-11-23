"use client";

import { useEffect, useState } from "react";

const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const DEFAULTS = {
  name: "",
  lat: "13.75",
  lon: "100.50",
  kwp: "5",
  angle: "15",
  aspect: "0",
  loss: "14",
  price: "4.5",
  costPerKwp: "30000",
};

const fmt = (n, d = 0) =>
  Number(n).toLocaleString("th-TH", { maximumFractionDigits: d, minimumFractionDigits: d });

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

export default function Home() {
  const [f, setF] = useState(DEFAULTS);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState({ configured: false, rows: [] });
  const [saveMsg, setSaveMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

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
      (pos) =>
        setF((prev) => ({
          ...prev,
          lat: pos.coords.latitude.toFixed(4),
          lon: pos.coords.longitude.toFixed(4),
        })),
      () => setError("ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง")
    );
  }

  async function calculate(e) {
    e.preventDefault();
    setError("");
    setSaveMsg("");
    setResult(null);
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        lat: f.lat, lon: f.lon, kwp: f.kwp, angle: f.angle, aspect: f.aspect, loss: f.loss,
      });
      const res = await fetch(`/api/pvgis?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "คำนวณไม่สำเร็จ");
      const systemCost = Number(f.kwp) * Number(f.costPerKwp);
      const yearlySaving = data.annualKwh * Number(f.price);
      const payback = yearlySaving > 0 ? systemCost / yearlySaving : null;
      setResult({ ...data, systemCost, yearlySaving, payback });
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
        name: f.name, lat: f.lat, lon: f.lon, kwp: f.kwp,
        annual_kwh: result.annualKwh,
        system_cost: result.systemCost,
        yearly_saving: result.yearlySaving,
        payback_years: result.payback,
      }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setSaving(false);
    setSaveMsg(res?.ok ? "บันทึกแล้ว ✓" : data.error || "บันทึกไม่สำเร็จ");
    if (res?.ok) loadHistory();
  }

  const max = result ? Math.max(...result.monthly.map((m) => m.kwh), 1) : 1;
  const best = result?.monthly.reduce((a, b) => (b.kwh > a.kwh ? b : a), result.monthly[0]);

  return (
    <>
      <header className="hero">
        <div className="hero-inner">
          <div className="sun"><SunIcon /></div>
          <div>
            <h1>คำนวณโซลาร์เซลล์</h1>
            <p>รู้ทันทีว่าหลังคาของคุณผลิตไฟได้เท่าไร ประหยัดได้ปีละเท่าไร และคืนทุนเมื่อไร</p>
          </div>
        </div>
      </header>

      <main>
        <form onSubmit={calculate} className="card form">
          <section className="group">
            <h2><span className="badge">1</span>ตำแหน่งที่ติดตั้ง</h2>
            <Field label="ชื่อโครงการ (ไม่บังคับ)">
              <input value={f.name} onChange={set("name")} placeholder="เช่น บ้านที่เชียงใหม่" />
            </Field>
            <div className="row">
              <Field label="ละติจูด">
                <input type="number" step="any" required value={f.lat} onChange={set("lat")} />
              </Field>
              <Field label="ลองจิจูด">
                <input type="number" step="any" required value={f.lon} onChange={set("lon")} />
              </Field>
            </div>
            <button type="button" className="ghost" onClick={useMyLocation}>
              📍 ใช้ตำแหน่งปัจจุบันของฉัน
            </button>
          </section>

          <section className="group">
            <h2><span className="badge">2</span>ระบบโซลาร์</h2>
            <div className="row">
              <Field label="ขนาดระบบ (kWp)" hint="บ้านทั่วไป 3 ถึง 10 kWp">
                <input type="number" step="any" min="0.1" required value={f.kwp} onChange={set("kwp")} />
              </Field>
              <Field label="มุมเอียงแผง (องศา)">
                <input type="number" min="0" max="90" required value={f.angle} onChange={set("angle")} />
              </Field>
            </div>
            <div className="row">
              <Field label="ทิศที่แผงหันไป" hint="0 = ใต้, -90 = ตะวันออก, 90 = ตะวันตก">
                <input type="number" min="-180" max="180" required value={f.aspect} onChange={set("aspect")} />
              </Field>
              <Field label="การสูญเสียของระบบ (%)" hint="ค่าปกติประมาณ 14%">
                <input type="number" min="0" max="100" required value={f.loss} onChange={set("loss")} />
              </Field>
            </div>
          </section>

          <section className="group">
            <h2><span className="badge">3</span>ราคา</h2>
            <div className="row">
              <Field label="ค่าไฟ (บาท/kWh)">
                <input type="number" step="any" min="0" required value={f.price} onChange={set("price")} />
              </Field>
              <Field label="ราคาติดตั้ง (บาท/kWp)">
                <input type="number" step="any" min="0" required value={f.costPerKwp} onChange={set("costPerKwp")} />
              </Field>
            </div>
          </section>

          <button type="submit" className="primary" disabled={loading}>
            {loading ? <><span className="spinner" /> กำลังคำนวณ...</> : "☀️ คำนวณ"}
          </button>
        </form>

        {error && <p className="alert" role="alert">{error}</p>}

        {result && (
          <section className="card results">
            <div className="payback">
              <span>คืนทุนภายใน</span>
              <strong>{result.payback ? fmt(result.payback, 1) : "-"}</strong>
              <span>ปี</span>
            </div>

            <div className="stats">
              <div className="stat">
                <span className="stat-icon">⚡</span>
                <span className="stat-label">ผลิตไฟต่อปี</span>
                <strong>{fmt(result.annualKwh)} <small>kWh</small></strong>
              </div>
              <div className="stat">
                <span className="stat-icon">💰</span>
                <span className="stat-label">ประหยัดต่อปี</span>
                <strong>{fmt(result.yearlySaving)} <small>บาท</small></strong>
              </div>
              <div className="stat">
                <span className="stat-icon">🏗️</span>
                <span className="stat-label">ค่าติดตั้ง</span>
                <strong>{fmt(result.systemCost)} <small>บาท</small></strong>
              </div>
            </div>

            <div className="chart-head">
              <h2>ไฟที่ผลิตได้รายเดือน</h2>
              {best && <span className="muted">สูงสุดเดือน {MONTHS[best.month - 1]} {fmt(best.kwh)} kWh</span>}
            </div>
            <div className="chart" role="img" aria-label="กราฟพลังงานรายเดือน">
              {result.monthly.map((m) => (
                <div key={m.month} className="col" tabIndex={0}>
                  <span className="tip">{fmt(m.kwh)} kWh</span>
                  <div className="bar" style={{ height: `${(m.kwh / max) * 100}%` }} />
                  <span className="label">{MONTHS[m.month - 1]}</span>
                </div>
              ))}
            </div>
            <details>
              <summary>ดูเป็นตาราง</summary>
              <table>
                <thead><tr><th>เดือน</th><th className="num">kWh</th></tr></thead>
                <tbody>
                  {result.monthly.map((m) => (
                    <tr key={m.month}><td>{MONTHS[m.month - 1]}</td><td className="num">{fmt(m.kwh)}</td></tr>
                  ))}
                </tbody>
              </table>
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
              ตัวเลขนี้เป็นการประมาณการจากข้อมูลย้อนหลังของ PVGIS ไม่รวมค่าบำรุงรักษาและการเสื่อมของแผง
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
                  {history.rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.name || `${fmt(r.lat, 2)}, ${fmt(r.lon, 2)}`}</td>
                      <td className="num">{fmt(r.kwp, 1)}</td>
                      <td className="num">{fmt(r.annual_kwh)}</td>
                      <td className="num">{r.payback_years ? fmt(r.payback_years, 1) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer>ข้อมูลแสงอาทิตย์จาก PVGIS (European Commission JRC)</footer>
      </main>
    </>
  );
}
