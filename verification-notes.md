# Verification Notes

- วันที่ตรวจสอบ: 19 สิงหาคม 2026
- เปิดหน้า `/site/main-memory` หลังรีสตาร์ต dev server สำเร็จ
- ระบบโหลดข้อมูลเว็บไซต์ความทรงจำหลักจาก backend แล้วแสดงหน้าป้อน PIN ตามปกติ
- หน้าดังกล่าวไม่แสดง token, PIN hash, storage key หรือข้อมูล repository-only ในเนื้อหาที่ browser ได้รับ

การทดสอบหน้าจอ PIN ยืนยันว่าปุ่มตัวเลขตอบสนองและแสดงสถานะการกรอกตัวเลขตามลำดับได้ตามปกติ ก่อนส่งคำขอปลดล็อกไปยัง backend.

เมื่อตรวจด้วย PIN เริ่มต้น `0000` ระบบปลดล็อกหน้าเว็บไซต์สำเร็จ หน้าเว็บแสดงตัวนับวัน ข้อความความทรงจำ แกลเลอรี และช่องวิดีโอว่างครบ 4 ช่องตาม UX เดิม จึงยืนยันการอ่านข้อมูลผ่าน GitHub-backed API ในเส้นทางผู้ใช้จริงได้.

หน้า Settings โหลดชื่อเว็บไซต์ ข้อความ วันที่ และช่องอัปโหลดวิดีโอ 4 ช่องจาก backend สำเร็จ โดยไม่มีช่องกรอก GitHub token และไม่มี PIN hash แสดงใน form หรือเนื้อหาหน้าเว็บ.

Vercel workspace `chok4` แสดง project `lovee-backoffice` ที่เชื่อม GitHub แล้ว แต่ยังไม่มี Production Deployment ขณะที่ account ที่ล็อกอินเป็น `xeno6116`. จึงต้องตั้งค่า environment และสั่ง deploy ผ่านหน้า project หรือแก้สิทธิ์ API ก่อนตรวจ URL production.

หน้า Git settings ยืนยันว่า repository เชื่อมต่อแล้ว แต่ยังไม่มี deployment จาก Git และต้องตรวจ production branch ในการตั้งค่า Build and Deployment ก่อน deploy.

การตรวจ dashboard ยืนยันว่า account `xeno6116` เปิด workspace `chok4` ได้และเห็น project `lovee-backoffice` แต่ project ยังไม่มี production deployment จึงกำลังเปลี่ยนไปใช้ team ใหม่ตามคำขอผู้ใช้.

เมนูบัญชี `xeno6116` และ workspace ปัจจุบันเปิดได้ แต่ยังไม่พบคำสั่งสร้าง team ใหม่จากเมนูที่แสดง จึงต้องเปิดหน้าสร้าง team โดยตรงและให้ผู้ใช้ยืนยันรายละเอียดของ team ใหม่.

เส้นทาง account settings สำหรับจัดการ team ที่ตรวจสอบไม่พร้อมใช้งานจาก session ปัจจุบัน จึงต้องให้ผู้ใช้สร้าง team ใหม่ผ่าน Team Switcher ใน Vercel dashboard แล้วส่งชื่อหรือ URL ของ workspace ใหม่ให้เชื่อม deployment ต่อ.

สร้าง Vercel team ใหม่ `lovee-xeno` และ deploy production สำเร็จที่ `https://lovee-backoffice-alpha.vercel.app` โดยหน้าแรกตอบกลับเป็นหน้าเข้าสู่ระบบของเว็บไซต์ตามการควบคุมสิทธิ์เจ้าของ.

Vercel project ใหม่ใน team `lovee-xeno` เชื่อมกับ `xEno6116/lovee-fixed` สำเร็จแล้ว และ deployment production สถานะ Ready. ต้องปรับ production branch ให้เป็น `fullstack-backoffice-20260819` ให้ตรงตามข้อกำหนดเดิมก่อนปิดการตรวจ deployment จาก Git.

Project configuration ยืนยันว่า Git link เชื่อมสำเร็จแต่ production branch เริ่มต้นเป็น `main`; deployment production ที่มีอยู่ถูกสร้างจาก commit `9507b4f` บน branch `fullstack-backoffice-20260819`. กำลังตรวจตำแหน่งตั้งค่า branch ใน Vercel dashboard เพื่อให้ Git deployment ในอนาคตใช้ branch เดียวกัน.

หน้า Environments ของ Vercel project ยืนยันว่า Production กำลัง track branch `main` และมีช่อง Branch Tracking ที่แก้ไขได้ รวมทั้งพบ environment variables ที่จำเป็นสำหรับ GitHub storage, OAuth และ S3 ครบใน Production/Preview.

ตั้งค่า Branch Tracking ของ Production สำเร็จเป็น `fullstack-backoffice-20260819` แล้ว และ Vercel แจ้งให้ redeploy commit จาก branch นี้เพื่อผูก production deployment ให้ตรงกับ branch ที่กำหนด.

เริ่ม redeploy Production จาก Vercel หลังบันทึก Branch Tracking แล้ว โดยใช้ source code จาก deployment ของ branch `fullstack-backoffice-20260819`; กำลังรอสถานะ build ให้เสร็จ.

deployment ใหม่จาก Git branch `fullstack-backoffice-20260819` สร้างสำเร็จและ Ready แต่ deployment แบบ CLI ล่าสุดที่ทดสอบ explicit API routes แสดงสถานะไม่สมบูรณ์ จึงกำลังตรวจ logs และ Git configuration ก่อนส่งมอบ.
