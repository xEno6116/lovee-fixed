# Vercel Environment Checklist

เว็บไซต์นี้ใช้ GitHub private repository เป็นที่เก็บข้อมูลเว็บไซต์และ user identity จึง **ไม่ต้องตั้งค่า `DATABASE_URL`** บน Vercel อีกต่อไป อย่างไรก็ตาม ระบบล็อกอินและการอัปโหลดสื่อยังต้องมีตัวแปรด้านล่างครบทั้ง Production และ Preview เพื่อให้ tRPC, OAuth และ storage proxy ใช้งานได้ตามเดิม

| ตัวแปร | ใช้งานโดย | สถานะ | หมายเหตุ |
|---|---|---|---|
| `GITHUB_DATA_TOKEN` | Backend | จำเป็น | Fine-grained token ที่ให้ `Contents: Read and write` เฉพาะ `xEno6116/lovee-data` |
| `JWT_SECRET` | Backend | จำเป็น | ค่า secret แบบสุ่มที่คงเดิมระหว่าง deployments เพื่อรักษา session cookie |
| `VITE_APP_ID` | Frontend และ Backend | จำเป็น | Application ID ของ Manus OAuth |
| `VITE_OAUTH_PORTAL_URL` | Frontend | จำเป็น | OAuth portal ที่ใช้เริ่ม sign-in |
| `OAUTH_SERVER_URL` | Backend | จำเป็น | OAuth server สำหรับแลก code และอ่านข้อมูลบัญชี |
| `OWNER_OPEN_ID` | Backend | จำเป็น | Open ID ของเจ้าของเพื่อกำหนด role เริ่มต้น |
| `OWNER_NAME` | Backend | แนะนำ | ชื่อเจ้าของที่ใช้โดยส่วนระบบของ template |
| `BUILT_IN_FORGE_API_URL` | Backend | จำเป็นเมื่อใช้อัปโหลด/แสดงสื่อ S3 | API สำหรับ presigned storage URLs |
| `BUILT_IN_FORGE_API_KEY` | Backend | จำเป็นเมื่อใช้อัปโหลด/แสดงสื่อ S3 | Credential สำหรับ storage proxy และอัปโหลดสื่อ |
| `RESEND_API_KEY` | Backend | จำเป็นสำหรับส่งจดหมาย | API key ของ Resend เก็บเป็น sensitive/encrypted เท่านั้น |
| `MAIL_FROM_EMAIL` | Backend | จำเป็นสำหรับส่งจดหมาย | อีเมลผู้ส่งที่ยืนยันกับ Resend เช่น `onboarding@resend.dev` |
| `S3_ENDPOINT` | Backend | ไม่บังคับ | Endpoint ของ AWS S3, Cloudflare R2 หรือ S3-compatible provider |
| `S3_REGION` | Backend | ไม่บังคับ | เช่น `ap-southeast-1` หรือ `auto` สำหรับ R2 |
| `S3_BUCKET` | Backend | ไม่บังคับ | Bucket สำหรับเก็บสื่อ |
| `S3_ACCESS_KEY_ID` | Backend | ไม่บังคับ | Access key แบบจำกัดสิทธิ์เฉพาะ bucket/prefix |
| `S3_SECRET_ACCESS_KEY` | Backend | ไม่บังคับ | Secret key เก็บเป็น sensitive/encrypted เท่านั้น |
| `S3_PUBLIC_BASE_URL` | Backend | ไม่บังคับ | CloudFront/custom domain/public media URL ที่ผู้ชมเปิดได้ |
| `S3_FORCE_PATH_STYLE` | Backend | ไม่บังคับ | `true` สำหรับ provider ที่ต้องการ path-style เช่นบาง S3-compatible service |

> **ข้อควรระวัง:** ห้ามกำหนด `GITHUB_DATA_TOKEN` ด้วย prefix `VITE_` และห้ามใส่ token ใน source code เพราะตัวแปร `VITE_*` จะถูกฝังในไฟล์ JavaScript ที่ส่งไป browser.

หลังตั้งค่า environment ให้เปิด URL production แล้ว sign in หนึ่งครั้ง ระบบจะตรวจหรือสร้าง record user ใน `data/users.json` และใช้ private repository ต่อไปโดยไม่เชื่อมต่อ MySQL.

ถ้าตั้งค่า `S3_*` ครบ ระบบจะเลือกใช้ bucket ของคุณเป็นหลักและอัปโหลดด้วย presigned URL โดยตรงจากเบราว์เซอร์ หากยังไม่ตั้งค่า ระบบจะใช้ Manus Forge storage เดิมเป็น fallback โดยอัตโนมัติ ดูรายละเอียด CORS และ policy ได้ที่ [S3_STORAGE.md](./S3_STORAGE.md)
