const { test, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';

const TTLCache = require('../cache/ttlCache');
const awcClientModule = require('../utils/awcClient');

const makeRequestStub = mock.method(awcClientModule, 'makeRequest', async () => {
  throw new Error('makeRequest stub not configured');
});

const ISIGMETFetcher = require('./isigmet');

const sequentialTest = (name, fn) => test(name, { concurrency: false }, fn);

const VALID_FEATURE = {
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0]
      ]
    ]
  },
  properties: {
    id: 'INTL-001',
    hazard: 'TROPICAL CYCLONE',
    severity: 'MODERATE',
    validTimeFrom: '2024-04-01T00:00:00Z',
    validTimeTo: '2024-04-01T03:00:00Z',
    altitudeLow1: 100,
    altitudeHigh1: 200,
    fir: 'KZNY',
    rawIntlSigmet: 'Raw text'
  }
};

let ttlGetStub;
let ttlSetStub;
let savedTTL;

beforeEach(() => {
  savedTTL = process.env.ISIGMET_CACHE_TTL_SECONDS;
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
  if (savedTTL === undefined) {
    delete process.env.ISIGMET_CACHE_TTL_SECONDS;
  } else {
    process.env.ISIGMET_CACHE_TTL_SECONDS = savedTTL;
  }
});

sequentialTest('fetchISIGMET returns empty array for invalid bounding boxes', async () => {
  const result = await ISIGMETFetcher.fetchISIGMET('bad-input');
  assert.deepEqual(result, []);
});

sequentialTest('fetchISIGMET returns cached results when available', async () => {
  const bbox = '-10,10,20,30';
  const cacheKey = `isigmet:${bbox}`;
  const cached = [{ id: 'cached-isigmet' }];

  ttlGetStub.mock.mockImplementation(key => (key === cacheKey ? cached : undefined));

  const segmentStub = mock.method(ISIGMETFetcher, 'fetchGeoJsonSegment', async () => {
    throw new Error('fetchGeoJsonSegment should not be called when cache is populated');
  });

  const result = await ISIGMETFetcher.fetchISIGMET(bbox);

  assert.deepEqual(result, cached);
  assert.equal(ttlSetStub.mock.callCount(), 0);
  assert.equal(segmentStub.mock.callCount(), 0);

  segmentStub.mock.restore();
});

sequentialTest('fetchISIGMET splits dateline-spanning bbox and caches unique merged records', async () => {
  process.env.ISIGMET_CACHE_TTL_SECONDS = '120';
  const bbox = '170,-10,-170,10';

  const segmentStub = mock.method(ISIGMETFetcher, 'fetchGeoJsonSegment', async (segment) => {
    if (segment === '170,-10,180,10') {
      return [
        { id: 'INTL-A' },
        { id: 'INTL-B' }
      ];
    }
    if (segment === '-180,-10,-170,10') {
      return [
        { id: 'INTL-B' },
        { id: 'INTL-C' }
      ];
    }

    throw new Error(`Unexpected segment ${segment}`);
  });

  const result = await ISIGMETFetcher.fetchISIGMET(bbox);

  assert.deepEqual(result.map(item => item.id).sort(), ['INTL-A', 'INTL-B', 'INTL-C']);
  assert.equal(segmentStub.mock.callCount(), 2);
  assert.equal(ttlSetStub.mock.callCount(), 1);

  const [cacheKey, cachedValue, ttl] = ttlSetStub.mock.calls[0].arguments;
  assert.equal(cacheKey, `isigmet:${bbox}`);
  assert.equal(cachedValue.length, 3);
  assert.equal(ttl, 120);

  segmentStub.mock.restore();
});

sequentialTest('splitBoundingBox handles dateline crossing and invalid input', () => {
  assert.deepEqual(ISIGMETFetcher.splitBoundingBox('-10,20,30,40'), ['-10,20,30,40']);
  assert.deepEqual(ISIGMETFetcher.splitBoundingBox('170,-10,-170,10'), ['170,-10,180,10', '-180,-10,-170,10']);
  assert.deepEqual(ISIGMETFetcher.splitBoundingBox('invalid'), []);
});

sequentialTest('fetchGeoJsonSegment returns empty array on 204 or missing data', async () => {
  makeRequestStub.mock.mockImplementation(async () => ({ status: 204 }));
  const from204 = await ISIGMETFetcher.fetchGeoJsonSegment('-10,20,30,40');
  assert.deepEqual(from204, []);

  makeRequestStub.mock.mockImplementation(async () => ({ status: 200, data: {} }));
  const fromMissing = await ISIGMETFetcher.fetchGeoJsonSegment('-10,20,30,40');
  assert.deepEqual(fromMissing, []);
});

