import sharp from "sharp";

export interface VariantResult {
  variant: "ORIGINAL" | "SM" | "MD" | "LG";
  buffer: Buffer;
  width: number;
  height: number;
  size: number;
  mimeType: string;
}

const VARIANT_SIZES: { variant: "SM" | "MD" | "LG"; maxDim: number }[] = [
  { variant: "SM", maxDim: 64 },
  { variant: "MD", maxDim: 128 },
  { variant: "LG", maxDim: 256 },
];

export async function generateVariants(
  original: Buffer,
  originalWidth: number,
  originalHeight: number,
): Promise<VariantResult[]> {
  const results: VariantResult[] = [];

  const originalWebp = await sharp(original).webp({ quality: 90 }).toBuffer();
  const origMeta = await sharp(originalWebp).metadata();

  results.push({
    variant: "ORIGINAL",
    buffer: originalWebp,
    width: origMeta.width ?? originalWidth,
    height: origMeta.height ?? originalHeight,
    size: originalWebp.length,
    mimeType: "image/webp",
  });

  for (const { variant, maxDim } of VARIANT_SIZES) {
    if (originalWidth <= maxDim && originalHeight <= maxDim) {
      results.push({
        variant,
        buffer: originalWebp,
        width: origMeta.width ?? originalWidth,
        height: origMeta.height ?? originalHeight,
        size: originalWebp.length,
        mimeType: "image/webp",
      });
      continue;
    }

    const resized = await sharp(original)
      .resize(maxDim, maxDim, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    const meta = await sharp(resized).metadata();

    results.push({
      variant,
      buffer: resized,
      width: meta.width ?? maxDim,
      height: meta.height ?? maxDim,
      size: resized.length,
      mimeType: "image/webp",
    });
  }

  return results;
}
