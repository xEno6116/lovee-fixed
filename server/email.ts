import { ENV } from "./_core/env";

export async function sendMemoryLetter(input: { to: string; senderName: string; senderEmail?: string; message: string; siteTitle: string }) {
  return sendResendEmail({
    to: input.to,
    subject: `จดหมายใหม่จากความทรงจำ — ${input.siteTitle}`,
    text: `ชื่อผู้ส่ง: ${input.senderName}\nอีเมล: ${input.senderEmail || "ไม่ได้ระบุ"}\n\n${input.message}`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#24213a"><h2>จดหมายใหม่จาก ${escapeHtml(input.senderName)}</h2><p style="white-space:pre-wrap">${escapeHtml(input.message)}</p>${input.senderEmail ? `<p>ตอบกลับได้ที่: ${escapeHtml(input.senderEmail)}</p>` : ""}<hr><small>ส่งจากเว็บไซต์ ${escapeHtml(input.siteTitle)}</small></div>`,
    replyTo: input.senderEmail,
  });
}

export async function sendVerificationEmail(input: { to: string; name: string; verificationUrl: string }) {
  return sendResendEmail({
    to: input.to,
    subject: "ยืนยันอีเมลสำหรับ LoveOffice",
    text: `สวัสดี ${input.name}\n\nกดลิงก์นี้เพื่อยืนยันอีเมลและเริ่มใช้งาน LoveOffice:\n${input.verificationUrl}\n\nลิงก์นี้หมดอายุภายใน 24 ชั่วโมง`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#24213a;max-width:560px"><h2>ยืนยันอีเมลของคุณ</h2><p>สวัสดี ${escapeHtml(input.name)}</p><p>กดปุ่มด้านล่างเพื่อยืนยันอีเมลและเริ่มสร้างเว็บไซต์ความทรงจำ</p><p><a href="${escapeHtml(input.verificationUrl)}" style="display:inline-block;background:#ec4899;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">ยืนยันอีเมล</a></p><p style="font-size:13px;color:#777">ลิงก์นี้หมดอายุภายใน 24 ชั่วโมง</p></div>`,
  });
}

async function sendResendEmail(input: { to: string; subject: string; text: string; html: string; replyTo?: string }) {
  if (!ENV.resendApiKey || !ENV.mailFromEmail) throw new Error("ยังไม่ได้ตั้งค่าระบบส่งอีเมล");
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${ENV.resendApiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: ENV.mailFromEmail, to: [input.to], ...(input.replyTo ? { reply_to: input.replyTo } : {}), subject: input.subject, text: input.text, html: input.html }) });
  if (!response.ok) { const detail = await response.text().catch(() => ""); console.error("[Email] Resend failed", response.status, detail); throw new Error("ส่งอีเมลไม่สำเร็จ"); }
  return { sent: true as const };
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character); }
