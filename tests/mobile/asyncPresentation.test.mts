import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { createLatestTask, withDeadline, type TaskState } from '../../src/shared/utils/latestTask.ts';
import { mathDocumentFallbackText } from '../../src/features/math/utils/mathDocumentFallback.ts';
import { buildMathDocumentHtml, type MathDocumentDefinition } from '../../src/features/math/utils/mathDocument.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('offer failure exits loading and a manual retry publishes new prices', async () => {
  const states: TaskState<string>[] = [];
  let calls = 0;
  const task = createLatestTask(async () => {
    if (++calls === 1) throw new Error('offline');
    return 'price from store';
  }, (state) => states.push(state), 1000, 'timeout');
  await task.run();
  await task.run();
  assert.deepEqual(states.map((state) => state.status), ['loading', 'error', 'loading', 'ready']);
  assert.deepEqual(states[3], { status: 'ready', value: 'price from store' });
});

test('a hung store request times out; a late old response cannot replace a retry', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const old = deferred<string>();
  const states: TaskState<string>[] = [];
  let calls = 0;
  const task = createLatestTask(() => ++calls === 1 ? old.promise : Promise.resolve('new prices'),
    (state) => states.push(state), 15000, 'store timeout');
  const pending = task.run();
  await Promise.resolve();
  context.mock.timers.tick(15000);
  await pending;
  assert.equal(states.at(-1)?.status, 'error');
  await task.run();
  old.resolve('stale prices');
  await Promise.resolve();
  assert.deepEqual(states.at(-1), { status: 'ready', value: 'new prices' });
});

test('account changes or unmount invalidate an in-flight offer response', async () => {
  const response = deferred<string>();
  const states: TaskState<string>[] = [];
  const task = createLatestTask(() => response.promise, (state) => states.push(state), 1000, 'timeout');
  const pending = task.run();
  task.cancel();
  response.resolve('another account');
  await pending;
  assert.deepEqual(states, [{ status: 'loading' }]);
});

test('a stalled font download reaches a bounded fallback and consumes late rejection', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const font = deferred<string>();
  const bounded = withDeadline(font.promise, 3000, 'font timeout').catch(() => 'system fonts');
  context.mock.timers.tick(3000);
  assert.equal(await bounded, 'system fonts');
  font.reject(new Error('late native rejection'));
  await Promise.resolve();
});

const definition: MathDocumentDefinition = {
  accessibilityLabel: 'Lecție', variant: 'lesson', sections: [
    { kind: 'heading', eyebrow: 'PASUL 1', title: 'Ecuația' },
    { kind: 'content', content: [
      { type: 'text', text: 'Scădem doi.', latex: '', spoken: '' },
      { type: 'math', text: '', latex: 'x=3', spoken: 'x egal cu trei',
        rendered: { svg: '<svg></svg>', viewBox: '0 0 10 10', widthEx: 1, heightEx: 1 } },
    ] },
  ],
};

test('native fallback preserves headings, explanations and formulas without a WebView', () => {
  const text = mathDocumentFallbackText(definition);
  assert.match(text, /PASUL 1\nEcuația/);
  assert.match(text, /Scădem doi/);
  assert.match(text, /x egal cu trei — x=3/);
});

test('generated document becomes visible when browser font readiness hangs and emits once', async () => {
  const html = buildMathDocumentHtml(definition);
  const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
  assert.ok(script);
  const messages: string[] = [];
  const classes = new Set<string>();
  const font = deferred<void>();
  let timeout!: () => void;
  const root = { classList: { add: (name: string) => classes.add(name) } };
  vm.runInNewContext(script, {
    document: { getElementById: () => root, fonts: { ready: font.promise } },
    window: { ReactNativeWebView: { postMessage: (value: string) => messages.push(value) } },
    requestAnimationFrame: (callback: () => void) => callback(),
    setTimeout: (callback: () => void, delay: number) => { assert.equal(delay, 260); timeout = callback; return 1; },
    clearTimeout: () => undefined,
  });
  assert.equal(messages.length, 0);
  timeout();
  assert.equal(classes.has('visible'), true);
  assert.equal(JSON.parse(messages[0]).type, 'document-ready');
  font.resolve();
  await Promise.resolve();
  assert.equal(messages.length, 1);
});
