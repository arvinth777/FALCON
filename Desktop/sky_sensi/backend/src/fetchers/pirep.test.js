const { test, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';

const TTLCache = require('../cache/ttlCache');
const awcClientModule = require('../utils/awcClient');

const makeRequestStub = mock.method(awcClientModule, 'makeRequest', async () => {
  throw new Error('makeRequest stub not configured');
});

const PIREPFetcher = require('./pirep');

const sequentialTest = (name, fn) => test(name, { concurrency: false }, fn);

const SAMPLE_PIREP = {
  pirepId: 'P-123',
  lat: '40.0',
  lon: '-70.0',
  fltlvl: 'FL180',
  acType: 'B738',
  reportType: 'UUA',
  rawOb: 'UA /OV BOS/TM 1200/FL180/TP B738/TB MOD CHOP 27030KT/RM TEST',
  obsTime: '2024-04-01T00:00:00Z'
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

sequentialTest('fetchPIREP returns empty array for invalid bounding box input', async () => {
  const result = await PIREPFetcher.fetchPIREP('invalid');
  assert.deepEqual(result, []);
});

sequentialTest('fetchPIREP returns cached data when available', async () => {
  const bbox = '-120,30,-110,35';
  const cacheKey = `pirep:${bbox}`;
  const cached = [{ id: 'cached-pirep' }];

  ttlGetStub.mock.mockImplementation(key => (key === cacheKey ? cached : undefined));

  const result = await PIREPFetcher.fetchPIREP(bbox);

  assert.deepEqual(result, cached);
  assert.equal(ttlSetStub.mock.callCount(), 0);
});

sequentialTest('fetchPIREP normalizes records and caches results with default TTL', async () => {
  makeRequestStub.mock.mockImplementation(async () => ({
    status: 200,
    data: [
      SAMPLE_PIREP,
      { ...SAMPLE_PIREP, pirepId: 'P-456', fltlvl: '050', lat: 39.5, lon: -71.2 }
    ]
  }));

  const results = await PIREPFetcher.fetchPIREP('-120,30,-110,35');

  assert.equal(results.length, 2);
  const first = results[0];
  assert.equal(first.id, 'P-123');
  assert.equal(first.type, 'TURBULENCE');
  assert.equal(first.intensity, 'MODERATE');
  assert.equal(first.fl, 180);
  assert.equal(first._legacy.altitudeFt, 18000);
  assert.ok(first.time.endsWith('Z'));

  assert.equal(ttlSetStub.mock.callCount(), 1);
  const [, cachedValue, ttl] = ttlSetStub.mock.calls[0].arguments;
  assert.equal(cachedValue.length, 2);
  assert.equal(ttl, 300);
});

sequentialTest('fetchPIREP caches empty results when upstream responds 204', async () => {
  makeRequestStub.mock.mockImplementation(async () => ({ status: 204 }));

  const results = await PIREPFetcher.fetchPIREP('-120,30,-110,35');

  assert.deepEqual(results, []);
  assert.equal(ttlSetStub.mock.callCount(), 1);
  const [, cachedValue, ttl] = ttlSetStub.mock.calls[0].arguments;
  assert.deepEqual(cachedValue, []);
  assert.equal(ttl, 300);
});

sequentialTest('fetchPIREP retries after 429 and returns normalized data', async () => {
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
        data: [SAMPLE_PIREP]
      };
    }
    throw new Error(`Unexpected attempt ${attempt}`);
  });

  const backoffStub = mock.method(PIREPFetcher, 'exponentialBackoff', async () => undefined);

  const results = await PIREPFetcher.fetchPIREP('-120,30,-110,35');

  assert.equal(attempt, 2);
  assert.equal(results.length, 1);

  backoffStub.mock.restore();
});

sequentialTest('parseAltitude handles flight levels and hundreds of feet', () => {
  assert.deepEqual(PIREPFetcher.parseAltitude('FL250'), { value: 25000, type: 'FL', feet: 25000 });
  assert.deepEqual(PIREPFetcher.parseAltitude('050'), { value: 5000, type: 'MSL', feet: 5000 });
  assert.equal(PIREPFetcher.parseAltitude('UKN'), null);
});

