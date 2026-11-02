import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GROUPS, PLACES, gridRef, atlasSVG } from '../web/atlas.js';

const catalog = JSON.parse(readFileSync(new URL('../web/data/catalog.json', import.meta.url)));

test('every catalog industry has exactly one place on the atlas, and the atlas has no extras', () => {
  const ids = catalog.industries.map((i) => i.id).sort();
  const placed = GROUPS.flatMap((g) => g.ids);
  assert.equal(new Set(placed).size, placed.length);
  assert.deepEqual([...placed].sort(), ids);
  for (const id of ids) assert.match(gridRef(PLACES[id]), /^[A-H][1-5]$/);
});

test('trails are drawn only to industries with linked roles', () => {
  const svg = atlasSVG({ industries: catalog.industries, counts: { ai: 2, power: 0 }, from: '计算机类' });
  assert.equal((svg.match(/class="trail"/g) || []).length, 1);
  assert.match(svg, /人工智能与数据，图幅 [A-H][1-5]，2 个相关岗位/);
});
