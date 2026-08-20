export const visualThemes = [
  { id: "soft-love", name: "Soft Love", description: "ชมพูครีมนุ่มแบบความทรงจำเดิม", themeColor: "#ec4899", backgroundStyle: "soft", themeMode: "light", fontFamily: "gaegu" },
  { id: "minimal-white", name: "Minimal White", description: "ขาวสะอาด โล่ง และเรียบหรู", themeColor: "#334155", backgroundStyle: "paper", themeMode: "light", fontFamily: "sans" },
  { id: "midnight-date", name: "Midnight Date", description: "ดำม่วงกับดาวและแสงยามค่ำ", themeColor: "#a78bfa", backgroundStyle: "night", themeMode: "night", fontFamily: "serif" },
  { id: "film-diary", name: "Film Diary", description: "กระดาษไดอารี่ รูปฟิล์ม และ Polaroid", themeColor: "#a16207", backgroundStyle: "paper", themeMode: "light", fontFamily: "serif" },
  { id: "lavender-dream", name: "Lavender Dream", description: "ม่วงลาเวนเดอร์ กระจกนุ่มแบบฝัน", themeColor: "#8b5cf6", backgroundStyle: "soft", themeMode: "light", fontFamily: "sans" },
  { id: "sunset-memory", name: "Sunset Memory", description: "ส้มชมพูอบอุ่นเหมือนพระอาทิตย์ตก", themeColor: "#f97316", backgroundStyle: "sunset", themeMode: "light", fontFamily: "gaegu" },
] as const;

export type VisualThemeId = (typeof visualThemes)[number]["id"];
export type VisualTheme = (typeof visualThemes)[number];

export function getVisualTheme(id: string | undefined): VisualTheme {
  return visualThemes.find((theme) => theme.id === id) ?? visualThemes[0];
}
