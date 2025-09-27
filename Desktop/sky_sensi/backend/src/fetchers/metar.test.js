const { test, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';

const TTLCache = require('../cache/ttlCache');
const { awcClient, clearRequestCache } = require('../utils/awcClient');
const { normalizeTimestamp } = require('../utils/timestampUtils');

const METARFetcher = require('./metar');

const sequentialTest = (name, fn) => test(name, { concurrency: false }, fn);

const SAMPLE_METAR = {
  icaoId: 'KJFK',
  name: 'John F. Kennedy International Airport',
  lat: 40.6398,
  lon: -73.7789,
  obsTimeMs: 1_700_000_000_000,
  obsTime: 1_700_000_000,
  temp: 18.3,
  dewp: 12.1,
  wdir: 180,
  wspd: 12,
  wgst: 20,
  visib: '3/4',
  altim: 29.92,
  fltCat: 'VFR',
  rawOb: 'METAR KJFK ...',
  clouds: [{ coverage: 'BKN', altitude: 1500 }],
  wxString: 'RA'
};

let ttlGetStub;
let ttlSetStub;

beforeEach(() => {
  clearRequestCache();
  ttlGetStub = mock.method(TTLCache, 'get', () => undefined);
  ttlSetStub = mock.method(TTLCache, 'set', () => true);
});

afterEach(() => {
  ttlGetStub.mock.restore();
  ttlSetStub.mock.restore();
});

sequentialTest('fetchMETAR chunks ICAO codes respecting batch size', async () => {
  const codes = Array.from({ length: 50 }, (_, idx) => `K${(idx + 1).toString().padStart(3, '0')}`);
  const capturedChunks = [];

  const fetchChunkStub = mock.method(METARFetcher, 'fetchMETARChunk', async (chunkIds) => {
    capturedChunks.push([...chunkIds]);
    return chunkIds.map(icao => ({ icao, observationTime: '2024-01-01T00:00:00.000Z' }));
  });

  const results = await METARFetcher.fetchMETAR(codes);

  assert.equal(fetchChunkStub.mock.callCount(), 3);
  assert.deepEqual(capturedChunks.map(chunk => chunk.length), [20, 20, 10]);
  assert.equal(results.length, 50);

  fetchChunkStub.mock.restore();
});

sequentialTest('fetchMETAR with small ICAO lists uses a single chunk', async () => {
  const codes = ['KLAX'];
  const fetchChunkStub = mock.method(METARFetcher, 'fetchMETARChunk', async chunkIds => (
    chunkIds.map(icao => ({ icao, observationTime: '2024-01-01T00:00:00.000Z' }))
  ));

  const results = await METARFetcher.fetchMETAR(codes);

  assert.equal(fetchChunkStub.mock.callCount(), 1);
  assert.deepEqual(fetchChunkStub.mock.calls[0].arguments[0], codes);
  assert.equal(results.length, 1);

  fetchChunkStub.mock.restore();
});

sequentialTest('fetchMETAR with batch-size ICAO list still performs single chunk', async () => {
  const codes = Array.from({ length: 20 }, (_, idx) => `K${(idx + 1).toString().padStart(3, '0')}`);
  const fetchChunkStub = mock.method(METARFetcher, 'fetchMETARChunk', async chunkIds => (
    chunkIds.map(icao => ({ icao, observationTime: '2024-01-01T00:00:00.000Z' }))
  ));

  await METARFetcher.fetchMETAR(codes);

  assert.equal(fetchChunkStub.mock.callCount(), 1);
  assert.equal(fetchChunkStub.mock.calls[0].arguments[0].length, 20);

  fetchChunkStub.mock.restore();
});

sequentialTest('fetchMETAR caches merged results and returns cached value', async () => {
  const codes = ['KLAX', 'KSFO'];
  const cacheKey = `metar:${[...codes].sort().join(',')}`;
  const cachedValue = [{ icao: 'KLAX' }];
  let store;

  ttlGetStub.mock.restore();
  ttlSetStub.mock.restore();
  ttlGetStub = mock.method(TTLCache, 'get', (key) => (key === cacheKey ? store : undefined));
  ttlSetStub = mock.method(TTLCache, 'set', (key, value) => {
    if (key === cacheKey) {
      store = value;
    }
    return true;
  });

  const fetchChunkStub = mock.method(METARFetcher, 'fetchMETARChunk', async () => cachedValue);

  const first = await METARFetcher.fetchMETAR(codes);
  const second = await METARFetcher.fetchMETAR(codes);

  assert.equal(fetchChunkStub.mock.callCount(), 1);
  assert.equal(ttlSetStub.mock.callCount(), 1);
  assert.deepEqual(first, cachedValue);
  assert.deepEqual(second, cachedValue);

  fetchChunkStub.mock.restore();
});

sequentialTest('fetchMETAR caches empty results from upstream APIs', async () => {
  const codes = ['KSEA', 'KPDX'];
  const cacheKey = `metar:${[...codes].sort().join(',')}`;
  ttlGetStub.mock.restore();
  ttlSetStub.mock.restore();

  let stored;
  ttlGetStub = mock.method(TTLCache, 'get', key => (key === cacheKey ? stored : undefined));
  ttlSetStub = mock.method(TTLCache, 'set', (key, value) => {
    if (key === cacheKey) {
      stored = value;
    }
    return true;
  });

  const fetchChunkStub = mock.method(METARFetcher, 'fetchMETARChunk', async () => []);

  const result = await METARFetcher.fetchMETAR(codes);

  assert.deepEqual(result, []);
  assert.equal(fetchChunkStub.mock.callCount(), 1);
  assert.equal(ttlSetStub.mock.callCount(), 1);
  assert.deepEqual(stored, []);

  fetchChunkStub.mock.restore();
});

sequentialTest('fetchMETARChunk returns empty array on 204 responses', async () => {
  const responseStub = mock.method(awcClient, 'get', async () => ({ status: 204 }));

  const results = await METARFetcher.fetchMETARChunk(['KDEN']);

  assert.deepEqual(results, []);
  responseStub.mock.restore();
});

sequentialTest('fetchMETARChunk retries after 429 with exponential backoff', async () => {
  let attempt = 0;
  const error = new Error('Too Many Requests');
  error.response = { status: 429 };

  const responseStub = mock.method(awcClient, 'get', async () => {
    attempt += 1;
    if (attempt === 1) {
      throw error;
    }
    return { status: 200, data: [SAMPLE_METAR] };
  });

  const backoffStub = mock.method(METARFetcher, 'exponentialBackoff', async () => undefined);

  const results = await METARFetcher.fetchMETARChunk(['KJFK']);

  assert.equal(responseStub.mock.callCount(), 2);
  assert.equal(backoffStub.mock.callCount(), 1);
  assert.equal(results.length, 1);
  assert.equal(results[0].icao, 'KJFK');

  responseStub.mock.restore();
  backoffStub.mock.restore();
});

sequentialTest('fetchMETARChunk normalizes observation timestamps from obsTimeMs and obsTime', async () => {
  const responseStub = mock.method(awcClient, 'get', async () => ({
    status: 200,
    data: [SAMPLE_METAR]
  }));

  const results = await METARFetcher.fetchMETARChunk(['KJFK']);

  const expected = normalizeTimestamp(SAMPLE_METAR.obsTimeMs, {
    context: 'METAR:KJFK.observationTime'
  });

  assert.equal(results[0].observationTime, expected);

  responseStub.mock.restore();
});

sequentialTest('fetchMETARChunk falls back to obsTime when obsTimeMs is missing', async () => {
  const metar = { ...SAMPLE_METAR, obsTimeMs: undefined };
  const responseStub = mock.method(awcClient, 'get', async () => ({
    status: 200,
    data: [metar]
  }));

  const results = await METARFetcher.fetchMETARChunk(['KJFK']);
  const expected = normalizeTimestamp(metar.obsTime, {
    context: 'METAR:KJFK.observationTime'
  });

  assert.equal(results[0].observationTime, expected);

  responseStub.mock.restore();
});

sequentialTest('normalizeVisibility converts fractional values', () => {
  assert.equal(METARFetcher.normalizeVisibility('1/2'), 0.5);
  assert.equal(METARFetcher.normalizeVisibility('3/4'), 0.75);
});

sequentialTest('buildWindObject handles null values appropriately', () => {
  assert.equal(METARFetcher.buildWindObject(null, null, null), null);

  const wind = METARFetcher.buildWindObject(null, 12, null);
  assert.deepEqual(wind, { direction: 'VRB', speed: 12, gust: null, unit: 'KT' });
});

sequentialTest('validateICAOCodes filters invalid codes', () => {
  const result = METARFetcher.validateICAOCodes(['KLAX', 'ksfo', '1234', 'K5', null]);
  assert.deepEqual(result, ['KLAX', 'KSFO']);
});

sequentialTest('fetchMETARChunk transforms raw AWC payload correctly', async () => {
  const responseStub = mock.method(awcClient, 'get', async () => ({
    status: 200,
    data: [SAMPLE_METAR]
  }));

  const results = await METARFetcher.fetchMETARChunk(['KJFK']);
  const metar = results[0];

  assert.equal(metar.icao, SAMPLE_METAR.icaoId);
  assert.equal(metar.name, SAMPLE_METAR.name);
  assert.equal(metar.lat, SAMPLE_METAR.lat);
  assert.equal(metar.lon, SAMPLE_METAR.lon);
  assert.equal(metar.visibility, 0.75);
  assert.equal(metar.visibilityUnits, 'SM');
  assert.equal(metar.wind.direction, SAMPLE_METAR.wdir);
  assert.equal(metar.wind.speed, SAMPLE_METAR.wspd);
  assert.equal(metar.wind.gust, SAMPLE_METAR.wgst);
  assert.equal(metar.flightCategory, SAMPLE_METAR.fltCat);
  assert.deepEqual(metar.clouds, SAMPLE_METAR.clouds);

  responseStub.mock.restore();
});

sequentialTest('fetchMETAR handles empty ICAO input gracefully', async () => {
  const results = await METARFetcher.fetchMETAR([]);
  assert.deepEqual(results, []);
});
