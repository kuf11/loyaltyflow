import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRules } from './loyalty.js';

test('loyalty rules clamp unsafe values and sort levels', () => {
  const rules = normalizeRules({
    mode: 'unexpected',
    welcomeBonus: 9_999_999,
    levels: [
      { name: 'Gold', threshold: 1000, value: 150 },
      { name: 'Start', threshold: -10, value: -5 },
    ],
  });

  assert.equal(rules.mode, 'cashback');
  assert.equal(rules.welcomeBonus, 1_000_000);
  assert.deepEqual(rules.levels, [
    { name: 'Start', threshold: 0, value: 0 },
    { name: 'Gold', threshold: 1000, value: 100 },
  ]);
});

test('loyalty rules fall back to a usable first level', () => {
  const rules = normalizeRules({ levels: [] });
  assert.ok(rules.levels.length > 0);
  assert.equal(rules.levels[0].threshold, 0);
});
