import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { serviceLoader } from './helpers/loadService.mts';
import { friendlyWrittenMathError } from '../src/utils/writtenMathErrors.ts';

const alice = { uid: 'alice', isAnonymous: false, providerData: [{ providerId: 'google.com' }] };
function fixture() {
  const auth = { currentUser: { ...alice } as any };
  const disk = new Map<string, string>();
  class File {
    key: string;
    constructor(...parts: string[]) { this.key = parts.join('/'); }
    get exists() { return disk.has(this.key); }
    get size() { return this.textSync().length; }
    textSync() { return disk.get(this.key) ?? ''; }
    async text() { return this.textSync(); }
    write(value: string) { disk.set(this.key, value); }
    delete() { disk.delete(this.key); }
  }
  const load = serviceLoader({
    '@react-native-firebase/app': { getApp() {} },
    '@react-native-firebase/auth': { getAuth: () => auth },
    'expo-file-system': { File, Paths: { cache: 'cache', document: 'documents' } },
    './temporaryImages': { isManagedTemporaryImage: () => true, clearTemporaryCapturedImagesOnStartup() {}, deleteTemporaryCapturedImages() {} },
  });
  return { auth, disk, load, File };
}
const draft = { problem: { version: 1, nodes: [{ type: 'symbol', value: 'x' }] }, solution: { version: 1, nodes: [] } };
const mathInputSource = await readFile(new URL('../src/screens/MathInputScreen.tsx', import.meta.url), 'utf8');

test('math drafts persist by account, survive editing sessions and reject stale identity writers', () => {
  const { auth, disk, load } = fixture();
  const sessions = load('src/services/sessionGuard.ts');
  const service = load('src/services/mathDraft.ts');
  const session = sessions.captureSession();
  assert.equal(service.writeMathDraft('solve', draft, session), true);
  assert.equal(JSON.stringify(service.readMathDraft('solve', session)), JSON.stringify(draft));
  auth.currentUser = { ...alice, uid: 'bob' };
  assert.equal(service.writeMathDraft('solve', draft, session), false);
  assert.equal(service.readMathDraft('solve', sessions.captureSession()), null);
  assert.equal(disk.size, 0);
});

