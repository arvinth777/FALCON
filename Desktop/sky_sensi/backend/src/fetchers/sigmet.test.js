const { test, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';

const TTLCache = require('../cache/ttlCache');
const awcClientModule = require('../utils/awcClient');

const makeRequestStub = mock.method(awcClientModule, 'makeRequest', async () => {
  throw new Error('makeRequest stub not configured');
});

const SIGMETFetcher = require('./sigmet');

const sequentialTest = (name, fn) => test(name, { concurrency: false }, fn);

const SAMPLE_FEATURE = {
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-120, 30],
        [-110, 30],
        [-110, 35],
        [-120, 35],
        [-120, 30]
      ]
    ]
  },
  properties: {
    id: 'SIG-1234',
    hazard: 'TURB',
    severity: 'MODERATE',
    validTimeFrom: '2024-03-01T00:00:00Z',
    validTimeTo: '2024-03-01T03:00:00Z',
    altitudeLow1: 10000,
    altitudeHigh1: 20000,
    rawAirSigmet: 'TEST RAW TEXT'
  }
};

let ttlGetStub;
let ttlSetStub;

beforeEach(() => {
  ttlGetStub = mock.method(TTLCache, 'get', () => undefined);
  ttlSetStub = mock.method(TTLCache, 'set', () => true);
  if (typeof makeRequestStub.mock.reset === 'function') {
    makeRequestStub.mock.reset();
  }
  makeRequestStub.mock.mockImplementation(async () => {
    throw new Error('makeRequest stub not configured');
  });
});

afterEach(() => {
  ttlGetStub.mock.restore();
  ttlSetStub.mock.restore();
});

sequentialTest('fetchSIGMET returns empty array for invalid bounding boxes', async () => {
  const result = await SIGMETFetcher.fetchSIGMET('not,a,valid,bbox');

  assert.deepEqual(result, []);
});

sequentialTest('fetchSIGMET returns cached values when available', async () => {
  const bbox = '-120,30,-110,35';
  const cacheKey = `sigmet:${bbox}`;
  const cachedValue = [{ id: 'cached-sigmet' }];

  ttlGetStub.mock.mockImplementation(key => (key === cacheKey ? cachedValue : undefined));

  const result = await SIGMETFetcher.fetchSIGMET(bbox);

  assert.deepEqual(result, cachedValue);
  assert.equal(ttlSetStub.mock.callCount(), 0);
});

sequentialTest('fetchSIGMET transforms features and caches results', async () => {
  makeRequestStub.mock.mockImplementation(async () => ({
    status: 200,
    data: { features: [SAMPLE_FEATURE] }
  }));

  const results = await SIGMETFetcher.fetchSIGMET([-120, 30, -110, 35]);

  assert.equal(ttlSetStub.mock.callCount(), 1);

  const [cacheKey, cachedValue] = ttlSetStub.mock.calls[0].arguments;
  assert.equal(cacheKey, 'sigmet:-120,30,-110,35');
  assert.equal(cachedValue.length, 1);

  const sigmet = results[0];
  assert.equal(sigmet.id, SAMPLE_FEATURE.properties.id);
  assert.equal(sigmet.type, 'SIGMET');
  assert.equal(sigmet.phenomenon, 'TURBULENCE');
  assert.equal(sigmet.severity, SAMPLE_FEATURE.properties.severity);
  assert.equal(sigmet.altitudeLow, SAMPLE_FEATURE.properties.altitudeLow1);
  assert.equal(sigmet.altitudeHigh, SAMPLE_FEATURE.properties.altitudeHigh1);
  assert.deepEqual(sigmet.geometry, SAMPLE_FEATURE.geometry);
  assert.equal(sigmet.rawText, SAMPLE_FEATURE.properties.rawAirSigmet);

});

sequentialTest('fetchSIGMET caches and returns empty array on 204 responses', async () => {
  makeRequestStub.mock.mockImplementation(async () => ({ status: 204 }));

  const results = await SIGMETFetcher.fetchSIGMET('-120,30,-110,35');

  assert.deepEqual(results, []);
  assert.equal(ttlSetStub.mock.callCount(), 1);

  const [, value, ttl] = ttlSetStub.mock.calls[0].arguments;
  assert.deepEqual(value, []);
  assert.equal(ttl, 300);
});

sequentialTest('fetchSIGMET retries once after 429 with exponential backoff', async () => {
  let attempt = 0;
  const error = new Error('Rate limited');
  error.response = { status: 429 };

  makeRequestStub.mock.mockImplementation(async () => {
    attempt += 1;
    if (attempt === 1) {
      throw error;
    }
    if (attempt === 2) {
      return {
        status: 200,
        data: { features: [SAMPLE_FEATURE] }
      };
    }

    throw new Error(`Unexpected attempt ${attempt}`);
  });

  const backoffStub = mock.method(SIGMETFetcher, 'exponentialBackoff', async () => undefined);

  const results = await SIGMETFetcher.fetchSIGMET('-120,30,-110,35');

  assert.equal(backoffStub.mock.callCount(), 1);
  assert.equal(results.length, 1);
  assert.equal(attempt, 2);

  backoffStub.mock.restore();
});

sequentialTest('categorizePhenomenon maps hazards to normalized constants', () => {
  assert.equal(SIGMETFetcher.categorizePhenomenon('turb'), 'TURBULENCE');
  assert.equal(SIGMETFetcher.categorizePhenomenon('VOLCANIC ASH'), 'VOLCANIC_ASH');
  assert.equal(SIGMETFetcher.categorizePhenomenon(''), 'UNKNOWN');
  assert.equal(SIGMETFetcher.categorizePhenomenon(null), 'UNKNOWN');
});

sequentialTest('normalizeBoundingBox accepts arrays and rejects malformed inputs', () => {
  assert.equal(SIGMETFetcher.normalizeBoundingBox([-120, 30, -110, 35]), '-120,30,-110,35');
  assert.equal(SIGMETFetcher.normalizeBoundingBox('-120,30,-110,35'), '-120,30,-110,35');
  assert.equal(SIGMETFetcher.normalizeBoundingBox('bad'), null);
  assert.equal(SIGMETFetcher.normalizeBoundingBox([1, 2, 3]), null);
});

sequentialTest('filter helpers operate on provided collections', () => {
  const now = new Date();
  const past = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const future = new Date(now.getTime() + 10 * 60 * 1000).toISOString();

  const sigmets = [
    { id: '1', phenomenon: 'TURBULENCE', validFrom: past, validTo: future },
    { id: '2', phenomenon: 'ICING', validFrom: past, validTo: past }
  ];

  const filteredPhenomenon = SIGMETFetcher.filterByPhenomenon(sigmets, 'TURBULENCE');
  assert.equal(filteredPhenomenon.length, 1);
  assert.equal(filteredPhenomenon[0].id, '1');

  const filteredValid = SIGMETFetcher.filterValid(sigmets);
  assert.equal(filteredValid.length, 1);
  assert.equal(filteredValid[0].id, '1');
});

sequentialTest('getCacheStats returns sigmet-specific metrics', () => {
  const keysStub = mock.method(TTLCache, 'keys', () => ['sigmet:test', 'other']);
  const statsStub = mock.method(TTLCache, 'getStats', () => ({ keys: 2, hits: 1, misses: 1 }));

  const stats = SIGMETFetcher.getCacheStats();
  assert.equal(stats.totalSigmetKeys, 1);
  assert.deepEqual(stats.overallCacheStats, { keys: 2, hits: 1, misses: 1 });

  keysStub.mock.restore();
  statsStub.mock.restore();
});
