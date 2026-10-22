import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, Heart, LockKeyhole, Orbit, Pause, Play, Settings, Sparkles, Video } from "lucide-react";
import CosmicBackdrop from "@/components/CosmicBackdrop";
import { trpc } from "@/lib/trpc";

declare global {
  interface Window {
    grecaptcha?: { render: (container: HTMLElement, parameters: { sitekey: string }) => number; getResponse: (widgetId?: number) => string; reset: (widgetId?: number) => void };
  }
}

type TimeParts = { days: number; hours: number; minutes: number; seconds: number };

function elapsedFrom(startDate: string): TimeParts {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  const difference = Math.max(0, Date.now() - new Date(`${startDate}T00:00:00`).getTime());
  return { days: Math.floor(difference / 86_400_000), hours: Math.floor((difference / 3_600_000) % 24), minutes: Math.floor((difference / 60_000) % 60), seconds: Math.floor((difference / 1_000) % 60) };
}

function remainingUntil(target: string): TimeParts {
  const targetTime = Date.parse(target);
  const difference = Number.isFinite(targetTime) ? Math.max(0, targetTime - Date.now()) : 0;
  return { days: Math.floor(difference / 86_400_000), hours: Math.floor((difference / 3_600_000) % 24), minutes: Math.floor((difference / 60_000) % 60), seconds: Math.floor((difference / 1_000) % 60) };
}

function ClockBox({ value, label }: { value: number; label: string }) {
  return <div className="memory-clock-box"><strong>{String(value).padStart(2, "0")}</strong><span>{label}</span></div>;
}

