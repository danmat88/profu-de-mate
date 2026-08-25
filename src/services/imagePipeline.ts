import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { CapturedImage, CaptureSource } from '../types';
import { deleteTransientCapturedSource, storeTemporaryCapturedImage } from './temporaryImages';

const MAX_IMAGE_EDGE = 1800;
const JPEG_QUALITY = 0.84;
const EDIT_QUALITY = 0.9;

type RawImage = {
  uri: string;
  width: number;
  height: number;
};

export type CropRect = {
  originX: number;
  originY: number;
  width: number;
  height: number;
};

export async function prepareCapturedImage(image: RawImage, source: CaptureSource): Promise<CapturedImage> {
  try {
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
    const uri = await storeTemporaryCapturedImage(result.uri);

    return {
      uri,
      width: result.width,
      height: result.height,
      source,
    };
  } finally {
    deleteTransientCapturedSource(image.uri);
  }
}

export async function cropCapturedImage(image: CapturedImage, crop: CropRect): Promise<CapturedImage> {
  const originX = Math.min(Math.max(0, Math.round(crop.originX)), Math.max(0, image.width - 1));
  const originY = Math.min(Math.max(0, Math.round(crop.originY)), Math.max(0, image.height - 1));
  const width = Math.min(Math.max(1, Math.round(crop.width)), image.width - originX);
  const height = Math.min(Math.max(1, Math.round(crop.height)), image.height - originY);
  const context = ImageManipulator.manipulate(image.uri);

  context.crop({ originX, originY, width, height });
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({ compress: EDIT_QUALITY, format: SaveFormat.JPEG });
  const uri = await storeTemporaryCapturedImage(result.uri);

  return { uri, width: result.width, height: result.height, source: image.source };
}

export async function rotateCapturedImage(image: CapturedImage): Promise<CapturedImage> {
  const context = ImageManipulator.manipulate(image.uri);

  context.rotate(90);
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({ compress: EDIT_QUALITY, format: SaveFormat.JPEG });
  const uri = await storeTemporaryCapturedImage(result.uri);

  return { uri, width: result.width, height: result.height, source: image.source };
}
