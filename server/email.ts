type SendEmailInput = { to: string; subject: string; message: string };
type LetterAnswer = { question: string; answer: string };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char] ?? char);
}

export function buildLoveOfficeEmailHtml(message: string) {
  return `<main style="max-width:560px;margin:0 auto;padding:32px;background:#fff7fb;color:#31202c;font-family:Arial,sans-serif"><div style="padding:28px;border:1px solid #f9a8d4;border-radius:20px;background:#fff"><p style="margin:0 0 14px;color:#db2777;font-weight:700">LoveOffice</p><div style="font-size:16px;line-height:1.75;white-space:normal">${escapeHtml(message).replace(/\n/g, "<br />")}</div></div></main>`;
}

export function buildQuestionAnswerSummary(answers: LetterAnswer[]) {
  return answers.map(({ question, answer }, index) => `คำถามข้อ ${index + 1}: ${question}\n\nคำตอบ: ${answer}`).join("\n\n──────────\n\n");
}

export async function sendLoveOfficeEmail(input: SendEmailInput, request = fetch) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("ยังไม่ได้ตั้งค่า Resend API key");
  const from = process.env.RESEND_FROM_EMAIL || "LoveOffice <onboarding@resend.dev>";
  const response = await request("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, text: input.message, html: buildLoveOfficeEmailHtml(input.message) }),
  });
  const payload = await response.json().catch(() => ({})) as { id?: string; message?: string; name?: string };
  if (!response.ok) throw new Error(payload.message || payload.name || "ส่งอีเมลไม่สำเร็จ");
  return { id: payload.id ?? "" };
}
