export type FontChoice = {
  fontFamily: "gaegu" | "serif" | "sans";
  customFontUrl: string;
  customFontName: string;
};

export function getFontPreviewFamily(choice: FontChoice) {
  if (choice.customFontUrl) return "'AnniversaryCustom', 'Noto Sans Thai', system-ui, sans-serif";
  if (choice.fontFamily === "serif") return "Georgia, 'Noto Serif Thai', serif";
  if (choice.fontFamily === "sans") return "'Noto Sans Thai', system-ui, sans-serif";
  return "'Gaegu', 'Noto Sans Thai', sans-serif";
}

export function resetFontChoice<T extends FontChoice>(choice: T): T {
  return { ...choice, fontFamily: "gaegu", customFontUrl: "", customFontName: "" };
}
