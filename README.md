
# HostAtom MySQL Starter — No .env (Config JSON)

โปรเจคตัวอย่าง Express + mysql2 ที่ **ไม่ใช้ .env** เลย
คอนฟิกทั้งหมดอยู่ใน `config/app.config.json` เพื่อหลีกเลี่ยงปัญหาเวลาไปใช้งานบน Plesk (HostAtom)

## 1) ติดตั้งและตั้งค่า
```bash
npm i
cp config/app.config.sample.json config/app.config.json
# แก้ไข config/app.config.json ให้ตรงเครื่องของคุณ
```

## 2) เตรียมฐานข้อมูล
- สร้างฐาน `pfpserv_nodejs` แล้วนำเข้า `sql/schema.sql` ผ่าน phpMyAdmin
- หรือเปลี่ยนชื่อฐาน/ผู้ใช้ใน `config/app.config.json` ให้ตรงกับระบบของคุณ

## 3) รัน Dev
```bash
npm run dev
# http://localhost:3000
# /health เพื่อตรวจ DB
```

## 4) API
- GET `/` — ping
- GET `/health` — DB status
- CRUD `/categories`

## 5) ใช้บน HostAtom (Plesk)
- อัปโหลดทั้งโปรเจคขึ้นไป และวางไฟล์ `config/app.config.json` (ตัวจริง) ผ่าน Plesk File Manager
- Node.js settings:
  - Application startup file: `src/server.js`
  - (ไม่จำเป็นต้องตั้ง Environment Variables)
  - Document Root: โฟลเดอร์ที่มี `public`
  - Restart app

## 6) โครงสร้างไฟล์สำคัญ
- `config/app.config.json` — คอนฟิกจริง (ควรอยู่ใน .gitignore)
- `src/config.js` — ตัวอ่านและ validate คอนฟิก
- `src/db/pool.js` — เชื่อม MySQL ด้วย mysql2/promise
- `src/controllers/*` + `src/routes/*` — ตัวอย่าง CRUD
- `sql/schema.sql` — สร้างตารางตัวอย่าง
