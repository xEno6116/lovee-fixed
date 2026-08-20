const FONT_FORMAT_BY_EXTENSION = {
  woff2: "woff2",
  woff: "woff",
  ttf: "truetype",
  otf: "opentype",
} as const;

function escapeCssUrl(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]/g, "");
}

/** Builds the declaration used by the public anniversary page for an uploaded S3 font URL. */
export function buildCustomFontFace(url: string) {
  const source = url.trim();
  if (!source) return "";

  const pathname = source.split(/[?#]/, 1)[0].toLowerCase();
  const extension = pathname.match(/\.(woff2?|ttf|otf)$/)?.[1] as keyof typeof FONT_FORMAT_BY_EXTENSION | undefined;
  const format = extension ? FONT_FORMAT_BY_EXTENSION[extension] : undefined;
  const formatDeclaration = format ? ` format("${format}")` : "";

  return `@font-face { font-family: "AnniversaryCustom"; src: url("${escapeCssUrl(source)}")${formatDeclaration}; font-display: swap; font-style: normal; }`;
}