export default function Home({ slug }: { slug: string }) {
  const siteQuery = trpc.site.public.get.useQuery({ slug });
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [secretMessage, setSecretMessage] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [unlockedSite, setUnlockedSite] = useState<typeof siteQuery.data>();
  const [clock, setClock] = useState<TimeParts>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [deletionClock, setDeletionClock] = useState<TimeParts>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const captchaRef = useRef<HTMLDivElement>(null);
  const captchaWidget = useRef<number | null>(null);
  const [videoIndex, setVideoIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const site = unlockedSite ?? siteQuery.data;
  const videoSlots = useMemo(() => Array.from({ length: 4 }, (_, index) => site?.videos[index] ?? null), [site?.videos]);

  useEffect(() => {
    if (!site?.settings.startDate) return;
    const updateClock = () => setClock(elapsedFrom(site.settings.startDate));
    updateClock();
    const timer = window.setInterval(updateClock, 1_000);
    return () => window.clearInterval(timer);
  }, [site?.settings.startDate]);

  useEffect(() => {
    if (!site?.locked || !site.deletionAt) return;
    const updateClock = () => setDeletionClock(remainingUntil(site.deletionAt!));
    updateClock();
    const timer = window.setInterval(updateClock, 1_000);
    return () => window.clearInterval(timer);
  }, [site?.locked, site?.deletionAt]);

  useEffect(() => {
    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
    if (!siteKey || !captchaRef.current || captchaWidget.current !== null) return;
    const renderCaptcha = () => {
      if (window.grecaptcha && captchaRef.current && captchaWidget.current === null) {
        captchaWidget.current = window.grecaptcha.render(captchaRef.current, { sitekey: siteKey });
        return true;
      }
      return false;
    };
    if (renderCaptcha()) return;
    const timer = window.setInterval(() => { if (renderCaptcha()) window.clearInterval(timer); }, 200);
    return () => window.clearInterval(timer);
  }, [site?.site.id]);

  const resetCaptcha = () => {
    if (captchaWidget.current !== null && window.grecaptcha) window.grecaptcha.reset(captchaWidget.current);
  };

  const verifyPublicPin = async (candidate: string) => {
    if (verifying || candidate.length !== 4) return;
    setVerifying(true);
    setError("");
    try {
      const recaptchaToken = captchaWidget.current !== null && window.grecaptcha ? window.grecaptcha.getResponse(captchaWidget.current) : "";
      const response = await fetch("/api/trpc/site.public.unlock?batch=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 0: { json: { slug, pin: candidate, ...(recaptchaToken ? { recaptchaToken } : {}) } } }),
      });
      const payload = await response.json().catch(() => null);
      const result = payload?.[0]?.result?.data?.json as { valid?: boolean; data?: typeof siteQuery.data } | undefined;
      if (response.ok && result?.valid && result.data) {
        setUnlockedSite(result.data);
        setSecretMessage(result.data.settings.secretMessage ?? "");
        setUnlocked(true);
        setPin("");
      } else {
        setError("การยืนยันไม่ผ่าน หรือ PIN ไม่ถูกต้อง");
        setPin("");
        resetCaptcha();
      }
    } catch {
      setError("ตรวจสอบ PIN ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      setPin("");
      resetCaptcha();
    } finally {
      setVerifying(false);
    }
  };

  const pressNumber = (digit: string) => {
    if (verifying || pin.length >= 4) return;
    const next = `${pin}${digit}`;
    setPin(next);
    setError("");
    if (next.length === 4) void verifyPublicPin(next);
  };

  useEffect(() => {
    if (unlocked) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key >= "0" && event.key <= "9") pressNumber(event.key);
      if (event.key === "Backspace") { setPin((value) => value.slice(0, -1)); setError(""); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const toggleMusic = async () => {
    const audio = audioRef.current;
    if (!audio || !site?.settings.musicUrl) return;
    try {
      if (audio.paused) { await audio.play(); setPlaying(true); } else { audio.pause(); setPlaying(false); }
    } catch { setPlaying(false); }
  };

  if (siteQuery.isLoading) return <div className="cosmic-app-shell cosmic-center-shell"><CosmicBackdrop /><div className="cosmic-loading-card"><Sparkles size={22} />กำลังตามหาความทรงจำ…</div></div>;
  if (!site) return <div className="cosmic-app-shell cosmic-center-shell"><CosmicBackdrop /><div className="cosmic-access-card"><Orbit size={30} /><h1>ไม่พบความทรงจำนี้</h1><p>ลิงก์อาจไม่ถูกต้อง หรือเว็บไซต์นี้ไม่มีอยู่แล้ว</p></div></div>;
  if (site.locked) return <div className="cosmic-app-shell cosmic-center-shell"><CosmicBackdrop /><div className="memory-expired-card"><LockKeyhole size={29} /><span className="cosmic-eyebrow">ORBIT PAUSED</span><h1>เว็บไซต์ถูกล็อกแล้ว</h1><p>เว็บไซต์นี้หมดอายุและจะลบข้อมูลกับสื่อโดยอัตโนมัติเมื่อครบกำหนด</p><div className="memory-clock memory-clock-compact"><ClockBox value={deletionClock.days} label="วัน" /><ClockBox value={deletionClock.hours} label="ชม." /><ClockBox value={deletionClock.minutes} label="นาที" /><ClockBox value={deletionClock.seconds} label="วินาที" /></div><small>กรุณาติดต่อเจ้าของเว็บไซต์เพื่อต่ออายุ</small></div></div>;

  const photos = site.images;
  const backgroundStyle = site.settings.backgroundStyle ?? "night";
  const themeFont = { gaegu: "'Gaegu', 'Noto Sans Thai', sans-serif", serif: "Georgia, 'Noto Serif Thai', serif", sans: "'DM Sans', 'Noto Sans Thai', sans-serif" }[site.settings.fontFamily ?? "sans"];
  const siteStyle = { "--site-accent": site.settings.themeColor ?? "#8b5cf6", fontFamily: themeFont } as CSSProperties;
  const movePhoto = (direction: number) => { if (photos.length) setPhotoIndex((index) => (index + direction + photos.length) % photos.length); };

  return <div className={`memory-site memory-tone-${backgroundStyle} ${site.settings.themeMode === "light" ? "memory-light" : ""}`} style={siteStyle}>
    <CosmicBackdrop />
    <audio ref={audioRef} src={site.settings.musicUrl || undefined} loop onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} />
    {!unlocked && <section className="memory-unlock-screen"><Link href={`/site/${slug}/settings`} className="memory-settings-link" aria-label="ตั้งค่าเว็บไซต์"><Settings size={17} /></Link><div className="memory-unlock-card">
      <div className="memory-unlock-symbol"><Heart size={22} fill="currentColor" /><i /></div><span className="cosmic-eyebrow">PRIVATE CONSTELLATION</span><h1>{site.site.title}</h1><p>ใส่รหัส 4 หลักเพื่อเปิดพิกัดความทรงจำของเรา</p>
      <div ref={captchaRef} className="memory-captcha" aria-label="ยืนยันว่าไม่ใช่บอท" />
      <div className="memory-pin-dots" aria-label={`กรอก PIN แล้ว ${pin.length} จาก 4 หลัก`}>{Array.from({ length: 4 }, (_, index) => <span key={index} className={index < pin.length ? "is-filled" : ""} />)}</div>
      <div className="memory-keypad" role="group" aria-label="แป้นตัวเลข PIN">{Array.from({ length: 9 }, (_, index) => <button type="button" key={index + 1} onClick={() => pressNumber(String(index + 1))}>{index + 1}</button>)}<span /><button type="button" onClick={() => pressNumber("0")}>0</button><button type="button" className="memory-keypad-clear" onClick={() => { setPin((value) => value.slice(0, -1)); setError(""); }} aria-label="ลบตัวเลขล่าสุด">←</button></div>
      {pin.length === 4 && <button type="button" className="cosmic-primary-button memory-verify-button" onClick={() => void verifyPublicPin(pin)} disabled={verifying}>{verifying ? "กำลังตรวจสอบ…" : "ยืนยัน PIN"}</button>}
      <p className="memory-unlock-error" role="alert" aria-live="polite">{verifying ? "กำลังเปิดประตูสู่ความทรงจำ…" : error}</p>
    </div></section>}

    {unlocked && <main className="memory-content">
      <header className="memory-hero"><div className="memory-hero-copy"><span className="cosmic-eyebrow"><Sparkles size={15} /> OUR STORY IN ORBIT</span><h1>{site.site.title}</h1><p>ทุกวินาทีที่ผ่านไป ยังอยู่ในวงโคจรของเราเสมอ</p><div className="memory-clock"><ClockBox value={clock.days} label="วัน" /><ClockBox value={clock.hours} label="ชั่วโมง" /><ClockBox value={clock.minutes} label="นาที" /><ClockBox value={clock.seconds} label="วินาที" /></div></div><div className="memory-hero-orbit" aria-hidden="true"><span /><i /><b>∞</b></div></header>
      <div className="memory-page-grid">
        <section className="memory-panel memory-video-panel"><div className="memory-section-heading"><div><span className="cosmic-section-kicker">MOTION MEMORY</span><h2><Video size={20} /> วิดีโอของเรา</h2></div><span>{videoIndex + 1} / 4</span></div><div className="memory-carousel-shell"><button type="button" className="memory-arrow memory-arrow-prev" onClick={() => setVideoIndex((index) => (index + 3) % 4)} aria-label="ช่องวิดีโอก่อนหน้า"><ChevronLeft size={20} /></button><div className="memory-video-viewport"><div className="memory-video-track" style={{ transform: `translateX(-${videoIndex * 100}%)` }}>{videoSlots.map((asset, index) => <div className="memory-video-slide" key={asset?.id ?? `slot-${index}`}>{asset ? <video className="memory-video" controls playsInline preload="metadata" src={asset.url} /> : <div className="memory-empty-media"><Video size={33} /><strong>ช่องวิดีโอ {index + 1}</strong><span>รอเรื่องราวบทต่อไป</span></div>}</div>)}</div></div><button type="button" className="memory-arrow memory-arrow-next" onClick={() => setVideoIndex((index) => (index + 1) % 4)} aria-label="ช่องวิดีโอถัดไป"><ChevronRight size={20} /></button></div><div className="memory-slider-dots">{videoSlots.map((_, index) => <button key={index} className={index === videoIndex ? "is-active" : ""} onClick={() => setVideoIndex(index)} aria-label={`ดูวิดีโอช่อง ${index + 1}`} />)}</div></section>
        <section className="memory-message-panel"><span className="cosmic-section-kicker">A SMALL UNIVERSE</span><Heart size={22} fill="currentColor" /><p>{site.settings.memoryMessage}</p><i className="memory-message-star">✦</i></section>
        {secretMessage && <section className="memory-secret-panel"><LockKeyhole size={17} /><div><span>UNLOCKED NOTE</span><p>{secretMessage}</p></div></section>}
        <section className="memory-panel memory-gallery-panel"><div className="memory-section-heading"><div><span className="cosmic-section-kicker">PHOTO DUST</span><h2><Sparkles size={19} /> รูปที่คบกัน</h2></div>{photos.length ? <span>{photoIndex + 1} / {photos.length}</span> : null}</div><div className="memory-photo-shell"><button type="button" className="memory-arrow memory-photo-prev" onClick={() => movePhoto(-1)} disabled={!photos.length} aria-label="รูปก่อนหน้า"><ChevronLeft size={20} /></button><div className="memory-photo-viewport"><div className="memory-photo-track" style={{ transform: `translateX(-${photoIndex * 100}%)` }}>{photos.length ? photos.map((asset) => <div className="memory-photo-slide" key={asset.id}><img src={asset.url} alt={asset.originalName} loading="lazy" /></div>) : <div className="memory-photo-slide"><div className="memory-empty-photo"><Sparkles size={30} />ยังไม่มีรูปภาพ</div></div>}</div></div><button type="button" className="memory-arrow memory-photo-next" onClick={() => movePhoto(1)} disabled={!photos.length} aria-label="รูปถัดไป"><ChevronRight size={20} /></button></div></section>
      </div>
      <footer className="memory-footer"><span /><p>อยู่ด้วยกันตลอดไปนะ</p><span /></footer>
    </main>}
    {unlocked && <div className={`memory-music-dock ${playing ? "is-playing" : ""}`}><button type="button" className="memory-record-button" onClick={toggleMusic} disabled={!site.settings.musicUrl} aria-label="เล่นหรือหยุดเพลง"><span><i /></span></button><div><small>OUR SOUNDTRACK</small><p>{site.settings.musicUrl ? "Our Song" : "ยังไม่มีเพลง"}</p></div><button type="button" className="memory-play-button" onClick={toggleMusic} disabled={!site.settings.musicUrl} aria-label="เล่นหรือหยุดเพลง">{playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}</button></div>}
  </div>;
}
