import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  FileStack,
  HardDrive,
  Heart,
  KeyRound,
  LetterText,
  Loader2,
  LockKeyhole,
  PauseCircle,
  Plus,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { OwnerLoginButton } from "@/components/OwnerLoginModal";
import { ownerSettingsPath } from "@/const";
import { trpc } from "@/lib/trpc";

function formatBytes(value: number) {
  if (value < 1_048_576) return `${Math.max(0, Math.round(value / 1_024))} KB`;
  return `${(value / 1_048_576).toFixed(2)} MB`;
}

function formatDate(value: string) {
  if (!value) return "ยังไม่มีข้อมูล";
  return new Date(value).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

function StatCard({ icon: Icon, label, value, hint, tone = "pink" }: { icon: typeof Eye; label: string; value: string | number; hint: string; tone?: "pink" | "violet" | "sky" | "amber" }) {
  return <article className={`lo-stat-card lo-stat-${tone}`}><div className="lo-stat-icon"><Icon size={20} /></div><div><p>{label}</p><strong>{value}</strong><span>{hint}</span></div></article>;
}

export default function Dashboard() {
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const sitesQuery = trpc.site.dashboard.list.useQuery(undefined, { enabled: isAuthenticated });
  const overviewQuery = trpc.site.dashboard.overview.useQuery(undefined, { enabled: isAuthenticated });
  const securityQuery = trpc.site.dashboard.securityOverview.useQuery(undefined, { enabled: isAuthenticated });
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [cloneSource, setCloneSource] = useState("");
  const [cloneTitle, setCloneTitle] = useState("");
  const [cloneSlug, setCloneSlug] = useState("");
  const [error, setError] = useState("");
  const createMutation = trpc.site.dashboard.create.useMutation({
    onSuccess: (site) => { void utils.site.dashboard.list.invalidate(); void utils.site.dashboard.overview.invalidate(); setLocation(ownerSettingsPath(site.slug)); },
    onError: (reason) => setError(reason.message),
  });
  const cloneMutation = trpc.site.dashboard.clone.useMutation({
    onSuccess: (site) => { void utils.site.dashboard.list.invalidate(); void utils.site.dashboard.overview.invalidate(); setCloneSource(""); setCloneTitle(""); setCloneSlug(""); setLocation(ownerSettingsPath(site.slug)); },
    onError: (reason) => setError(reason.message),
  });
  const removeMutation = trpc.site.dashboard.remove.useMutation({
    onSuccess: () => { void utils.site.dashboard.list.invalidate(); void utils.site.dashboard.overview.invalidate(); },
    onError: (reason) => setError(reason.message),
  });
  const overview = overviewQuery.data;
  const sites = overview?.sites ?? (sitesQuery.data ?? []).map((site) => ({ ...site, viewCount: site.viewCount ?? 0, letterResponseCount: site.letterResponseCount ?? 0, storageBytes: 0, isPaused: Boolean(site.isPaused), lastViewedAt: site.lastViewedAt ?? "" }));
  const chartData = useMemo(() => overview?.trend.map((item) => ({ ...item, label: new Date(`${item.date}T00:00:00Z`).toLocaleDateString("th-TH", { weekday: "short" }).replace(".", "") })) ?? [], [overview?.trend]);

  const create = () => { setError(""); createMutation.mutate({ title: title.trim(), slug: slug.trim().toLowerCase() }); };
  const clone = () => { setError(""); if (!cloneSource || !cloneTitle.trim() || !cloneSlug.trim()) return; cloneMutation.mutate({ sourceSlug: cloneSource, title: cloneTitle.trim(), slug: cloneSlug.trim().toLowerCase() }); };
  const remove = (siteTitle: string, siteSlug: string) => { if (window.confirm(`ลบเว็บไซต์ “${siteTitle}” และข้อมูลทั้งหมดหรือไม่? การดำเนินการนี้ย้อนกลับไม่ได้`)) removeMutation.mutate({ slug: siteSlug }); };

  if (loading) return <div className="legacy-loading"><Loader2 className="animate-spin" /></div>;
  if (!isAuthenticated) return <div className="legacy-loading"><div className="text-center"><h1 className="text-3xl">ศูนย์ควบคุม LoveOffice</h1><p className="mt-3">เข้าสู่ระบบเพื่อเข้าถึงเว็บไซต์ สถิติ และเครื่องมือผู้ดูแล</p><OwnerLoginButton className="legacy-save-btn mt-6">เข้าสู่ระบบ</OwnerLoginButton></div></div>;

  return <DashboardLayout><div className="lo-control-center">
    <header className="lo-control-hero">
      <div><p className="lo-eyebrow"><ShieldCheck size={14} />LOVE OFFICE CONTROL CENTER</p><h1>หลังบ้านครบวงจร</h1><p>จัดการทุกเว็บไซต์ ดูข้อมูลการเข้าชม ควบคุมสถานะ และสำรองความทรงจำจากหน้าเดียว</p></div>
      <div className="lo-hero-badge"><Heart size={18} fill="currentColor" /><span>{overview?.totals.sites ?? sites.length} เว็บไซต์ของคุณ</span></div>
    </header>

    {error && <p className="lo-feedback lo-feedback-error">{error}</p>}

    <section className="lo-stat-grid" aria-label="สรุปข้อมูลเว็บไซต์">
      <StatCard icon={FileStack} label="เว็บไซต์ทั้งหมด" value={overview?.totals.sites ?? sites.length} hint={`${overview?.totals.pausedSites ?? 0} เว็บกำลังพักอยู่`} />
      <StatCard icon={Eye} label="ยอดเข้าชม" value={(overview?.totals.views ?? 0).toLocaleString()} hint="รวมทุกเว็บไซต์" tone="violet" />
      <StatCard icon={LetterText} label="จดหมายที่ได้รับ" value={(overview?.totals.letterResponses ?? 0).toLocaleString()} hint="คำตอบจากผู้เยี่ยมชม" tone="sky" />
      <StatCard icon={HardDrive} label="พื้นที่สื่อ" value={formatBytes(overview?.totals.storageBytes ?? 0)} hint="รูป วิดีโอ เพลง และฟอนต์" tone="amber" />
    </section>

    <section className="lo-dashboard-grid">
      <article className="lo-panel lo-trend-panel"><div className="lo-panel-heading"><div><p>ANALYTICS</p><h2>แนวโน้มผู้เข้าชม 7 วัน</h2></div><BarChart3 size={20} /></div><div className="lo-chart-wrap">{chartData.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 12, right: 0, left: -28, bottom: 0 }}><defs><linearGradient id="loveofficeViews" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#ec4899" stopOpacity={0.3} /><stop offset="100%" stopColor="#ec4899" stopOpacity={0.01} /></linearGradient></defs><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#9a8292", fontSize: 11 }} /><Tooltip cursor={{ stroke: "#fbcfe8" }} contentStyle={{ borderRadius: 14, border: "1px solid #fce7f3", boxShadow: "0 10px 30px rgba(95, 45, 78, .10)" }} formatter={(value, name) => [Number(value).toLocaleString(), name === "views" ? "ผู้เข้าชม" : "คำตอบจดหมาย"]} /><Area type="monotone" dataKey="views" stroke="#ec4899" strokeWidth={2.5} fill="url(#loveofficeViews)" /></AreaChart></ResponsiveContainer> : <div className="lo-empty-chart">กำลังรวบรวมข้อมูลการเข้าชม</div>}</div><p className="lo-panel-note">ระบบบันทึกยอดใหม่เมื่อผู้เยี่ยมชมเปิดความทรงจำสำเร็จ</p></article>

      <article className="lo-panel lo-security-panel"><div className="lo-panel-heading"><div><p>SECURITY</p><h2>การป้องกันหลังบ้าน</h2></div><LockKeyhole size={20} /></div><div className="lo-security-main"><span className={securityQuery.data?.activeLocks ? "is-alert" : "is-safe"}>{securityQuery.data?.activeLocks ? `${securityQuery.data.activeLocks} การล็อกชั่วคราว` : "สถานะปกติ"}</span><p>ล็อกหลังลองรหัสผิด {securityQuery.data?.policy.maxFailedAttempts ?? 5} ครั้งภายใน {securityQuery.data?.policy.windowMinutes ?? 15} นาที</p></div><div className="lo-security-events">{securityQuery.data?.recentEvents.length ? securityQuery.data.recentEvents.slice(0, 3).map((event) => <div key={`${event.at}-${event.status}`}><span className={`lo-event-dot lo-event-${event.status}`} /><p>{event.status === "success" ? "เข้าสู่ระบบสำเร็จ" : event.status === "blocked" ? "ระบบบล็อกการลองรหัส" : "ใส่รหัสไม่ถูกต้อง"}<small>{formatDate(event.at)}</small></p></div>) : <div><CheckCircle2 size={18} /><p>ยังไม่มีเหตุการณ์ที่ต้องจัดการ<small>ไม่มีการเก็บ IP ดิบของผู้เยี่ยมชม</small></p></div>}</div></article>
    </section>

    <section className="lo-action-grid">
      <article className="lo-action-card lo-create-card"><div className="lo-action-title"><span><Plus size={18} /></span><div><h2>สร้างเว็บไซต์ใหม่</h2><p>เริ่มเว็บไซต์ความทรงจำอีกหนึ่งพื้นที่</p></div></div><div className="lo-field-grid"><label>ชื่อเว็บไซต์<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="เช่น ความทรงจำของเรา" /></label><label>ชื่อลิงก์<input value={slug} onChange={(event) => setSlug(event.target.value.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase())} placeholder="our-memory" /></label></div><button className="lo-primary-button" onClick={create} disabled={!title.trim() || !slug.trim() || createMutation.isPending}>{createMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}สร้างเว็บใหม่</button></article>
      <article className="lo-action-card lo-clone-card"><div className="lo-action-title"><span><Copy size={18} /></span><div><h2>โคลนเว็บไซต์</h2><p>คัดลอกเนื้อหา รูป สื่อ และการตั้งค่า พร้อม PIN ใหม่เป็น 0000</p></div></div><div className="lo-field-grid"><label>ต้นฉบับ<select value={cloneSource} onChange={(event) => setCloneSource(event.target.value)}><option value="">เลือกเว็บไซต์</option>{sites.map((site) => <option key={site.slug} value={site.slug}>{site.title}</option>)}</select></label><label>ชื่อของสำเนา<input value={cloneTitle} onChange={(event) => setCloneTitle(event.target.value)} placeholder="เช่น เซอร์ไพรส์วันพิเศษ" /></label><label className="lo-field-full">ลิงก์ของสำเนา<input value={cloneSlug} onChange={(event) => setCloneSlug(event.target.value.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase())} placeholder="special-memory" /></label></div><button className="lo-secondary-button" onClick={clone} disabled={!cloneSource || !cloneTitle.trim() || !cloneSlug.trim() || cloneMutation.isPending}>{cloneMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Copy size={16} />}สร้างสำเนา</button></article>
    </section>

    <section className="lo-sites-section"><div className="lo-section-heading"><div><p>WEBSITES</p><h2>เว็บไซต์ของฉัน</h2></div><span>{sites.length} รายการ</span></div>{sitesQuery.isLoading || overviewQuery.isLoading ? <div className="lo-loading-sites"><Loader2 className="animate-spin" />กำลังโหลดศูนย์ควบคุม…</div> : <div className="lo-site-grid">{sites.map((site) => <article key={site.id} className={`lo-site-card ${site.isPaused ? "is-paused" : ""}`}><div className="lo-site-card-top"><div className="lo-site-heart"><Heart size={17} fill="currentColor" /></div><div className={`lo-site-status ${site.isPaused ? "is-paused" : ""}`}>{site.isPaused ? <><PauseCircle size={13} />พักเว็บ</> : <><CheckCircle2 size={13} />ออนไลน์</>}</div></div><h3>{site.title}</h3><p className="lo-site-slug">/site/{site.slug}</p><div className="lo-site-metrics"><span><Eye size={14} />{(site.viewCount ?? 0).toLocaleString()} วิว</span><span><LetterText size={14} />{(site.letterResponseCount ?? 0)} จดหมาย</span><span><HardDrive size={14} />{formatBytes(site.storageBytes ?? 0)}</span></div><p className="lo-site-last">อัปเดตล่าสุด: {formatDate(site.updatedAt)}<br />เข้าชมล่าสุด: {formatDate(site.lastViewedAt ?? "")}</p><div className="lo-site-actions"><Link href={`/site/${site.slug}`} target="_blank" className="lo-icon-action" title="เปิดหน้าบ้าน"><ExternalLink size={16} /></Link><Link href={ownerSettingsPath(site.slug)} className="lo-manage-button"><Settings size={15} />จัดการ</Link><button className="lo-icon-action lo-delete-action" onClick={() => remove(site.title, site.slug)} disabled={removeMutation.isPending} title="ลบเว็บไซต์"><Trash2 size={16} /></button></div></article>)}</div>}</section>

    <section className="lo-panel lo-activity-panel"><div className="lo-panel-heading"><div><p>ACTIVITY LOG</p><h2>กิจกรรมล่าสุด</h2></div><Activity size={20} /></div>{overview?.recentActivity.length ? <div className="lo-activity-list">{overview.recentActivity.map((activity) => <div key={activity.id}><span className={`lo-activity-icon lo-activity-${activity.kind}`}><Activity size={13} /></span><p><strong>{activity.label}</strong><span>{activity.siteTitle} · {formatDate(activity.at)}</span></p><Link href={ownerSettingsPath(activity.siteSlug)}>ดูเว็บ</Link></div>)}</div> : <div className="lo-empty-activity"><Users size={20} />กิจกรรมสำคัญของเว็บไซต์จะแสดงที่นี่</div>}</section>
  </div></DashboardLayout>;
}
