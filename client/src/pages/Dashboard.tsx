import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ExternalLink, Loader2, Plus, Settings, Trash2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { OwnerLoginButton } from "@/components/OwnerLoginModal";
import { trpc } from "@/lib/trpc";

export default function Dashboard() {
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const sitesQuery = trpc.site.dashboard.list.useQuery(undefined, { enabled: isAuthenticated });
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const createMutation = trpc.site.dashboard.create.useMutation({
    onSuccess: (site) => { void utils.site.dashboard.list.invalidate(); setLocation(`/site/${site.slug}/settings`); },
    onError: (reason) => setError(reason.message),
  });
  const removeMutation = trpc.site.dashboard.remove.useMutation({
    onSuccess: () => { void utils.site.dashboard.list.invalidate(); },
    onError: (reason) => setError(reason.message),
  });
  const create = () => { setError(""); createMutation.mutate({ title, slug: slug.trim().toLowerCase() }); };
  const remove = (siteTitle: string, siteSlug: string) => { if (window.confirm(`ลบเว็บไซต์ “${siteTitle}” และข้อมูลทั้งหมดหรือไม่?`)) removeMutation.mutate({ slug: siteSlug }); };

  if (loading) return <div className="legacy-loading"><Loader2 className="animate-spin" /></div>;
  if (!isAuthenticated) return <div className="legacy-loading"><div className="text-center"><h1 className="text-3xl">หลังบ้านเว็บไซต์ความทรงจำ</h1><p className="mt-3">เข้าสู่ระบบเพื่อสร้างและดูเฉพาะเว็บไซต์ของคุณ</p><OwnerLoginButton className="legacy-save-btn mt-6">เข้าสู่ระบบ</OwnerLoginButton></div></div>;

  return <DashboardLayout><div className="mx-auto max-w-5xl space-y-8 py-6">
    <header><p className="text-sm font-semibold text-pink-500">PRIVATE SITE MANAGER</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">เว็บไซต์ของฉัน</h1><p className="mt-2 text-slate-500">ทุกเว็บไซต์ ข้อมูล และสื่อ ถูกแยกตามบัญชีของคุณ</p></header>
    <section className="rounded-3xl border border-pink-100 bg-pink-50/70 p-6 shadow-sm"><div className="flex items-center gap-2 text-pink-700"><Plus size={19} /><h2 className="text-xl font-bold">สร้างเว็บไซต์ใหม่</h2></div><div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto]"><label className="grid gap-2 text-sm font-semibold text-slate-700">ชื่อเว็บไซต์<input className="rounded-xl border border-pink-200 bg-white px-3 py-2.5" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="เช่น ความทรงจำของเรา" /></label><label className="grid gap-2 text-sm font-semibold text-slate-700">ชื่อลิงก์<input className="rounded-xl border border-pink-200 bg-white px-3 py-2.5" value={slug} onChange={(event) => setSlug(event.target.value.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase())} placeholder="our-memory" /><span className="text-xs font-normal text-slate-500">ใช้ตัวอักษรอังกฤษ ตัวเลข และ -</span></label><button className="mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-pink-600 px-5 font-bold text-white disabled:opacity-50" onClick={create} disabled={!title.trim() || !slug.trim() || createMutation.isPending}>{createMutation.isPending ? <Loader2 className="animate-spin" size={17} /> : <Plus size={17} />}สร้างเว็บ</button></div>{error && <p className="mt-4 rounded-xl bg-rose-100 px-3 py-2 text-sm text-rose-700">{error}</p>}</section>
    <section><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold text-slate-900">รายการเว็บไซต์</h2><span className="text-sm text-slate-500">{sitesQuery.data?.length ?? 0} เว็บไซต์</span></div>{sitesQuery.isLoading ? <div className="py-12 text-center text-slate-500"><Loader2 className="mx-auto animate-spin" /></div> : <div className="grid gap-4 md:grid-cols-2">{sitesQuery.data?.map((site) => <article key={site.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-lg font-bold text-slate-900">{site.title}</h3><p className="mt-1 font-mono text-sm text-pink-600">/site/{site.slug}</p><p className="mt-3 text-sm text-slate-500">เฉพาะคุณที่ล็อกอินเท่านั้นที่เปิดดูหรือจัดการเว็บไซต์นี้ได้</p><div className="mt-5 flex flex-wrap gap-2"><Link href={`/site/${site.slug}`} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white"><ExternalLink size={15} />ดูเว็บไซต์</Link><Link href={`/site/${site.slug}/settings`} className="inline-flex items-center gap-2 rounded-xl border border-pink-200 px-3 py-2 text-sm font-bold text-pink-700"><Settings size={15} />จัดการ</Link><button className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-sm font-bold text-rose-700 disabled:opacity-50" onClick={() => remove(site.title, site.slug)} disabled={removeMutation.isPending}><Trash2 size={15} />ลบ</button></div></article>)}</div>}</section>
  </div></DashboardLayout>;
}
