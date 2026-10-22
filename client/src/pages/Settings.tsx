import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  Clapperboard,
  ImagePlus,
  KeyRound,
  Loader2,
  MessageCircleHeart,
  Music2,
  Orbit,
  Palette,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import CosmicBackdrop from "@/components/CosmicBackdrop";
import { trpc } from "@/lib/trpc";

function toDateTimeLocal(value?: string | null) {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
}

function UploadTrigger({ accept, disabled, onChange, label }: { accept: string; disabled: boolean; onChange: (event: ChangeEvent<HTMLInputElement>) => void; label: string }) {
  return <label className={`cosmic-upload-trigger ${disabled ? "is-disabled" : ""}`}>
    <Upload size={16} /><span>{label}</span><input type="file" accept={accept} disabled={disabled} onChange={onChange} />
  </label>;
}

export default function Settings({ slug }: { slug: string }) {
  const utils = trpc.useUtils();
  const { isAuthenticated, loading } = useAuth();
  const adminQuery = trpc.site.admin.get.useQuery({ slug }, { enabled: isAuthenticated });
  const [memoryMessage, setMemoryMessage] = useState("");
  const [secretMessage, setSecretMessage] = useState("");
  const [startDate, setStartDate] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [pin, setPin] = useState("");
  const [themeColor, setThemeColor] = useState("#8b5cf6");
  const [backgroundStyle, setBackgroundStyle] = useState<"soft" | "sunset" | "night" | "paper">("night");
  const [themeMode, setThemeMode] = useState<"light" | "night">("night");
  const [fontFamily, setFontFamily] = useState<"gaegu" | "serif" | "sans">("sans");
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "error" | "info"; message: string } | null>(null);
  const invalidateSite = () => { void utils.site.admin.get.invalidate({ slug }); void utils.site.private.get.invalidate({ slug }); };
  const saveMutation = trpc.site.admin.saveSettings.useMutation({ onSuccess: () => { invalidateSite(); setPin(""); setStatus({ tone: "success", message: "บันทึกการตั้งค่าแล้ว — ความทรงจำของคุณอัปเดตเรียบร้อย" }); }, onError: (error) => setStatus({ tone: "error", message: `บันทึกไม่สำเร็จ: ${error.message}` }) });
  const prepareUploadMutation = trpc.site.admin.prepareUpload.useMutation();
  const finalizeUploadMutation = trpc.site.admin.finalizeUpload.useMutation({ onSuccess: invalidateSite });
  const removeMutation = trpc.site.admin.removeMedia.useMutation({ onSuccess: () => { invalidateSite(); setStatus({ tone: "success", message: "นำไฟล์ออกจากวงโคจรแล้ว" }); }, onError: (error) => setStatus({ tone: "error", message: `ลบไฟล์ไม่สำเร็จ: ${error.message}` }) });

  useEffect(() => {
    const settings = adminQuery.data?.settings;
    if (settings) {
      setMemoryMessage(settings.memoryMessage);
      setSecretMessage(settings.secretMessage ?? "");
      setStartDate(settings.startDate);
      setExpiresAt(toDateTimeLocal(settings.expiresAt));
      setThemeColor(settings.themeColor ?? "#8b5cf6");
      setBackgroundStyle(settings.backgroundStyle ?? "night");
      setThemeMode(settings.themeMode ?? "night");
      setFontFamily(settings.fontFamily ?? "sans");
    }
  }, [adminQuery.data?.settings]);

  const assets = adminQuery.data?.assets ?? [];
  const videos = useMemo(() => assets.filter((asset) => asset.kind === "video"), [assets]);
  const images = useMemo(() => assets.filter((asset) => asset.kind === "image"), [assets]);
  const songs = useMemo(() => assets.filter((asset) => asset.kind === "audio"), [assets]);

  const uploadFiles = async (kind: "image" | "video" | "audio", files: File[]) => {
    if (!files.length) return;
    if (kind === "video" && videos.length >= 4) { setStatus({ tone: "error", message: "อัปโหลดวิดีโอได้สูงสุด 4 ช่อง" }); return; }
    setUploading(true);
    setStatus({ tone: "info", message: "กำลังส่งไฟล์ขึ้นสู่วงโคจรความทรงจำ…" });
    try {
      for (const file of files) {
        const mimeType = file.type || "application/octet-stream";
        const plan = await prepareUploadMutation.mutateAsync({ slug, kind, fileName: file.name, mimeType });
        const response = await fetch(plan.uploadUrl, { method: "PUT", headers: { "Content-Type": mimeType }, body: file });
        if (!response.ok) throw new Error(`อัปโหลดไฟล์ไปยังพื้นที่จัดเก็บไม่สำเร็จ (${response.status})`);
        await finalizeUploadMutation.mutateAsync({ slug, kind, fileName: file.name, mimeType, key: plan.key, url: plan.url });
      }
      setStatus({ tone: "success", message: `อัปโหลด ${files[0].name} เรียบร้อยแล้ว` });
    } catch (error) {
      setStatus({ tone: "error", message: `อัปโหลดไม่สำเร็จ: ${error instanceof Error ? error.message : "เกิดข้อผิดพลาด"}` });
    } finally { setUploading(false); }
  };

  const onFiles = (kind: "image" | "video" | "audio") => async (event: ChangeEvent<HTMLInputElement>) => {
    try { const file = event.target.files?.[0]; if (file) await uploadFiles(kind, [file]); } finally { event.target.value = ""; }
  };
  const save = () => {
    const musicUrl = adminQuery.data?.settings.musicUrl ?? "";
    setStatus({ tone: "info", message: "กำลังบันทึกการตั้งค่า…" });
    saveMutation.mutate({ slug, memoryMessage, secretMessage, startDate, pin: pin || undefined, musicUrl, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null, themeColor, backgroundStyle, themeMode, fontFamily });
  };
  const remove = (id: number) => removeMutation.mutate({ slug, id });

  if (loading || (isAuthenticated && adminQuery.isLoading)) return <div className="cosmic-app-shell cosmic-center-shell"><CosmicBackdrop /><div className="cosmic-loading-card"><Loader2 className="animate-spin" size={24} />กำลังซิงก์ข้อมูล…</div></div>;
  if (!isAuthenticated) return <div className="cosmic-app-shell cosmic-center-shell"><CosmicBackdrop /><div className="cosmic-access-card"><ShieldCheck size={30} /><h1>พื้นที่เจ้าของเว็บไซต์</h1><p>เข้าสู่ระบบก่อน เพื่อจัดการความทรงจำในหน้านี้</p><button className="cosmic-primary-button" onClick={() => startLogin()}><ArrowLeft size={17} />เข้าสู่ระบบ</button></div></div>;
  if (adminQuery.error || !adminQuery.data) return <div className="cosmic-app-shell cosmic-center-shell"><CosmicBackdrop /><div className="cosmic-access-card"><Orbit size={30} /><h1>ไม่พบวงโคจรนี้</h1><p>เว็บไซต์นี้ไม่มีอยู่ในระบบ หรือเป็นของเจ้าของรายอื่น</p><Link className="cosmic-secondary-button" href="/dashboard">กลับแดชบอร์ด</Link></div></div>;

  return <div className="cosmic-app-shell cosmic-settings-shell"><CosmicBackdrop />
    <header className="cosmic-settings-topbar"><Link href="/dashboard" className="cosmic-back-link"><ArrowLeft size={17} />ทุกเว็บไซต์</Link><span className="cosmic-settings-topbar-label"><Sparkles size={14} />MEMORY CONTROL ROOM</span><Link href={`/site/${slug}`} className="cosmic-preview-link">ดูหน้าเว็บ <span>↗</span></Link></header>
    <main className="cosmic-settings-content">
      <section className="cosmic-settings-heading"><div><span className="cosmic-eyebrow"><Settings2 size={15} /> SITE SETTINGS</span><h1>{adminQuery.data.site.title}</h1><p>ปรับแต่งทุกองค์ประกอบของความทรงจำนี้ได้จากที่เดียว</p></div><div className="cosmic-settings-orb"><span>{assets.length}</span><small>ASSETS</small></div></section>
      {status && <p className={`cosmic-status cosmic-status-${status.tone}`} role="status">{status.tone === "success" ? <Check size={16} /> : <Sparkles size={16} />}{status.message}</p>}

      <div className="cosmic-settings-layout">
        <aside className="cosmic-settings-aside"><div className="cosmic-aside-orbit"><Orbit size={26} /><span>PRIVATE<br />ORBIT</span></div><h2>สถานีควบคุม<br />ความทรงจำ</h2><p>ทุกครั้งที่บันทึก การเปลี่ยนแปลงจะปรากฏบนหน้าเว็บไซต์ของคุณ</p><div className="cosmic-aside-metrics"><span><b>{videos.length}</b> / 4 วิดีโอ</span><span><b>{images.length}</b> รูปภาพ</span><span><b>{songs.length}</b> เพลง</span></div><Link href={`/site/${slug}`} className="cosmic-aside-preview">เปิดหน้าเว็บไซต์ <ArrowLeft size={15} /></Link></aside>
        <div className="cosmic-settings-panels">
          <section className="cosmic-panel cosmic-media-panel"><div className="cosmic-panel-heading"><div><span className="cosmic-section-kicker">VISUAL DIARY</span><h2><Clapperboard size={19} /> วิดีโอ</h2><p>ใส่ได้สูงสุด 4 ไฟล์ และเลือกเพิ่มภายหลังได้</p></div><span className="cosmic-count-chip">{videos.length}/4</span></div><div className="cosmic-video-slots">{Array.from({ length: 4 }, (_, index) => { const current = videos[index]; return <div className={`cosmic-video-slot ${current ? "is-filled" : ""}`} key={index}><span className="cosmic-slot-number">0{index + 1}</span>{current ? <><span className="cosmic-file-name">{current.originalName}</span><button type="button" className="cosmic-remove-button" onClick={() => remove(current.id)} disabled={removeMutation.isPending} aria-label={`ลบวิดีโอ ${index + 1}`}><Trash2 size={15} /></button></> : <UploadTrigger accept="video/*" disabled={uploading} onChange={onFiles("video")} label="เพิ่มวิดีโอ" />}</div>; })}</div></section>

          <div className="cosmic-media-split"><section className="cosmic-panel cosmic-media-panel"><div className="cosmic-panel-heading compact"><div><span className="cosmic-section-kicker">PHOTO DUST</span><h2><ImagePlus size={19} /> แกลเลอรี่</h2></div><UploadTrigger accept="image/*" disabled={uploading} onChange={onFiles("image")} label="เพิ่มรูป" /></div><div className="cosmic-file-list">{images.length ? images.map((asset, index) => <div className="cosmic-file-row" key={asset.id}><span className="cosmic-file-order">{String(index + 1).padStart(2, "0")}</span><span className="cosmic-file-name">{asset.originalName}</span><button type="button" className="cosmic-remove-button" onClick={() => remove(asset.id)} disabled={removeMutation.isPending} aria-label={`ลบรูป ${index + 1}`}><Trash2 size={15} /></button></div>) : <p className="cosmic-empty-copy">ยังไม่มีรูปภาพ — เลือกเพิ่มทีละไฟล์ได้</p>}</div></section>
          <section className="cosmic-panel cosmic-media-panel"><div className="cosmic-panel-heading compact"><div><span className="cosmic-section-kicker">SOUNDTRACK</span><h2><Music2 size={19} /> เพลงรัก</h2></div><UploadTrigger accept="audio/*" disabled={uploading} onChange={onFiles("audio")} label="เพิ่มเพลง" /></div><div className="cosmic-file-list">{songs.length ? songs.map((asset) => <div className="cosmic-file-row" key={asset.id}><Music2 size={15} /><span className="cosmic-file-name">{asset.originalName}</span><button type="button" className="cosmic-remove-button" onClick={() => remove(asset.id)} disabled={removeMutation.isPending} aria-label={`ลบเพลง ${asset.originalName}`}><Trash2 size={15} /></button></div>) : <p className="cosmic-empty-copy">ยังไม่มีเพลง — เพิ่ม soundtrack ของเราได้ที่นี่</p>}</div></section></div>

          <section className="cosmic-panel cosmic-details-panel"><div className="cosmic-panel-heading"><div><span className="cosmic-section-kicker">STORY & STYLE</span><h2><MessageCircleHeart size={19} /> ข้อความและธีม</h2><p>ทำให้หน้าเว็บไซต์สะท้อนเรื่องราวของคุณ</p></div></div><div className="cosmic-field-grid"><label className="cosmic-field-wide">ข้อความหน้าเว็บ<textarea value={memoryMessage} onChange={(event) => setMemoryMessage(event.target.value)} maxLength={5000} /></label><label className="cosmic-field-wide">ข้อความลับหลังกรอก PIN<textarea value={secretMessage} onChange={(event) => setSecretMessage(event.target.value)} placeholder="ข้อความนี้จะแสดงเฉพาะเมื่อกรอก PIN ถูกต้อง" maxLength={5000} /></label><label>วันที่เริ่มคบ<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label>รหัส PIN ใหม่ (4 หลัก)<span className="cosmic-input-with-icon"><KeyRound size={16} /><input type="text" inputMode="numeric" maxLength={4} value={pin} placeholder="คงค่าเดิมหากไม่เปลี่ยน" onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} /></span></label><label>โทนพื้นหลัง<select value={backgroundStyle} onChange={(event) => setBackgroundStyle(event.target.value as typeof backgroundStyle)}><option value="night">Galaxy midnight</option><option value="soft">Stardust soft</option><option value="sunset">Nebula sunset</option><option value="paper">Moonlit paper</option></select></label><label>ฟอนต์<select value={fontFamily} onChange={(event) => setFontFamily(event.target.value as typeof fontFamily)}><option value="sans">Modern sans</option><option value="gaegu">ลายมืออบอุ่น</option><option value="serif">Editorial serif</option></select></label><label>สีแสงประจำเว็บไซต์<span className="cosmic-color-input"><input type="color" value={themeColor} onChange={(event) => setThemeColor(event.target.value)} /><b>{themeColor}</b></span></label><label>โหมดสี<select value={themeMode} onChange={(event) => setThemeMode(event.target.value as typeof themeMode)}><option value="night">Night glow</option><option value="light">Light glow</option></select></label><label className="cosmic-field-wide">วันเวลาหมดอายุเว็บไซต์<span className="cosmic-input-with-icon"><CalendarClock size={16} /><input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></span><small>เมื่อถึงเวลานี้เว็บจะล็อก และเริ่มนับถอยหลัง 3 วันก่อนลบข้อมูลกับสื่อ หากไม่ต้องการหมดอายุให้เว้นว่าง</small></label></div></section>

          <div className="cosmic-save-bar"><div><strong>พร้อมบันทึกการเปลี่ยนแปลงแล้ว</strong><span>ข้อมูลและไฟล์ถูกแยกเฉพาะเว็บไซต์นี้</span></div><button className="cosmic-primary-button" type="button" onClick={save} disabled={saveMutation.isPending || uploading}>{saveMutation.isPending || uploading ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}{saveMutation.isPending ? "กำลังบันทึก…" : uploading ? "กำลังอัปโหลด…" : "บันทึกการตั้งค่า"}</button></div>
        </div>
      </div>
    </main>
  </div>;
}
