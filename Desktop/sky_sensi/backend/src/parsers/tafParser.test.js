const test = require('node:test');
const assert = require('node:assert/strict');

const TAFParser = require('./tafParser');

test('extractVisibility ignores time range tokens when searching for meters', () => {
  const block = 'TEMPO 1212/1318 4000 SHRA';
  const visibility = TAFParser.extractVisibility(block);

  assert.ok(visibility, 'Expected visibility to be detected');
  assert.equal(visibility.unit, 'M');
  assert.equal(visibility.value, 4000);
});

test('extractVisibility returns null when only time range is provided', () => {
  const block = 'TEMPO 1212/1318';
  const visibility = TAFParser.extractVisibility(block);

  assert.equal(visibility, null);
});

test('extractVisibility handles CAVOK as unlimited visibility', () => {
  const block = 'CAVOK';
  const visibility = TAFParser.extractVisibility(block);

  assert.ok(visibility, 'Expected CAVOK to yield visibility');
  assert.equal(visibility.unit, 'M');
  assert.equal(visibility.value, 9999);
  assert.equal(visibility.cavok, true);

  const visibilitySM = TAFParser.normalizeVisibilityToSM(visibility);
  assert.equal(visibilitySM, 6.21);
});

test('extractCeiling returns null for CAVOK blocks', () => {
  const block = 'CAVOK';

  assert.equal(TAFParser.extractCeiling(block), null);
  const parsedBlock = TAFParser.parseWeatherBlock(block, null, null, true);
  assert.equal(parsedBlock.ceilingFt, null);
  assert.equal(parsedBlock.visibilitySM, 6.21);
});
