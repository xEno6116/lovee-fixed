import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Link } from "wouter";
import { Loader2, Trash2, Upload } from "lucide-react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

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
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "error" | "info"; message: string } | null>(null);
  const invalidateSite = () => { void utils.site.admin.get.invalidate({ slug }); void utils.site.private.get.invalidate({ slug }); };
  const saveMutation = trpc.site.admin.saveSettings.useMutation({ onSuccess: () => { invalidateSite(); setPin(""); setStatus({ tone: "success", message: "บันทึกการตั้งค่าแล้ว" }); }, onError: (error) => setStatus({ tone: "error", message: `บันทึกไม่สำเร็จ: ${error.message}` }) });
  const prepareUploadMutation = trpc.site.admin.prepareUpload.useMutation();
  const finalizeUploadMutation = trpc.site.admin.finalizeUpload.useMutation({ onSuccess: invalidateSite });
  const removeMutation = trpc.site.admin.removeMedia.useMutation({ onSuccess: () => { invalidateSite(); setStatus({ tone: "success", message: "ลบไฟล์ออกจากรายการแล้ว" }); }, onError: (error) => setStatus({ tone: "error", message: `ลบไฟล์ไม่สำเร็จ: ${error.message}` }) });

  useEffect(() => { const settings = adminQuery.data?.settings; if (settings) { setMemoryMessage(settings.memoryMessage); setSecretMessage(settings.secretMessage ?? ""); setStartDate(settings.startDate); setExpiresAt(toDateTimeLocal(settings.expiresAt)); } }, [adminQuery.data?.settings]);
  const assets = adminQuery.data?.assets ?? [];
  const videos = useMemo(() => assets.filter((asset) => asset.kind === "video"), [assets]);
  const images = useMemo(() => assets.filter((asset) => asset.kind === "image"), [assets]);
  const songs = useMemo(() => assets.filter((asset) => asset.kind === "audio"), [assets]);

  const uploadFiles = async (kind: "image" | "video" | "audio", files: File[]) => {
    if (!files.length) return;
    if (kind === "video" && videos.length >= 4) { setStatus({ tone: "error", message: "อัปโหลดวิดีโอได้สูงสุด 4 ช่อง" }); return; }
    setUploading(true); setStatus({ tone: "info", message: "กำลังเตรียมพื้นที่จัดเก็บไฟล์…" });
    try {
      for (const file of files) {
        const mimeType = file.type || "application/octet-stream";
        const plan = await prepareUploadMutation.mutateAsync({ slug, kind, fileName: file.name, mimeType });
        const response = await fetch(plan.uploadUrl, { method: "PUT", headers: { "Content-Type": mimeType }, body: file });
        if (!response.ok) throw new Error(`อัปโหลดไฟล์ไปยังพื้นที่จัดเก็บไม่สำเร็จ (${response.status})`);
        await finalizeUploadMutation.mutateAsync({ slug, kind, fileName: file.name, mimeType, key: plan.key, url: plan.url });
      }
      setStatus({ tone: "success", message: `อัปโหลดไฟล์ ${files[0].name} เรียบร้อยแล้ว` });
    } catch (error) {
      setStatus({ tone: "error", message: `อัปโหลดไม่สำเร็จ: ${error instanceof Error ? error.message : "เกิดข้อผิดพลาด"}` });
    } finally { setUploading(false); }
  };
  const onFiles = (kind: "image" | "video" | "audio") => async (event: ChangeEvent<HTMLInputElement>) => { try { const file = event.target.files?.[0]; if (file) await uploadFiles(kind, [file]); } finally { event.target.value = ""; } };
  const save = () => { const musicUrl = adminQuery.data?.settings.musicUrl ?? ""; setStatus({ tone: "info", message: "กำลังบันทึกการตั้งค่า…" }); saveMutation.mutate({ slug, memoryMessage, secretMessage, startDate, pin: pin || undefined, musicUrl, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null }); };
  const remove = (id: number) => removeMutation.mutate({ slug, id });

  if (loading || (isAuthenticated && adminQuery.isLoading)) return <div className="legacy-admin-screen"><div className="legacy-admin-box text-center"><Loader2 className="mx-auto animate-spin text-pink-500" /></div></div>;
  if (!isAuthenticated) return <div className="legacy-admin-screen"><div className="legacy-admin-box text-center"><h3>เว็บไซต์ส่วนตัว</h3><p className="legacy-admin-note">เข้าสู่ระบบเจ้าของเว็บไซต์ก่อนเพื่อจัดการข้อมูล</p><button className="legacy-save-btn mt-5" onClick={() => startLogin()}>Sign in</button></div></div>;
  if (adminQuery.error || !adminQuery.data) return <div className="legacy-admin-screen"><div className="legacy-admin-box text-center"><h3>ไม่พบเว็บไซต์นี้</h3><p className="legacy-admin-note">เว็บไซต์นี้เป็นของเจ้าของรายอื่น หรือไม่มีอยู่ในระบบ</p><Link className="legacy-close-btn mt-4 inline-block" href="/dashboard">กลับแดชบอร์ด</Link></div></div>;

  return <div className="legacy-admin-screen"><section className="legacy-admin-box"><div className="flex items-center justify-between gap-3"><h3>{adminQuery.data.site.title}</h3><Link className="legacy-close-btn" href={`/site/${slug}`}>ปิด</Link></div><div className="legacy-admin-stack">
    {status && <p className={`legacy-status legacy-status-${status.tone}`} role="status">{status.message}</p>}
    <div><label>ช่องวิดีโอ (เลือกใส่ได้สูงสุด 4 ไฟล์)</label><div className="legacy-input-stack">{Array.from({ length: 4 }, (_, index) => { const current = videos[index]; return <div className="legacy-upload-row" key={index}>{current ? <><span className="truncate">วิดีโอ {index + 1}: {current.originalName}</span><button type="button" onClick={() => remove(current.id)} aria-label="ลบวิดีโอ"><Trash2 size={15} /></button></> : <input type="file" accept="video/*" className="legacy-file-input" disabled={uploading} onChange={onFiles("video")} aria-label={`วิดีโอที่ ${index + 1}`} />}</div>; })}</div><p className="legacy-admin-note">เลือกใส่ภายหลังได้ ไม่จำเป็นต้องมีครบทั้ง 4 ช่อง</p></div>
    <div><label>แกลเลอรี่ภาพ 📸 (อัปโหลดทีละ 1 ไฟล์)</label><input type="file" accept="image/*" className="legacy-file-input" disabled={uploading} onChange={onFiles("image")} />{images.length ? <div className="legacy-media-list">{images.map((asset, index) => <div className="legacy-upload-row" key={asset.id}><span className="truncate">รูป {index + 1}: {asset.originalName}</span><button type="button" onClick={() => remove(asset.id)} aria-label={`ลบรูป ${index + 1}`}><Trash2 size={15} /></button></div>)}</div> : <p className="legacy-admin-note">ยังไม่มีรูปภาพ — เลือกไฟล์ใหม่ได้ทีละไฟล์</p>}</div>
    <div><label>เพลงรัก (ไฟล์เสียง, ทีละ 1 ไฟล์)</label><input type="file" accept="audio/*" className="legacy-file-input" disabled={uploading} onChange={onFiles("audio")} />{songs.length ? <div className="legacy-media-list">{songs.map((asset) => <div className="legacy-upload-row" key={asset.id}><span className="truncate">{asset.originalName}</span><button type="button" onClick={() => remove(asset.id)} aria-label={`ลบเพลง ${asset.originalName}`}><Trash2 size={15} /></button></div>)}</div> : <p className="legacy-admin-note">ยังไม่มีเพลง — เลือกไฟล์ใหม่ได้ทีละไฟล์</p>}</div>
    <div className="legacy-basic-card"><h4>ตั้งค่าพื้นฐาน ⚙️</h4><label>ข้อความหน้าเว็บ</label><textarea className="legacy-file-input h-20" value={memoryMessage} onChange={(event) => setMemoryMessage(event.target.value)} /><label className="mt-4">ข้อความลับหลังกรอก PIN</label><textarea className="legacy-file-input h-20" value={secretMessage} onChange={(event) => setSecretMessage(event.target.value)} placeholder="ข้อความนี้จะแสดงหลังกรอก PIN ถูกต้องเท่านั้น" /><div className="legacy-admin-grid"><div><label>วันที่เริ่มคบ</label><input type="date" className="legacy-file-input" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></div><div><label>รหัส PIN (4 หลัก)</label><input type="text" className="legacy-file-input" inputMode="numeric" maxLength={4} value={pin} placeholder="คงค่าเดิมหากไม่เปลี่ยน" onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} /></div></div><div className="mt-4"><label>วันเวลาหมดอายุเว็บไซต์</label><input type="datetime-local" className="legacy-file-input" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /><p className="legacy-admin-note">เมื่อถึงเวลานี้เว็บจะล็อกทั้งเว็บ และเริ่มนับถอยหลัง 3 วันก่อนลบข้อมูลกับสื่อของเว็บไซต์นี้ หากไม่ต้องการหมดอายุให้เว้นว่าง</p></div></div>
    <div className="legacy-admin-actions"><button className="legacy-save-btn" type="button" onClick={save} disabled={saveMutation.isPending || uploading}>{saveMutation.isPending || uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}บันทึก</button><Link className="legacy-close-btn" href={`/site/${slug}`}>ดูเว็บไซต์</Link></div>
    <Link className="legacy-close-btn text-center" href="/dashboard">กลับแดชบอร์ด</Link><div className="legacy-guide"><h4>เว็บไซต์ส่วนตัว</h4><p>ข้อมูลและสื่อของเว็บไซต์นี้ถูกแยกจากเว็บไซต์อื่น และเปิดได้เฉพาะเจ้าของที่ล็อกอินอยู่</p></div>
  </div></section></div>;
}
