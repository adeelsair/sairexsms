import sharp from "sharp";

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
}

const MIN_DIMENSION = 128;
const MAX_DIMENSION = 4096;
const MAX_SIZE = 5 * 1024 * 1024;

const ALLOWED_FORMATS = new Set(["png", "jpeg", "jpg", "webp", "svg"]);

export async function validateImage(
  buffer: Buffer,
  originalSize: number,
): Promise<ImageMetadata> {
  if (originalSize > MAX_SIZE) {
    throw new Error(`File too large (${(originalSize / 1024 / 1024).toFixed(1)} MB). Maximum is 5 MB.`);
  }

  const metadata = await sharp(buffer).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Invalid image — could not read dimensions.");
  }

  const format = metadata.format ?? "";
  if (!ALLOWED_FORMATS.has(format)) {
    throw new Error(`Unsupported format: ${format}. Use PNG, JPG, WEBP, or SVG.`);
  }

  if (metadata.width < MIN_DIMENSION || metadata.height < MIN_DIMENSION) {
    throw new Error(
      `Image too small (${metadata.width}×${metadata.height}). Minimum is ${MIN_DIMENSION}×${MIN_DIMENSION}.`,
    );
  }

  if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
    throw new Error(
      `Image too large (${metadata.width}×${metadata.height}). Maximum is ${MAX_DIMENSION}×${MAX_DIMENSION}.`,
    );
  }

  return {
    width: metadata.width,
    height: metadata.height,
    format,
    size: originalSize,
  };
}
