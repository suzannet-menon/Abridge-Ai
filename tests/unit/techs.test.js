import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCustomStack, starterLanguageFor } from '../../backend/src/domain/techs.js';

test('blank input yields no components and no unknowns', () => {
  assert.deepEqual(parseCustomStack(''), { components: [], unknown: [] });
  assert.deepEqual(parseCustomStack(null), { components: [], unknown: [] });
});

test('C++ survives the separator split as one token', () => {
  const { components } = parseCustomStack('C++ + Postgres');
  const tokens = components.map(c => c.token);
  assert.ok(tokens.includes('cpp'));
  assert.ok(tokens.includes('postgres'));
  assert.equal(components.length, 2);
});

test('C# is recognized, not mangled', () => {
  const { components, unknown } = parseCustomStack('C#');
  assert.deepEqual(components.map(c => c.token), ['csharp']);
  assert.deepEqual(unknown, []);
});

test('recognized stack components come back grouped and labelled', () => {
  const { components, unknown } = parseCustomStack('FastAPI + React + PostgreSQL');
  assert.deepEqual(unknown, []);
  assert.deepEqual(
    components.map(c => `${c.label}/${c.category}`).sort(),
    ['FastAPI/api', 'PostgreSQL/data', 'React/ui'],
  );
});

test('unknown tokens are reported, not dropped silently', () => {
  const { unknown } = parseCustomStack('odin + Bun');
  assert.deepEqual(unknown, ['odin']);
});

test('starter language follows the custom stack runtime', () => {
  assert.equal(starterLanguageFor({ customStack: 'FastAPI + React' }), 'python');
  assert.equal(starterLanguageFor({ customStack: 'gin' }), 'go');
  assert.equal(starterLanguageFor({ customStack: 'axum' }), 'rust');
  assert.equal(starterLanguageFor({ customStack: 'react + vue' }), 'typescript');
});

test('bundled stack keys pass straight through', () => {
  assert.equal(starterLanguageFor({ stack: 'python' }), 'python');
  assert.equal(starterLanguageFor({ stack: 'rust' }), 'rust');
});
