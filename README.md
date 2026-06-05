# Lucky Draw — คู่มือ Deploy บน Vercel

## ขั้นตอน Deploy (ใช้เวลาประมาณ 10 นาที)

---

### ขั้นที่ 1 — อัปโหลดขึ้น GitHub

1. ไปที่ https://github.com → กด **New repository**
2. ตั้งชื่อ: `lucky-draw` → กด **Create repository**
3. กด **uploading an existing file**
4. ลาก **ทุกไฟล์ในโฟลเดอร์นี้** ใส่ทั้งหมด (รวม app/ และ lib/)
5. กด **Commit changes**

---

### ขั้นที่ 2 — สร้าง Vercel Account + Deploy

1. ไปที่ https://vercel.com → **Sign up with GitHub**
2. กด **Add New Project** → เลือก repo `lucky-draw`
3. กด **Deploy** (ไม่ต้องตั้งค่าอะไร)
4. รอ 1–2 นาที → ได้ URL เช่น `https://lucky-draw-xxx.vercel.app`

---

### ขั้นที่ 3 — สร้าง Vercel KV (ฐานข้อมูล)

1. ใน Vercel Dashboard → ไปที่ **Storage** tab
2. กด **Create Database** → เลือก **KV**
3. ตั้งชื่อ: `lucky-draw-kv` → กด **Create**
4. กด **Connect to Project** → เลือก `lucky-draw`
5. ✅ Env variables จะถูกเพิ่มอัตโนมัติ

---

### ขั้นที่ 4 — ตั้ง Admin Password

1. ใน Vercel Dashboard → **Settings** → **Environment Variables**
2. กด **Add** → ใส่:
   - Name: `ADMIN_PASSWORD`
   - Value: รหัสผ่านที่ต้องการ (เช่น `myadmin123`)
3. กด **Save**
4. ไปที่ **Deployments** → กด **Redeploy**

---

### เสร็จแล้ว! 🎉

- **URL สุ่มรางวัล**: `https://lucky-draw-xxx.vercel.app`
- **Admin**: กดแท็บ Admin ในเว็บ → ใส่รหัสผ่านที่ตั้งไว้

---

## โครงสร้างไฟล์

```
lucky-draw/
├── app/
│   ├── layout.js          # Layout หลัก
│   ├── page.js            # หน้าเว็บหลัก
│   ├── page.module.css    # สไตล์
│   └── api/
│       ├── draw/route.js  # API สุ่มโค้ด (ตรวจ IP)
│       ├── stats/route.js # API ดูสถิติ
│       └── reset/route.js # API รีเซ็ต
├── lib/
│   └── codes.js           # โค้ด 498 ตัว
├── package.json
├── next.config.js
└── README.md
```
