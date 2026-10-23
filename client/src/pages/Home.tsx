import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, Mail, Pause, Play, RotateCcw, Settings, Video, Volume2, VolumeX } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { DEFAULT_MUSIC_PLAYER_LAYOUT } from "@shared/site-layout";

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
  const difference = Math.max(0, new Date(target).getTime() - Date.now());
  return { days: Math.floor(difference / 86_400_000), hours: Math.floor((difference / 3_600_000) % 24), minutes: Math.floor((difference / 60_000) % 60), seconds: Math.floor((difference / 1_000) % 60) };
}

function ClockBox({ value, label }: { value: number; label: string }) {
  return <div className="legacy-clock-box"><strong>{value}</strong><span>{label}</span></div>;
}

function formatAudioTime(value: number) {
  if (!Number.isFinite(value)) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function Home({ slug }: { slug: string }) {
  const siteQuery = trpc.site.public.get.useQuery({ slug }, { staleTime: 60_000, gcTime: 10 * 60_000, refetchOnWindowFocus: false, refetchOnReconnect: false });
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
  const [audioTime, setAudioTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [volume, setVolume] = useState(0.75);
  const [muted, setMuted] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [letterName, setLetterName] = useState("");
  const [letterEmail, setLetterEmail] = useState("");
  const [letterMessage, setLetterMessage] = useState("");
  const [letterStatus, setLetterStatus] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);
  const sendLetterMutation = trpc.site.public.sendLetter.useMutation({
    onSuccess: () => { setLetterStatus("ส่งจดหมายเรียบร้อยแล้ว"); setLetterName(""); setLetterEmail(""); setLetterMessage(""); },
    onError: (reason) => setLetterStatus(reason.message),
  });

  const site = unlockedSite ?? siteQuery.data;
  const videoSlots = useMemo(() => Array.from({ length: 4 }, (_, index) => site?.videos[index] ?? null), [site?.videos]);

  useEffect(() => {
    if (!site?.settings.startDate) return;
    let timer: number | undefined;
    const updateClock = () => { if (document.visibilityState === "visible") setClock(elapsedFrom(site.settings.startDate)); };
    const start = () => { if (document.visibilityState === "visible") { updateClock(); timer = window.setInterval(updateClock, 1_000); } };
    const stop = () => { if (timer !== undefined) { window.clearInterval(timer); timer = undefined; } };
    const onVisibility = () => { stop(); start(); };
    start(); document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [site?.settings.startDate]);

  useEffect(() => {
    if (!site?.locked || !site.deletionAt) return;
    let timer: number | undefined;
    const updateClock = () => { if (document.visibilityState === "visible") setDeletionClock(remainingUntil(site.deletionAt!)); };
    const start = () => { if (document.visibilityState === "visible") { updateClock(); timer = window.setInterval(updateClock, 1_000); } };
    const stop = () => { if (timer !== undefined) { window.clearInterval(timer); timer = undefined; } };
    const onVisibility = () => { stop(); start(); };
    start(); document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
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
    let timer: number | undefined;
    const retry = () => { if (renderCaptcha()) { if (timer !== undefined) window.clearInterval(timer); timer = undefined; } };
    timer = window.setInterval(retry, 500);
    return () => { if (timer !== undefined) window.clearInterval(timer); };
  }, [site?.site.id]);

  useEffect(() => {
    const pauseWhenHidden = () => { if (document.visibilityState === "hidden") { audioRef.current?.pause(); setPlaying(false); } };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, []);

  useEffect(() => {
    const resize = () => setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    if (audioRef.current) { audioRef.current.volume = volume; audioRef.current.muted = muted; }
  }, [volume, muted, siteQuery.data?.settings.musicUrl]);

  const verifyPublicPin = async (candidate: string) => {
    if (verifying || candidate.length !== 4) return;
    setVerifying(true);
    setError("");
    try {
      const response = await fetch("/api/trpc/site.public.unlock?batch=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 0: { json: { slug, pin: candidate } } }),
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
      }
    } catch {
      setError("ตรวจสอบ PIN ไม่สำเร็จ");
      setPin("");
    } finally {
      setVerifying(false);
    }
  };

  const pressNumber = (digit: string) => {
    if (verifying || pin.length >= 4) return;
    const next = `${pin}${digit}`;
    setPin(next);
    setError("");
    if (next.length === 4) {
      void verifyPublicPin(next);
    }
  };

  const toggleMusic = async () => {
    const audio = audioRef.current;
    if (!audio || !site?.settings.musicUrl) return;
    try { if (audio.paused) { await audio.play(); setPlaying(true); } else { audio.pause(); setPlaying(false); } } catch { setPlaying(false); }
  };
  const sendLetter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLetterStatus("");
    sendLetterMutation.mutate({ slug, senderName: letterName, senderEmail: letterEmail, message: letterMessage });
  };

  if (siteQuery.isLoading) return <div className="legacy-loading">กำลังเปิดความทรงจำ…</div>;
  if (!site) return <div className="legacy-loading">ไม่สามารถเปิดเว็บไซต์นี้ได้</div>;
  if (site.locked) return <div className="legacy-lock-screen"><div className="legacy-admin-box text-center"><h2>เว็บไซต์ถูกล็อกแล้ว</h2><p className="legacy-admin-note">เว็บไซต์นี้หมดอายุและจะลบข้อมูลกับสื่อโดยอัตโนมัติเมื่อครบกำหนด</p><div className="legacy-clock justify-center my-6"><ClockBox value={deletionClock.days} label="วัน" /><ClockBox value={deletionClock.hours} label="ชั่วโมง" /><ClockBox value={deletionClock.minutes} label="นาที" /><ClockBox value={deletionClock.seconds} label="วินาที" /></div><p className="legacy-admin-note">กรุณาติดต่อเจ้าของเว็บไซต์เพื่อขอต่ออายุ</p></div></div>;

  const photos = site.images;
  const layoutOrder = site.settings.layoutOrder ?? ["video", "message", "secret", "gallery", "letter"];
  const hiddenSections = new Set(site.settings.hiddenSections ?? []);
  const sectionWidths = site.settings.sectionWidths ?? {};
  const sectionStyle = (id: "video" | "message" | "secret" | "gallery" | "letter") => ({ order: layoutOrder.indexOf(id), gridColumn: `span ${sectionWidths[id] ?? 12}`, display: hiddenSections.has(id) ? "none" : undefined });
  const musicPlayerLayout = site.settings.musicPlayerLayout ?? DEFAULT_MUSIC_PLAYER_LAYOUT;
  const playerScale = musicPlayerLayout.scale;
  const viewportWidth = viewportSize.width || 360;
  const viewportHeight = viewportSize.height || 720;
  const playerWidth = Math.min(340, viewportWidth - 24) * playerScale;
  const playerHeight = 154 * playerScale;
  const playerLeft = Math.max(playerWidth / 2 + 12, Math.min(viewportWidth - playerWidth / 2 - 12, (musicPlayerLayout.x / 100) * viewportWidth));
  const playerTop = Math.max(playerHeight / 2 + 12, Math.min(viewportHeight - playerHeight / 2 - 12, (musicPlayerLayout.y / 100) * viewportHeight));
  const themeBackground = { soft: "#fff5f7", sunset: "#fff7ed", night: "#0f172a", paper: "#fefce8" }[site.settings.backgroundStyle ?? "soft"];
  const themeFont = { gaegu: "'Gaegu', 'Noto Sans Thai', sans-serif", serif: "Georgia, 'Noto Serif Thai', serif", sans: "system-ui, 'Noto Sans Thai', sans-serif" }[site.settings.fontFamily ?? "gaegu"];
  const movePhoto = (direction: number) => { if (photos.length) setPhotoIndex((index) => (index + direction + photos.length) % photos.length); };

  return <div className="legacy-anniversary min-h-screen" style={{ backgroundColor: themeBackground, color: site.settings.themeMode === "night" ? "#f8fafc" : undefined, fontFamily: themeFont }}>
    <audio ref={audioRef} src={site.settings.musicUrl || undefined} preload="metadata" loop onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} onTimeUpdate={(event) => setAudioTime(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setAudioDuration(event.currentTarget.duration)} onDurationChange={(event) => setAudioDuration(event.currentTarget.duration)} />
    {!unlocked && <section className="legacy-lock-screen">
      <Link href={`/site/${slug}/settings`} className="legacy-settings-trigger" aria-label="Settings"><Settings size={20} /></Link>
      <div className="mb-10 text-center"><h2>{site.site.title}</h2><p className="legacy-lock-hint">ลิงก์นี้เป็นลิงก์ส่วนตัว กรุณากรอกรหัสผ่าน 4 หลักเพื่อเข้าชม</p></div>
      <div ref={captchaRef} className="flex justify-center mb-5" aria-label="ยืนยันว่าไม่ใช่บอท" />
      <div className="legacy-dots" aria-label="รหัสผ่าน progress">{Array.from({ length: 4 }, (_, index) => <span key={index} className={index < pin.length ? "active" : ""} />)}</div>
      <div className="legacy-keypad">{Array.from({ length: 9 }, (_, index) => <button type="button" key={index + 1} className="legacy-key-btn" onClick={() => pressNumber(String(index + 1))}>{index + 1}</button>)}<span /><button type="button" className="legacy-key-btn" onClick={() => pressNumber("0")}>0</button><button type="button" className="legacy-key-btn soft" onClick={() => setPin((value) => value.slice(0, -1))} aria-label="ลบตัวเลข">←</button></div>
      {pin.length === 4 && <button type="button" className="legacy-save-btn mt-4" onClick={() => void verifyPublicPin(pin)} disabled={verifying}>{verifying ? "กำลังตรวจสอบ…" : "เข้าชมความทรงจำ"}</button>}
      <p className="legacy-lock-error">{verifying ? "กำลังตรวจสอบ…" : error}</p>
    </section>}
    {unlocked && <main className="legacy-main-content legacy-layout-stack">
      <header className="legacy-header"><h1>{site.site.title}</h1><div className="legacy-clock"><ClockBox value={clock.days} label="วัน" /><ClockBox value={clock.hours} label="ชั่วโมง" /><ClockBox value={clock.minutes} label="นาที" /><ClockBox value={clock.seconds} label="วินาที" /></div></header>
      <section style={sectionStyle("video")} className="legacy-section legacy-video-section"><div className="legacy-section-inner"><h3>วิดีโอ 🎬</h3><p className="legacy-section-hint">เลื่อนด้วยลูกศรเพื่อดูช่องวิดีโอทั้ง 4 ช่อง</p><div className="legacy-video-shell"><button type="button" className="legacy-arrow legacy-arrow-prev" onClick={() => setVideoIndex((index) => (index + 3) % 4)} aria-label="ช่องวิดีโอก่อนหน้า"><ChevronLeft size={22} /></button><div className="legacy-video-viewport"><div className="legacy-video-track" style={{ transform: `translateX(-${videoIndex * 100}%)` }}>{videoSlots.map((asset, index) => <div className="legacy-video-slide" key={asset?.id ?? `slot-${index}`}>{asset ? <video className="size-full object-contain bg-slate-950" controls playsInline preload="none" src={asset.url} /> : <div className="legacy-empty-media"><Video size={34} /><strong>ช่องวิดีโอ {index + 1}</strong><span>ยังไม่มีไฟล์</span></div>}</div>)}</div></div><button type="button" className="legacy-arrow legacy-arrow-next" onClick={() => setVideoIndex((index) => (index + 1) % 4)} aria-label="ช่องวิดีโอถัดไป"><ChevronRight size={22} /></button></div><p className="legacy-counter">{videoIndex + 1}/4</p></div></section>
      <section style={sectionStyle("message")} className="legacy-section legacy-message-section"><div className="legacy-glass-card"><p>{site.settings.memoryMessage}</p></div></section>
      {secretMessage && <section style={sectionStyle("secret")} className="legacy-section legacy-message-section"><div className="legacy-glass-card"><h3>ข้อความลับ</h3><p>{secretMessage}</p></div></section>}
      <section style={sectionStyle("gallery")} className="legacy-section legacy-gallery-section"><h3>รูปที่คบกัน 📸</h3><div className="legacy-photo-slider"><button type="button" className="legacy-arrow legacy-photo-prev" onClick={() => movePhoto(-1)} disabled={!photos.length} aria-label="รูปก่อนหน้า"><ChevronLeft size={22} /></button><div className="legacy-photo-viewport"><div className="legacy-photo-track" style={{ transform: `translateX(-${photoIndex * 100}%)` }}>{photos.length ? photos.map((asset) => <div className="legacy-photo-slide" key={asset.id}><img src={asset.url} alt={asset.originalName} loading="lazy" decoding="async" /></div>) : <div className="legacy-photo-slide"><div className="legacy-empty-photo">ยังไม่มีรูปภาพ</div></div>}</div></div><button type="button" className="legacy-arrow legacy-photo-next" onClick={() => movePhoto(1)} disabled={!photos.length} aria-label="รูปถัดไป"><ChevronRight size={22} /></button></div></section>
      <section style={sectionStyle("letter")} className="legacy-section legacy-message-section"><div className="legacy-glass-card"><h3><Mail size={18} className="inline-block" /> เขียนจดหมายถึงเรา</h3><p className="legacy-section-hint">ฝากข้อความไว้ แล้วระบบจะส่งเข้าอีเมลเจ้าของเว็บไซต์</p><form className="mt-4 grid gap-3" onSubmit={sendLetter}><input required maxLength={80} value={letterName} onChange={(event) => setLetterName(event.target.value)} placeholder="ชื่อของคุณ" className="rounded-xl border border-pink-200 bg-white px-3 py-2.5" /><input type="email" value={letterEmail} onChange={(event) => setLetterEmail(event.target.value)} placeholder="อีเมลสำหรับตอบกลับ (ไม่บังคับ)" className="rounded-xl border border-pink-200 bg-white px-3 py-2.5" /><textarea required minLength={3} maxLength={5000} value={letterMessage} onChange={(event) => setLetterMessage(event.target.value)} placeholder="เขียนข้อความจากหัวใจ…" className="min-h-28 rounded-xl border border-pink-200 bg-white px-3 py-2.5" /><button type="submit" className="legacy-save-btn" disabled={sendLetterMutation.isPending}>{sendLetterMutation.isPending ? "กำลังส่ง…" : "ส่งจดหมาย"}</button></form>{letterStatus && <p className="legacy-lock-error mt-3" role="status">{letterStatus}</p>}</div></section>
      <footer className="legacy-footer">อยู่ด้วยกันตลอดไปนะ 💖🌷</footer>
    </main>}
    {unlocked && <div className={`legacy-cd-player ${playing ? "playing" : ""}`} style={{ left: playerLeft, top: playerTop, right: "auto", bottom: "auto", transform: `translate(-50%, -50%) scale(${playerScale})` }}>
      <div className="legacy-cd-case"><div className="legacy-cd-disc"><div className="legacy-cd-center" /></div></div>
      <div className="legacy-music-player-content"><div className="legacy-music-player-heading"><div><span className="legacy-music-player-eyebrow">OUR SONG</span><p className="legacy-cd-label">A little piece of us ♡</p></div><button type="button" className="legacy-music-icon-btn" onClick={() => { if (audioRef.current) { audioRef.current.currentTime = 0; setAudioTime(0); } }} disabled={!site.settings.musicUrl} aria-label="เริ่มเพลงใหม่"><RotateCcw size={15} /></button></div>
        <input className="legacy-music-seek" type="range" min="0" max={audioDuration || 0} step="0.1" value={Math.min(audioTime, audioDuration || 0)} disabled={!site.settings.musicUrl || !audioDuration} onChange={(event) => { const next = Number(event.target.value); setAudioTime(next); if (audioRef.current) audioRef.current.currentTime = next; }} aria-label="ตำแหน่งเพลง" />
        <div className="legacy-music-time"><span>{formatAudioTime(audioTime)}</span><span>{formatAudioTime(audioDuration)}</span></div>
        <div className="legacy-music-player-controls"><button type="button" className="legacy-cd-button" onClick={toggleMusic} disabled={!site.settings.musicUrl} aria-label={playing ? "หยุดเพลง" : "เล่นเพลง"}>{playing ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}</button><div className="legacy-music-volume"><button type="button" className="legacy-music-icon-btn" onClick={() => setMuted((value) => !value)} aria-label={muted ? "เปิดเสียง" : "ปิดเสียง"}>{muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}</button><input type="range" min="0" max="1" step="0.01" value={muted ? 0 : volume} onChange={(event) => { const next = Number(event.target.value); setVolume(next); setMuted(next === 0); }} aria-label="ระดับเสียง" /></div></div>
      </div>
    </div>}
  </div>;
}
