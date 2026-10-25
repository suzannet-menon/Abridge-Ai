import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDeadline, deadlineScore, milestoneSlots } from '../../backend/src/domain/deadline.js';

test('empty deadline normalizes to kind empty', () => {
  for (const raw of ['', '   ', null, undefined]) {
    const p = parseDeadline(raw);
    assert.deepEqual(p, { days: null, label: 'no deadline', kind: 'empty' });
  }
});

test('day / week / month forms parse to calendar days', () => {
  assert.deepEqual(parseDeadline('6 days'), { days: 6, label: '6 days', kind: 'days' });
  assert.deepEqual(parseDeadline('1day'), { days: 1, label: '1day', kind: 'days' });
  assert.deepEqual(parseDeadline('2 weeks'), { days: 14, label: '2 weeks', kind: 'weeks' });
  assert.deepEqual(parseDeadline('3 months'), { days: 90, label: '3 months', kind: 'months' });
  assert.deepEqual(parseDeadline('2.5 months'), { days: 75, label: '2.5 months', kind: 'months' });
});

test('case-insensitive parsing', () => {
  assert.equal(parseDeadline('10 DAYS').days, 10);
  assert.equal(parseDeadline('2 Weeks').kind, 'weeks');
});

test('natural language or bare numbers stay vague, not invented', () => {
  for (const raw of ['soon', 'end of summer', '42', 'by friday']) {
    const p = parseDeadline(raw);
    assert.equal(p.days, null);
    assert.equal(p.kind, 'vague');
    assert.equal(p.label, raw);
  }
});

test('time-realism score bands', () => {
  assert.equal(deadlineScore({ kind: 'empty' }), 8);
  assert.equal(deadlineScore({ kind: 'vague' }), 10);
  assert.equal(deadlineScore({ kind: 'days', days: 7 }), 6);
  assert.equal(deadlineScore({ kind: 'days', days: 14 }), 9);
  assert.equal(deadlineScore({ kind: 'weeks', days: 21 }), 12);
  assert.equal(deadlineScore({ kind: 'months', days: 90 }), 14);
  assert.equal(deadlineScore({ kind: 'months', days: 180 }), 13);
});

test('milestone slots: weeks for unknown or > 14 day deadlines', () => {
  assert.deepEqual(milestoneSlots(null, 4), ['Week 1', 'Week 2', 'Week 3', 'Week 4']);
  assert.deepEqual(milestoneSlots(30, 4), ['Week 1', 'Week 2', 'Week 3', 'Week 4']);
});

test('milestone slots: day ranges inside a 14-day window', () => {
  assert.deepEqual(milestoneSlots(5, 4), ['Day 1', 'Day 3', 'Day 4', 'Day 5']);
});

test('milestone slots: a one-day sprint clamps to Day 1', () => {
  const out = milestoneSlots(1, 4);
  assert.deepEqual(out, ['Day 1', 'Day 1', 'Day 1', 'Day 1']);
});
