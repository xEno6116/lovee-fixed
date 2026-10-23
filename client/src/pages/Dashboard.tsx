import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Check, ExternalLink, Image as ImageIcon, LayoutDashboard, Loader2, Mail, Music, PencilRuler, Plus, Settings, Share2, Trash2, Video } from "lucide-react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";

type AuthMode = "login" | "register";

export default function Dashboard() {
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const sitesQuery = trpc.site.dashboard.list.useQuery(undefined, { enabled: isAuthenticated });
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [authPending, setAuthPending] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [sharedSlug, setSharedSlug] = useState<string | null>(null);
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("verify");
    if (!token) return;
    void fetch(`/api/verify-email?token=${encodeURIComponent(token)}`).then(async (response) => {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      setVerificationMessage(response.ok ? "ยืนยันอีเมลสำเร็จแล้ว ตอนนี้เข้าสู่ระบบได้เลย" : (payload?.error || "ยืนยันอีเมลไม่สำเร็จ"));
      window.history.replaceState({}, "", "/dashboard");
    }).catch(() => setVerificationMessage("ไม่สามารถยืนยันอีเมลได้ กรุณาลองใหม่"));
  }, []);
  const resendVerification = async () => {
    setAuthPending(true); setError("");
    try {
      const response = await fetch("/api/local-resend-verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: verificationEmail || authEmail, password: authPassword }) });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "ส่งอีเมลไม่สำเร็จ");
      setVerificationMessage("ส่งลิงก์ยืนยันใหม่แล้ว กรุณาตรวจสอบกล่องจดหมาย");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "ส่งอีเมลไม่สำเร็จ"); }
    finally { setAuthPending(false); }
  };
  const createMutation = trpc.site.dashboard.create.useMutation({ onSuccess: (site) => { void utils.site.dashboard.list.invalidate(); setLocation(`/site/${site.slug}/settings`); }, onError: (reason) => setError(reason.message) });
  const removeMutation = trpc.site.dashboard.remove.useMutation({ onSuccess: () => { void utils.site.dashboard.list.invalidate(); }, onError: (reason) => setError(reason.message) });
  const create = () => { setError(""); createMutation.mutate({ title, slug: slug.trim().toLowerCase() }); };
  const remove = (siteTitle: string, siteSlug: string) => { if (window.confirm(`ลบเว็บไซต์ “${siteTitle}” และข้อมูลทั้งหมดหรือไม่?`)) removeMutation.mutate({ slug: siteSlug }); };
  const shareSite = async (siteTitle: string, siteSlug: string) => {
    const url = `${window.location.origin}/site/${siteSlug}`;
    try {
      if (navigator.share) await navigator.share({ title: siteTitle, text: `${siteTitle} — ความทรงจำของเรา`, url });
      else await navigator.clipboard.writeText(url);
      setSharedSlug(siteSlug);
      window.setTimeout(() => setSharedSlug((current) => current === siteSlug ? null : current), 2200);
    } catch { /* ผู้ใช้ปิดหน้าต่างแชร์ ไม่ต้องแสดง error */ }
  };
  const submitLocalAuth = async () => {
    setAuthPending(true); setError("");
    try {
      const response = await fetch(authMode === "register" ? "/api/local-register" : "/api/local-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: authName, email: authEmail, password: authPassword }) });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        if (payload?.error?.includes("ยืนยันอีเมล")) { setNeedsVerification(true); setVerificationEmail(authEmail); }
        throw new Error(payload?.error || "ดำเนินการไม่สำเร็จ");
      }
      window.location.assign("/dashboard");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "ดำเนินการไม่สำเร็จ"); }
    finally { setAuthPending(false); }
  };
  const loginWithOwnerPassword = async () => {
    setAuthPending(true); setError("");
    try {
      const response = await fetch("/api/owner-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: ownerPassword }) });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "เข้าสู่ระบบไม่สำเร็จ");
      window.location.assign("/dashboard");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "เข้าสู่ระบบไม่สำเร็จ"); }
    finally { setAuthPending(false); }
  };
  if (loading) return <div className="legacy-loading"><Loader2 className="animate-spin" /></div>;
  if (!isAuthenticated) return <div className="legacy-loading legacy-auth-page"><div className="legacy-auth-card"><h1>หลังบ้านเว็บไซต์ความทรงจำ</h1><p className="legacy-auth-subtitle">สร้างพื้นที่ความทรงจำของคุณฟรี 1 เว็บ</p><div className="legacy-auth-tabs"><button className={authMode === "register" ? "active" : ""} onClick={() => { setAuthMode("register"); setError(""); }}>สมัครใช้งานฟรี</button><button className={authMode === "login" ? "active" : ""} onClick={() => { setAuthMode("login"); setError(""); }}>เข้าสู่ระบบ</button></div><form className="legacy-auth-form" onSubmit={(event) => { event.preventDefault(); void submitLocalAuth(); }}>{authMode === "register" && <label>ชื่อของคุณ<input required minLength={2} maxLength={80} value={authName} onChange={(event) => setAuthName(event.target.value)} placeholder="เช่น มินนี่" /></label>}<label>อีเมล<input required type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" /></label><label>รหัสผ่าน<input required minLength={8} type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="อย่างน้อย 8 ตัวอักษร" autoComplete={authMode === "register" ? "new-password" : "current-password"} /></label><button className="legacy-save-btn" type="submit" disabled={authPending}>{authPending ? "กำลังดำเนินการ…" : authMode === "register" ? "สมัครสมาชิกและเริ่มสร้างเว็บ" : "เข้าสู่ระบบ"}</button></form>{import.meta.env.VITE_OAUTH_PORTAL_URL && import.meta.env.VITE_APP_ID && <button className="legacy-auth-secondary" onClick={() => { const message = startLogin(); if (message) setError(message); }}>ใช้บัญชีแพลตฟอร์มแทน</button>}<details className="legacy-owner-login"><summary>เข้าสู่ระบบเจ้าของเดิม</summary><div><input type="password" value={ownerPassword} onChange={(event) => setOwnerPassword(event.target.value)} placeholder="รหัสเจ้าของ" /><button className="legacy-close-btn" onClick={() => void loginWithOwnerPassword()} disabled={!ownerPassword || authPending}>เข้าใช้</button></div></details>{needsVerification && <div className="legacy-verification-box"><strong>เกือบเสร็จแล้ว</strong><p>{verificationMessage || `เราได้ส่งลิงก์ยืนยันไปที่ ${verificationEmail || authEmail}`}</p><button type="button" onClick={() => void resendVerification()} disabled={authPending || !authPassword}>{authPending ? "กำลังส่ง…" : "ส่งอีเมลยืนยันอีกครั้ง"}</button><small>เปิดอีเมลแล้วกดปุ่ม “ยืนยันอีเมล” จากนั้นกลับมาเข้าสู่ระบบ</small></div>}{verificationMessage && !needsVerification && <p className="legacy-verification-success">{verificationMessage}</p>}{error && <p className="legacy-lock-error" role="alert">{error}</p>}<p className="legacy-auth-note">สมัครเองได้ ไม่ต้องใช้ token · บัญชีฟรีสร้างได้ 1 เว็บไซต์</p></div></div>;
  const siteCount = sitesQuery.data?.length ?? 0;
  const firstSlug = sitesQuery.data?.[0]?.slug;
  const adminQuery = trpc.site.admin.get.useQuery({ slug: firstSlug ?? "" }, { enabled: isAuthenticated && Boolean(firstSlug) });
  const assets = adminQuery.data?.assets ?? [];
  const imageCount = assets.filter((asset) => asset.kind === "image").length;
  const videoCount = assets.filter((asset) => asset.kind === "video").length;
  const audioCount = assets.filter((asset) => asset.kind === "audio").length;
  return <DashboardLayout><div className="legacy-dashboard-page admin-dashboard mx-auto w-full max-w-6xl space-y-6 py-6">
    <header className="admin-dashboard-hero"><div><p className="admin-kicker">ADMIN DASHBOARD</p><h1>จัดการเว็บไซต์ของคุณ</h1><p>ดูภาพรวม แก้ไขการออกแบบ และจัดการความทรงจำทั้งหมดจากที่เดียว</p></div><div className="admin-hero-icon"><LayoutDashboard size={28} /></div></header>
    {siteCount === 0 ? <section className="admin-empty-state"><div className="admin-empty-icon"><PencilRuler size={28} /></div><h2>เริ่มสร้างเว็บไซต์ความทรงจำ</h2><p>สร้างเว็บได้ฟรี 1 เว็บไซต์ต่อบัญชี แล้วปรับแต่งรูป วิดีโอ ธีม และจดหมายได้จากหลังบ้าน</p><div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto] text-left"><label className="admin-field">ชื่อเว็บไซต์<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="เช่น ความทรงจำของเรา" /></label><label className="admin-field">ชื่อลิงก์<input value={slug} onChange={(event) => setSlug(event.target.value.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase())} placeholder="our-memory" /><span>ใช้ตัวอักษรอังกฤษ ตัวเลข และ -</span></label><button className="admin-primary-btn md:mt-7" onClick={create} disabled={!title.trim() || !slug.trim() || createMutation.isPending}>{createMutation.isPending ? <Loader2 className="animate-spin" size={17} /> : <Plus size={17} />}สร้างเว็บ</button></div></section> : <>
      <section className="admin-overview-grid"><div className="admin-stat-card"><span className="admin-stat-icon"><ImageIcon size={18} /></span><strong>{imageCount}</strong><span>รูปภาพ</span></div><div className="admin-stat-card"><span className="admin-stat-icon"><Video size={18} /></span><strong>{videoCount}/4</strong><span>วิดีโอ</span></div><div className="admin-stat-card"><span className="admin-stat-icon"><Music size={18} /></span><strong>{audioCount ? "พร้อม" : "ยังไม่มี"}</strong><span>เพลงประกอบ</span></div><div className="admin-stat-card"><span className="admin-stat-icon"><Mail size={18} /></span><strong>{adminQuery.data?.settings.letterRecipientEmail ? "พร้อม" : "ตั้งค่า"}</strong><span>รับจดหมาย</span></div></section>
      <section className="admin-site-card"><div className="admin-site-card-top"><div><p className="admin-kicker">เว็บไซต์ของฉัน</p><h2>{sitesQuery.data?.[0]?.title}</h2><p className="admin-slug">/site/{sitesQuery.data?.[0]?.slug}</p></div><span className="admin-live-badge"><span />ออนไลน์</span></div><p className="admin-site-description">เว็บไซต์ของคุณพร้อมแชร์แล้ว ปรับแต่งหน้าตาและจัดวางส่วนต่าง ๆ ได้จากเมนูออกแบบเว็บไซต์</p><div className="admin-quick-actions"><Link href={`/site/${firstSlug}/settings`} className="admin-primary-btn"><PencilRuler size={17} />ออกแบบเว็บไซต์</Link><Link href={`/site/${firstSlug}`} className="admin-secondary-btn"><ExternalLink size={17} />ดูเว็บไซต์</Link><button className="admin-secondary-btn" onClick={() => void shareSite(sitesQuery.data?.[0]?.title ?? "เว็บไซต์ความทรงจำ", firstSlug ?? "")}><Share2 size={17} />{sharedSlug === firstSlug ? "คัดลอกแล้ว" : "แชร์ลิงก์"}</button></div></section>
      <section className="admin-management-grid"><Link href={`/site/${firstSlug}/settings`} className="admin-management-card"><span><PencilRuler size={19} /></span><div><strong>ออกแบบหน้าเว็บ</strong><p>เลือกธีม สี ฟอนต์ ลำดับส่วน และซ่อนส่วนที่ไม่ต้องการ</p></div><b>›</b></Link><Link href={`/site/${firstSlug}/settings`} className="admin-management-card"><span><ImageIcon size={19} /></span><div><strong>จัดการรูปและวิดีโอ</strong><p>อัปโหลดรูปหลายรูป วิดีโอ เพลง และไฟล์ขนาดใหญ่</p></div><b>›</b></Link><Link href={`/site/${firstSlug}/settings`} className="admin-management-card"><span><Mail size={19} /></span><div><strong>ตั้งค่าความเป็นส่วนตัว</strong><p>รหัสผ่านเข้าชม อีเมลรับจดหมาย และวันหมดอายุ</p></div><b>›</b></Link></section>
    </>}
    {error && <p className="admin-error">{error}</p>}
    <section className="admin-footer-card"><div><strong>แพ็กเกจฟรี · 1 เว็บไซต์ต่อบัญชี</strong><p>ข้อมูลทั้งหมดของคุณแยกเป็นส่วนตัว และมีเพียงเจ้าของที่ล็อกอินเท่านั้นที่แก้ไขได้</p></div>{siteCount > 0 && <button className="admin-danger-btn" onClick={() => remove(sitesQuery.data?.[0]?.title ?? "เว็บไซต์นี้", firstSlug ?? "")} disabled={removeMutation.isPending}><Trash2 size={15} />ลบเว็บไซต์</button>}</section>
  </div></DashboardLayout>;
}
