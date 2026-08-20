import { useEffect, useState, type ButtonHTMLAttributes, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, Loader2, LockKeyhole, Mail } from "lucide-react";
import { trpc } from "@/lib/trpc";

type OwnerLoginButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function OwnerLoginButton({ children, onClick, ...buttonProps }: OwnerLoginButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        {...buttonProps}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) setOpen(true);
        }}
      >
        {children}
      </button>
      <OwnerLoginModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function OwnerLoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [error, setError] = useState("");
  const [requested, setRequested] = useState(false);
  const requestMagicLinkMutation = trpc.auth.requestMagicLink.useMutation();

  useEffect(() => {
    if (!open) {
      setError("");
      setRequested(false);
    }
  }, [open]);

  if (!open) return null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    try {
      await requestMagicLinkMutation.mutateAsync();
      setRequested(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ไม่สามารถเข้าสู่ระบบได้");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !requestMagicLinkMutation.isPending) onClose(); }}>
      <section className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="owner-login-title">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-pink-100 text-pink-600"><LockKeyhole size={22} /></div>
        <h2 id="owner-login-title" className="mt-4 text-center text-xl font-bold text-slate-900">เข้าสู่ระบบเจ้าของ</h2>
        <p className="mt-2 text-center text-sm text-slate-500">ระบบจะส่งลิงก์ยืนยันไปยังอีเมลเจ้าของที่อนุญาตเท่านั้น</p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <div className="flex items-center gap-3 rounded-2xl border border-pink-100 bg-pink-50 px-4 py-3 text-sm text-slate-700"><Mail size={18} className="shrink-0 text-pink-600" /><span>ส่งลิงก์เข้าสู่ระบบให้เจ้าของเว็บไซต์</span></div>
          {requested && <p className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status"><CheckCircle2 size={17} className="mt-0.5 shrink-0" />ตรวจอีเมลแล้วกดลิงก์ภายใน 10 นาที เพื่อลงชื่อเข้าใช้หลังบ้าน</p>}
          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</p>}
          <div className="flex gap-3 pt-1"><button type="button" onClick={onClose} disabled={requestMagicLinkMutation.isPending} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60">{requested ? "ปิด" : "ยกเลิก"}</button><button type="submit" disabled={requestMagicLinkMutation.isPending || requested} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-pink-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-pink-700 disabled:opacity-60">{requestMagicLinkMutation.isPending && <Loader2 size={16} className="animate-spin" />}ส่งลิงก์เข้าอีเมล</button></div>
        </form>
      </section>
    </div>
  );
}