test('the written editor debounces disk persistence and has no vertical workspace scroll', () => {
  assert.match(mathInputSource, /const SAVE_DELAY_MS = 420/);
  assert.match(mathInputSource, /saveTimer\.current = setTimeout\(\(\) => persistDraft\(\), SAVE_DELAY_MS\)/);
  assert.match(mathInputSource, /AppState\.addEventListener\('change'/);
  assert.doesNotMatch(mathInputSource, /<ScrollView/);
});

test('invalid, expired and future-dated drafts are discarded, and deletion clears both modes', () => {
  const { disk, load } = fixture();
  const session = load('src/services/sessionGuard.ts').captureSession();
  const service = load('src/services/mathDraft.ts');
  for (const updatedAt of [Date.now() - 8 * 86400000, Date.now() + 86400000]) {
    service.writeMathDraft('solve', draft, session);
    const key = [...disk.keys()][0];
    const value = JSON.parse(disk.get(key)!);
    disk.set(key, JSON.stringify({ ...value, updatedAt }));
    assert.equal(service.readMathDraft('solve', session), null);
  }
  service.writeMathDraft('solve', draft, session);
  service.writeMathDraft('check', draft, session);
  service.clearMathDrafts();
  assert.equal(disk.size, 0);
});

test('written pending analysis resumes without an image and retains the original request ID', async () => {
  const { load, auth } = fixture();
  const service = load('src/services/pendingAnalysis.ts');
  const math = { problemLatex: 'x+1=3' };
  const requestId = 'analysis-abcdef-123456';
  assert.equal(service.savePendingWrittenMath('solve', math, requestId, 'alice'), true);
  const pending = await service.preparePendingAnalysisOnStartup();
  assert.equal(pending.schemaVersion, 3);
  assert.equal(pending.requestId, requestId);
  assert.equal(pending.math.problemLatex, 'x+1=3');
  assert.equal(pending.image, undefined);
  service.clearPendingAnalysis('analysis-different-123456');
  assert.equal(service.getPreparedPendingAnalysis().requestId, requestId);
  auth.currentUser = { ...alice, uid: 'bob' };
  assert.equal(service.getPreparedPendingAnalysis(), null);
});

test('failed disk writes do not publish a resumable typed analysis', async () => {
  const { load, File, disk } = fixture();
  const service = load('src/services/pendingAnalysis.ts');
  await service.preparePendingAnalysisOnStartup();
  const write = File.prototype.write;
  File.prototype.write = () => { throw new Error('No space left'); };
  assert.equal(service.savePendingWrittenMath('solve', { problemLatex: 'x=2' }, 'analysis-abcdef-123456', 'alice'), false);
  assert.equal(service.getPreparedPendingAnalysis(), null);
  assert.equal(disk.size, 0);
  File.prototype.write = write;
  assert.equal(service.savePendingWrittenMath('solve', { problemLatex: 'x=2' }, 'analysis-abcdef-123456', 'alice'), true);
  assert.equal((await service.preparePendingAnalysisOnStartup()).math.problemLatex, 'x=2');
});

test('typed check cannot persist an absent solution or an oversized problem', () => {
  const { load } = fixture();
  const service = load('src/services/pendingAnalysis.ts');
  assert.equal(service.savePendingWrittenMath('check', { problemLatex: 'x=2' }, 'analysis-abcdef-123456', 'alice'), false);
  assert.equal(service.savePendingWrittenMath('solve', { problemLatex: 'x'.repeat(1601) }, 'analysis-abcdef-123456', 'alice'), false);
  assert.equal(service.savePendingWrittenMath('check', { problemLatex: 'x+1=3', solutionLatex: 'x=2' }, 'analysis-abcdef-123456', 'alice'), true);
});

test('typed retry looks up completed results and never sends another analysis or opens an image file', async () => {
  const auth = { currentUser: alice as any };
  const calls: string[] = [];
  let cached = false;
  let sent: any;
  const result = { mode: 'solve', status: 'ready' };
  const load = serviceLoader({
    '@react-native-firebase/app': { getApp() {} }, '@react-native-firebase/auth': { getAuth: () => auth },
    '@react-native-firebase/functions': { getFunctions() {}, httpsCallable: (_f: any, name: string) => async (request: any) => {
      calls.push(name);
      if (name === 'getAnalysisStatus') return { data: cached ? { state: 'completed', response: { lessonId: 'lesson', result } } : { state: 'missing' } };
      sent = request; cached = true;
      return { data: { lessonId: 'lesson', result } };
    } },
    'expo-file-system': { File: class { constructor() { throw Error('typed request must never open a photo'); } } },
    '../utils/mathContent': { isMathAnalysis: () => true },
    './firebase': { initializeVerifiedFirebaseServices: async () => auth.currentUser },
    './installationIdentity': { getInstallationToken: async () => 'a'.repeat(64) },
  });
  const service = load('src/services/mathAnalysis.ts');
  const math = { problemLatex: 'x+1=3' };
  await service.analyzeOrResumeWrittenMath('solve', math, 'analysis-abcdef-123456', false, () => false, 'alice');
  assert.equal(sent.kind, 'math');
  assert.equal(sent.problemLatex, math.problemLatex);
  assert.equal(sent.imageBase64, undefined);
  await service.analyzeOrResumeWrittenMath('solve', math, 'analysis-abcdef-123456', true, () => false, 'alice');
  assert.deepEqual(calls, ['analyzeMathImage', 'getAnalysisStatus']);
  auth.currentUser = { ...alice, uid: 'bob' };
  await assert.rejects(service.analyzeOrResumeWrittenMath('solve', math, 'analysis-abcdef-123456', false, () => false, 'alice'), { code: 'session/changed' });
  assert.equal(calls.length, 2);
});

test('typed errors never ask for a photograph or reveal provider details', () => {
  for (const code of ['functions/invalid-argument', 'functions/aborted', 'functions/unauthenticated', 'functions/internal']) {
    const text = friendlyWrittenMathError({ code, message: 'sensitive-provider-data' });
    assert.doesNotMatch(text, /fotograf|sensitive-provider-data/i);
  }
});
