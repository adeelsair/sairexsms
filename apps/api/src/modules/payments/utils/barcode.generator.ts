import bwipjs from "bwip-js";

export async function generateCode128PngDataUrl(text: string) {
  const png = await bwipjs.toBuffer({
    bcid: "code128",
    text,
    scale: 2,
    height: 12,
    includetext: false,
    backgroundcolor: "FFFFFF",
  });

  return `data:image/png;base64,${png.toString("base64")}`;
}
