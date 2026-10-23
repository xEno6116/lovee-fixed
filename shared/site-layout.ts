export const DESIGN_SECTION_IDS = ["video", "message", "secret", "gallery", "letter"] as const;

export type DesignSectionId = (typeof DESIGN_SECTION_IDS)[number];
export type SectionWidths = Partial<Record<DesignSectionId, number>>;

export const PAGE_ELEMENT_IDS = ["header", "clock", ...DESIGN_SECTION_IDS, "footer"] as const;
export type PageElementId = (typeof PAGE_ELEMENT_IDS)[number];

export type PageElementLayout = {
  x: number;
  y: number;
  width: number;
  zIndex?: number;
  scale?: number;
};

export type PageElementLayouts = Record<PageElementId, PageElementLayout>;
export type PartialPageElementLayouts = Partial<Record<PageElementId, PageElementLayout>>;

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

export const PAGE_EDITOR_PREVIEW_SCALE = 0.24;
export const PAGE_LAYOUT_MIN_HEIGHT = 3600;

const defaultHeights: Record<DesignSectionId, number> = {
  video: 580,
  message: 300,
  secret: 300,
  gallery: 650,
  letter: 520,
};

export function createDefaultPageElementLayouts(
  order: readonly DesignSectionId[] = DESIGN_SECTION_IDS,
  widths: SectionWidths = {},
): PageElementLayouts {
  const layouts = {} as PageElementLayouts;
  layouts.header = { x: 0, y: 0, width: 100, zIndex: 1, scale: 1 };
  layouts.clock = { x: 0, y: 155, width: 100, zIndex: 2, scale: 1 };
  let y = 330;
  let zIndex = 3;
  const ordered = [...order, ...DESIGN_SECTION_IDS.filter((id) => !order.includes(id))];
  ordered.forEach((id) => {
    layouts[id] = {
      x: 0,
      y,
      width: ((widths[id] ?? 12) / 12) * 100,
      zIndex: zIndex++,
      scale: 1,
    };
    y += defaultHeights[id] + 90;
  });
  layouts.footer = { x: 0, y: y + 40, width: 100, zIndex: zIndex, scale: 1 };
  return layouts;
}

export function normalizePageElementLayouts(defaults: PageElementLayouts, saved?: PartialPageElementLayouts): PageElementLayouts {
  return Object.fromEntries(PAGE_ELEMENT_IDS.map((id) => {
    const fallback = defaults[id];
    const value = { ...fallback, ...saved?.[id] };
    const scaleValue = Number.isFinite(value.scale) ? value.scale! : fallback.scale ?? 1;
    const scale = Math.max(0.7, Math.min(1.3, scaleValue));
    const widthValue = Number.isFinite(value.width) ? value.width : fallback.width;
    const width = Math.max(20, Math.min(100 / scale, widthValue));
    const xValue = Number.isFinite(value.x) ? value.x : fallback.x;
    const x = Math.max(0, Math.min(100 - width * scale, xValue));
    const yValue = Number.isFinite(value.y) ? value.y : fallback.y;
    const y = Math.max(0, Math.min(8000, yValue));
    const zValue = Number.isFinite(value.zIndex) ? value.zIndex! : fallback.zIndex ?? 0;
    const zIndex = Math.max(0, Math.min(99, Math.round(zValue)));
    return [id, { x, y, width, zIndex, scale }];
  })) as PageElementLayouts;
}
