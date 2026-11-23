// Server-side proxy: PVGIS does not allow direct browser requests (CORS).
export const dynamic = "force-dynamic";

function num(v, min, max) {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

export async function GET(request) {
  const p = new URL(request.url).searchParams;
  const lat = num(p.get("lat"), -90, 90);
  const lon = num(p.get("lon"), -180, 180);
  const kwp = num(p.get("kwp"), 0.1, 10000);
  const loss = num(p.get("loss") ?? 14, 0, 100);
  const angle = num(p.get("angle") ?? 15, 0, 90);
  const aspect = num(p.get("aspect") ?? 0, -180, 180);
  if ([lat, lon, kwp, loss, angle, aspect].some((v) => v === null)) {
    return Response.json({ error: "ค่าที่กรอกไม่ถูกต้อง" }, { status: 400 });
  }

  const qs = new URLSearchParams({
    lat: String(lat), lon: String(lon), peakpower: String(kwp),
    loss: String(loss), angle: String(angle), aspect: String(aspect),
    outputformat: "json",
  });

  try {
    const res = await fetch(`https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?${qs}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.outputs) {
      const msg = data?.message || `PVGIS ตอบกลับ ${res.status}`;
      return Response.json({ error: msg }, { status: 502 });
    }
    const monthly = (data.outputs.monthly?.fixed ?? []).map((m) => ({
      month: m.month,
      kwh: m.E_m,
    }));
    const annualKwh = data.outputs.totals?.fixed?.E_y ??
      monthly.reduce((s, m) => s + m.kwh, 0);
    return Response.json({ annualKwh, monthly });
  } catch (e) {
    return Response.json({ error: "เชื่อมต่อ PVGIS ไม่ได้ ลองใหม่อีกครั้ง" }, { status: 502 });
  }
}
