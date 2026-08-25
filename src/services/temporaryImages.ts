import { Directory, File, Paths } from 'expo-file-system';

const TEMPORARY_IMAGES_DIRECTORY = 'profu-de-mate-captures-v1';
const TRANSIENT_SOURCE_DIRECTORIES = ['Camera', 'ImageManipulator', 'ImagePicker'] as const;

function getTemporaryImagesDirectory(): Directory {
  return new Directory(Paths.cache, TEMPORARY_IMAGES_DIRECTORY);
}

function getDirectoryPrefix(): string {
  const uri = getTemporaryImagesDirectory().uri;
  return uri.endsWith('/') ? uri : `${uri}/`;
}

function getCachePrefix(): string {
  return Paths.cache.uri.endsWith('/') ? Paths.cache.uri : `${Paths.cache.uri}/`;
}

export function isManagedTemporaryImage(uri: string): boolean {
  return uri.startsWith(getDirectoryPrefix());
}

/** Deletes only an app-cache copy returned by Camera/ImagePicker, never a gallery original. */
export function deleteTransientCapturedSource(uri: string): void {
  if (!uri.startsWith(getCachePrefix()) || isManagedTemporaryImage(uri)) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Startup cleanup retries known provider cache directories after a crash.
  }
}

function clearTransientSourceDirectories(): void {
  for (const name of TRANSIENT_SOURCE_DIRECTORIES) {
    try {
      const directory = new Directory(Paths.cache, name);
      if (directory.exists) directory.delete();
    } catch {
      // These are cache-only directories; Android or the next launch can retry.
    }
  }
}

function createTemporaryImageName(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 12);
  return `capture-${timestamp}-${random}.jpg`;
}

/**
 * Moves an ImageManipulator result into the only cache directory owned by the
 * capture flow. Gallery originals and camera-provider files are never adopted,
 * so cleanup cannot delete a user's source photo.
 */
export async function storeTemporaryCapturedImage(uri: string): Promise<string> {
  const directory = getTemporaryImagesDirectory();
  directory.create({ idempotent: true, intermediates: true });

  const source = new File(uri);
  if (!source.exists) throw new Error('The processed image no longer exists.');

  const destination = new File(directory, createTemporaryImageName());
  try {
    await source.move(destination);
  } catch (error) {
    try {
      if (source.exists) source.delete();
    } catch {
      // The operating system can still evict an unadopted cache file.
    }
    throw error;
  }
  return destination.uri;
}

/** Deletes only files inside the app-owned capture cache. */
export function deleteTemporaryCapturedImages(
  uris: Array<string | null | undefined>,
  keepUris: Array<string | null | undefined> = [],
): void {
  const keep = new Set(keepUris.filter((uri): uri is string => Boolean(uri)));

  for (const uri of new Set(uris.filter((value): value is string => Boolean(value)))) {
    if (keep.has(uri) || !isManagedTemporaryImage(uri)) continue;
    try {
      const file = new File(uri);
      if (file.exists) file.delete();
    } catch {
      // Cache cleanup is best-effort and must not hide the user's next action.
    }
  }
}

export function clearTemporaryCapturedImages(): void {
  try {
    const directory = getTemporaryImagesDirectory();
    if (directory.exists) directory.delete();
  } catch {
    // A later flow or application start will retry the cleanup.
  }
  clearTransientSourceDirectories();
}

function clearTemporaryCapturedImagesExcept(keepUris: string[]): void {
  const keep = new Set(keepUris.filter(isManagedTemporaryImage));
  if (keep.size === 0) {
    clearTemporaryCapturedImages();
    return;
  }

  try {
    const directory = getTemporaryImagesDirectory();
    if (!directory.exists) return;
    for (const entry of directory.list()) {
      if (!keep.has(entry.uri)) entry.delete();
    }
  } catch {
    // Invalid crash leftovers are retried on the next cold start.
  }
}

/** Keeps only a validated image belonging to an unfinished analysis. */
export function clearTemporaryCapturedImagesOnStartup(keepUris: string[] = []): void {
  clearTransientSourceDirectories();
  clearTemporaryCapturedImagesExcept(keepUris);
}
