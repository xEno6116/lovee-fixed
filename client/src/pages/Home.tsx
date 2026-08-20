import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BookHeart, CheckCircle2, ChevronLeft, ChevronRight, Expand, Facebook, Heart, Instagram, MailOpen, MapPin, Pause, Play, QrCode, RotateCcw, Send, Share2, Shuffle, Sparkles, Video, X } from "lucide-react";
import QRCode from "qrcode";
import { trpc } from "@/lib/trpc";
import { createFloatingHeart, type FloatingHeart } from "@/heartEffect";
import { buildCustomFontFace } from "@/fontFace";
import { getRevealContent } from "@/revealExperience";
import { isReleasedAt, nextMemoryIndex } from "@/memoryExperience";
import { getVisualTheme } from "@/themeGallery";

type TimeParts = { days: number; hours: number; minutes: number; seconds: number };

function elapsedFrom(startDate: string): TimeParts {
  const difference = Math.max(0, Date.now() - new Date(`${startDate}T00:00:00`).getTime());
  return { days: Math.floor(difference / 86_400_000), hours: Math.floor((difference / 3_600_000) % 24), minutes: Math.floor((difference / 60_000) % 60), seconds: Math.floor((difference / 1_000) % 60) };
}

function ClockBox({ value, label }: { value: number; label: string }) {
  return <div className="legacy-clock-box"><strong>{value}</strong><span>{label}</span></div>;
}

