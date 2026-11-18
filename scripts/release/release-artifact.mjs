import fs from 'node:fs';
import { inflateRawSync } from 'node:zlib';

/** Read entries without extracting untrusted archive paths to the filesystem. */
export function archiveEntries(bytes) {
  let end = bytes.length - 22;
  while (end >= Math.max(0, bytes.length - 65557) && bytes.readUInt32LE(end) !== 0x06054b50) end -= 1;
  if (end < Math.max(0, bytes.length - 65557)) throw new Error('Arhivă ZIP invalidă.');
  const count = bytes.readUInt16LE(end + 10);
  let offset = bytes.readUInt32LE(end + 16);
  if (count === 65535 || offset === 0xffffffff) throw new Error('ZIP64 necesită un verificator compatibil.');
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    if (bytes.readUInt32LE(offset) !== 0x02014b50) throw new Error('Director ZIP invalid.');
    const flags = bytes.readUInt16LE(offset + 8);
    const method = bytes.readUInt16LE(offset + 10);
    const size = bytes.readUInt32LE(offset + 20);
    const uncompressed = bytes.readUInt32LE(offset + 24);
    const nameSize = bytes.readUInt16LE(offset + 28);
    const extraSize = bytes.readUInt16LE(offset + 30);
    const commentSize = bytes.readUInt16LE(offset + 32);
    const local = bytes.readUInt32LE(offset + 42);
    const name = bytes.subarray(offset + 46, offset + 46 + nameSize).toString('utf8');
    if ((flags & 1) || ![0, 8].includes(method) || uncompressed > 256 * 1024 * 1024) {
      throw new Error(`Intrare ZIP nesuportată: ${name}`);
    }
    if (bytes.readUInt32LE(local) !== 0x04034b50) throw new Error('Antet ZIP invalid.');
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    if (start + size > bytes.length) throw new Error('Intrare ZIP trunchiată.');
    const compressed = bytes.subarray(start, start + size);
    const data = method === 0 ? compressed : inflateRawSync(compressed, { maxOutputLength: 256 * 1024 * 1024 });
    if (data.length !== uncompressed) throw new Error('Lungime ZIP invalidă.');
    entries.push({ name, data });
    offset += 46 + nameSize + extraSize + commentSize;
  }
  return entries;
}

export function assertNoDebugTokens(entries, tokens) {
  const candidates = [...new Set(tokens.map((value) => value?.trim()).filter(Boolean))];
  for (const entry of entries) {
    if (candidates.some((token) => entry.data.includes(Buffer.from(token)))) {
      throw new Error(`Token App Check debug găsit în ${entry.name}. Valoarea nu este afișată.`);
    }
  }
}

export function assertReleaseCertificate(output, expected) {
  if (/Android Debug/i.test(output)) throw new Error('Artefactul este semnat Android Debug.');
  const normalized = expected?.replace(/:/g, '').toLowerCase();
  if (!normalized || !/^[a-f0-9]{64}$/.test(normalized)) {
    throw new Error('Declară amprenta certificatului de release prin PROFU_RELEASE_CERT_SHA256.');
  }
  const fingerprints = [...output.matchAll(/SHA-?256(?: digest)?\s*:\s*([a-f0-9:]+)/gi)]
    .map((match) => match[1].replace(/:/g, '').toLowerCase());
  if (!fingerprints.includes(normalized)) throw new Error('Certificatul artefactului diferă de certificatul de release declarat.');
}

export function assertReleaseManifest(output) {
  if (/debuggable[^\r\n=]*=\s*(?:"true"|true\b|\(type 0x12\)0xffffffff)/i.test(output)) {
    throw new Error('Manifestul permite depanarea (debuggable).');
  }
  if (!/ro\.profudemate\.app/.test(output)) throw new Error('Identificatorul aplicației nu corespunde.');
  const target = output.match(/targetSdkVersion[^\r\n=]*=\s*(?:"(\d+)"|\(type 0x10\)0x([a-f0-9]+)|(\d+)\b)/i);
  const api = target?.[1] ? Number(target[1]) : target?.[2] ? parseInt(target[2], 16) : Number(target?.[3] ?? 0);
  if (api < 36) throw new Error('Manifestul trebuie să declare targetSdkVersion minimum 36.');
}

export function readArchive(file) { return archiveEntries(fs.readFileSync(file)); }
