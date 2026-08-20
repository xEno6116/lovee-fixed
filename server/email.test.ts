import { afterEach, describe, expect, it, vi } from "vitest";
import { buildLoveOfficeEmailHtml, sendLoveOfficeEmail } from "./email";

const previousKey = process.env.RESEND_API_KEY;
const previousFrom = process.env.RESEND_FROM_EMAIL;

afterEach(() => {
  process.env.RESEND_API_KEY = previousKey;
  process.env.RESEND_FROM_EMAIL = previousFrom;
});

describe("LoveOffice email sender", () => {
  it("escapes message content before rendering email HTML", () => {
    expect(buildLoveOfficeEmailHtml("<script>alert(1)</script>\nรักนะ")).toContain("&lt;script&gt;");
    expect(buildLoveOfficeEmailHtml("a\nb")).toContain("a<br />b");
  });

  it("sends a server-side Resend request with a configured sender", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "LoveOffice <hello@example.com>";
    const request = vi.fn(async () => new Response(JSON.stringify({ id: "email_123" }), { status: 200 }));

    await expect(sendLoveOfficeEmail({ to: "recipient@example.com", subject: "ถึงเธอ", message: "คิดถึงนะ" }, request as typeof fetch)).resolves.toEqual({ id: "email_123" });
    expect(request).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Authorization: "Bearer re_test" }) }));
  });
});
