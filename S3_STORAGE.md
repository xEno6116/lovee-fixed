# Cloud Storage สำหรับรูปภาพและวิดีโอ

ระบบอัปโหลดใช้ presigned URL ทำให้ไฟล์ถูกส่งจากเบราว์เซอร์ตรงไปยัง object storage ไม่วิ่งผ่านเซิร์ฟเวอร์ของเว็บ เหมาะกับไฟล์วิดีโอขนาดใหญ่ และมี progress bar ในหน้า Settings

## โหมดที่รองรับ

- หากตั้งค่า `S3_*` ครบ ระบบจะใช้ AWS S3 หรือ S3-compatible storage เช่น Cloudflare R2 เป็นหลัก
- หากยังไม่ตั้งค่า `S3_*` ระบบจะใช้ Manus Forge storage เดิมโดยอัตโนมัติ จึงไม่กระทบข้อมูลเดิม
- GitHub storage เป็น fallback ชั้นสุดท้ายสำหรับการติดตั้งที่ไม่มี Forge

## Environment variables

ตั้งค่าใน Vercel Project Settings → Environment Variables:

```text
S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=ap-southeast-1
S3_BUCKET=ชื่อ-bucket
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_BASE_URL=https://cdn.example.com
S3_FORCE_PATH_STYLE=false
```

สำหรับ AWS S3 สามารถใช้ `S3_ENDPOINT` เป็นค่าว่างและตั้ง `S3_PUBLIC_BASE_URL` เป็น CloudFront หรือ URL public ของ bucket แทนได้ สำหรับ Cloudflare R2 ให้ใช้ endpoint ของ R2, `S3_REGION=auto`, `S3_FORCE_PATH_STYLE=true` และตั้ง custom domain/public bucket URL ใน `S3_PUBLIC_BASE_URL`

## สิทธิ์และ CORS

Access key ควรจำกัดสิทธิ์เฉพาะ `PutObject`, `GetObject` และ `DeleteObject` ภายใต้ prefix ที่เว็บใช้งาน เช่น `anniversary/*` ไม่ควรใช้ root credentials

ตั้งค่า CORS ของ bucket ให้รับ `PUT` และ `GET` จาก `https://loveoffice-memory-fixed.vercel.app` รวมถึง preview domain ที่ใช้ทดสอบ และอนุญาต header `Content-Type`, `x-amz-*` ตาม provider

`S3_PUBLIC_BASE_URL` ต้องเป็น URL ที่ผู้เข้าชมหน้าเว็บเปิดรูปและวิดีโอได้โดยไม่ต้องมี AWS credentials เช่น CloudFront, custom domain ของ R2 หรือ bucket ที่ตั้ง policy สำหรับ object media เท่านั้น
