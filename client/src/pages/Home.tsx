import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, Pause, Play, Settings, Video } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { OwnerLoginButton } from "@/components/OwnerLoginModal";
import { trpc } from "@/lib/trpc";

type TimeParts = { days: number; hours: number; minutes: number; seconds: number };

function elapsedFrom(startDate: string): TimeParts {
  const difference = Math.max(0, Date.now() - new Date(`${startDate}T00:00:00`).getTime());
  return { days: Math.floor(difference / 86_400_000), hours: Math.floor((difference / 3_600_000) % 24), minutes: Math.floor((difference / 60_000) % 60), seconds: Math.floor((difference / 1_000) % 60) };
}

function ClockBox({ value, label }: { value: number; label: string }) {
  return <div className="legacy-clock-box"><strong>{value}</strong><span>{label}</span></div>;
}

export default function Home({ slug }: { slug: string }) {
  const { isAuthenticated, loading } = useAuth();
  const siteQuery = trpc.site.private.get.useQuery({ slug }, { enabled: isAuthenticated });
  const verifyPin = trpc.site.private.verifyPin.useMutation();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [clock, setClock] = useState<TimeParts>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [videoIndex, setVideoIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const site = siteQuery.data;
  const videoSlots = useMemo(() => Array.from({ length: 4 }, (_, index) => site?.videos[index] ?? null), [site?.videos]);

  useEffect(() => {
    if (!site?.settings.startDate) return;
    const updateClock = () => setClock(elapsedFrom(site.settings.startDate));
    updateClock();
    const timer = window.setInterval(updateClock, 1_000);
    return () => window.clearInterval(timer);
  }, [site?.settings.startDate]);

  const pressNumber = (digit: string) => {
    if (verifyPin.isPending || pin.length >= 4) return;
    const next = `${pin}${digit}`;
    setPin(next);
    setError("");
    if (next.length === 4) verifyPin.mutate({ slug, pin: next }, {
      onSuccess: ({ valid }) => {
        if (valid) { setUnlocked(true); setPin(""); }
        else { setError("PIN ไม่ถูกต้อง ลองใหม่อีกครั้งนะ"); window.setTimeout(() => setPin(""), 450); }
      },
      onError: () => { setError("ตรวจสอบ PIN ไม่สำเร็จ"); setPin(""); },
    });
  };

  const toggleMusic = async () => {
    const audio = audioRef.current;
    if (!audio || !site?.settings.musicUrl) return;
    try { if (audio.paused) { await audio.play(); setPlaying(true); } else { audio.pause(); setPlaying(false); } } catch { setPlaying(false); }
  };

  if (loading) return <div className="legacy-loading">กำลังตรวจสอบสิทธิ์การเข้าถึง…</div>;
  if (!isAuthenticated) return <div className="legacy-loading"><div className="text-center"><p>เว็บไซต์นี้เป็นส่วนตัวสำหรับเจ้าของเท่านั้น</p><OwnerLoginButton className="legacy-save-btn mt-5">เข้าสู่ระบบเจ้าของ</OwnerLoginButton></div></div>;
  if (siteQuery.isLoading) return <div className="legacy-loading">กำลังเปิดความทรงจำ…</div>;
  if (!site) return <div className="legacy-loading">ไม่สามารถเปิดเว็บไซต์นี้ได้</div>;

  const photos = site.images;
  const movePhoto = (direction: number) => { if (photos.length) setPhotoIndex((index) => (index + direction + photos.length) % photos.length); };

  return <div className="legacy-anniversary min-h-screen bg-[#fff5f7]">
    <audio ref={audioRef} src={site.settings.musicUrl || undefined} loop onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} />
    {!unlocked && <section className="legacy-lock-screen">
      <Link href={`/site/${slug}/settings`} className="legacy-settings-trigger" aria-label="Settings"><Settings size={20} /></Link>
      <div className="mb-10 text-center"><h2>{site.site.title}</h2></div>
      <div className="legacy-dots" aria-label="PIN progress">{Array.from({ length: 4 }, (_, index) => <span key={index} className={index < pin.length ? "active" : ""} />)}</div>
      <div className="legacy-keypad">{Array.from({ length: 9 }, (_, index) => <button type="button" key={index + 1} className="legacy-key-btn" onClick={() => pressNumber(String(index + 1))}>{index + 1}</button>)}<span /><button type="button" className="legacy-key-btn" onClick={() => pressNumber("0")}>0</button><button type="button" className="legacy-key-btn soft" onClick={() => setPin((value) => value.slice(0, -1))} aria-label="ลบตัวเลข">←</button></div>
      <p className="legacy-lock-error">{verifyPin.isPending ? "กำลังตรวจสอบ…" : error}</p>
    </section>}
    {unlocked && <main className="legacy-main-content">
      <header className="legacy-header"><h1>{site.site.title}</h1><div className="legacy-clock"><ClockBox value={clock.days} label="วัน" /><ClockBox value={clock.hours} label="ชั่วโมง" /><ClockBox value={clock.minutes} label="นาที" /><ClockBox value={clock.seconds} label="วินาที" /></div></header>
      <section className="legacy-section legacy-video-section"><div className="legacy-section-inner"><h3>วิดีโอ 🎬</h3><p className="legacy-section-hint">เลื่อนด้วยลูกศรเพื่อดูช่องวิดีโอทั้ง 4 ช่อง</p><div className="legacy-video-shell"><button type="button" className="legacy-arrow legacy-arrow-prev" onClick={() => setVideoIndex((index) => (index + 3) % 4)} aria-label="ช่องวิดีโอก่อนหน้า"><ChevronLeft size={22} /></button><div className="legacy-video-viewport"><div className="legacy-video-track" style={{ transform: `translateX(-${videoIndex * 100}%)` }}>{videoSlots.map((asset, index) => <div className="legacy-video-slide" key={asset?.id ?? `slot-${index}`}>{asset ? <video className="size-full object-contain bg-slate-950" controls playsInline src={asset.url} /> : <div className="legacy-empty-media"><Video size={34} /><strong>ช่องวิดีโอ {index + 1}</strong><span>ยังไม่มีไฟล์</span></div>}</div>)}</div></div><button type="button" className="legacy-arrow legacy-arrow-next" onClick={() => setVideoIndex((index) => (index + 1) % 4)} aria-label="ช่องวิดีโอถัดไป"><ChevronRight size={22} /></button></div><p className="legacy-counter">{videoIndex + 1}/4</p></div></section>
      <section className="legacy-section legacy-message-section"><div className="legacy-glass-card"><p>{site.settings.memoryMessage}</p></div></section>
      <section className="legacy-section legacy-gallery-section"><h3>รูปที่คบกัน 📸</h3><div className="legacy-photo-slider"><button type="button" className="legacy-arrow legacy-photo-prev" onClick={() => movePhoto(-1)} disabled={!photos.length} aria-label="รูปก่อนหน้า"><ChevronLeft size={22} /></button><div className="legacy-photo-viewport"><div className="legacy-photo-track" style={{ transform: `translateX(-${photoIndex * 100}%)` }}>{photos.length ? photos.map((asset) => <div className="legacy-photo-slide" key={asset.id}><img src={asset.url} alt={asset.originalName} /></div>) : <div className="legacy-photo-slide"><div className="legacy-empty-photo">ยังไม่มีรูปภาพ</div></div>}</div></div><button type="button" className="legacy-arrow legacy-photo-next" onClick={() => movePhoto(1)} disabled={!photos.length} aria-label="รูปถัดไป"><ChevronRight size={22} /></button></div></section>
      <footer className="legacy-footer">อยู่ด้วยกันตลอดไปนะ 💖🌷</footer>
    </main>}
    {unlocked && <div className={`legacy-cd-player ${playing ? "playing" : ""}`}><div className="legacy-cd-case"><div className="legacy-cd-disc"><div className="legacy-cd-center" /></div></div><div><p className="legacy-cd-label">Our Song ❤️</p><button type="button" className="legacy-cd-button" onClick={toggleMusic} disabled={!site.settings.musicUrl} aria-label="เล่นหรือหยุดเพลง">{playing ? <Pause size={13} /> : <Play size={13} fill="currentColor" />}</button></div></div>}
  </div>;
}
