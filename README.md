# Solar Calculator (คำนวณโซลาร์เซลล์)

เว็บคำนวณพลังงานแสงอาทิตย์ที่ผลิตได้ต่อปี รายเดือน และระยะเวลาคืนทุน
ใช้ Next.js + ข้อมูลแสงอาทิตย์ฟรีจาก PVGIS + บันทึกผลลง Supabase แล้ว deploy บน Vercel

> เว็บใช้งานได้แม้ยังไม่ตั้งค่า Supabase (แค่ยังบันทึกผลไม่ได้) จึงไม่ error ตอน deploy

## สิ่งที่ต้องมี
- บัญชี GitHub, Supabase และ Vercel (ฟรีทั้งหมด)
- ถ้าจะลองบนเครื่องตัวเอง: Node.js เวอร์ชัน 20.9 ขึ้นไป

## ขั้นที่ 1: Supabase (ฐานข้อมูล)
1. ไปที่ supabase.com > New project ตั้งชื่อและรหัสผ่าน รอจนสร้างเสร็จ
2. เมนูซ้าย **SQL Editor** > New query > วางเนื้อหาไฟล์ `supabase/schema.sql` > กด **Run**
3. ไปที่ **Project Settings > API** (หรือปุ่ม Connect) แล้วจดค่า 2 อย่าง
   - Project URL เช่น `https://abcd.supabase.co`
   - anon key หรือ publishable key

## ขั้นที่ 2: GitHub (เก็บโค้ด)
1. ไปที่ github.com > New repository ตั้งชื่อ `solar-calculator` > Create
2. อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ (ยกเว้น `node_modules` และ `.next` ถ้ามี)
   - วิธีง่าย: กด "uploading an existing file" แล้วลากไฟล์ทั้งหมดลงไป > Commit
   - หรือใช้คำสั่ง:
     ```bash
     git init
     git add .
     git commit -m "first version"
     git branch -M main
     git remote add origin https://github.com/<ชื่อผู้ใช้>/solar-calculator.git
     git push -u origin main
     ```
   - ห้ามอัปโหลดไฟล์ `.env.local` (มีกุญแจของคุณ)

## ขั้นที่ 3: Vercel (เปิดเว็บ)
1. ไปที่ vercel.com > Add New > Project > Import repository `solar-calculator`
2. Framework จะเป็น **Next.js** อัตโนมัติ ไม่ต้องแก้ Build Command
3. เปิด **Environment Variables** แล้วเพิ่ม
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL จากขั้นที่ 1
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon/publishable key จากขั้นที่ 1
4. กด **Deploy** รอสักครู่จะได้ลิงก์เว็บ เช่น `https://solar-calculator.vercel.app`
5. ถ้าเพิ่มค่า Environment Variables ทีหลัง ต้องกด **Redeploy** ใหม่หนึ่งครั้ง

## ลองบนเครื่องตัวเอง (ไม่บังคับ)
```bash
npm install
cp .env.example .env.local   # แล้วใส่ค่าจาก Supabase
npm run dev                   # เปิด http://localhost:3000
```

## ปัญหาที่พบบ่อย
| อาการ | วิธีแก้ |
|---|---|
| ขึ้นว่า "ยังไม่ได้เชื่อม Supabase" | ใส่ Environment Variables ใน Vercel ให้ถูกชื่อ แล้ว Redeploy |
| บันทึกแล้วขึ้น `relation "calculations" does not exist` | ยังไม่ได้รัน `supabase/schema.sql` |
| บันทึกแล้วขึ้น `row-level security policy` | รัน `supabase/schema.sql` ใหม่อีกครั้ง (มี policy อยู่ในไฟล์) |
| "เชื่อมต่อ PVGIS ไม่ได้" | เซิร์ฟเวอร์ PVGIS ช้าหรือปิดชั่วคราว ลองกดคำนวณอีกครั้ง |

## โครงสร้างไฟล์
- `app/page.js` หน้าเว็บและฟอร์มคำนวณ
- `app/api/pvgis/route.js` ดึงข้อมูลจาก PVGIS ฝั่งเซิร์ฟเวอร์
- `app/api/calculations/route.js` บันทึกและอ่านผลจาก Supabase
- `lib/supabase.js` ตัวเชื่อม Supabase
- `supabase/schema.sql` สร้างตารางในฐานข้อมูล
