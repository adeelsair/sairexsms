export const SIDEBAR_TOP_COLOR = "#0F2F57";
export const SIDEBAR_MID_COLOR = "#1D4E89";
export const SIDEBAR_ACCENT_COLOR = "#1FA2A6";
export const SIDEBAR_BOTTOM_COLOR = "#39B54A";
export const ADMIN_TOP_BAR_PADDING_Y_PX = 4;

export const SIDEBAR_GRADIENT = `linear-gradient(180deg, ${SIDEBAR_TOP_COLOR} 0%, ${SIDEBAR_MID_COLOR} 40%, ${SIDEBAR_ACCENT_COLOR} 75%, ${SIDEBAR_BOTTOM_COLOR} 100%)`;

function normalizeHexColor(color: string): string {
  return color.trim().toLowerCase();
}

function isSameColor(colorA: string, colorB: string): boolean {
  return normalizeHexColor(colorA) === normalizeHexColor(colorB);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace("#", "").trim();
  if (normalized.length !== 6) return null;

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  if ([r, g, b].some((value) => Number.isNaN(value))) {
    return null;
  }

  return { r, g, b };
}

function getReadableTextColor(backgroundHex: string): "#FFFFFF" | "#000000" {
  const rgb = hexToRgb(backgroundHex);
  if (!rgb) return "#FFFFFF";
  const yiq = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return yiq >= 128 ? "#000000" : "#FFFFFF";
}

export function getAdminChromeColors() {
  const topBarBackgroundColor = SIDEBAR_TOP_COLOR;
  const bottomBarBackgroundColor = SIDEBAR_BOTTOM_COLOR;
  const sharedBarColor = isSameColor(topBarBackgroundColor, bottomBarBackgroundColor);

  return {
    topBarBackgroundColor,
    bottomBarBackgroundColor,
    topBarTextColor: sharedBarColor
      ? getReadableTextColor(topBarBackgroundColor)
      : bottomBarBackgroundColor,
    bottomBarTextColor: sharedBarColor
      ? getReadableTextColor(bottomBarBackgroundColor)
      : topBarBackgroundColor,
  };
}
