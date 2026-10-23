import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Check, ExternalLink, Loader2, Plus, Settings, Share2, Trash2 } from "lucide-react";
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
      if (authMode === "register") { setNeedsVerification(true); setVerificationEmail(authEmail); setVerificationMessage("สมัครสำเร็จแล้ว กรุณาตรวจสอบอีเมลเพื่อยืนยันก่อนเข้าสู่ระบบ"); return; }
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
  return <DashboardLayout><div className="legacy-dashboard-page mx-auto w-full max-w-5xl space-y-8 py-6"><header><p className="text-sm font-semibold text-pink-500">PRIVATE SITE MANAGER</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">เว็บไซต์ของฉัน</h1><p className="mt-2 text-slate-500">ทุกเว็บไซต์ ข้อมูล และสื่อ ถูกแยกตามบัญชีของคุณ</p></header><section className="rounded-3xl border border-pink-100 bg-pink-50/70 p-6 shadow-sm"><div className="flex items-center gap-2 text-pink-700"><Plus size={19} /><h2 className="text-xl font-bold">{siteCount >= 1 ? "เว็บไซต์ของคุณ" : "สร้างเว็บไซต์ใหม่"}</h2></div>{siteCount >= 1 ? <p className="mt-3 rounded-xl bg-white px-4 py-3 text-sm text-slate-600">แพ็กเกจฟรีจำกัด 1 เว็บไซต์ต่อบัญชี คุณสามารถจัดการเว็บไซต์เดิมได้จากรายการด้านล่าง</p> : <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto]"><label className="grid gap-2 text-sm font-semibold text-slate-700">ชื่อเว็บไซต์<input className="rounded-xl border border-pink-200 bg-white px-3 py-2.5" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="เช่น ความทรงจำของเรา" /></label><label className="grid gap-2 text-sm font-semibold text-slate-700">ชื่อลิงก์<input className="rounded-xl border border-pink-200 bg-white px-3 py-2.5" value={slug} onChange={(event) => setSlug(event.target.value.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase())} placeholder="our-memory" /><span className="text-xs font-normal text-slate-500">ใช้ตัวอักษรอังกฤษ ตัวเลข และ -</span></label><button className="mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-pink-600 px-5 font-bold text-white disabled:opacity-50" onClick={create} disabled={!title.trim() || !slug.trim() || createMutation.isPending}>{createMutation.isPending ? <Loader2 className="animate-spin" size={17} /> : <Plus size={17} />}สร้างเว็บ</button></div>}{error && <p className="mt-4 rounded-xl bg-rose-100 px-3 py-2 text-sm text-rose-700">{error}</p>}</section><section><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold text-slate-900">รายการเว็บไซต์</h2><span className="text-sm text-slate-500">{siteCount} เว็บไซต์</span></div>{sitesQuery.isLoading ? <div className="py-12 text-center text-slate-500"><Loader2 className="mx-auto animate-spin" /></div> : <div className="grid gap-4 md:grid-cols-2">{sitesQuery.data?.map((site) => <article key={site.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-lg font-bold text-slate-900">{site.title}</h3><p className="mt-1 font-mono text-sm text-pink-600">/site/{site.slug}</p><p className="mt-3 text-sm text-slate-500">ทุกคนที่มีลิงก์จะต้องกรอกรหัสผ่าน 4 หลักก่อนเข้าชม</p><div className="mt-5 flex flex-wrap gap-2"><Link href={`/site/${site.slug}`} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white"><ExternalLink size={15} />ดูเว็บไซต์</Link><button className="inline-flex items-center gap-2 rounded-xl border border-pink-200 px-3 py-2 text-sm font-bold text-pink-700" onClick={() => void shareSite(site.title, site.slug)}>{sharedSlug === site.slug ? <Check size={15} /> : <Share2 size={15} />}{sharedSlug === site.slug ? "คัดลอกแล้ว" : "แชร์ลิงก์"}</button><Link href={`/site/${site.slug}/settings`} className="inline-flex items-center gap-2 rounded-xl border border-pink-200 px-3 py-2 text-sm font-bold text-pink-700"><Settings size={15} />จัดการ</Link><button className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-sm font-bold text-rose-700 disabled:opacity-50" onClick={() => remove(site.title, site.slug)} disabled={removeMutation.isPending}><Trash2 size={15} />ลบ</button></div></article>)}</div>}</section></div></DashboardLayout>;
}