sequentialTest('categorizePhenomenon and intensity helpers detect conditions', () => {
  const rawText = 'TB MOD CHOP ICE RIME TSTM RAIN WIND GUST';
  const phenomena = PIREPFetcher.categorizePhenomenon(rawText);
  assert.ok(phenomena.includes('TURBULENCE'));
  assert.ok(phenomena.includes('ICING'));
  assert.ok(phenomena.includes('CONVECTIVE'));
  assert.ok(phenomena.includes('PRECIPITATION'));
  assert.ok(phenomena.includes('WIND'));

  assert.equal(PIREPFetcher.extractIntensity('SEVERE TURB'), 'SEVERE');
  assert.equal(PIREPFetcher.extractIntensity('MOD ICE'), 'MODERATE');
  assert.equal(PIREPFetcher.extractIntensity('LIGHT RAIN'), 'LIGHT');
  assert.equal(PIREPFetcher.extractIntensity('TRACE ICE'), 'TRACE');
  assert.equal(PIREPFetcher.extractIntensity('SMOOTH'), 'SMOOTH');
});

sequentialTest('convertToFlightLevel infers from altitude structures', () => {
  assert.equal(PIREPFetcher.convertToFlightLevel({ feet: 18000 }), 180);
  assert.equal(PIREPFetcher.convertToFlightLevel(null, 'FL200'), 200);
  assert.equal(PIREPFetcher.convertToFlightLevel(null, '050'), 50);
  assert.equal(PIREPFetcher.convertToFlightLevel(null, 'UNKNOWN'), null);
});

sequentialTest('getPrimaryPhenomenon prioritizes turbulence and icing', () => {
  assert.equal(PIREPFetcher.getPrimaryPhenomenon(['ICING', 'TURBULENCE']), 'TURBULENCE');
  assert.equal(PIREPFetcher.getPrimaryPhenomenon(['PRECIPITATION']), 'PRECIPITATION');
  assert.equal(PIREPFetcher.getPrimaryPhenomenon([]), 'OTHER');
});

sequentialTest('normalizePirepRecord filters malformed entries', () => {
  assert.equal(PIREPFetcher.normalizePirepRecord(null), null);
  assert.equal(PIREPFetcher.normalizePirepRecord({}), null);
  assert.equal(PIREPFetcher.normalizePirepRecord({ lat: 100, lon: 0 }), null);

  const normalized = PIREPFetcher.normalizePirepRecord(SAMPLE_PIREP);
  assert.equal(normalized.id, SAMPLE_PIREP.pirepId);
  assert.equal(normalized.lat, 40);
  assert.equal(normalized.lon, -70);
  assert.equal(normalized.type, 'TURBULENCE');
  assert.equal(normalized._legacy.altitudeFt, 18000);
  assert.equal(normalized._legacy.phenomenonText.includes('TURBULENCE'), true);
});

sequentialTest('filter helpers select by phenomenon and time range', () => {
  const now = Date.now();
  const recent = new Date(now - 60 * 60 * 1000).toISOString();
  const old = new Date(now - 8 * 60 * 60 * 1000).toISOString();

  const pireps = [
    { type: 'TURBULENCE', phenomenon: ['TURBULENCE'], time: recent },
    { type: 'ICING', phenomenon: ['ICING'], time: old }
  ];

  assert.equal(PIREPFetcher.filterByPhenomenon(pireps, 'turbulence').length, 1);
  assert.equal(PIREPFetcher.filterByAge(pireps, 6).length, 1);
});

sequentialTest('normalizeBoundingBox and getCacheStats behave as expected', () => {
  assert.equal(PIREPFetcher.normalizeBoundingBox([-120, 30, -110, 35]), '-120,30,-110,35');
  assert.equal(PIREPFetcher.normalizeBoundingBox('invalid'), null);
  assert.equal(PIREPFetcher.normalizeBoundingBox('1,2,3,4'), '1,2,3,4');

  const keysStub = mock.method(TTLCache, 'keys', () => ['pirep:foo', 'other']);
  const statsStub = mock.method(TTLCache, 'getStats', () => ({ keys: 2, hits: 1, misses: 1 }));

  const stats = PIREPFetcher.getCacheStats();
  assert.equal(stats.totalPirepKeys, 1);
  assert.deepEqual(stats.overallCacheStats, { keys: 2, hits: 1, misses: 1 });

  keysStub.mock.restore();
  statsStub.mock.restore();
});
