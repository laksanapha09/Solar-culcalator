-- รันไฟล์นี้ใน Supabase > SQL Editor ครั้งเดียว
-- ทั้งหมดอยู่ในคำสั่งเดียว (do block) จึงใช้ได้แม้ตัวแก้ SQL รับได้ทีละคำสั่ง
do $$
begin
  create table if not exists public.calculations (
    id bigint generated always as identity primary key,
    created_at timestamptz not null default now(),
    name text,
    lat double precision not null,
    lon double precision not null,
    kwp double precision not null,
    annual_kwh double precision not null,
    system_cost double precision,
    yearly_saving double precision,
    payback_years double precision
  );

  alter table public.calculations enable row level security;

  -- ทุกคนอ่านและเพิ่มข้อมูลได้ (ไม่ให้แก้ไขหรือลบ)
  drop policy if exists "public read" on public.calculations;
  create policy "public read" on public.calculations
    for select to anon, authenticated using (true);

  drop policy if exists "public insert" on public.calculations;
  create policy "public insert" on public.calculations
    for insert to anon, authenticated with check (true);
end
$$;
