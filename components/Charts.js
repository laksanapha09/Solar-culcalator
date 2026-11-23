"use client";

import { useEffect, useRef, useState } from "react";

export const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export const fmt = (n, d = 0) =>
  Number(n).toLocaleString("th-TH", { maximumFractionDigits: d, minimumFractionDigits: d });

// Monthly production split into used directly / via battery / exported,
// with a marker for the month's consumption.
export function EnergyChart({ months, showBattery }) {
  const [hover, setHover] = useState(null);
  const series = [
    { key: "direct", label: "ใช้เองกลางวัน", cls: "s-direct" },
    ...(showBattery ? [{ key: "battery", label: "ใช้ผ่านแบตเตอรี่", cls: "s-battery" }] : []),
    { key: "exported", label: "ขายคืนการไฟฟ้า", cls: "s-export" },
  ];
  const max = Math.max(...months.map((m) => Math.max(m.direct + m.battery + m.exported, m.use)), 1);
  const h = hover !== null ? months[hover] : null;

  return (
    <div>
      <div className="legend">
        {series.map((s) => (
          <span key={s.key}><i className={`swatch ${s.cls}`} />{s.label}</span>
        ))}
        <span><i className="swatch s-use" />ไฟที่ใช้ทั้งเดือน</span>
      </div>
      <div className="tooltip-line" aria-live="polite">
        {h ? (
          <>
            <b>{MONTHS[h.month - 1]}</b> ผลิต {fmt(h.pv)} kWh · ใช้เอง {fmt(h.direct)}
            {showBattery && <> · แบต {fmt(h.battery)}</>} · ขายคืน {fmt(h.exported)} · ใช้ทั้งหมด {fmt(h.use)}
          </>
        ) : (
          <span className="muted">แตะหรือชี้ที่แท่งเพื่อดูตัวเลข</span>
        )}
      </div>
      <div className="chart stacked" role="img" aria-label="กราฟไฟที่ผลิตได้รายเดือน">
        {months.map((m, i) => (
          <div
            key={m.month}
            className={`col${hover === i ? " active" : ""}`}
            tabIndex={0}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            onClick={() => setHover(i)}
          >
            <div className="stack">
              <div className="use-mark" style={{ bottom: `${(m.use / max) * 100}%` }} />
              {series.slice().reverse().map((s) =>
                m[s.key] > 0 ? (
                  <div key={s.key} className={`seg ${s.cls}`} style={{ height: `${(m[s.key] / max) * 100}%` }} />
                ) : null
              )}
            </div>
            <span className="label">{MONTHS[m.month - 1]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Cumulative money over 25 years: below zero is still paying back.
export function CashflowChart({ years, payback }) {
  const [hover, setHover] = useState(null);
  const box = useRef(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    // Match the drawing width to the screen so text stays readable on phones.
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  const H = 240, L = 56, R = 12, T = 16, B = 28;
  const vals = years.map((y) => y.cumulative);
  let min = Math.min(0, ...vals), max = Math.max(0, ...vals);
  const pad = (max - min) * 0.08 || 1;
  min -= pad; max += pad;
  const x = (yr) => L + (yr / (years.length - 1)) * (W - L - R);
  const y = (v) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const path = years.map((p, i) => `${i ? "L" : "M"}${x(p.year).toFixed(1)},${y(p.cumulative).toFixed(1)}`).join("");
  const ticks = niceTicks(min, max, 4);
  const h = hover !== null ? years[hover] : null;

  function move(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - L) / (W - L - R)) * (years.length - 1));
    setHover(Math.max(0, Math.min(years.length - 1, i)));
  }

  return (
    <div ref={box}>
      <div className="tooltip-line" aria-live="polite">
        {h ? (
          <>
            <b>ปีที่ {h.year}</b> เงินสะสม{" "}
            <span className={h.cumulative >= 0 ? "pos" : "neg"}>{h.cumulative >= 0 ? "+" : ""}{fmt(h.cumulative)} บาท</span>
          </>
        ) : (
          <span className="muted">ชี้หรือแตะที่กราฟเพื่อดูแต่ละปี</span>
        )}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="cashflow"
        role="img"
        aria-label="กราฟเงินสะสม 25 ปี"
        onMouseMove={move}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => move(e.touches[0] ? { currentTarget: e.currentTarget, clientX: e.touches[0].clientX } : e)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className={t === 0 ? "zero" : "grid"} />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" className="axis">{shortBaht(t)}</text>
          </g>
        ))}
        {(W < 420 ? [0, 10, 20] : [0, 5, 10, 15, 20, 25]).map((yr) => (
          <text key={yr} x={x(yr)} y={H - 8} textAnchor="middle" className="axis">{yr}</text>
        ))}
        <path d={`${path}L${x(years.length - 1)},${y(0)}L${x(0)},${y(0)}Z`} className="area" />
        <path d={path} className="line" />
        {payback !== null && payback <= 25 && (
          <g>
            <line x1={x(payback)} x2={x(payback)} y1={T} y2={H - B} className="payback-line" />
            <text x={x(payback) + 6} y={T + 12} className="axis strong">คืนทุน</text>
          </g>
        )}
        {h && (
          <g>
            <line x1={x(h.year)} x2={x(h.year)} y1={T} y2={H - B} className="cross" />
            <circle cx={x(h.year)} cy={y(h.cumulative)} r="5" className="dot" />
          </g>
        )}
      </svg>
      <div className="axis-title">ปีหลังติดตั้ง</div>
    </div>
  );
}

function shortBaht(v) {
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toLocaleString("th-TH", { maximumFractionDigits: 1 })} ล้าน`;
  if (a >= 1e3) return `${(v / 1e3).toLocaleString("th-TH", { maximumFractionDigits: 0 })} พัน`;
  return String(Math.round(v));
}

function niceTicks(min, max, count) {
  const step0 = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= step0);
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) out.push(Math.round(v));
  return out;
}
