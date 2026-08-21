import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { CapturedImage, CaptureSource } from '../types';

const MAX_IMAGE_EDGE = 1800;
const JPEG_QUALITY = 0.84;

type RawImage = {
  uri: string;
  width: number;
  height: number;
};

export async function prepareCapturedImage(image: RawImage, source: CaptureSource): Promise<CapturedImage> {
  const context = ImageManipulator.manipulate(image.uri);
  const longestEdge = Math.max(image.width, image.height);

  if (longestEdge > MAX_IMAGE_EDGE) {
    if (image.width >= image.height) context.resize({ width: MAX_IMAGE_EDGE, height: null });
    else context.resize({ width: null, height: MAX_IMAGE_EDGE });
  }

  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({
    compress: JPEG_QUALITY,
    format: SaveFormat.JPEG,
  });

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    source,
  };
}
