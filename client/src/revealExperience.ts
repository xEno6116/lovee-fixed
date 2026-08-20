export type RevealContent = {
  siteTitle: string;
  welcomeTitle: string;
  welcomeMessage: string;
  memoryMessage: string;
};

export function getRevealContent(content: RevealContent) {
  const headline = content.welcomeTitle.trim() || content.siteTitle.trim() || "ความทรงจำสำหรับเธอ";
  const message = content.welcomeMessage.trim() || content.memoryMessage.trim() || "กดเปิดเพื่อเริ่มความทรงจำของเรา";
  return { headline, message };
}
