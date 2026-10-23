import { useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent } from "react";
import { Link } from "wouter";
import { Loader2, Music2, Trash2, Upload } from "lucide-react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import PageLayoutEditor from "@/components/PageLayoutEditor";
import { createDefaultPageElementLayouts, DEFAULT_MUSIC_PLAYER_LAYOUT, DEFAULT_SECTION_WIDTHS, normalizePageElementLayouts, type DesignSectionId, type MusicPlayerLayout, type PageElementId, type PageElementLayouts, type SectionWidths } from "@shared/site-layout";

function readAsDataUrl(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("ไม่สามารถอ่านไฟล์ได้")); reader.readAsDataURL(file); }); }
function toDateTimeLocal(value?: string | null) { return value ? new Date(value).toISOString().slice(0, 16) : ""; }

export default function Settings({ slug }: { slug: string }) {
  const utils = trpc.useUtils();
  const { isAuthenticated, loading } = useAuth();
  const adminQuery = trpc.site.admin.get.useQuery({ slug }, { enabled: isAuthenticated });
  const [memoryMessage, setMemoryMessage] = useState("");
  const [secretMessage, setSecretMessage] = useState("");
  const [startDate, setStartDate] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [pin, setPin] = useState("");
  const [themeColor, setThemeColor] = useState("#ec4899");
  const [backgroundStyle, setBackgroundStyle] = useState<"soft" | "sunset" | "night" | "paper">("soft");
  const [themeMode, setThemeMode] = useState<"light" | "night">("light");
  const [fontFamily, setFontFamily] = useState<"gaegu" | "serif" | "sans">("gaegu");
  const [letterRecipientEmail, setLetterRecipientEmail] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [layoutOrder, setLayoutOrder] = useState<DesignSectionId[]>(["video", "message", "secret", "gallery", "letter"]);
  const [hiddenSections, setHiddenSections] = useState<PageElementId[]>([]);
  const [sectionWidths, setSectionWidths] = useState<SectionWidths>(DEFAULT_SECTION_WIDTHS);
  const [elementLayouts, setElementLayouts] = useState<PageElementLayouts>(() => createDefaultPageElementLayouts());
  const [musicPlayerLayout, setMusicPlayerLayout] = useState<MusicPlayerLayout>(DEFAULT_MUSIC_PLAYER_LAYOUT);
  const playerCanvasRef = useRef<HTMLDivElement>(null);
  const activePlayerPointer = useRef<number | null>(null);
  const [status, setStatus] = useState<{ tone: "success" | "error" | "info"; message: string } | null>(null);
  const invalidateSite = () => { void utils.site.admin.get.invalidate({ slug }); void utils.site.private.get.invalidate({ slug }); };
  const saveMutation = trpc.site.admin.saveSettings.useMutation({ onSuccess: () => { invalidateSite(); setPin(""); setStatus({ tone: "success", message: "บันทึกการตั้งค่าแล้ว" }); }, onError: (error) => setStatus({ tone: "error", message: `บันทึกไม่สำเร็จ: ${error.message}` }) });
  const prepareUploadMutation = trpc.site.admin.prepareUpload.useMutation();
  const finalizeUploadMutation = trpc.site.admin.finalizeUpload.useMutation({ onSuccess: invalidateSite });
  const removeMutation = trpc.site.admin.removeMedia.useMutation({ onSuccess: () => { invalidateSite(); setStatus({ tone: "success", message: "ลบไฟล์ออกจากรายการแล้ว" }); }, onError: (error) => setStatus({ tone: "error", message: `ลบไฟล์ไม่สำเร็จ: ${error.message}` }) });

  useEffect(() => { const settings = adminQuery.data?.settings; if (settings) { const order = settings.layoutOrder ?? ["video", "message", "secret", "gallery", "letter"]; const widths = { ...DEFAULT_SECTION_WIDTHS, ...settings.sectionWidths }; const defaults = createDefaultPageElementLayouts(order, widths); setMemoryMessage(settings.memoryMessage); setSecretMessage(settings.secretMessage ?? ""); setStartDate(settings.startDate); setExpiresAt(toDateTimeLocal(settings.expiresAt)); setThemeColor(settings.themeColor ?? "#ec4899"); setBackgroundStyle(settings.backgroundStyle ?? "soft"); setThemeMode(settings.themeMode ?? "light"); setFontFamily(settings.fontFamily ?? "gaegu"); setLetterRecipientEmail(settings.letterRecipientEmail ?? ""); setLayoutOrder(order); setHiddenSections(settings.hiddenSections ?? []); setSectionWidths(widths); setElementLayouts(normalizePageElementLayouts(defaults, settings.elementLayouts)); setMusicPlayerLayout(settings.musicPlayerLayout ?? DEFAULT_MUSIC_PLAYER_LAYOUT); } }, [adminQuery.data?.settings]);
  useEffect(() => { const id = decodeURIComponent(window.location.hash.slice(1)); if (!id) return; const frame = window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })); return () => window.cancelAnimationFrame(frame); }, [adminQuery.data?.site.id]);
  const assets = adminQuery.data?.assets ?? [];
  const videos = useMemo(() => assets.filter((asset) => asset.kind === "video"), [assets]);
  const images = useMemo(() => assets.filter((asset) => asset.kind === "image"), [assets]);
  const songs = useMemo(() => assets.filter((asset) => asset.kind === "audio"), [assets]);

  const uploadFiles = async (kind: "image" | "video" | "audio", files: File[]) => {
    if (!files.length) return;
    if (kind === "video" && videos.length >= 4) { setStatus({ tone: "error", message: "อัปโหลดวิดีโอได้สูงสุด 4 ช่อง" }); return; }
    setUploading(true); setUploadProgress(0); setStatus({ tone: "info", message: "กำลังเตรียมพื้นที่จัดเก็บไฟล์…" });
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const mimeType = file.type || "application/octet-stream";
        const plan = await prepareUploadMutation.mutateAsync({ slug, kind, fileName: file.name, mimeType });
        await new Promise<void>((resolve, reject) => {
          const request = new XMLHttpRequest();
          request.open("PUT", plan.uploadUrl);
          request.setRequestHeader("Content-Type", mimeType);
          request.upload.onprogress = (event) => { if (event.lengthComputable) setUploadProgress(Math.round(((index + event.loaded / event.total) / files.length) * 100)); };
          request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`อัปโหลดไฟล์ไปยังพื้นที่จัดเก็บไม่สำเร็จ (${request.status})`));
          request.onerror = () => reject(new Error("เชื่อมต่อ Cloud Storage ไม่สำเร็จ"));
          request.send(file);
        });
        await finalizeUploadMutation.mutateAsync({ slug, kind, fileName: file.name, mimeType, key: plan.key, url: plan.url });
      }
      setUploadProgress(100); setStatus({ tone: "success", message: `อัปโหลดไฟล์ ${files.length > 1 ? `${files.length} ไฟล์` : files[0].name} เรียบร้อยแล้ว` });
    } catch (error) {
      setStatus({ tone: "error", message: `อัปโหลดไม่สำเร็จ: ${error instanceof Error ? error.message : "เกิดข้อผิดพลาด"}` });
    } finally { setUploading(false); }
  };
  const onFiles = (kind: "image" | "video" | "audio") => async (event: ChangeEvent<HTMLInputElement>) => { try { const files = Array.from(event.target.files ?? []); if (files.length) await uploadFiles(kind, files); } finally { event.target.value = ""; } };
  const movePlayer = (event: PointerEvent<HTMLButtonElement>) => { if (activePlayerPointer.current !== event.pointerId || !playerCanvasRef.current) return; const rect = playerCanvasRef.current.getBoundingClientRect(); setMusicPlayerLayout((current) => ({ ...current, x: Math.max(12, Math.min(88, ((event.clientX - rect.left) / rect.width) * 100)), y: Math.max(12, Math.min(88, ((event.clientY - rect.top) / rect.height) * 100)) })); };
  const save = () => { const musicUrl = adminQuery.data?.settings.musicUrl ?? ""; setStatus({ tone: "info", message: "กำลังบันทึกการตั้งค่า…" }); saveMutation.mutate({ slug, memoryMessage, secretMessage, startDate, pin: pin || undefined, musicUrl, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null, themeColor, backgroundStyle, themeMode, fontFamily, letterRecipientEmail, layoutOrder, hiddenSections, sectionWidths, musicPlayerLayout, elementLayouts }); };
  const remove = (id: number) => removeMutation.mutate({ slug, id });

  if (loading || (isAuthenticated && adminQuery.isLoading)) return <div className="legacy-admin-screen"><div className="legacy-admin-box text-center"><Loader2 className="mx-auto animate-spin text-pink-500" /></div></div>;
  if (!isAuthenticated) return <div className="legacy-admin-screen"><div className="legacy-admin-box text-center"><h3>หลังบ้านเจ้าของเว็บไซต์</h3><p className="legacy-admin-note">เข้าสู่ระบบด้วยบัญชีเจ้าของก่อน จึงจะแก้ไขเว็บไซต์นี้ได้</p><button className="legacy-save-btn mt-5" onClick={() => startLogin()}>เข้าสู่ระบบด้วยบัญชีแพลตฟอร์ม</button><Link className="legacy-close-btn mt-3 inline-block" href="/dashboard">ไปหน้าเข้าสู่ระบบเจ้าของเว็บไซต์</Link><p className="legacy-admin-note mt-3">หากใช้บัญชีอีเมลหรือรหัสเจ้าของเดิม ให้เข้าสู่ระบบจากหน้าเจ้าของเว็บไซต์</p></div></div>;
  if (adminQuery.error || !adminQuery.data) return <div className="legacy-admin-screen"><div className="legacy-admin-box text-center"><h3>ไม่พบเว็บไซต์นี้</h3><p className="legacy-admin-note">เว็บไซต์นี้เป็นของเจ้าของรายอื่น หรือไม่มีอยู่ในระบบ</p><Link className="legacy-close-btn mt-4 inline-block" href="/dashboard">กลับแดชบอร์ด</Link></div></div>;

  return <div className="legacy-admin-screen"><section className="legacy-admin-box"><div className="flex items-center justify-between gap-3"><h3>{adminQuery.data.site.title}</h3><div className="flex flex-wrap items-center justify-end gap-2"><Link className="legacy-close-btn" href="/dashboard">หน้าหลังบ้าน</Link><Link className="legacy-close-btn" href={`/site/${slug}`}>ดูเว็บไซต์</Link></div></div><div className="legacy-admin-stack">
    {status && <p className={`legacy-status legacy-status-${status.tone}`} role="status">{status.message}{uploading && <><span className="legacy-upload-progress-label"> {uploadProgress}%</span><span className="legacy-upload-progress"><span style={{ width: `${uploadProgress}%` }} /></span></>}</p>}
    <nav className="legacy-settings-nav" aria-label="ทางลัดการตั้งค่า"><a href="#settings-layout">ออกแบบ</a><a href="#settings-media">รูป/วิดีโอ/เพลง</a><a href="#settings-content">ข้อความ</a><a href="#settings-privacy">ความเป็นส่วนตัว</a></nav>
    <div id="settings-layout" className="legacy-design-card legacy-layout-editor">
      <div className="legacy-design-heading"><div><h4>จัดวางหน้าเว็บ 🎨</h4><p className="legacy-admin-note">ลากย้ายและปรับขนาดหัวเว็บกับทุกส่วนบนหน้าเว็บได้ แล้วกดบันทึก</p></div><Link className="legacy-close-btn" href={`/site/${slug}`}>ดูตัวอย่าง</Link></div>
      <PageLayoutEditor layouts={elementLayouts} onChange={setElementLayouts} hiddenSections={hiddenSections} onHiddenSectionsChange={setHiddenSections} />
      <div className="legacy-player-editor"><div><h4><Music2 size={17} /> วางเครื่องเล่นเพลง</h4><p>ลากเครื่องเล่นไปยังตำแหน่งที่ต้องการ แล้วปรับขนาดได้</p></div>
        <div ref={playerCanvasRef} className="legacy-player-canvas">
          <div className="legacy-player-canvas-label">ตัวอย่างหน้าเว็บ</div>
          <button type="button" className="legacy-player-canvas-widget" style={{ left: `${musicPlayerLayout.x}%`, top: `${musicPlayerLayout.y}%`, transform: `translate(-50%, -50%) scale(${musicPlayerLayout.scale})` }} onPointerDown={(event) => { event.preventDefault(); activePlayerPointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={movePlayer} onPointerUp={() => { activePlayerPointer.current = null; }} onPointerCancel={() => { activePlayerPointer.current = null; }} aria-label="ลากเพื่อกำหนดตำแหน่งเครื่องเล่นเพลง"><span className="legacy-player-mini-disc">♫</span><span><strong>เพลงของเรา</strong><small>ลากเพื่อย้ายตำแหน่ง</small></span><span className="legacy-player-mini-play">▶</span></button>
        </div>
        <label className="legacy-player-scale">ขนาดเครื่องเล่น <input type="range" min="0.7" max="1.3" step="0.05" value={musicPlayerLayout.scale} onChange={(event) => setMusicPlayerLayout((current) => ({ ...current, scale: Number(event.target.value) }))} /><output>{Math.round(musicPlayerLayout.scale * 100)}%</output></label>
      </div>
    </div>
    <div id="settings-media"><label>ช่องวิดีโอ (เลือกใส่ได้สูงสุด 4 ไฟล์)</label><div className="legacy-input-stack">{Array.from({ length: 4 }, (_, index) => { const current = videos[index]; return <div className="legacy-upload-row" key={index}>{current ? <><span className="truncate">วิดีโอ {index + 1}: {current.originalName}</span><button type="button" onClick={() => remove(current.id)} aria-label="ลบวิดีโอ"><Trash2 size={15} /></button></> : <input type="file" accept="video/*" className="legacy-file-input" disabled={uploading} onChange={onFiles("video")} aria-label={`วิดีโอที่ ${index + 1}`} />}</div>; })}</div><p className="legacy-admin-note">เลือกใส่ภายหลังได้ ไม่จำเป็นต้องมีครบทั้ง 4 ช่อง</p></div>
    <div><label>แกลเลอรี่ภาพ 📸 (เลือกหลายรูปได้)</label><input type="file" accept="image/*" multiple className="legacy-file-input" disabled={uploading} onChange={onFiles("image")} />{images.length ? <div className="legacy-media-list">{images.map((asset, index) => <div className="legacy-upload-row" key={asset.id}><span className="truncate">รูป {index + 1}: {asset.originalName}</span><button type="button" onClick={() => remove(asset.id)} aria-label={`ลบรูป ${index + 1}`}><Trash2 size={15} /></button></div>)}</div> : <p className="legacy-admin-note">ยังไม่มีรูปภาพ — เลือกไฟล์ใหม่ได้ทีละไฟล์</p>}</div>
    <div><label>เพลงรัก (ไฟล์เสียง, ทีละ 1 ไฟล์)</label><input type="file" accept="audio/*" className="legacy-file-input" disabled={uploading} onChange={onFiles("audio")} />{songs.length ? <div className="legacy-media-list">{songs.map((asset) => <div className="legacy-upload-row" key={asset.id}><span className="truncate">{asset.originalName}</span><button type="button" onClick={() => remove(asset.id)} aria-label={`ลบเพลง ${asset.originalName}`}><Trash2 size={15} /></button></div>)}</div> : <p className="legacy-admin-note">ยังไม่มีเพลง — เลือกไฟล์ใหม่ได้ทีละไฟล์</p>}</div>
    <div id="settings-content" className="legacy-basic-card"><h4>ตั้งค่าพื้นฐาน ⚙️</h4><label>ข้อความหน้าเว็บ</label><textarea className="legacy-file-input h-20" value={memoryMessage} onChange={(event) => setMemoryMessage(event.target.value)} /><label className="mt-4">ข้อความลับหลังกรอกรหัสผ่าน</label><textarea className="legacy-file-input h-20" value={secretMessage} onChange={(event) => setSecretMessage(event.target.value)} placeholder="ข้อความนี้จะแสดงหลังกรอกรหัสผ่านถูกต้องเท่านั้น" /><div className="legacy-admin-grid"><div><label>วันที่เริ่มคบ</label><input type="date" className="legacy-file-input" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></div><div><label>รหัสผ่านเข้าชม (4 หลัก)</label><input type="text" className="legacy-file-input" inputMode="numeric" maxLength={4} value={pin} placeholder="คงค่าเดิมหากไม่เปลี่ยน" onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} /><p className="legacy-admin-note">คนที่ได้รับลิงก์จะต้องใช้รหัสนี้ก่อนเข้าชมเว็บไซต์</p></div></div><div className="legacy-admin-grid mt-4"><div><label>ธีม</label><select className="legacy-file-input" value={backgroundStyle} onChange={(event) => setBackgroundStyle(event.target.value as typeof backgroundStyle)}><option value="soft">Soft</option><option value="sunset">Sunset</option><option value="night">Night</option><option value="paper">Paper</option></select></div><div><label>ฟ้อนต์</label><select className="legacy-file-input" value={fontFamily} onChange={(event) => setFontFamily(event.target.value as typeof fontFamily)}><option value="gaegu">ลายมือ</option><option value="serif">Serif</option><option value="sans">Sans</option></select></div></div><div className="legacy-admin-grid"><div><label>สีธีม</label><input type="color" className="h-10 w-full" value={themeColor} onChange={(event) => setThemeColor(event.target.value)} /></div><div><label>โหมดสี</label><select className="legacy-file-input" value={themeMode} onChange={(event) => setThemeMode(event.target.value as typeof themeMode)}><option value="light">Light</option><option value="night">Night</option></select></div></div><div id="settings-privacy" className="mt-4"><label>อีเมลรับจดหมาย</label><input type="email" className="legacy-file-input" value={letterRecipientEmail} onChange={(event) => setLetterRecipientEmail(event.target.value)} placeholder="your@email.com" /><p className="legacy-admin-note">จดหมายจากหน้าเว็บจะถูกส่งมาที่อีเมลนี้</p></div><div className="mt-4"><label>วันเวลาหมดอายุเว็บไซต์</label><input type="datetime-local" className="legacy-file-input" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /><p className="legacy-admin-note">เมื่อถึงเวลานี้เว็บจะล็อกทั้งเว็บ และเริ่มนับถอยหลัง 3 วันก่อนลบข้อมูลกับสื่อของเว็บไซต์นี้ หากไม่ต้องการหมดอายุให้เว้นว่าง</p></div></div>
    <div className="legacy-admin-actions"><button className="legacy-save-btn" type="button" onClick={save} disabled={saveMutation.isPending || uploading}>{saveMutation.isPending || uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}บันทึก</button><Link className="legacy-close-btn" href={`/site/${slug}`}>ดูเว็บไซต์</Link></div>
    <Link className="legacy-close-btn text-center" href="/dashboard">กลับแดชบอร์ด</Link><div className="legacy-guide"><h4>เว็บไซต์ส่วนตัว</h4><p>ข้อมูลและสื่อของเว็บไซต์นี้ถูกแยกจากเว็บไซต์อื่น และเปิดได้เฉพาะเจ้าของที่ล็อกอินอยู่</p></div>
  </div></section></div>;
}
