export const DESIGN_SECTION_IDS = ["video", "message", "secret", "gallery", "letter"] as const;

export type DesignSectionId = (typeof DESIGN_SECTION_IDS)[number];
export type SectionWidths = Partial<Record<DesignSectionId, number>>;

export type MusicPlayerLayout = {
  x: number;
  y: number;
  scale: number;
};

export const DEFAULT_SECTION_WIDTHS: Record<DesignSectionId, number> = {
  video: 12,
  message: 12,
  secret: 12,
  gallery: 12,
  letter: 12,
};

export const DEFAULT_MUSIC_PLAYER_LAYOUT: MusicPlayerLayout = {
  x: 50,
  y: 86,
  scale: 1,
};
