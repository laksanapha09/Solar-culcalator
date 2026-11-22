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

export default function Home() {
  const [f, setF] = useState(DEFAULTS);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState({ configured: false, rows: [] });
  const [saveMsg, setSaveMsg] = useState("");

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
    });
    const data = await res.json().catch(() => ({}));
    setSaveMsg(res.ok ? "บันทึกแล้ว" : data.error || "บันทึกไม่สำเร็จ");
    if (res.ok) loadHistory();
  }

  const max = result ? Math.max(...result.monthly.map((m) => m.kwh), 1) : 1;

  return (
    <main>
      <h1>คำนวณโซลาร์เซลล์</h1>
      <p className="muted">
        ประเมินพลังงานที่ผลิตได้ต่อปีและระยะเวลาคืนทุน ด้วยข้อมูลแสงอาทิตย์จาก PVGIS
      </p>

      <form onSubmit={calculate} className="card grid">
        <label className="wide">ชื่อโครงการ (ไม่บังคับ)
          <input value={f.name} onChange={set("name")} placeholder="เช่น บ้านที่เชียงใหม่" />
        </label>
        <label>ละติจูด
          <input type="number" step="any" required value={f.lat} onChange={set("lat")} />
        </label>
        <label>ลองจิจูด
          <input type="number" step="any" required value={f.lon} onChange={set("lon")} />
        </label>
        <button type="button" className="secondary wide" onClick={useMyLocation}>
          ใช้ตำแหน่งปัจจุบันของฉัน
        </button>
        <label>ขนาดระบบ (kWp)
          <input type="number" step="any" min="0.1" required value={f.kwp} onChange={set("kwp")} />
        </label>
        <label>มุมเอียงแผง (องศา)
          <input type="number" min="0" max="90" required value={f.angle} onChange={set("angle")} />
        </label>
        <label>ทิศ (0 = ใต้, -90 = ตะวันออก, 90 = ตะวันตก)
          <input type="number" min="-180" max="180" required value={f.aspect} onChange={set("aspect")} />
        </label>
        <label>การสูญเสียของระบบ (%)
          <input type="number" min="0" max="100" required value={f.loss} onChange={set("loss")} />
        </label>
        <label>ค่าไฟ (บาท/kWh)
          <input type="number" step="any" min="0" required value={f.price} onChange={set("price")} />
        </label>
        <label>ราคาติดตั้ง (บาท/kWp)
          <input type="number" step="any" min="0" required value={f.costPerKwp} onChange={set("costPerKwp")} />
        </label>
        <button type="submit" className="wide" disabled={loading}>
          {loading ? "กำลังคำนวณ..." : "คำนวณ"}
        </button>
      </form>

      {error && <p className="error" role="alert">{error}</p>}

      {result && (
        <section className="card">
          <div className="stats">
            <div><span className="muted">ผลิตไฟต่อปี</span><strong>{fmt(result.annualKwh)} kWh</strong></div>
            <div><span className="muted">ประหยัดต่อปี</span><strong>{fmt(result.yearlySaving)} บาท</strong></div>
            <div><span className="muted">ค่าติดตั้ง</span><strong>{fmt(result.systemCost)} บาท</strong></div>
            <div><span className="muted">คืนทุน</span><strong>{result.payback ? `${fmt(result.payback, 1)} ปี` : "-"}</strong></div>
          </div>

          <h2>พลังงานที่ผลิตได้รายเดือน (kWh)</h2>
          <div className="chart" role="img" aria-label="กราฟพลังงานรายเดือน">
            {result.monthly.map((m) => (
              <div key={m.month} className="col" title={`${MONTHS[m.month - 1]}: ${fmt(m.kwh)} kWh`}>
                <div className="bar" style={{ height: `${(m.kwh / max) * 100}%` }} />
                <span className="label">{MONTHS[m.month - 1]}</span>
              </div>
            ))}
          </div>
          <details>
            <summary>ดูเป็นตาราง</summary>
            <table>
              <thead><tr><th>เดือน</th><th>kWh</th></tr></thead>
              <tbody>
                {result.monthly.map((m) => (
                  <tr key={m.month}><td>{MONTHS[m.month - 1]}</td><td>{fmt(m.kwh)}</td></tr>
                ))}
              </tbody>
            </table>
          </details>

          {history.configured && (
            <p>
              <button onClick={save}>บันทึกผลลัพธ์</button> <span className="muted">{saveMsg}</span>
            </p>
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
          <table>
            <thead><tr><th>ชื่อ</th><th>kWp</th><th>kWh/ปี</th><th>คืนทุน (ปี)</th></tr></thead>
            <tbody>
              {history.rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name || `${fmt(r.lat, 2)}, ${fmt(r.lon, 2)}`}</td>
                  <td>{fmt(r.kwp, 1)}</td>
                  <td>{fmt(r.annual_kwh)}</td>
                  <td>{r.payback_years ? fmt(r.payback_years, 1) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