sequentialTest('fetchGeoJsonSegment normalizes features and filters invalid entries', async () => {
  const invalidFeature = {
    type: 'Feature',
    geometry: null,
    properties: {
      id: 'MISSING-GEO',
      hazard: 'ICE',
      validTimeFrom: '2024-04-01T00:00:00Z',
      validTimeTo: '2024-04-01T03:00:00Z'
    }
  };

  const missingPropFeature = {
    type: 'Feature',
    geometry: VALID_FEATURE.geometry,
    properties: {
      hazard: 'ICE',
      validTimeFrom: '2024-04-01T00:00:00Z',
      validTimeTo: '2024-04-01T03:00:00Z'
    }
  };

  makeRequestStub.mock.mockImplementation(async () => ({
    status: 200,
    data: { features: [VALID_FEATURE, invalidFeature, missingPropFeature] }
  }));

  const results = await ISIGMETFetcher.fetchGeoJsonSegment('-10,20,30,40');

  assert.equal(results.length, 1);
  const isigmet = results[0];
  assert.equal(isigmet.id, VALID_FEATURE.properties.id);
  assert.equal(isigmet.type, 'ISIGMET');
  assert.equal(isigmet.phenomenon, 'TROPICAL_CYCLONE');
  assert.equal(isigmet.severity, 'MODERATE');
  assert.equal(isigmet.fir, VALID_FEATURE.properties.fir);
  assert.deepEqual(isigmet.geometry, VALID_FEATURE.geometry);
  assert.ok(isigmet.validFrom.endsWith('Z'));
  assert.ok(isigmet.validTo.endsWith('Z'));
});

sequentialTest('fetchGeoJsonSegment retries on 429 and returns normalized data', async () => {
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
        data: { features: [VALID_FEATURE] }
      };
    }

    throw new Error(`Unexpected attempt ${attempt}`);
  });

  const backoffStub = mock.method(ISIGMETFetcher, 'exponentialBackoff', async () => undefined);

  const results = await ISIGMETFetcher.fetchGeoJsonSegment('-10,20,30,40');

  assert.equal(attempt, 2);
  assert.equal(results.length, 1);

  backoffStub.mock.restore();
});

sequentialTest('categorizePhenomenon and filter helpers behave as expected', () => {
  assert.equal(ISIGMETFetcher.categorizePhenomenon('turb'), 'TURBULENCE');
  assert.equal(ISIGMETFetcher.categorizePhenomenon('volcanic ash'), 'VOLCANIC_ASH');
  assert.equal(ISIGMETFetcher.categorizePhenomenon(''), 'UNKNOWN');

  const now = new Date();
  const earlier = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const later = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

  const isigmets = [
    { id: 'A', fir: 'KZNY', phenomenon: 'TURBULENCE', validFrom: earlier, validTo: later },
    { id: 'B', fir: 'KZLA', phenomenon: 'ICING', validFrom: earlier, validTo: earlier }
  ];

  assert.equal(ISIGMETFetcher.filterByFIR(isigmets, 'kzny').length, 1);
  assert.equal(ISIGMETFetcher.filterByPhenomenon(isigmets, 'icing').length, 1);
  assert.equal(ISIGMETFetcher.filterValid(isigmets).length, 1);
});

sequentialTest('normalizeBoundingBox and validation helpers enforce expected formats', () => {
  assert.equal(ISIGMETFetcher.normalizeBoundingBox([-10, 20, 30, 40]), '-10,20,30,40');
  assert.equal(ISIGMETFetcher.normalizeBoundingBox('-10,20,30,40'), '-10,20,30,40');
  assert.equal(ISIGMETFetcher.normalizeBoundingBox('invalid'), null);
  assert.equal(ISIGMETFetcher.normalizeBoundingBox([1, 2, 3]), null);

  assert.equal(ISIGMETFetcher.isBoundingBoxStringValid('-10,20,30,40'), true);
  assert.equal(ISIGMETFetcher.isBoundingBoxStringValid('200,20,30,40'), false);
  assert.equal(ISIGMETFetcher.isBoundingBoxStringValid(null), false);
});

sequentialTest('getCacheStats reports International SIGMET cache metrics', () => {
  const keysStub = mock.method(TTLCache, 'keys', () => ['isigmet:bounded', 'something']);
  const statsStub = mock.method(TTLCache, 'getStats', () => ({ keys: 2, hits: 1, misses: 1 }));

  const stats = ISIGMETFetcher.getCacheStats();
  assert.equal(stats.totalIsigmetKeys, 1);
  assert.deepEqual(stats.overallCacheStats, { keys: 2, hits: 1, misses: 1 });

  keysStub.mock.restore();
  statsStub.mock.restore();
});
