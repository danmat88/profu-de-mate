import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
const require = createRequire(import.meta.url);

test('patched decoder keeps the CommonJS query-string contract and Romanian round-trips', () => {
  const query = require('query-string');
  assert.equal(query.parse('titlu=Ecua%C8%9Bii%20%C8%99i%20frac%C8%9Bii').titlu, 'Ecuații și fracții');
  assert.equal(query.parse('titlu=%E0%A4%A').titlu, '%E0%A4%A');
  const data = { title: 'Profu’ de mate', x: 'a+b' };
  assert.deepEqual({ ...query.parse(query.stringify(data)) }, data);
});

test('actual query parser finishes malformed percent input without recursive decoding blow-up', () => {
  const parse = require('query-string').parse;
  const value = '%FF%00'.repeat(10_000);
  const result = runInNewContext('parse("x=" + value)', { parse, value }, { timeout: 2000 });
  assert.equal(typeof result.x, 'string');
});

test('UUID security update retains the v4 API used by xcode and gaxios', () => {
  const uuid = require('uuid');
  assert.match(uuid.v4(), /^[a-f0-9-]{36}$/);
  assert.throws(() => uuid.v5('name', uuid.v5.DNS, new Uint8Array(1)), RangeError);
});
