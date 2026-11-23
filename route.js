import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabase();
  if (!supabase) return Response.json({ configured: false, rows: [] });
  const { data, error } = await supabase
    .from("calculations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return Response.json({ configured: true, rows: [], error: error.message }, { status: 500 });
  return Response.json({ configured: true, rows: data });
}

export async function POST(request) {
  const supabase = getSupabase();
  if (!supabase) {
    return Response.json({ error: "ยังไม่ได้ตั้งค่า Supabase" }, { status: 503 });
  }
  const b = await request.json().catch(() => null);
  const required = ["lat", "lon", "kwp", "annual_kwh"];
  if (!b || required.some((k) => !Number.isFinite(Number(b[k])))) {
    return Response.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }
  const row = {
    name: String(b.name ?? "").slice(0, 100) || null,
    lat: Number(b.lat),
    lon: Number(b.lon),
    kwp: Number(b.kwp),
    annual_kwh: Number(b.annual_kwh),
    system_cost: Number.isFinite(Number(b.system_cost)) ? Number(b.system_cost) : null,
    yearly_saving: Number.isFinite(Number(b.yearly_saving)) ? Number(b.yearly_saving) : null,
    payback_years: Number.isFinite(Number(b.payback_years)) ? Number(b.payback_years) : null,
  };
  const { error } = await supabase.from("calculations").insert(row);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
