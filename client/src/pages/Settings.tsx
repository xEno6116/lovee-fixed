import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Link } from "wouter";
import { Loader2, Trash2, Upload } from "lucide-react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

function readAsDataUrl(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("ไม่สามารถอ่านไฟล์ได้")); reader.readAsDataURL(file); }); }

export default function Settings({ slug }: { slug: string }) {
  const utils = trpc.useUtils();
  const { isAuthenticated, loading } = useAuth();
  const adminQuery = trpc.site.admin.get.useQuery({ slug }, { enabled: isAuthenticated });
  const [memoryMessage, setMemoryMessage] = useState("");
  const [startDate, setStartDate] = useState("");
  const [pin, setPin] = useState("");
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "error" | "info"; message: string } | null>(null);
  const invalidateSite = () => { void utils.site.admin.get.invalidate({ slug }); void utils.site.private.get.invalidate({ slug }); };
  const saveMutation = trpc.site.admin.saveSettings.useMutation({ onSuccess: () => { invalidateSite(); setPin(""); setStatus({ tone: "success", message: "บันทึกการตั้งค่าแล้ว" }); }, onError: (error) => setStatus({ tone: "error", message: `บันทึกไม่สำเร็จ: ${error.message}` }) });
  const uploadMutation = trpc.site.admin.uploadMedia.useMutation({ onSuccess: invalidateSite, onError: (error) => setStatus({ tone: "error", message: `อัปโหลดไม่สำเร็จ: ${error.message}` }) });
  const removeMutation = trpc.site.admin.removeMedia.useMutation({ onSuccess: () => { invalidateSite(); setStatus({ tone: "success", message: "ลบไฟล์ออกจากรายการแล้ว" }); }, onError: (error) => setStatus({ tone: "error", message: `ลบไฟล์ไม่สำเร็จ: ${error.message}` }) });

  useEffect(() => { const settings = adminQuery.data?.settings; if (settings) { setMemoryMessage(settings.memoryMessage); setStartDate(settings.startDate); } }, [adminQuery.data?.settings]);
  const assets = adminQuery.data?.assets ?? [];
  const videos = useMemo(() => assets.filter((asset) => asset.kind === "video"), [assets]);
  const images = useMemo(() => assets.filter((asset) => asset.kind === "image"), [assets]);
  const songs = useMemo(() => assets.filter((asset) => asset.kind === "audio"), [assets]);

  const uploadFiles = async (kind: "image" | "video" | "audio", files: File[]) => {
    if (!files.length) return;
    if (kind === "video" && videos.length + files.length > 4) { setStatus({ tone: "error", message: "อัปโหลดวิดีโอได้สูงสุด 4 ช่อง" }); return; }
    setUploading(true); setStatus({ tone: "info", message: "กำลังอัปโหลดไฟล์ไปยังพื้นที่จัดเก็บ…" });
    try { for (const file of files) await uploadMutation.mutateAsync({ slug, kind, fileName: file.name, dataUrl: await readAsDataUrl(file) }); setStatus({ tone: "success", message: `อัปโหลด ${files.length} ไฟล์เรียบร้อยแล้ว` }); } catch (error) { setStatus({ tone: "error", message: `อัปโหลดไม่สำเร็จ: ${error instanceof Error ? error.message : "เกิดข้อผิดพลาด"}` }); } finally { setUploading(false); }
  };
  const onFiles = (kind: "image" | "video" | "audio") => async (event: ChangeEvent<HTMLInputElement>) => { try { await uploadFiles(kind, Array.from(event.target.files ?? [])); } finally { event.target.value = ""; } };
  const save = () => { const musicUrl = adminQuery.data?.settings.musicUrl ?? ""; setStatus({ tone: "info", message: "กำลังบันทึกการตั้งค่า…" }); saveMutation.mutate({ slug, memoryMessage, startDate, pin: pin || undefined, musicUrl }); };
  const remove = (id: number) => removeMutation.mutate({ slug, id });

  if (loading || (isAuthenticated && adminQuery.isLoading)) return <div className="legacy-admin-screen"><div className="legacy-admin-box text-center"><Loader2 className="mx-auto animate-spin text-pink-500" /></div></div>;
  if (!isAuthenticated) return <div className="legacy-admin-screen"><div className="legacy-admin-box text-center"><h3>เว็บไซต์ส่วนตัว</h3><p className="legacy-admin-note">เข้าสู่ระบบเจ้าของเว็บไซต์ก่อนเพื่อจัดการข้อมูล</p><button className="legacy-save-btn mt-5" onClick={() => startLogin()}>Sign in</button></div></div>;
  if (adminQuery.error || !adminQuery.data) return <div className="legacy-admin-screen"><div className="legacy-admin-box text-center"><h3>ไม่พบเว็บไซต์นี้</h3><p className="legacy-admin-note">เว็บไซต์นี้เป็นของเจ้าของรายอื่น หรือไม่มีอยู่ในระบบ</p><Link className="legacy-close-btn mt-4 inline-block" href="/">กลับแดชบอร์ด</Link></div></div>;

  return <div className="legacy-admin-screen"><section className="legacy-admin-box"><h3>{adminQuery.data.site.title}</h3><div className="legacy-admin-stack">
    {status && <p className={`legacy-status legacy-status-${status.tone}`} role="status">{status.message}</p>}
    <div><label>ช่องวิดีโอ (เลือกใส่ได้สูงสุด 4 ไฟล์)</label><div className="legacy-input-stack">{Array.from({ length: 4 }, (_, index) => { const current = videos[index]; return <div className="legacy-upload-row" key={index}>{current ? <><span className="truncate">วิดีโอ {index + 1}: {current.originalName}</span><button type="button" onClick={() => remove(current.id)} aria-label="ลบวิดีโอ"><Trash2 size={15} /></button></> : <input type="file" accept="video/*" className="legacy-file-input" disabled={uploading} onChange={onFiles("video")} aria-label={`วิดีโอที่ ${index + 1}`} />}</div>; })}</div><p className="legacy-admin-note">เลือกใส่ภายหลังได้ ไม่จำเป็นต้องมีครบทั้ง 4 ช่อง</p></div>
    <div><label>แกลเลอรี่ภาพ 📸</label><input type="file" accept="image/*" multiple className="legacy-file-input" disabled={uploading} onChange={onFiles("image")} />{images.length ? <div className="legacy-media-list">{images.map((asset, index) => <div className="legacy-upload-row" key={asset.id}><span className="truncate">รูป {index + 1}: {asset.originalName}</span><button type="button" onClick={() => remove(asset.id)} aria-label={`ลบรูป ${index + 1}`}><Trash2 size={15} /></button></div>)}</div> : <p className="legacy-admin-note">ยังไม่มีรูปภาพ — ไฟล์จะถูกเก็บผ่าน S3</p>}</div>
    <div><label>เพลงรัก (ไฟล์เสียง)</label><input type="file" accept="audio/*" className="legacy-file-input" disabled={uploading} onChange={onFiles("audio")} />{songs.length ? <div className="legacy-media-list">{songs.map((asset) => <div className="legacy-upload-row" key={asset.id}><span className="truncate">{asset.originalName}</span><button type="button" onClick={() => remove(asset.id)} aria-label={`ลบเพลง ${asset.originalName}`}><Trash2 size={15} /></button></div>)}</div> : <p className="legacy-admin-note">ยังไม่มีเพลง — ไฟล์เพลงจะถูกเก็บใน S3</p>}</div>
    <div className="legacy-basic-card"><h4>ตั้งค่าพื้นฐาน ⚙️</h4><label>ข้อความหน้าเว็บ</label><textarea className="legacy-file-input h-20" value={memoryMessage} onChange={(event) => setMemoryMessage(event.target.value)} /><div className="legacy-admin-grid"><div><label>วันที่เริ่มคบ</label><input type="date" className="legacy-file-input" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></div><div><label>รหัส PIN (4 หลัก)</label><input type="text" className="legacy-file-input" inputMode="numeric" maxLength={4} value={pin} placeholder="คงค่าเดิมหากไม่เปลี่ยน" onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} /></div></div></div>
    <div className="legacy-admin-actions"><button className="legacy-save-btn" type="button" onClick={save} disabled={saveMutation.isPending || uploading}>{saveMutation.isPending || uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}บันทึก</button><Link className="legacy-close-btn" href={`/site/${slug}`}>ดูเว็บไซต์</Link></div>
    <Link className="legacy-close-btn text-center" href="/">กลับแดชบอร์ด</Link><div className="legacy-guide"><h4>เว็บไซต์ส่วนตัว</h4><p>ข้อมูลและสื่อของเว็บไซต์นี้ถูกแยกจากเว็บไซต์อื่น และเปิดได้เฉพาะเจ้าของที่ล็อกอินอยู่</p></div>
  </div></section></div>;
}
