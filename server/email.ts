import { ENV } from "./_core/env";

export async function sendMemoryLetter(input: {
  to: string;
  senderName: string;
  senderEmail?: string;
  message: string;
  siteTitle: string;
}) {
  if (!ENV.resendApiKey || !ENV.mailFromEmail) {
    throw new Error("ยังไม่ได้ตั้งค่าระบบส่งอีเมล");
  }

  const replyTo = input.senderEmail?.trim();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: ENV.mailFromEmail,
      to: [input.to],
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject: `จดหมายใหม่จากความทรงจำ — ${input.siteTitle}`,
      text: `ชื่อผู้ส่ง: ${input.senderName}\nอีเมล: ${replyTo || "ไม่ได้ระบุ"}\n\n${input.message}`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#24213a"><h2>จดหมายใหม่จาก ${escapeHtml(input.senderName)}</h2><p style="white-space:pre-wrap">${escapeHtml(input.message)}</p>${replyTo ? `<p>ตอบกลับได้ที่: ${escapeHtml(replyTo)}</p>` : ""}<hr><small>ส่งจากเว็บไซต์ ${escapeHtml(input.siteTitle)}</small></div>`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[Email] Resend failed", response.status, detail);
    throw new Error("ส่งจดหมายไม่สำเร็จ");
  }

  return { sent: true as const };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}
