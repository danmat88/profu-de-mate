import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
// @ts-expect-error Dependency-free release tooling is JavaScript.
import { assertDeployConfiguration } from '../scripts/deploy-preflight.mjs';

const projectDirectory = path.resolve('preflight-fixture');
const projectId = 'explicit-project-id';
function check(files: Record<string, string>, shellEnvironment: Record<string, string> = {}) {
  const contents = new Map(Object.entries({ 'firebase.json': '{"functions":{"source":"functions"}}', ...files })
    .map(([name, value]) => [path.join(projectDirectory, name), value]));
  return assertDeployConfiguration({ projectDirectory, projectId, shellEnvironment,
    exists: (file: string) => contents.has(file), read: (file: string) => contents.get(file) });
}

test('deploy refuses absent stage even when shell or emulator/root dotenv has a stage', () => {
  assert.throws(() => check({}));
  assert.throws(() => check({}, { PROFU_RELEASE_SECURITY_STAGE: 'play' }));
  for (const file of ['.env', 'functions/.env.local', 'functions/.env.default']) {
    assert.throws(() => check({ [file]: 'PROFU_RELEASE_SECURITY_STAGE=play' }));
  }
});

test('explicit project env overrides shared Functions env exactly as deploy does', () => {
  const result = check({ 'functions/.env': 'PROFU_RELEASE_SECURITY_STAGE=play',
    'functions/.env.explicit-project-id': 'PROFU_RELEASE_SECURITY_STAGE=pre-play-public' });
  assert.equal(result.stage, 'pre-play-public');
  assert.deepEqual(result.loadedFiles, ['functions/.env', 'functions/.env.explicit-project-id']);
});

test('unknown, empty and conflicting stages fail closed', () => {
  for (const value of ['debug', '', 'PLAY']) assert.throws(() => check({ 'functions/.env': `PROFU_RELEASE_SECURITY_STAGE=${value}` }));
  assert.throws(() => check({ 'functions/.env': 'PROFU_RELEASE_SECURITY_STAGE=play' }, { PROFU_RELEASE_SECURITY_STAGE: 'pre-play-public' }));
  assert.equal(check({ 'functions/.env': 'PROFU_RELEASE_SECURITY_STAGE=play' }, { PROFU_RELEASE_SECURITY_STAGE: 'play' }).stage, 'play');
});

test('dotenv parser failures do not print secret content', () => {
  assert.throws(() => check({ 'functions/.env': 'PROFU_RELEASE_SECURITY_STAGE=play\nFIREBASE_PRIVATE=do-not-print-me' }), (error: Error) => {
    assert.match(error.message, /invalid/);
    assert.doesNotMatch(error.message, /do-not-print-me/);
    return true;
  });
});

test('changed codebase layouts or paths require preflight review', () => {
  assert.throws(() => check({ 'firebase.json': '{"functions":[{"source":"functions"}]}' }));
  assert.throws(() => check({ 'firebase.json': '{"functions":{"source":"../outside"}}' }));
});
