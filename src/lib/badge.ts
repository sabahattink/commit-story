/** README badge SVG rendering. All text is XML-escaped before interpolation. */

export type BadgeStyle = "flat" | "flat-square" | "for-the-badge";

export interface BadgeInput {
  style: BadgeStyle;
  label: string;
  value: string;
  /** Hex color literal, e.g. "#22c55e". */
  color: string;
}

const STYLES: readonly BadgeStyle[] = ["flat", "flat-square", "for-the-badge"];
const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;
const FONT = 'font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11"';

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function parseBadgeStyle(input: string | null): BadgeStyle {
  return STYLES.find((s) => s === input) ?? "flat";
}

function measureText(text: string, fontSize: number): number {
  return Math.ceil(text.length * fontSize * 0.62 + 16);
}

function buildFlat(label: string, value: string, color: string, square: boolean): string {
  const lw = measureText(label, 11);
  const vw = measureText(value, 11);
  const total = lw + vw;
  const l = escapeXml(label);
  const v = escapeXml(value);
  const gradient = square
    ? ""
    : `
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${total}" height="20" rx="3" fill="#fff"/></clipPath>`;
  const group = square ? "<g>" : '<g clip-path="url(#r)">';
  const shine = square ? "" : `\n    <rect width="${total}" height="20" fill="url(#s)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="20" role="img" aria-label="${l}: ${v}">
  <title>${l}: ${v}</title>${gradient}
  ${group}
    <rect width="${lw}" height="20" fill="#555"/>
    <rect x="${lw}" width="${vw}" height="20" fill="${color}"/>${shine}
  </g>
  <g fill="#fff" text-anchor="middle" ${FONT}>
    <text x="${lw / 2}" y="15" fill="#010101" fill-opacity=".3">${l}</text>
    <text x="${lw / 2}" y="14">${l}</text>
    <text x="${lw + vw / 2}" y="15" fill="#010101" fill-opacity=".3">${v}</text>
    <text x="${lw + vw / 2}" y="14">${v}</text>
  </g>
</svg>`;
}

function buildForTheBadge(label: string, value: string, color: string): string {
  const ul = label.toUpperCase();
  const uv = value.toUpperCase();
  const lw = measureText(ul, 11) + 10;
  const vw = measureText(uv, 11) + 10;
  const total = lw + vw;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="28" role="img" aria-label="${escapeXml(label)}: ${escapeXml(value)}">
  <title>${escapeXml(label)}: ${escapeXml(value)}</title>
  <g>
    <rect width="${lw}" height="28" fill="#555"/>
    <rect x="${lw}" width="${vw}" height="28" fill="${color}"/>
  </g>
  <g fill="#fff" text-anchor="middle" ${FONT} font-weight="bold" letter-spacing="1">
    <text x="${lw / 2}" y="19">${escapeXml(ul)}</text>
    <text x="${lw + vw / 2}" y="19">${escapeXml(uv)}</text>
  </g>
</svg>`;
}

export function renderBadge({ style, label, value, color }: BadgeInput): string {
  if (!HEX_COLOR.test(color)) throw new TypeError(`Invalid badge color: ${color}`);
  if (style === "for-the-badge") return buildForTheBadge(label, value, color);
  return buildFlat(label, value, color, style === "flat-square");
}
