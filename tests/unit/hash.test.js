import test from 'node:test';
import assert from 'node:assert/strict';
import { hash, pick } from '../../backend/src/utils/hash.js';

test('hash("") is the FNV-1a offset basis', () => {
  assert.equal(hash(''), 0x811c9dc5);
});

test('hash is deterministic for identical input', () => {
  assert.equal(hash('abridgeai::research'), hash('abridgeai::research'));
});

test('hash returns an unsigned 32-bit integer', () => {
  for (const s of ['', 'x', 'idea-with-much-longer-content', 'ideä ünïcode']) {
    const h = hash(s);
    assert.ok(Number.isInteger(h));
    assert.ok(h >= 0 && h <= 0xffffffff);
  }
});

test('different inputs hash differently (no obvious collisions)', () => {
  const seen = new Set(['a', 'b', 'cli note taker', 'cli note take', 'research:seed1', 'research:seed2'].map(hash));
  assert.equal(seen.size, 6);
});

test('pick returns exactly n distinct items', () => {
  const pool = ['one', 'two', 'three', 'four', 'five'];
  const out = pick(12345, pool, 3);
  assert.equal(out.length, 3);
  assert.equal(new Set(out).size, 3);
  for (const item of out) assert.ok(pool.includes(item));
});

test('pick is deterministic for the same seed', () => {
  const pool = ['a1', 'b2', 'c3', 'd4', 'e5'];
  assert.deepEqual(pick(77, pool, 2), pick(77, pool, 2));
});

test('pick caps at pool size instead of repeating', () => {
  const out = pick(9, ['x', 'y'], 5);
  assert.equal(out.length, 2);
});
