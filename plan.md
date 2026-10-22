# แผนปรับปรุง LoveOffice — Galaxy Memory UI

## ขอบเขตการส่งมอบ
ปรับปรุงเว็บไซต์เดิมให้สวยงามขึ้น ใช้งานได้ลื่นและไม่มีจุดสะดุด โดยคงฟีเจอร์เดิมทั้งหมด ได้แก่ การล็อกอินเจ้าของ, การสร้างและลบเว็บไซต์, PIN lock, ตัวนับวันครบรอบ, แกลเลอรี่รูป, วิดีโอ 4 ช่อง, เพลง, ข้อความลับ และหน้า Settings รวมถึงการเรียกข้อมูลผ่าน backend เดิม

## แนวทางการออกแบบ

- **Nebula editorial / cosmic glass — 0.08**: พื้นหลังอวกาศเข้ม เลย์เอาต์แบบ editorial ใช้ glass panels และเส้นวงโคจร
- **Starlit scrapbook — 0.06**: สมุดความทรงจำโทน midnight มีการ์ดเหมือนฟิล์มและสติกเกอร์ดาว
- **Aurora observatory — 0.04**: แดชบอร์ดคล้ายห้องสังเกตการณ์ ใช้แสงออโรราและ typography แบบเทคโนโลยี

เลือกใช้ **Nebula editorial / cosmic glass** เพราะทำให้ทั้งหน้า public ที่โรแมนติกและหลังบ้านที่จริงจังอยู่ใน visual system เดียวกัน โดยยังอ่านง่ายบนมือถือ

### หลักการออกแบบ
- **Design movement:** cosmic glassmorphism ผสม editorial layout ที่มีจุดนำสายตา ไม่ใช่การวางการ์ดกลางหน้าซ้ำ ๆ
- **Core principles:** ลำดับชัดเจน, glass ที่โปร่งแต่ contrast สูง, motion ที่ตอบสนอง, responsive-first
- **Color philosophy:** midnight navy เป็น canvas ที่ทำให้ความทรงจำเด่นขึ้น; violet/cyan/pink เป็นแสงเนบิวลาและ accent ที่สื่อถึงความรักกับความมหัศจรรย์
- **Layout paradigm:** ใช้เส้นทางสายตาแบบ orbit — hero/ข้อมูลสำคัญอยู่แกนหลักและส่วนรองลอยเป็น satellite panels
- **Signature elements:** starfield แบบ CSS, orbital rings, glass cards พร้อม glow และ status pills แบบ telemetry
- **Interaction philosophy:** ทุก action มี feedback ด้วย hover lift, glow, loading state และสถานะที่อ่านได้ ไม่พึ่ง animation อย่างเดียว
- **Animation:** ดาว twinkle ช้า ๆ, nebula drift, card hover ยกขึ้นเล็กน้อย, progress/clock pulse; ปิด motion ตาม prefers-reduced-motion
- **Typography system:** ใช้ Space Grotesk/DM Sans สำหรับ UI และ Noto Sans Thai fallback; headline หนา กระชับ, label uppercase เล็กสำหรับ metadata
- **Brand essence:** ห้องเก็บความทรงจำของคนสองคนที่ทำให้เรื่องราวธรรมดาดูเหมือนอยู่ท่ามกลางดวงดาว — อบอุ่น, ละเอียดอ่อน, มีมนตร์เสน่ห์
- **Brand voice:** สั้น อบอุ่น และชวนค้นหา เช่น “เปิดพิกัดความทรงจำของเรา” และ “บันทึกช่วงเวลานี้ไว้ในวงโคจรของเรา”
- **Wordmark & logo:** ใช้ไอคอนวงแหวนดาว 2 ชั้นคู่กับคำว่า LoveOffice ใน header แทนการใช้ตัวอักษรลอย ๆ
- **Signature brand color:** Nebula violet `#8B5CF6` ผสม electric cyan `#22D3EE`

## Implementation approach

1. เปลี่ยน global tokens และ utility classes ใน `client/src/index.css` เป็นระบบสี midnight/nebula พร้อม starfield, glass, glow, responsive states และ reduced-motion fallback
2. ปรับ `Dashboard.tsx` ให้มี login gate แบบ cosmic, dashboard header, create form, stat cards และ site cards ที่สแกนข้อมูลได้เร็ว โดยไม่เปลี่ยน API หรือ mutation เดิม
3. ปรับ `Settings.tsx` เป็น control room แบบสองคอลัมน์บน desktop และ single-column บนมือถือ คง input/upload/delete/save behavior เดิมทั้งหมด
4. ปรับ `Home.tsx` เป็น public memory experience แบบ unlock portal + orbit layout เพิ่ม visual hierarchy, theme-aware CSS variables, gallery/video controls และ music dock โดยไม่เปลี่ยน data flow
5. ปรับ `App.tsx` / route metadata เฉพาะที่จำเป็น และรักษา route manifest ให้ครบเหมือนเดิม

## Project structure

- `client/src/pages/Dashboard.tsx`: หลังบ้านรวมเว็บไซต์และฟอร์มสร้างเว็บไซต์
- `client/src/pages/Settings.tsx`: ตั้งค่าข้อความ ธีม PIN วันหมดอายุ และสื่อ
- `client/src/pages/Home.tsx`: หน้า public, PIN unlock, counter, media carousel, music
- `client/src/index.css`: design tokens, responsive layout, animations และ legacy-compatible classes
- `client/public/manus-routes.json`: route declarations สำหรับทุกหน้า
- `server/`: tRPC/API และ storage เดิม ไม่เปลี่ยนในงานนี้

## Constraints

- ไม่เปลี่ยน schema, API contract, auth flow หรือระบบจัดเก็บสื่อ
- ไม่ hard-code ข้อมูลเว็บไซต์หรือ secret ลง frontend
- ใช้ CSS/ไอคอนจาก dependency เดิมเป็นหลัก ไม่เพิ่มบริการภายนอกที่ไม่จำเป็น
- ต้องทำงานได้ที่ desktop/mobile และไม่เกิด horizontal overflow

## รอบปรับปรุงเพิ่มเติม
- เพิ่มการเลือกอัปโหลดรูปหลายไฟล์ในครั้งเดียว เพื่อลดจำนวนคลิกในการสร้างแกลเลอรี
- เพิ่มฟอร์มจดหมายบนหน้า public และส่งผ่าน Resend ฝั่ง server โดยเก็บคีย์ไว้ใน environment เท่านั้น
- เพิ่มอีเมลผู้รับในหน้า Settings โดยไม่นำค่าอีเมลออกไปใน public response
