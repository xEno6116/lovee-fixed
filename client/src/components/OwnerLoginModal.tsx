import { useEffect, useState, type ButtonHTMLAttributes, type FormEvent, type ReactNode } from "react";
import { Loader2, LockKeyhole } from "lucide-react";
import { trpc } from "@/lib/trpc";

type OwnerLoginButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode };

export function OwnerLoginButton({ children, onClick, ...buttonProps }: OwnerLoginButtonProps) {
  const [open, setOpen] = useState(false);
  return <><button type="button" {...buttonProps} onClick={(event) => { onClick?.(event); if (!event.defaultPrevented) setOpen(true); }}>{children}</button><OwnerLoginModal open={open} onClose={() => setOpen(false)} /></>;
}

export function OwnerLoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const loginMutation = trpc.auth.login.useMutation();

  useEffect(() => {
    if (!open) { setPasscode(""); setError(""); }
  }, [open]);
  if (!open) return null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    try {
      await loginMutation.mutateAsync({ passcode });
      setPasscode("");
      await utils.auth.me.invalidate();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ไม่สามารถเข้าสู่ระบบได้");
    }
  };

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !loginMutation.isPending) onClose(); }}>
    <section className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="owner-login-title">
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-pink-100 text-pink-600"><LockKeyhole size={22} /></div>
      <h2 id="owner-login-title" className="mt-4 text-center text-xl font-bold text-slate-900">เข้าสู่ระบบเจ้าของ</h2>
      <p className="mt-2 text-center text-sm text-slate-500">ยืนยันด้วยรหัสตัวเลขเพียงครั้งเดียว แล้วใช้งานต่อได้ 7 วัน</p>
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">รหัสตัวเลขหลังบ้าน
          <input autoFocus required value={passcode} onChange={(event) => setPasscode(event.target.value.replace(/\D/g, "").slice(0, 12))} type="password" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" minLength={6} maxLength={12} className="w-full rounded-xl border border-pink-200 bg-white px-3 py-2.5 text-center text-lg tracking-[0.35em] outline-none transition focus:border-pink-500 focus:ring-4 focus:ring-pink-100" placeholder="••••••" />
        </label>
        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</p>}
        <div className="flex gap-3 pt-1"><button type="button" onClick={onClose} disabled={loginMutation.isPending} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60">ยกเลิก</button><button type="submit" disabled={loginMutation.isPending || passcode.length < 6} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-pink-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-pink-700 disabled:opacity-60">{loginMutation.isPending && <Loader2 size={16} className="animate-spin" />}ยืนยันรหัส</button></div>
      </form>
    </section>
  </div>;
}
