# Free one-site access design

## Product rule

ผู้ใช้หนึ่งบัญชีสร้างเว็บไซต์ความทรงจำได้สูงสุด 1 เว็บไซต์ในแพ็กเกจฟรี ผู้ใช้ต้องล็อกอินด้วยบัญชีของตัวเองและไม่ต้องเห็น GitHub token, storage credential หรือ Resend API key

## Login/Register UX

หน้า `/dashboard` ใช้ OAuth เดิมของระบบเป็นทั้ง Login และ Register:

- **เข้าสู่ระบบ**: สำหรับบัญชีที่มีอยู่แล้ว
- **สมัครใช้งานฟรี**: สำหรับผู้ใช้ใหม่ กดแล้วไปสร้างบัญชีกับ OAuth provider เดิม
- เมื่อ OAuth callback สำเร็จ ระบบ `upsertUser` จะสร้าง user record อัตโนมัติถ้ายังไม่มี
- หลังกลับมา Dashboard ระบบแสดงจำนวนเว็บไซต์และสถานะสิทธิ์ฟรี
- ถ้ายังไม่มีเว็บไซต์ จะแสดงฟอร์มสร้างเว็บแรก
- ถ้ามีแล้ว ปุ่มสร้างเว็บจะถูกปิด พร้อมข้อความว่าใช้สิทธิ์ครบแล้ว และให้จัดการเว็บเดิมจากรายการ

การแยก Login/Register ที่หน้าเว็บเป็นเรื่อง UX ไม่ใช่การสร้างระบบรหัสผ่านใหม่ จึงไม่ต้องเก็บ password หรือ reset token ในระบบ LoveOffice

## Data model

ระบบปัจจุบันใช้ private GitHub JSON repository เป็น storage layer:

```text
users.json
  users[]
    id         stable internal user id
    openId     OAuth identity, unique account key
    email      display/contact email
    name       display name
    role       admin | user

sites.json
  sites[]
    id         stable site id
    ownerId    references users.id
    slug       globally unique public URL
    title
    settings
    assets[]
```

`ownerId` เป็น tenant boundary: ทุก protected query และ mutation ต้องค้นหาเว็บไซต์ด้วย `(ownerId, slug)` หรือ `(ownerId, siteId)` เท่านั้น

## Enforcing the one-site limit

กฎต้องอยู่ฝั่ง server ไม่ใช่แค่ disabled button ใน frontend:

1. `createSiteForOwner` อ่าน repository snapshot ภายใน `updateJson`
2. นับ `sites` ที่ `ownerId` ตรงกับผู้ใช้
3. ถ้าจำนวนมากกว่าหรือเท่ากับ `FREE_SITE_LIMIT = 1` ให้หยุดด้วย `owner site limit reached`
4. Router แปลงเป็น `FORBIDDEN` พร้อมข้อความภาษาไทย
5. `updateJson` ใช้ GitHub SHA optimistic concurrency; ถ้ามีคำขอพร้อมกัน GitHub จะ reject SHA ที่เก่า แล้ว retry จากข้อมูลล่าสุด ทำให้ไม่สร้างเว็บเกินโควตา

การลบเว็บไซต์จะคืนสิทธิ์ให้ผู้ใช้สร้างเว็บไซต์ใหม่ได้ 1 เว็บอีกครั้งตามโมเดล free plan ปัจจุบัน

## Future paid plans

หากมีแพ็กเกจในอนาคต ให้เปลี่ยนจาก constant เป็น entitlement:

```text
users.planId -> plans.id
plans.siteLimit
users.planExpiresAt
```

แล้วตรวจ `siteLimit` ใน service เดียวกัน ห้ามย้ายกฎไปไว้เฉพาะ frontend
