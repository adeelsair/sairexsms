import type { CSSProperties } from "react";
import { getAdminChromeColors } from "@/lib/theme/chrome-theme";

function getReadableTextColor(backgroundHex: string): "#FFFFFF" | "#000000" {
  const normalized = backgroundHex.replace("#", "").trim();
  if (normalized.length !== 6) return "#FFFFFF";

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  if ([r, g, b].some((value) => Number.isNaN(value))) return "#FFFFFF";

  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "#000000" : "#FFFFFF";
}

export function getLandingButtonThemeStyles(): {
  topBarFilled: CSSProperties;
  bottomBarFilled: CSSProperties;
} {
  const { topBarBackgroundColor, bottomBarBackgroundColor } = getAdminChromeColors();

  return {
    topBarFilled: {
      backgroundColor: topBarBackgroundColor,
      borderColor: topBarBackgroundColor,
      color: bottomBarBackgroundColor,
    },
    bottomBarFilled: {
      backgroundColor: bottomBarBackgroundColor,
      borderColor: bottomBarBackgroundColor,
      color: getReadableTextColor(bottomBarBackgroundColor),
    },
  };
}
