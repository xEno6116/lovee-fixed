export const uiLayouts = [
  { id: "soft-story", name: "Soft Story", description: "รูปแบบดั้งเดิม อบอุ่น ละมุน และเล่าเรื่องเป็นลำดับ", accent: "#ec4899" },
  { id: "polaroid-journal", name: "Polaroid Journal", description: "สมุดบันทึกฟิล์ม มีกรอบรูปและกระดาษโน้ต", accent: "#a16207" },
  { id: "midnight-glass", name: "Midnight Glass", description: "กลางคืนแบบกระจกใส แสงนีออน และการ์ดสไตล์โมเดิร์น", accent: "#8b5cf6" },
] as const;

export type UiLayoutId = (typeof uiLayouts)[number]["id"];
export type UiLayout = (typeof uiLayouts)[number];

export function getUiLayout(id: string | undefined): UiLayout {
  return uiLayouts.find((layout) => layout.id === id) ?? uiLayouts[0];
}
