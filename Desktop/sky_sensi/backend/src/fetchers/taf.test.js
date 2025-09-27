const { test, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';

const TTLCache = require('../cache/ttlCache');
const TAFParser = require('../parsers/tafParser');
const ReliabilityCalculator = require('../utils/reliabilityCalculator');
const { awcClient, clearRequestCache } = require('../utils/awcClient');
const { normalizeTimestamp } = require('../utils/timestampUtils');

const TAFFetcher = require('./taf');

const sequentialTest = (name, fn) => test(name, { concurrency: false }, fn);

const SAMPLE_TAF = {
  icaoId: 'KSFO',
  issueTime: '2023-10-01T00:00:00Z',
  bulletinTime: '2023-10-01T00:05:00Z',
  validTimeFrom: '2023-10-01T00:00:00Z',
  validTimeTo: '2023-10-01T06:00:00Z',
  rawTAF: 'TAF KSFO 010000Z 0100/0206 18010KT P6SM FEW020 SCT150'
};

let ttlGetStub;
let ttlSetStub;
let parserStub;
let currentBlockStub;

beforeEach(() => {
  clearRequestCache();
  ttlGetStub = mock.method(TTLCache, 'get', () => undefined);
  ttlSetStub = mock.method(TTLCache, 'set', () => true);
  parserStub = mock.method(TAFParser, 'parse', () => ({
    blocks: [{
      type: 'INITIAL',
      startTime: '2023-10-01T00:00:00Z',
      endTime: '2023-10-01T06:00:00Z',
      visibility: { unit: 'SM', value: 'P6' },
      wind: { direction: 180, speed: 10 }
    }],
    currentBlockIndex: 0
  }));
  currentBlockStub = mock.method(TAFParser, 'getCurrentBlock', (parsed) => parsed.blocks[parsed.currentBlockIndex] || null);
  mock.method(ReliabilityCalculator, 'calculateOverallReliability', () => ({
    score: 80,
    rating: 'HIGH',
    confidence: 0.9,
    factors: []
  }));
  mock.method(ReliabilityCalculator, 'generateSummary', () => 'High reliability');
});

afterEach(() => {
  ttlGetStub.mock.restore();
  ttlSetStub.mock.restore();
  parserStub.mock.restore();
  ReliabilityCalculator.calculateOverallReliability.mock.restore();
  ReliabilityCalculator.generateSummary.mock.restore();
  currentBlockStub.mock.restore();
});

const buildIcaoSequence = (count) => Array.from({ length: count }, (_, idx) => {
  const first = String.fromCharCode(65 + (idx % 26));
  const second = String.fromCharCode(65 + Math.floor(idx / 26) % 26);
  const third = String.fromCharCode(65 + Math.floor(idx / 676) % 26);
  return `K${first}${second}${third}`;
});

sequentialTest('fetchTAF chunks ICAO codes and caches results', async () => {
  const codes = buildIcaoSequence(45);
  const cacheKey = `taf:${[...codes].sort().join(',')}`;
  const chunkCalls = [];

  ttlGetStub.mock.restore();
  ttlSetStub.mock.restore();
  let stored;
  ttlGetStub = mock.method(TTLCache, 'get', (key) => (key === cacheKey ? stored : undefined));
  ttlSetStub = mock.method(TTLCache, 'set', (key, value) => {
    if (key === cacheKey) {
      stored = value;
    }
    return true;
  });

  const fetchChunkStub = mock.method(TAFFetcher, 'fetchTAFChunk', async (chunkIds) => {
    chunkCalls.push([...chunkIds]);
    return chunkIds.map(icao => ({ icao }));
  });

  try {
    const first = await TAFFetcher.fetchTAF(codes);
    const second = await TAFFetcher.fetchTAF(codes);

    const expectedChunks = Math.ceil(codes.length / 20);
    assert.equal(fetchChunkStub.mock.callCount(), expectedChunks);
    assert.equal(ttlSetStub.mock.callCount(), 1);
    assert.equal(first.length, codes.length);
    assert.equal(second.length, codes.length);
    assert.equal(chunkCalls.length, expectedChunks);
  } finally {
    fetchChunkStub.mock.restore();
  }
});

sequentialTest('fetchTAF returns cached value when available', async () => {
  const codes = ['KSFO', 'KLAX'];
  const cacheKey = `taf:${[...codes].sort().join(',')}`;
  const cached = [{ icao: 'KSFO' }];

  ttlGetStub.mock.restore();
  ttlSetStub.mock.restore();
  ttlGetStub = mock.method(TTLCache, 'get', (key) => (key === cacheKey ? cached : undefined));
  ttlSetStub = mock.method(TTLCache, 'set', () => true);

  const fetchChunkStub = mock.method(TAFFetcher, 'fetchTAFChunk', async () => {
    throw new Error('should not call fetchTAFChunk when cached');
  });

  try {
    const results = await TAFFetcher.fetchTAF(codes);
    assert.deepEqual(results, cached);
    assert.equal(fetchChunkStub.mock.callCount(), 0);
  } finally {
    fetchChunkStub.mock.restore();
  }
});

sequentialTest('fetchTAFChunk handles 204 responses by returning empty array', async () => {
  const responseStub = mock.method(awcClient, 'get', async () => ({ status: 204 }));

  try {
    const result = await TAFFetcher.fetchTAFChunk(['KSFO']);
    assert.deepEqual(result, []);
    assert.equal(parserStub.mock.callCount(), 0);
  } finally {
    responseStub.mock.restore();
  }
});

sequentialTest('fetchTAFChunk retries after 429 and returns parsed data', async () => {
  let attempt = 0;
  const tooMany = new Error('429');
  tooMany.response = { status: 429 };

  const responseStub = mock.method(awcClient, 'get', async () => {
    attempt += 1;
    if (attempt === 1) {
      throw tooMany;
    }
    return { status: 200, data: [SAMPLE_TAF] };
  });

  const backoffStub = mock.method(TAFFetcher, 'exponentialBackoff', async () => undefined);

  try {
    const result = await TAFFetcher.fetchTAFChunk(['KSFO']);

    assert.equal(responseStub.mock.callCount(), 2);
    assert.equal(backoffStub.mock.callCount(), 1);
    assert.equal(result.length, 1);
    assert.equal(result[0].icao, 'KSFO');
    assert.ok(parserStub.mock.callCount() >= 1);
  } finally {
    responseStub.mock.restore();
    backoffStub.mock.restore();
  }
});

sequentialTest('fetchTAFChunk normalizes timestamps and parses blocks', async () => {
  const responseStub = mock.method(awcClient, 'get', async () => ({
    status: 200,
    data: [SAMPLE_TAF]
  }));

  try {
    const result = await TAFFetcher.fetchTAFChunk(['KSFO']);
    const taf = result[0];

    assert.equal(taf.icao, SAMPLE_TAF.icaoId);
    assert.equal(taf.rawTAF, SAMPLE_TAF.rawTAF);
    assert.equal(taf.issueTime, normalizeTimestamp(SAMPLE_TAF.issueTime));
    assert.equal(taf.forecastBlocks.length, 1);
    assert.equal(taf.currentBlock.type, 'INITIAL');
  } finally {
    responseStub.mock.restore();
  }
});

sequentialTest('compareForecastVsActual delegates to reliability calculator', () => {
  const tafData = {
    icao: 'KSFO',
    currentBlock: {
      type: 'INITIAL',
      visibility: { unit: 'SM', value: 'P6' },
      ceiling: { altitude: 3000, coverage: 'BKN' },
      weather: ['RA'],
      wind: { direction: 180, speed: 12 }
    }
  };

  const metarData = {
    visibility: 6,
    clouds: [{ cover: 'BKN', base: 3200 }],
    presentWeather: 'RA',
    wind: { direction: 190, speed: 14 }
  };

  const comparison = TAFFetcher.compareForecastVsActual(tafData, metarData);

  assert.equal(comparison.reliability.rating, 'HIGH');
  assert.equal(comparison.reliabilitySummary, 'High reliability');
  assert.ok(ReliabilityCalculator.calculateOverallReliability.mock.callCount() > 0);
});
