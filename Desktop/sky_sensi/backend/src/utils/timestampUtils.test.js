const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeTimestamp } = require('./timestampUtils');

test('normalizeTimestamp converts epoch seconds to ISO strings', () => {
  const epochSeconds = 1_700_000_000;
  const expected = new Date(epochSeconds * 1000).toISOString();

  assert.equal(normalizeTimestamp(epochSeconds), expected);
});

test('normalizeTimestamp scales microsecond epochs down to milliseconds', () => {
  const epochMicroseconds = 1_700_000_000_000_000;
  const expected = new Date(epochMicroseconds / 1000).toISOString();

  assert.equal(normalizeTimestamp(epochMicroseconds), expected);
});

test('normalizeTimestamp handles microsecond epochs provided as strings', () => {
  const epochMicrosecondsString = '1700000000000000';
  const expected = new Date(Number(epochMicrosecondsString) / 1000).toISOString();

  assert.equal(normalizeTimestamp(epochMicrosecondsString), expected);
});