export default function Home({ slug }: { slug: string }) {
  const siteQuery = trpc.site.public.get.useQuery({ slug }, { enabled: true, retry: false });
  const verifyPin = trpc.site.public.unlock.useMutation();
  const recordView = trpc.site.public.recordView.useMutation();
  const submitLetterResponse = trpc.site.public.submitLetterResponse.useMutation({ onSuccess: () => { setQuestionAnswers({}); setQuestionSubmitted(true); setQuestionOpened(false); setQuestionStatus("ส่งคำตอบถึงเราแล้ว ขอบคุณนะ 💌"); }, onError: (result) => setQuestionStatus(result.message || "ส่งคำตอบไม่สำเร็จ") });
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [clock, setClock] = useState<TimeParts>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [videoIndex, setVideoIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [playerPosition, setPlayerPosition] = useState({ x: 0, y: 0 });
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeart[]>([]);
  const [revealDismissed, setRevealDismissed] = useState(false);
  const [letterOpened, setLetterOpened] = useState(false);
  const [noteIndex, setNoteIndex] = useState(0);
  const [selectedNote, setSelectedNote] = useState<{ title: string; body: string } | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; originalName: string; caption: string } | null>(null);
  const [questionOpened, setQuestionOpened] = useState(false);
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [questionHoneypot, setQuestionHoneypot] = useState("");
  const [questionStatus, setQuestionStatus] = useState("");
  const [questionSubmitted, setQuestionSubmitted] = useState(false);
  const questionOpenedAt = useRef(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const playerDragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  const site = siteQuery.data;
  const videoSlots = useMemo(() => Array.from({ length: 4 }, (_, index) => site?.videos[index] ?? null), [site?.videos]);

  useEffect(() => {
    if (!site?.settings.startDate) return;
    const updateClock = () => setClock(elapsedFrom(site.settings.startDate));
    updateClock();
    const timer = window.setInterval(updateClock, 1_000);
    return () => window.clearInterval(timer);
  }, [site?.settings.startDate]);

  useEffect(() => { if (unlocked) void QRCode.toDataURL(window.location.href, { width: 180, margin: 1, color: { dark: "#3b2438", light: "#ffffff" } }).then(setQrCode); }, [unlocked]);
  useEffect(() => { if (unlocked) recordView.mutate({ slug }); }, [unlocked, slug]);

  const pressNumber = (digit: string) => {
    if (verifyPin.isPending || pin.length >= 4) return;
    const next = `${pin}${digit}`;
    setPin(next);
    setError("");
    if (next.length === 4) verifyPin.mutate({ slug, pin: next }, {
      onSuccess: ({ valid }) => {
        if (valid) { setRevealDismissed(false); setUnlocked(true); setPin(""); void siteQuery.refetch(); }
        else { setError("PIN ไม่ถูกต้อง ลองใหม่อีกครั้งนะ"); window.setTimeout(() => setPin(""), 450); }
      },
      onError: () => { setError("ตรวจสอบ PIN ไม่สำเร็จ"); setPin(""); },
    });
  };

  const toggleMusic = async () => {
    const audio = audioRef.current;
    if (!audio || !site?.settings.musicUrl) return;
    try { if (audio.paused) await audio.play(); else audio.pause(); } catch { setPlaying(false); }
  };
  const restartMusic = async () => {
    const audio = audioRef.current;
    if (!audio || !site?.settings.musicUrl) return;
    audio.currentTime = 0;
    try { await audio.play(); } catch { setPlaying(false); }
  };
  const startPlayerDrag = (event: React.PointerEvent<HTMLDivElement>) => { playerDragRef.current = { startX: event.clientX, startY: event.clientY, baseX: playerPosition.x, baseY: playerPosition.y }; event.currentTarget.setPointerCapture(event.pointerId); };
  const movePlayer = (event: React.PointerEvent<HTMLDivElement>) => { const drag = playerDragRef.current; if (!drag) return; setPlayerPosition({ x: drag.baseX + event.clientX - drag.startX, y: drag.baseY + event.clientY - drag.startY }); };
  const endPlayerDrag = () => { playerDragRef.current = null; };
  const launchHeart = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const heart: FloatingHeart = createFloatingHeart({ id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, x: rect.left + rect.width / 2, y: rect.top });
    setFloatingHearts((items) => [...items.slice(-14), heart]);
    window.setTimeout(() => setFloatingHearts((items) => items.filter((item) => item.id !== heart.id)), 1_250);
  };

  if (!unlocked) return <div className="legacy-anniversary min-h-screen legacy-bg-soft"><section className="legacy-lock-screen"><div className="mb-10 text-center"><h2>LoveOffice</h2><p>ใส่ PIN เพื่อเปิดความทรงจำ</p></div><div className="legacy-dots" aria-label="PIN progress">{Array.from({ length: 4 }, (_, index) => <span key={index} className={index < pin.length ? "active" : ""} />)}</div><div className="legacy-keypad">{Array.from({ length: 9 }, (_, index) => <button type="button" key={index + 1} className="legacy-key-btn" onClick={() => pressNumber(String(index + 1))}>{index + 1}</button>)}<span /><button type="button" className="legacy-key-btn" onClick={() => pressNumber("0")}>0</button><button type="button" className="legacy-key-btn soft" onClick={() => setPin((value) => value.slice(0, -1))} aria-label="ลบตัวเลข">←</button></div><p className="legacy-lock-error">{verifyPin.isPending ? "กำลังตรวจสอบ…" : error}</p></section></div>;
  if (siteQuery.isLoading) return <div className="legacy-loading">กำลังเปิดความทรงจำ…</div>;
  if (!site) return <div className="legacy-loading">ไม่สามารถเปิดเว็บไซต์นี้ได้</div>;

  const photos = site.images;
  const movePhoto = (direction: number) => { if (photos.length) setPhotoIndex((index) => (index + direction + photos.length) % photos.length); };
  const themeStyle = { "--legacy-theme": site.settings.themeColor || "#ec4899" } as CSSProperties & { "--legacy-theme": string };
  const hasContacts = Boolean(site.settings.facebookUrl || site.settings.instagramUrl);
  const features = site.settings.features;
  const now = Date.now();
  const isPublished = (date: string) => isReleasedAt(date, now);
  const visibleNotes = features.notes.filter((note) => isPublished(note.publishAt));
  const showSurprise = Boolean((features.surpriseTitle || features.surpriseMessage) && isPublished(features.surpriseAt));
  const activeNote = visibleNotes.length ? visibleNotes[noteIndex % visibleNotes.length] : null;
  const nightMode = features.themeMode === "night" || (features.themeMode === "auto" && new Date().getHours() >= 19);
  const customFontFace = buildCustomFontFace(features.customFontUrl);
  const visualTheme = getVisualTheme(features.visualTheme);
  const questionPrompts = features.questionLetterPrompts;
  const questionLetterLocked = Boolean(site.letterSubmitted || questionSubmitted);
  const revealContent = getRevealContent({ siteTitle: site.site.title, welcomeTitle: features.welcomeTitle, welcomeMessage: features.welcomeMessage, memoryMessage: site.settings.memoryMessage });
  const playerStyle = { "--legacy-player-x": `${playerPosition.x}px`, "--legacy-player-y": `${playerPosition.y}px` } as CSSProperties & { "--legacy-player-x": string; "--legacy-player-y": string };
  const share = async () => { const data = { title: site.site.title, text: "เว็บไซต์ความทรงจำของเรา", url: window.location.href }; try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(data.url); window.alert("คัดลอกลิงก์แล้ว"); } } catch { /* User cancelled sharing. */ } };
  const openMemory = (event: React.MouseEvent<HTMLButtonElement>) => { launchHeart(event); setRevealDismissed(true); };
  const showNextNote = () => { if (visibleNotes.length > 1) setNoteIndex((index) => nextMemoryIndex(index, visibleNotes.length)); };
  const openQuestionLetter = () => { if (questionLetterLocked) return; questionOpenedAt.current = Date.now(); setQuestionOpened(true); setQuestionStatus(""); };
  const allQuestionsAnswered = questionPrompts.length > 0 && questionPrompts.every((item) => Boolean(questionAnswers[item.id]?.trim()));
  const submitQuestion = () => { if (!allQuestionsAnswered || !window.confirm("ยืนยันส่งคำตอบทั้งหมดถึงเจ้าของเว็บไซต์?")) return; setQuestionStatus("กำลังส่งคำตอบ…"); submitLetterResponse.mutate({ slug, answers: questionPrompts.map((item) => ({ question: item.prompt, answer: questionAnswers[item.id]?.trim() ?? "" })), startedAt: questionOpenedAt.current, honeypot: questionHoneypot }); };

  return <div className={`legacy-anniversary min-h-screen legacy-bg-${features.backgroundStyle} legacy-visual-${visualTheme.id} ${customFontFace ? "legacy-font-custom" : `legacy-font-${features.fontFamily}`} ${nightMode ? "legacy-night" : ""}`} style={themeStyle}>
    {customFontFace && <style data-custom-font>{customFontFace}</style>}
    <audio ref={audioRef} src={site.settings.musicUrl || undefined} loop onPause={() => setPlaying(false)} onWaiting={() => setPlaying(false)} onPlaying={() => setPlaying(true)} onError={() => setPlaying(false)} />
    {!unlocked && <section className="legacy-lock-screen">
      <div className="mb-10 text-center"><h2>{site.site.title}</h2></div>
      <div className="legacy-dots" aria-label="PIN progress">{Array.from({ length: 4 }, (_, index) => <span key={index} className={index < pin.length ? "active" : ""} />)}</div>
      <div className="legacy-keypad">{Array.from({ length: 9 }, (_, index) => <button type="button" key={index + 1} className="legacy-key-btn" onClick={() => pressNumber(String(index + 1))}>{index + 1}</button>)}<span /><button type="button" className="legacy-key-btn" onClick={() => pressNumber("0")}>0</button><button type="button" className="legacy-key-btn soft" onClick={() => setPin((value) => value.slice(0, -1))} aria-label="ลบตัวเลข">←</button></div>
      <p className="legacy-lock-error">{verifyPin.isPending ? "กำลังตรวจสอบ…" : error}</p>
    </section>}
    {unlocked && <main className="legacy-main-content">
      <header className="legacy-header"><h1>{site.site.title}</h1>{features.welcomeTitle && <p className="legacy-welcome-title">{features.welcomeTitle}</p>}{features.welcomeMessage && <p className="legacy-welcome-message">{features.welcomeMessage}</p>}<button type="button" className="legacy-heart-button" onClick={launchHeart}><Heart size={16} fill="currentColor" />ส่งหัวใจ</button><div className="legacy-clock"><ClockBox value={clock.days} label="วัน" /><ClockBox value={clock.hours} label="ชั่วโมง" /><ClockBox value={clock.minutes} label="นาที" /><ClockBox value={clock.seconds} label="วินาที" /></div></header>
      {showSurprise && <section className="legacy-section legacy-letter-section"><button type="button" className={`legacy-letter ${letterOpened ? "opened" : ""}`} onClick={() => setLetterOpened((opened) => !opened)}><span className="legacy-letter-seal"><MailOpen size={20} /></span>{letterOpened ? <span className="legacy-letter-copy"><strong>{features.surpriseTitle || "จดหมายสำหรับเธอ"}</strong><span>{features.surpriseMessage}</span></span> : <span className="legacy-letter-copy"><strong>มีจดหมายลับถึงเธอ</strong><span>กดเพื่อเปิดอ่านข้อความ</span></span>}</button></section>}
      {features.questionLetterEnabled && questionPrompts.length > 0 && <section className="legacy-section legacy-question-letter-section">{questionLetterLocked ? <div className="legacy-question-letter legacy-question-letter-locked" role="status"><span className="legacy-letter-seal"><CheckCircle2 size={20} /></span><span className="legacy-letter-copy"><strong>ส่งคำตอบเรียบร้อยแล้ว</strong><span>จดหมายฉบับนี้ปิดรับคำตอบแล้ว ขอบคุณนะ 💌</span></span></div> : <button type="button" className="legacy-question-letter" onClick={openQuestionLetter}><span className="legacy-letter-seal"><MailOpen size={20} /></span><span className="legacy-letter-copy"><strong>{features.questionLetterTitle || "คำถามถึงเธอ"}</strong><span>มีคำถาม {questionPrompts.length} ข้ออยากให้ตอบ กดเพื่อเปิดจดหมาย</span></span></button>}</section>}
      {!features.hideVideos && <section className="legacy-section legacy-video-section"><div className="legacy-section-inner"><h3>วิดีโอ 🎬</h3><p className="legacy-section-hint">เลื่อนด้วยลูกศรเพื่อดูช่องวิดีโอทั้ง 4 ช่อง</p><div className="legacy-video-shell"><button type="button" className="legacy-arrow legacy-arrow-prev" onClick={() => setVideoIndex((index) => (index + 3) % 4)} aria-label="ช่องวิดีโอก่อนหน้า"><ChevronLeft size={22} /></button><div className="legacy-video-viewport"><div className="legacy-video-track" style={{ transform: `translateX(-${videoIndex * 100}%)` }}>{videoSlots.map((asset, index) => <div className="legacy-video-slide" key={asset?.id ?? `slot-${index}`}>{asset ? <video className="size-full object-contain bg-slate-950" controls playsInline src={asset.url} /> : <div className="legacy-empty-media"><Video size={34} /><strong>ช่องวิดีโอ {index + 1}</strong><span>ยังไม่มีไฟล์</span></div>}</div>)}</div></div><button type="button" className="legacy-arrow legacy-arrow-next" onClick={() => setVideoIndex((index) => (index + 1) % 4)} aria-label="ช่องวิดีโอถัดไป"><ChevronRight size={22} /></button></div><p className="legacy-counter">{videoIndex + 1}/4</p></div></section>}
      {!features.hideMessage && <section className="legacy-section legacy-message-section"><div className="legacy-glass-card"><p>{site.settings.memoryMessage}</p></div></section>}
      {features.timeline.length > 0 && <section className="legacy-section"><h3>ไทม์ไลน์ของเรา</h3><div className="legacy-story-list">{features.timeline.map((item) => <article key={item.id}><strong>{item.date}</strong><h4>{item.title}</h4><p>{item.description}</p></article>)}</div></section>}
      {features.places.length > 0 && <section className="legacy-section"><h3>สถานที่พิเศษ</h3><div className="legacy-place-list">{features.places.map((item) => <a key={item.id} href={item.mapUrl || undefined} target="_blank" rel="noreferrer"><MapPin size={17} />{item.name}</a>)}</div></section>}
      {activeNote && <section className="legacy-section legacy-memory-card-section"><h3>ไพ่สุ่มความทรงจำ <BookHeart size={22} className="inline" /></h3><div className="legacy-memory-card"><button type="button" className="legacy-memory-card-face" onClick={() => setSelectedNote(activeNote)}><span>Memory card</span><strong>{activeNote.title}</strong><p>กดเพื่อเปิดอ่าน</p></button><div className="legacy-memory-card-actions"><button type="button" onClick={showNextNote} disabled={visibleNotes.length < 2}><Shuffle size={16} />สุ่มใบถัดไป</button><span>{noteIndex % visibleNotes.length + 1}/{visibleNotes.length}</span></div></div></section>}
      {!features.hideGallery && <section className="legacy-section legacy-gallery-section"><h3>รูปที่คบกัน 📸</h3><div className="legacy-photo-slider"><button type="button" className="legacy-arrow legacy-photo-prev" onClick={() => movePhoto(-1)} disabled={!photos.length} aria-label="รูปก่อนหน้า"><ChevronLeft size={22} /></button><div className="legacy-photo-viewport"><div className="legacy-photo-track" style={{ transform: `translateX(-${photoIndex * 100}%)` }}>{photos.length ? photos.map((asset) => <div className="legacy-photo-slide" key={asset.id}><button type="button" className="legacy-photo-open" onClick={() => setSelectedPhoto({ url: asset.url, originalName: asset.originalName, caption: asset.caption ?? "" })} aria-label={`เปิดรูป ${asset.originalName} เต็มจอ`}><img src={asset.url} alt={asset.caption || asset.originalName} /><span><Expand size={17} />เปิดรูปเต็มจอ</span></button></div>) : <div className="legacy-photo-slide"><div className="legacy-empty-photo">ยังไม่มีรูปภาพ</div></div>}</div></div><button type="button" className="legacy-arrow legacy-photo-next" onClick={() => movePhoto(1)} disabled={!photos.length} aria-label="รูปถัดไป"><ChevronRight size={22} /></button></div></section>}
      <footer className="legacy-footer"><p>อยู่ด้วยกันตลอดไปนะ 💖🌷</p>{hasContacts && <nav className="legacy-contact-links" aria-label="ช่องทางติดต่อ">{site.settings.facebookUrl && <a href={site.settings.facebookUrl} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={19} /><span>Facebook</span></a>}{site.settings.instagramUrl && <a href={site.settings.instagramUrl} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={19} /><span>Instagram</span></a>}</nav>}<div className="legacy-share"><button type="button" onClick={share}><Share2 size={17} />แชร์ลิงก์</button>{qrCode && <details><summary><QrCode size={17} />QR Code</summary><img src={qrCode} alt="QR Code สำหรับเปิดเว็บไซต์นี้" /></details>}</div></footer>
    </main>}
    {unlocked && !revealDismissed && <section className="legacy-reveal-overlay" role="dialog" aria-modal="true" aria-label="ข้อความเปิดตัว"><div className="legacy-reveal-orb legacy-reveal-orb-one" /><div className="legacy-reveal-orb legacy-reveal-orb-two" /><div className="legacy-reveal-card"><div className="legacy-reveal-hearts" aria-hidden="true"><span>♥</span><span>♥</span><span>♥</span></div><p className="legacy-reveal-eyebrow">A little surprise for you</p><h2>{revealContent.headline}</h2><p>{revealContent.message}</p><button type="button" onClick={openMemory}><Heart size={17} fill="currentColor" />เปิดความทรงจำ</button></div></section>}
    {unlocked && selectedNote && <section className="legacy-memory-modal" role="dialog" aria-modal="true" aria-label="โน้ตความทรงจำ"><button type="button" className="legacy-memory-modal-backdrop" onClick={() => setSelectedNote(null)} aria-label="ปิดโน้ต" /><article><button type="button" className="legacy-memory-modal-close" onClick={() => setSelectedNote(null)} aria-label="ปิด"><X size={19} /></button><BookHeart size={26} /><h3>{selectedNote.title}</h3><p>{selectedNote.body}</p></article></section>}
    {unlocked && selectedPhoto && <section className="legacy-photo-modal" role="dialog" aria-modal="true" aria-label="รูปเต็มจอ"><button type="button" className="legacy-memory-modal-backdrop" onClick={() => setSelectedPhoto(null)} aria-label="ปิดรูป" /><div><button type="button" className="legacy-memory-modal-close" onClick={() => setSelectedPhoto(null)} aria-label="ปิด"><X size={19} /></button><img src={selectedPhoto.url} alt={selectedPhoto.caption || selectedPhoto.originalName} /><p>{selectedPhoto.caption || selectedPhoto.originalName}</p></div></section>}
    {unlocked && questionOpened && !questionLetterLocked && <section className="legacy-question-modal" role="dialog" aria-modal="true" aria-label="จดหมายคำถาม"><button type="button" className="legacy-memory-modal-backdrop" onClick={() => setQuestionOpened(false)} aria-label="ปิดจดหมายคำถาม" /><article><button type="button" className="legacy-memory-modal-close" onClick={() => setQuestionOpened(false)} aria-label="ปิด"><X size={19} /></button><MailOpen size={27} /><p className="legacy-question-eyebrow">A little question for you</p><h3>{features.questionLetterTitle || "คำถามถึงเธอ"}</h3><p>ตอบคำถามทั้ง {questionPrompts.length} ข้อ แล้วเราจะได้รับคำตอบทั้งหมดในจดหมายฉบับเดียว</p><div className="legacy-question-answers">{questionPrompts.map((item, index) => <label className="legacy-question-answer" key={item.id}><span>คำถามข้อ {index + 1}</span><strong>{item.prompt}</strong><textarea value={questionAnswers[item.id] ?? ""} onChange={(event) => setQuestionAnswers((answers) => ({ ...answers, [item.id]: event.target.value }))} placeholder="พิมพ์คำตอบของเธอตรงนี้…" rows={4} maxLength={2000} /></label>)}</div><input className="legacy-question-honeypot" tabIndex={-1} autoComplete="off" value={questionHoneypot} onChange={(event) => setQuestionHoneypot(event.target.value)} aria-hidden="true" /><button type="button" disabled={submitLetterResponse.isPending || !allQuestionsAnswered} onClick={submitQuestion}>{submitLetterResponse.isPending ? "กำลังส่ง…" : <><Send size={16} />ส่งคำตอบทั้งหมด</>}</button>{questionStatus && <small role="status">{questionStatus}</small>}</article></section>}
    {unlocked && <div className={`legacy-tape-player ${playing ? "playing" : ""}`} style={playerStyle} onPointerMove={movePlayer} onPointerUp={endPlayerDrag} onPointerCancel={endPlayerDrag}><div className="legacy-tape-grab" onPointerDown={startPlayerDrag} title="ลากเพื่อย้ายตำแหน่ง"><div className="legacy-tape"><div className="legacy-tape-label"><span>LOVE MIX</span><strong>A / B</strong></div><div className="legacy-tape-window"><i className="legacy-tape-reel legacy-tape-reel-left" /><i className="legacy-tape-reel legacy-tape-reel-right" /></div><span className="legacy-tape-screw legacy-tape-screw-one" /><span className="legacy-tape-screw legacy-tape-screw-two" /></div></div><div className="legacy-tape-controls"><p>{features.songLabel || "Our Song ❤️"}</p><div><button type="button" className="legacy-tape-button" onClick={restartMusic} disabled={!site.settings.musicUrl} aria-label="เริ่มเพลงใหม่"><RotateCcw size={14} /></button><button type="button" className="legacy-tape-button legacy-tape-play" onClick={toggleMusic} disabled={!site.settings.musicUrl} aria-label="เล่นหรือหยุดเพลง">{playing ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}</button></div></div></div>}
    <div className="legacy-floating-hearts" aria-hidden="true">{floatingHearts.map((heart) => <span key={heart.id} style={{ "--legacy-heart-x": `${heart.x}px`, "--legacy-heart-y": `${heart.y}px`, "--legacy-heart-size": `${heart.size}px`, "--legacy-heart-drift": `${heart.drift}px` } as CSSProperties & { "--legacy-heart-x": string; "--legacy-heart-y": string; "--legacy-heart-size": string; "--legacy-heart-drift": string }}>♥</span>)}</div>
  </div>;
}
