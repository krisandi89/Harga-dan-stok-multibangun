import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterAndRankRows,
  buildHighlightRegex,
  getHighlightSegments
} from '../src/utils/flexibleSearch.js';

const SAMPLE_ROWS = [
  ['HUITEX', 'HDPE 20 MIL ( 0.50 MM ) - (7m x 420m)', '7.00M x 420.00M', '10 m2', '-', 'Gudang Bitung'],
  ['HUITEX', 'HDPE 60 MIL ( 1.50 MM )', '7.00M x 140.00M', '980 m2', '-', 'Gudang Bitung'],
  ['HUITEX', 'HDPE 80 MIL ( 2.00 MM ) THAILAND', '7.00M x 105.00M', '735 m2', '-', 'Gudang Bitung'],
  ['POLY-FLEX', 'HDPE 80 MIL (2.00 MM)', '7.00M x 91.00M', '182.98 m2', '-', 'Gudang Bitung'],
  ['Tensar Geogrid', 'RE 520', '1.3m x 75m', '19,027.27 m2', '-', 'Gudang Bitung'],
  ['Tensar Geogrid', 'RE 580', '1.3m x 50m', '20,803.10 m2', '-', 'Gudang Bitung'],
  ['HILON', 'GTR500 (Non-Woven)', 'Geotextile', '4x50', '-', 'Gudang Bitung'],
  ['GEOTEXTILES NON WOVEN (HITAM)', 'GTR ( 500 GR ) Hitam (2m x 100m)', '2,00M x 100M', '200 m2', '1 Roll', 'Gudang Bitung']
];

test('flexible search matches spacing and spelling variations of 80mil / 80 mill', () => {
  for (const query of ['80mil', '80 mil', '80mill', '80 mill', '80mils']) {
    const matches = filterAndRankRows(SAMPLE_ROWS, query);
    assert.equal(matches.length, 2, `Expected 2 matches for "${query}"`);
    assert.ok(matches.every((row) => /80 MIL/i.test(row[1])));
  }
});

test('flexible search supports cross-column queries, punctuation omission, decimals, and typos', () => {
  assert.equal(filterAndRankRows(SAMPLE_ROWS, 'huitex 80mil').length, 1);
  assert.equal(filterAndRankRows(SAMPLE_ROWS, 're520')[0][1], 'RE 520');
  assert.equal(filterAndRankRows(SAMPLE_ROWS, 'polyflex')[0][0], 'POLY-FLEX');
  assert.equal(filterAndRankRows(SAMPLE_ROWS, '2mm').length, 2);
  assert.equal(filterAndRankRows(SAMPLE_ROWS, 'gtr500 hitam').length, 1);
  assert.equal(filterAndRankRows(SAMPLE_ROWS, 'geotekstil').length, 2);
  assert.equal(filterAndRankRows(SAMPLE_ROWS, 'huitx 80mil').length, 1);
});

test('highlighting matches flexible patterns and skips mid-number digits', () => {
  const segs = getHighlightSegments('HDPE 80 MIL ( 2.00 MM )', buildHighlightRegex('80mil'));
  assert.ok(segs.some((s) => s.match && s.text === '80 MIL'));

  const segsMill = getHighlightSegments('HDPE 80 MIL ( 2.00 MM )', buildHighlightRegex('80 mill'));
  assert.ok(segsMill.some((s) => s.match && s.text === '80 MIL'));

  const segs580 = getHighlightSegments('RE 580', buildHighlightRegex('80'));
  assert.ok(!segs580.some((s) => s.match));
});
