const lastResponseByVisitor = new Map<string, number>();
export const MIN_FORM_OPEN_MS = 2_000;
export const RESPONSE_COOLDOWN_MS = 60_000;

export function inspectLetterResponse(input: { startedAt: number; honeypot?: string }, visitorKey: string, now = Date.now()) {
  if (input.honeypot?.trim()) return { allowed: false, silent: true, reason: "" };
  if (!Number.isFinite(input.startedAt) || now - input.startedAt < MIN_FORM_OPEN_MS) return { allowed: false, silent: false, reason: "กรุณาอ่านจดหมายสักครู่ก่อนส่งคำตอบ" };
  const lastResponse = lastResponseByVisitor.get(visitorKey);
  if (lastResponse !== undefined && now - lastResponse < RESPONSE_COOLDOWN_MS) return { allowed: false, silent: false, reason: "ส่งคำตอบได้อีกครั้งในอีกสักครู่นะ" };
  return { allowed: true, silent: false, reason: "" };
}

export function recordLetterResponse(visitorKey: string, now = Date.now()) {
  lastResponseByVisitor.set(visitorKey, now);
}

export function resetLetterResponseGuard() {
  lastResponseByVisitor.clear();
}
