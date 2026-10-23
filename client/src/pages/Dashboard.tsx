import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowUpRight,
  ExternalLink,
  Loader2,
  LogOut,
  Orbit,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import CosmicBackdrop from "@/components/CosmicBackdrop";
import { trpc } from "@/lib/trpc";

function BrandMark() {
  return <Link href="/dashboard" className="cosmic-brand" aria-label="LoveOffice dashboard">
    <span className="cosmic-brand-mark"><Orbit size={20} /><i /></span>
    <span>Love<span>Office</span></span>
  </Link>;
}

export default function Dashboard() {
  const { isAuthenticated, loading, user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const sitesQuery = trpc.site.dashboard.list.useQuery(undefined, { enabled: isAuthenticated });
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerLoginPending, setOwnerLoginPending] = useState(false);

  const createMutation = trpc.site.dashboard.create.useMutation({
    onSuccess: (site) => {
      void utils.site.dashboard.list.invalidate();
      setLocation(`/site/${site.slug}/settings`);
    },
    onError: (reason) => setError(reason.message),
  });
  const removeMutation = trpc.site.dashboard.remove.useMutation({
    onSuccess: () => { void utils.site.dashboard.list.invalidate(); },
    onError: (reason) => setError(reason.message),
  });

  const create = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    createMutation.mutate({ title, slug: slug.trim().toLowerCase() });
  };

  const remove = (siteTitle: string, siteSlug: string) => {
    if (window.confirm(`ลบเว็บไซต์ “${siteTitle}” และข้อมูลทั้งหมดหรือไม่?`)) {
      removeMutation.mutate({ slug: siteSlug });
    }
  };

  const loginWithOwnerPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!ownerPassword || ownerLoginPending) return;
    setOwnerLoginPending(true);
    setError("");
    try {
      const response = await fetch("/api/owner-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: ownerPassword }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error || "เข้าสู่ระบบไม่สำเร็จ");
      }
      window.location.assign("/dashboard");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setOwnerLoginPending(false);
    }
  };

  const signOut = () => {
    void logout().catch(() => setError("ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง"));
  };

  if (loading) {
    return <div className="cosmic-app-shell cosmic-center-shell"><CosmicBackdrop /><div className="cosmic-loading-card"><Loader2 className="animate-spin" size={25} /><span>กำลังเปิดแผนที่ดวงดาว…</span></div></div>;
  }

  if (!isAuthenticated) {
    return <div className="cosmic-app-shell cosmic-login-shell"><CosmicBackdrop /><main className="cosmic-login-card">
      <div className="cosmic-login-topline"><BrandMark /><span className="cosmic-secure-label"><ShieldCheck size={14} /> Private space</span></div>
      <div className="cosmic-login-copy"><span className="cosmic-eyebrow"><Sparkles size={15} /> MEMORY CONSTELLATION</span><h1>{authMode === "login" ? <>กลับเข้าสู่<br />จักรวาลของคุณ</> : <>สร้างพื้นที่<br />ความทรงจำของคุณ</>}</h1><p>{authMode === "login" ? "เข้าสู่พื้นที่ส่วนตัว เพื่อดูแลเว็บไซต์ความทรงจำของคุณ" : "สมัครฟรีด้วยบัญชีของคุณ แล้วสร้างเว็บไซต์ความทรงจำได้ 1 เว็บ"}</p></div>
      <div className="cosmic-auth-tabs" role="tablist" aria-label="การเข้าสู่ระบบ"><button type="button" className={authMode === "login" ? "is-active" : ""} onClick={() => setAuthMode("login")} role="tab" aria-selected={authMode === "login"}>เข้าสู่ระบบ</button><button type="button" className={authMode === "register" ? "is-active" : ""} onClick={() => setAuthMode("register")} role="tab" aria-selected={authMode === "register"}>สมัครใช้งานฟรี</button></div>
      {import.meta.env.VITE_OAUTH_PORTAL_URL && import.meta.env.VITE_APP_ID ? (
        <button className="cosmic-primary-button cosmic-login-button" onClick={() => { const message = startLogin(); if (message) setError(message); }}><ArrowUpRight size={18} />{authMode === "login" ? "เข้าสู่ระบบด้วยบัญชีของฉัน" : "สมัครด้วยบัญชีของฉัน"}</button>
      ) : (
        <form className="cosmic-login-form" onSubmit={loginWithOwnerPassword}>
          <label htmlFor="owner-password">รหัสเจ้าของ</label>
          <div className="cosmic-input-wrap"><input id="owner-password" type="password" value={ownerPassword} onChange={(event) => setOwnerPassword(event.target.value)} placeholder="กรอกรหัสเพื่อเข้าสู่ระบบ" autoComplete="current-password" /><span aria-hidden="true">✦</span></div>
          <button className="cosmic-primary-button cosmic-login-button" disabled={!ownerPassword || ownerLoginPending}>{ownerLoginPending ? <><Loader2 className="animate-spin" size={18} />กำลังตรวจสอบ…</> : <><ArrowUpRight size={18} />เปิดพื้นที่ของฉัน</>}</button>
        </form>
      )}
      {error && <p className="cosmic-status cosmic-status-error" role="alert">{error}</p>}
      <p className="cosmic-login-note">ข้อมูลแยกตามบัญชีของคุณ · ฟรี 1 เว็บไซต์ต่อคน · ไม่ต้องใช้ token</p>
    </main></div>;
  }

  const siteCount = sitesQuery.data?.length ?? 0;
  return <div className="cosmic-app-shell cosmic-dashboard-shell"><CosmicBackdrop />
    <header className="cosmic-topbar">
      <BrandMark />
      <div className="cosmic-user-nav"><div className="cosmic-user-avatar">{user?.name?.charAt(0).toUpperCase() || "M"}</div><div className="cosmic-user-copy"><strong>{user?.name || "My memory space"}</strong><span>{user?.email || "Owner access"}</span></div><button className="cosmic-icon-button" onClick={signOut} aria-label="ออกจากระบบ" title="ออกจากระบบ"><LogOut size={17} /></button></div>
    </header>
    <main className="cosmic-dashboard-content">
      <section className="cosmic-dashboard-hero">
        <div><span className="cosmic-eyebrow"><Sparkles size={15} /> YOUR PRIVATE UNIVERSE</span><h1>เรื่องราวของคุณ<br /><em>กำลังเปล่งประกาย</em></h1><p>สร้างพื้นที่เล็ก ๆ ให้ทุกช่วงเวลายังคงโคจรอยู่รอบตัวคุณ</p></div>
        <div className="cosmic-hero-orb" aria-hidden="true"><span>MEMORY<br />ORBIT</span><i /><b /></div>
      </section>

      <section className="cosmic-stat-row" aria-label="สรุปเว็บไซต์">
        <article className="cosmic-stat-card"><span>MY CONSTELLATIONS</span><strong>{siteCount.toString().padStart(2, "0")}</strong><small>เว็บไซต์ในพื้นที่ของคุณ</small></article>
        <article className="cosmic-stat-card cosmic-stat-card-accent"><span>ACCESS STATUS</span><strong><ShieldCheck size={26} /> Safe</strong><small>ข้อมูลแยกตามบัญชีเจ้าของ</small></article>
      </section>

      <section className={`cosmic-panel cosmic-create-panel ${siteCount >= 1 ? "is-limit-reached" : ""}`}>
        <div className="cosmic-panel-heading"><div><span className="cosmic-section-kicker">NEW STAR</span><h2>สร้างเว็บไซต์ความทรงจำ</h2><p>กำหนดชื่อและลิงก์เฉพาะของเรื่องราวนี้</p></div><span className="cosmic-panel-icon"><Plus size={20} /></span></div>
        <form className="cosmic-create-form" onSubmit={create}>
          <label>ชื่อเว็บไซต์<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="เช่น ความทรงจำของเรา" maxLength={160} /></label>
          <label>ชื่อลิงก์<span className="cosmic-slug-input"><i>/site/</i><input value={slug} onChange={(event) => setSlug(event.target.value.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase())} placeholder="our-memory" maxLength={120} /></span><small>ใช้ตัวอักษรอังกฤษ ตัวเลข และขีดกลาง</small></label>
          <button className="cosmic-primary-button" disabled={siteCount >= 1 || !title.trim() || !slug.trim() || createMutation.isPending}>{createMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}{siteCount >= 1 ? "ใช้สิทธิ์เว็บไซต์ครบแล้ว" : "สร้างดวงดาวใหม่"}</button>
        </form>
        {siteCount >= 1 && <p className="cosmic-limit-note"><ShieldCheck size={16} /> แพ็กเกจฟรีจำกัด 1 เว็บไซต์ต่อบัญชี คุณสามารถเข้าไปจัดการเว็บไซต์เดิมได้จากรายการด้านล่าง</p>}
        {error && <p className="cosmic-status cosmic-status-error" role="alert">{error}</p>}
      </section>

      <section className="cosmic-sites-section"><div className="cosmic-section-title"><div><span className="cosmic-section-kicker">SAVED ORBITS</span><h2>เว็บไซต์ของฉัน</h2></div><span>{siteCount} เว็บไซต์</span></div>
        {sitesQuery.isLoading ? <div className="cosmic-list-loading"><Loader2 className="animate-spin" size={22} />กำลังอ่านข้อมูลเว็บไซต์…</div> : siteCount ? <div className="cosmic-site-grid">{sitesQuery.data?.map((site, index) => <article key={site.id} className="cosmic-site-card">
          <div className="cosmic-site-card-top"><span className="cosmic-site-index">0{index + 1}</span><span className="cosmic-live-dot">Active</span></div>
          <h3>{site.title}</h3><p className="cosmic-site-route">/site/{site.slug}</p><p className="cosmic-site-description">พื้นที่ส่วนตัวสำหรับบันทึกทุกช่วงเวลาสำคัญของคุณ</p>
          <div className="cosmic-site-actions"><Link href={`/site/${site.slug}`} className="cosmic-action-link cosmic-action-link-primary"><ExternalLink size={15} />เปิดเว็บไซต์</Link><Link href={`/site/${site.slug}/settings`} className="cosmic-action-link"><Settings size={15} />จัดการ</Link><button className="cosmic-action-link cosmic-danger-link" onClick={() => remove(site.title, site.slug)} disabled={removeMutation.isPending} aria-label={`ลบ ${site.title}`}><Trash2 size={15} /></button></div>
        </article>)}</div> : <div className="cosmic-empty-state"><Orbit size={32} /><h3>จักรวาลของคุณยังว่างอยู่</h3><p>เริ่มสร้างเว็บไซต์แรก แล้วเก็บภาพ เพลง และข้อความที่มีความหมายไว้ด้วยกัน</p></div>}
      </section>
    </main>
  </div>;
}
