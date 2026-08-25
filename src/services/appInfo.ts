import * as Application from 'expo-application';

const FALLBACK_VERSION = '1.0.0';

export function getNativeAppVersion(): string {
  return Application.nativeApplicationVersion?.trim() || FALLBACK_VERSION;
}

export function getNativeBuildVersion(): string | null {
  return Application.nativeBuildVersion?.trim() || null;
}

export function getFeedbackAppVersion(): string {
  const version = getNativeAppVersion();
  const build = getNativeBuildVersion();
  return (build ? `${version} (${build})` : version).slice(0, 24);
}

export function getAppVersionLabel(): string {
  const version = getNativeAppVersion();
  const build = getNativeBuildVersion();
  return `Profu’ de mate · versiunea ${version}${build ? ` · build ${build}` : ''}`;
}
