const METARFetcher = safeRequire('../fetchers/metar', () => ({
  fetchMETAR: async () => [],
  fetchMETARChunk: async () => [],
  validateICAOCodes: () => []
}));

const TAFFetcher = safeRequire('../fetchers/taf', () => ({
  fetchTAF: async () => [],
  fetchSingleTAF: async () => null,
  compareForecastVsActual: () => null,
  compareVisibility: () => false,
  compareCeiling: () => false,
  compareWeatherPhenomena: () => false,
  compareWind: () => false,
  normalizeMetarVisibility: visibility => {
    if (visibility === null || visibility === undefined) {
      return null;
    }
    if (typeof visibility === 'number') {
      return visibility;
    }
    const parsed = parseFloat(String(visibility));
    return Number.isFinite(parsed) ? parsed : null;
  },
  extractWindFromMetar: () => null,
  extractCeilingFromClouds: () => null
}));

const PIREPFetcher = safeRequire('../fetchers/pirep', () => ({
  fetchPIREP: async () => [],
  filterByAge: () => [],
  categorizePhenomenon: () => []
}));

const SIGMETFetcher = safeRequire('../fetchers/sigmet', () => ({
  fetchSIGMET: async () => [],
  filterValid: () => [],
  categorizePhenomenon: () => 'UNKNOWN'
}));

const ISIGMETFetcher = safeRequire('../fetchers/isigmet', () => ({
  fetchISIGMET: async () => [],
  filterValid: () => [],
  categorizePhenomenon: () => 'UNKNOWN'
}));
const openMeteoService = safeRequire('./openMeteoService', () => ({
  getAviationBriefing: async () => null
}));
const BoundingBox = require('../utils/bbox');
const geminiService = require('./geminiService');
const ReliabilityCalculator = require('../utils/reliabilityCalculator');
const { normalizeTimestamp, normalizeTimestampFields } = require('../utils/timestampUtils');
const { isValidGeometry } = require('../utils/geo');
const { limitConcurrency } = require('../utils/awcClient');
const { buildRouteCorridor, filterGeoJSONByPolygon } = require('../utils/corridor');
const { summarizeCorridor } = require('../utils/corridorSummary');
const { ensureFeatureCollection } = require('../utils/geojson');

const FILTER_SIGMETS_BY_BBOX = process.env.FILTER_SIGMETS_BY_BBOX === 'true';

const VALID_FLIGHT_CATEGORIES = new Set(['VFR', 'MVFR', 'IFR', 'LIFR', 'UNKNOWN']);

const sanitizeNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeFlightCategory = (category) => {
  if (!category) {
    return 'UNKNOWN';
  }
  const normalized = String(category).toUpperCase();
  return VALID_FLIGHT_CATEGORIES.has(normalized) ? normalized : 'UNKNOWN';
};

const normalizeWindSnapshot = (wind) => {
  if (!wind || typeof wind !== 'object') {
    return { dir: null, spd: null, gst: null };
  }

  const dir = typeof wind.dir === 'number'
    ? wind.dir
    : (typeof wind.direction === 'number' ? wind.direction : null);

  return {
    dir,
    spd: sanitizeNumber(wind.spd ?? wind.speed),
    gst: sanitizeNumber(wind.gst ?? wind.gust)
  };
};

function safeRequire(modulePath, fallbackFactory) {
  try {
    return require(modulePath);
  } catch (error) {
    console.warn(`Optional module '${modulePath}' not loaded: ${error.message}`);
    return fallbackFactory();
  }
}

class BriefingService {
  /**
   * Get comprehensive weather briefing for a route
   * @param {string} icaoCsv - Comma-separated ICAO codes (e.g., "KLAX,KSFO,KPHX")
   * @returns {Promise<object>} Complete briefing data
   */
  static async getBriefing(icaoCsv) {
    try {
      console.log(`Starting briefing generation for route: ${icaoCsv}`);
      
      // Parse and validate ICAO codes
      const icaoCodes = this.parseAndValidateICAOs(icaoCsv);
      if (icaoCodes.length === 0) {
        throw new Error('No valid ICAO codes provided');
      }

      // Step 1: Fetch airport data in parallel
      console.log('Fetching airport data (METAR & TAF)...');

      const [metarData, tafData] = await Promise.all([
        METARFetcher.fetchMETAR(icaoCodes),
        TAFFetcher.fetchTAF(icaoCodes)
      ]);

      // Step 2: Extract coordinates and calculate bounding box
      console.log('Calculating route bounding box...');
      const coordinates = this.extractCoordinates(metarData);
      let bbox = null;
      let pirepData = [];
    let sigmetData = [];
    let isigmetData = [];
    let isigmetFC = null;
    let isigmetFilterStats = { before: 0, after: 0 };
    let corridor = null;

      if (coordinates.length > 0) {
        bbox = BoundingBox.calculateAndFormat(coordinates);
        console.log(`Route bounding box: ${bbox}`);

        // Step 2.5: Build route corridor if we have coordinates with lat/lon
        const airportsWithCoords = coordinates.map(coord => ({
          lat: coord.lat,
          lon: coord.lon,
          icao: coord.icao
        }));

        if (airportsWithCoords.length >= 2) {
          try {
            const corridorPolygon = buildRouteCorridor(airportsWithCoords, { widthNm: 100, sampleNm: 20 });
            corridor = {
              widthNm: 100,
              polygon: corridorPolygon
            };
            console.log('Route corridor generated successfully');
          } catch (error) {
            console.warn('Failed to build route corridor, falling back to bounding box:', error.message);
            corridor = null;
          }
        }

        // Step 3: Fetch hazard data in parallel (now that we have coordinates)
        console.log('Fetching hazard data (PIREP, SIGMET, ISIGMET)...');
        const [fetchedPirep, fetchedSigmet, fetchedIsigmet] = await Promise.all([
          PIREPFetcher.fetchPIREP(bbox),
          SIGMETFetcher.fetchSIGMET(bbox),
          ISIGMETFetcher.fetchISIGMET(bbox)
        ]);

        // Assign the fetched data to the pre-declared variables
        pirepData = fetchedPirep;
        sigmetData = fetchedSigmet;
        isigmetFC = fetchedIsigmet;

        // Extract features from ISIGMET FeatureCollection and convert to old format for compatibility
        isigmetData = (isigmetFC?.features || []).map(feature => ({
          ...feature.properties,
          geometry: feature.geometry,
          id: feature.id
        }));

        isigmetFilterStats.before = isigmetData.length;

        // Step 3.5: Apply corridor filtering if available
        if (corridor && corridor.polygon) {
        try {
            console.log('Applying corridor filtering...');
            console.log(`SIGMETs before corridor filtering: ${sigmetData.length}`);
            console.log(`ISIGMETs before corridor filtering: ${isigmetData.length}`);
            console.log(`PIREPs before corridor filtering: ${pirepData.length}`);

            // Convert to GeoJSON for filtering
            const sigmetGeoJSON = { type: 'FeatureCollection', features: sigmetData };
            // Use the normalized ISIGMET FeatureCollection directly
            const isigmetGeoJSON = isigmetFC || { type: 'FeatureCollection', features: [] };

            // Filter by corridor
            const filteredSigmetGeoJSON = filterGeoJSONByPolygon(sigmetGeoJSON, corridor.polygon);
            const filteredIsigmetGeoJSON = filterGeoJSONByPolygon(isigmetGeoJSON, corridor.polygon);

            // Filter PIREPs by corridor (convert to GeoJSON)
            const pirepGeoJSON = {
              type: 'FeatureCollection',
              features: pirepData.map(pirep => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [pirep.lon, pirep.lat] },
                properties: pirep
              }))
            };
            const filteredPirepGeoJSON = filterGeoJSONByPolygon(pirepGeoJSON, corridor.polygon);

            // Check if corridor filtering removed everything - if so, fall back to original data
            const corridorSigmetCount = filteredSigmetGeoJSON.features.length;
            const corridorIsigmetCount = filteredIsigmetGeoJSON.features.length;
            const corridorPirepCount = filteredPirepGeoJSON.features.length;

            const originalTotal = sigmetData.length + isigmetData.length + pirepData.length;
            const filteredTotal = corridorSigmetCount + corridorIsigmetCount + corridorPirepCount;

            // If corridor filtering removed more than 90% of hazards, fall back to bounding box filtering
            if (originalTotal > 0 && (filteredTotal / originalTotal) < 0.1) {
              console.warn('Corridor filtering too restrictive, falling back to bounding box filtering');
              // Keep original data (already filtered by bounding box)
              // isigmetFC is already set to the original normalized FeatureCollection
            } else {
              // Apply corridor filtered results
              sigmetData = filteredSigmetGeoJSON.features;
              isigmetData = filteredIsigmetGeoJSON.features.map(feature => feature.properties);
              isigmetFC = filteredIsigmetGeoJSON; // Update the FeatureCollection too
              pirepData = filteredPirepGeoJSON.features.map(feature => feature.properties);
            }

            console.log(`SIGMETs after corridor filtering: ${sigmetData.length}`);
            console.log(`ISIGMETs after corridor filtering: ${isigmetData.length}`);
            console.log(`PIREPs after corridor filtering: ${pirepData.length}`);
          } catch (error) {
            console.warn('Corridor filtering failed, using original data:', error.message);
          }
        }

        // Apply bounding box filtering
        const bboxInfo = this.parseBoundingBox(bbox);
        if (bboxInfo) {
          const bboxSegments = Array.isArray(bboxInfo.segments) ? bboxInfo.segments : [];
          console.log('ISIGMETs before bbox filtering:', isigmetData.length);
          if (FILTER_SIGMETS_BY_BBOX) {
            console.log('SIGMETs before bbox filtering:', sigmetData.length);
            sigmetData = this.filterHazardsByBBox(sigmetData, bboxInfo);
            console.log('SIGMETs after bbox filtering:', sigmetData.length);
          }
          // Use lenient ISIGMET bounding box filtering for better coverage
          console.log('ISIGMETs before bbox filtering:', isigmetData.length);
          // For ISIGMETs, use a much more lenient filtering approach
          // since they often cover very large areas
          const filteredISIGMETs = isigmetData; // Keep all for now to test frontend
          console.log('ISIGMETs after bbox filtering:', filteredISIGMETs.length, '(lenient filtering)');

          const clampTarget = bboxInfo.isDatelineWrapped ? null : bboxSegments[0];
          isigmetData = filteredISIGMETs.map(isigmet => ({
            ...isigmet,
            clippedGeometry: isigmet.geometry && clampTarget
              ? this.clampGeometryToBBox(isigmet.geometry, clampTarget)
              : isigmet.geometry || null
          }));

          // Update the FeatureCollection to match the filtered data
          if (isigmetFC) {
            const filteredIds = new Set(isigmetData.map(item => item.id));
            isigmetFC = {
              type: 'FeatureCollection',
              features: isigmetFC.features.filter(feature => filteredIds.has(feature.id))
            };
          }

          isigmetFilterStats.after = isigmetData.length;
        } else {
          isigmetFilterStats.after = isigmetFilterStats.before;
        }
    } else {
      console.warn('No coordinates available - skipping hazard data fetch');
    }

      // Step 4: Process and normalize data
      console.log('Processing and normalizing data...');
      const processedData = this.processAndNormalize({
        icaoCodes,
        metarData,
        tafData,
        pirepData,
        sigmetData,
        isigmetFC,
        isigmetData,
        bbox,
        isigmetFilterStats,
        corridor
      });

      // Step 5: Integrate Open-Meteo data when coordinates are available
      try {
        const openMeteoForecasts = await this.fetchOpenMeteoForecasts(processedData.airports);
        processedData.openMeteoForecasts = openMeteoForecasts;
      } catch (error) {
        console.warn('Open-Meteo integration failed:', error.message);
        processedData.openMeteoForecasts = {};
      }

      // Step 6: Generate AI insights if available
      console.log('Generating AI briefing insights...');
      try {
        const [aiSummary, aiAlerts, aiAltitude] = await Promise.all([
          geminiService.generateBriefingSummary(processedData),
          geminiService.generateAlerts(processedData),
          geminiService.recommendAltitude(processedData)
        ]);

        processedData.aiSummary = {
          routeSummary: aiSummary.routeSummary,
          keyFindings: aiSummary.keyFindings,
          overallConditions: aiSummary.overallConditions,
          confidence: aiSummary.confidence,
          alerts: aiAlerts,
          altitudeRecommendation: aiAltitude,
          generatedAt: new Date().toISOString()
        };

        console.log('AI insights successfully integrated');
      } catch (error) {
        console.warn('AI insights generation failed, continuing without:', error.message);
        processedData.aiSummary = {
          routeSummary: `Route ${icaoCodes.join(',')} - AI analysis unavailable`,
          keyFindings: ['AI analysis temporarily unavailable - manual review recommended'],
          overallConditions: 'UNKNOWN',
          confidence: 'LOW',
          alerts: [],
          altitudeRecommendation: {
            recommendedAltitude: 8000,
            rationale: 'Standard altitude - AI analysis unavailable',
            confidence: 'LOW'
          },
          generatedAt: new Date().toISOString()
        };
      }

    const normalizedResponse = this.normalizeResponseTimestamps(processedData);

    console.log(`Briefing generation completed for ${icaoCodes.length} airports`);
    return normalizedResponse;

    } catch (error) {
      console.error('Briefing service error:', error.message);
      throw error;
    }
  }

  /**
   * Parse and validate ICAO codes from CSV string
   * @param {string} icaoCsv - Comma-separated ICAO codes
   * @returns {Array} Array of valid uppercase ICAO codes
   */
  static parseAndValidateICAOs(icaoCsv) {
    if (!icaoCsv || typeof icaoCsv !== 'string') {
      return [];
    }

    // Split by comma, trim whitespace, filter valid codes
    const codes = icaoCsv.split(',')
      .map(code => code.trim().toUpperCase())
      .filter(code => code.length === 4 && /^[A-Z]{4}$/.test(code))
      .filter((code, index, arr) => arr.indexOf(code) === index); // Remove duplicates

    return codes;
  }

  /**
   * Extract coordinates from METAR data
   * @param {Array} metarData - Array of METAR objects
   * @returns {Array} Array of coordinate objects {lat, lon}
   */
  static extractCoordinates(metarData) {
    return metarData
      .filter(metar => metar.lat && metar.lon)
      .map(metar => ({
        lat: metar.lat,
        lon: metar.lon,
        icao: metar.icao
      }));
  }

  /**
   * Process and normalize all weather data
   * @param {object} data - Raw weather data from all sources
   * @returns {object} Normalized briefing response
   */
  static processAndNormalize(data) {
    const { icaoCodes, metarData, tafData, pirepData, sigmetData, bbox, isigmetFilterStats, corridor, isigmetFC } = data;
    let { isigmetData } = data;

    const filterStats = isigmetFilterStats || {
      before: Array.isArray(isigmetData) ? isigmetData.length : 0,
      after: Array.isArray(isigmetData) ? isigmetData.length : 0
    };

    let validationDrops = 0;
    if (Array.isArray(isigmetData)) {
      const validatedISIGMETs = isigmetData.filter(entry => {
        const isValid = this.validateISIGMETEntry(entry);
        if (!isValid) {
          validationDrops += 1;
          console.warn('Removing malformed ISIGMET entry:', {
            id: entry?.id,
            type: entry?.type,
            phenomenon: entry?.phenomenon
          });
        }
        return isValid;
      });
      isigmetData = validatedISIGMETs;
    }

    // Create lookup maps for easier access
    const metarsByIcao = {};
    const tafsByIcao = {};

    metarData.forEach(metar => {
      metarsByIcao[metar.icao] = metar;
    });

    tafData.forEach(taf => {
      tafsByIcao[taf.icao] = taf;
    });

    // Build airports array with combined data and forecast comparisons
    const airports = icaoCodes.map(icao => {
      const metar = metarsByIcao[icao];
      const taf = tafsByIcao[icao];
      
      let forecastComparison = null;
      let tafForecasts = [];
      let flightTimeline = [];

      if (metar && taf) {
        forecastComparison = this.calculateForecastReliability(taf, metar);
      }
      
      const rawTafBlocks = Array.isArray(taf?.forecastBlocks) ? taf.forecastBlocks : [];

      if (rawTafBlocks.length > 0) {
        // Ensure every returned block has ISO UTC start and end
        const toISO = (t) => {
          const ms = typeof t === 'number' ? t * 1000 : Date.parse(t);
          return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
        };

        tafForecasts = rawTafBlocks.map((block, index) => {
          const normalizedBlock = normalizeTimestampFields(block, ['validFrom', 'validTo', 'startTime', 'endTime', 'start', 'end'], {
            context: `TAF:${taf.icao}.forecastBlocks[${index}]`
          });

          const derivedStart = normalizeTimestamp(block.start ?? block.startTime ?? block.validFrom, {
            context: `TAF:${taf.icao}.forecastBlocks[${index}].start`
          }) ?? normalizedBlock.start ?? normalizedBlock.startTime ?? normalizedBlock.validFrom ?? null;

          const derivedEnd = normalizeTimestamp(block.end ?? block.endTime ?? block.validTo, {
            context: `TAF:${taf.icao}.forecastBlocks[${index}].end`
          }) ?? normalizedBlock.end ?? normalizedBlock.endTime ?? normalizedBlock.validTo ?? null;

          return {
            ...normalizedBlock,
            start: toISO(derivedStart),
            end: toISO(derivedEnd),
            startTime: derivedStart,
            endTime: derivedEnd,
            validFrom: derivedStart,
            validTo: derivedEnd,
            category: normalizeFlightCategory(block.category ?? block.flightCategory),
            visibilitySM: sanitizeNumber(block.visibilitySM ?? block.visibility),
            ceilingFT: sanitizeNumber(block.ceilingFT ?? block.ceilingFt ?? block.ceiling),
            wind: normalizeWindSnapshot(block.wind)
          };
        });

        flightTimeline = tafForecasts
          .map(block => {
            if (!block.start || !block.end) {
              return null;
            }

            return {
              start: block.start,
              end: block.end,
              category: block.category
            };
          })
          .filter(Boolean);
      }

      if (!Array.isArray(flightTimeline)) {
        flightTimeline = [];
      }

      const normalizedTafTimes = taf
        ? normalizeTimestampFields(taf, ['issueTime', 'validTimeFrom', 'validTimeTo', 'bulletinTime'], {
            context: `TAF:${taf.icao}`
          })
        : null;

      const tafSummary = taf ? {
        icao: taf.icao,
        issueTime: normalizedTafTimes?.issueTime,
        validTimeFrom:
          normalizeTimestamp(taf.validTimeFrom ?? taf.forecastBlocks?.[0]?.start ?? taf.forecastBlocks?.[0]?.startTime, {
            context: `TAF:${taf.icao}.summary.validFrom`
          }) ?? normalizedTafTimes?.validTimeFrom ??
            (tafForecasts?.[0]?.start
              ? normalizeTimestamp(tafForecasts[0].start, {
                  context: `TAF:${taf.icao}.summary.startTime`
                })
              : null),
        validTimeTo:
          normalizeTimestamp(taf.validTimeTo ?? taf.forecastBlocks?.[taf.forecastBlocks.length - 1]?.end ?? taf.forecastBlocks?.[taf.forecastBlocks.length - 1]?.endTime, {
            context: `TAF:${taf.icao}.summary.validTo`
          }) ?? normalizedTafTimes?.validTimeTo ??
            (tafForecasts?.[tafForecasts.length - 1]?.end
              ? normalizeTimestamp(tafForecasts[tafForecasts.length - 1].end, {
                  context: `TAF:${taf.icao}.summary.endTime`
                })
              : null),
        rawTAF: taf.rawTAF,
        forecastBlocks: tafForecasts,
        blocks: tafForecasts,
        currentBlock: taf.currentBlock,
        currentBlockIndex: typeof taf.currentBlockIndex === 'number'
          ? taf.currentBlockIndex
          : (Array.isArray(taf.forecastBlocks) && taf.currentBlock
              ? taf.forecastBlocks.indexOf(taf.currentBlock)
              : -1)
      } : {
        icao,
        issueTime: null,
        validTimeFrom: null,
        validTimeTo: null,
        rawTAF: null,
        forecastBlocks: [],
        blocks: [],
        currentBlock: null,
        currentBlockIndex: -1
      };

      // Always set airport.taf and airport.flightTimeline, never throw if blocks empty
      const finalTafSummary = tafSummary || {
        icao,
        issueTime: null,
        validTimeFrom: null,
        validTimeTo: null,
        rawTAF: null,
        forecastBlocks: [],
        blocks: [],
        currentBlock: null,
        currentBlockIndex: -1
      };

      finalTafSummary.blocks = tafForecasts;
      finalTafSummary.flightTimeline = flightTimeline;

      return {
        icao,
        icaoCode: icao,
        name: metar ? metar.name : null,
        coordinates: metar ? { lat: metar.lat, lon: metar.lon } : null,
        latitude: metar?.lat,
        longitude: metar?.lon,
        flightCategory: metar?.flightCategory,
        hasMetar: !!metar,
        hasTaf: !!taf,
        taf: finalTafSummary,
        tafForecasts,
        flightTimeline,
        forecastComparison,
        forecastVsActual: forecastComparison
      };
    });

    // Filter and categorize hazards
    console.log('PIREPs before validation:', pirepData.length);
    const { valid: validatedPireps, dropped: droppedPireps } = this.filterValidPIREPs(pirepData);
    console.log('PIREPs after validation:', validatedPireps.length);

    const recentPireps = PIREPFetcher.filterByAge(validatedPireps, 3);

    const hazards = {
      pireps: {
        total: validatedPireps.length,
        byType: this.categorizePIREPs(validatedPireps),
        recent: recentPireps,
        validation: {
          dropped: droppedPireps
        }
      },
      sigmets: {
        total: sigmetData.length,
        active: SIGMETFetcher.filterValid(sigmetData),
        byType: this.categorizeSIGMETs(sigmetData)
      },
      isigmets: {
        total: isigmetData.length,
        active: ISIGMETFetcher.filterValid(isigmetData),
        byType: this.categorizeISIGMETs(isigmetData),
        filtering: {
          beforeFilterCount: filterStats.before,
          afterFilterCount: filterStats.after,
          validationDropped: validationDrops
        }
      }
    };

    // Generate corridor summary
    let corridorSummary = null;
    if (corridor) {
      try {
        corridorSummary = summarizeCorridor({
          airports: airports,
          metarsByIcao: metarsByIcao,
          sigmets: { type: 'FeatureCollection', features: hazards.sigmets.active },
          isigmets: { type: 'FeatureCollection', features: hazards.isigmets.active },
          pireps: hazards.pireps.recent
        });
        console.log('Corridor summary generated successfully');
      } catch (error) {
        console.warn('Failed to generate corridor summary:', error.message);
        corridorSummary = null;
      }
    }

    // Build response
    const response = {
      generatedAt: new Date().toISOString(),
      route: icaoCodes.join(','),
      boundingBox: bbox,
      airports,
      metarsByIcao,
      tafsByIcao,
      hazards,
      // Add root-level arrays for frontend compatibility
      sigmets: hazards.sigmets.active,
      isigmets: ensureFeatureCollection(isigmetFC), // ALWAYS a FeatureCollection, never null
      pireps: hazards.pireps.recent,
      weatherAlerts: hazards.sigmets.active.concat(hazards.isigmets.active),
      windsAloft: [], // Empty for now, can be populated later
      rawData: {
        pireps: validatedPireps,
        sigmets: sigmetData,
        isigmets: isigmetData
      },
      summary: {
        airportsWithData: airports.filter(a => a.hasMetar).length,
  totalHazards: validatedPireps.length + sigmetData.length + isigmetData.length,
        activeWarnings: hazards.sigmets.active.length + hazards.isigmets.active.length,
        pirepValidation: {
          total: pirepData.length,
          validated: validatedPireps.length,
          dropped: droppedPireps
        },
        isigmetFiltering: {
          beforeFilterCount: filterStats.before,
          afterFilterCount: filterStats.after,
          validationDropped: validationDrops
        }
      }
    };

    // Add corridor data if available
    if (corridor) {
      response.corridor = corridor;
    }
    if (corridorSummary) {
      response.corridorSummary = corridorSummary;
    }

    return response;
  }

  static async fetchOpenMeteoForecasts(airports) {
    if (!Array.isArray(airports) || airports.length === 0) {
      return {};
    }

    const airportsWithCoordinates = airports.filter(airport => {
      const latitude = airport?.latitude ?? airport?.coordinates?.lat;
      const longitude = airport?.longitude ?? airport?.coordinates?.lon;
      return Number.isFinite(latitude) && Number.isFinite(longitude);
    });

    if (airportsWithCoordinates.length === 0) {
      return {};
    }

    const forecastTasks = airportsWithCoordinates.map(airport => {
      const icao = (airport?.icao || airport?.icaoCode || airport?.identifier || '').toUpperCase();
      const latitude = airport?.latitude ?? airport?.coordinates?.lat;
      const longitude = airport?.longitude ?? airport?.coordinates?.lon;

      return async () => {
        if (!icao || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return null;
        }

        try {
          const forecast = await openMeteoService.getAviationBriefing(latitude, longitude, 5);
          return {
            icao,
            forecast,
            metadata: {
              fetchedAt: new Date().toISOString(),
              latitude,
              longitude,
              source: 'Open-Meteo'
            }
          };
        } catch (error) {
          console.warn(`Open-Meteo fetch failed for ${icao}:`, error.message);
          return {
            icao,
            error: error.message,
            metadata: {
              latitude,
              longitude,
              source: 'Open-Meteo'
            }
          };
        }
      };
    });

    const results = await limitConcurrency(forecastTasks, 3);

    return results.reduce((acc, entry) => {
      if (!entry || !entry.icao) {
        return acc;
      }

      if (entry.forecast) {
        acc[entry.icao] = {
          forecast: entry.forecast,
          metadata: entry.metadata
        };
      } else if (entry.error) {
        acc[entry.icao] = {
          error: entry.error,
          metadata: entry.metadata
        };
      }

      return acc;
    }, {});
  }

  static normalizeResponseTimestamps(payload, context = 'response') {
    if (payload === null || payload === undefined) {
      return payload;
    }

    if (Array.isArray(payload)) {
      return payload.map((item, index) =>
        this.normalizeResponseTimestamps(item, `${context}[${index}]`)
      );
    }

    if (payload instanceof Date) {
      const normalizedDate = normalizeTimestamp(payload, { context });
      return normalizedDate ?? payload.toISOString();
    }

    if (typeof payload !== 'object') {
      return payload;
    }

    const timestampKeyPattern = /(time(stamp)?|issued?|generated|valid|start|end|report|observed?|obs|expire|expires|expired|bulletin|effective|received|updated)(at|from|to|time|stamp)?$/;

    return Object.entries(payload).reduce((acc, [key, value]) => {
      const nextContext = `${context}.${key}`;

      if (Array.isArray(value) || (value && typeof value === 'object')) {
        acc[key] = this.normalizeResponseTimestamps(value, nextContext);
        return acc;
      }

      const shouldAttemptNormalization =
        (value instanceof Date || typeof value === 'string' || typeof value === 'number') &&
        timestampKeyPattern.test(key.toLowerCase());

      if (shouldAttemptNormalization) {
        const normalizedValue = normalizeTimestamp(value, { context: nextContext });
        acc[key] = normalizedValue ?? value;
        return acc;
      }

      acc[key] = value;
      return acc;
    }, Array.isArray(payload) ? [] : {});
  }

  /**
   * Calculate forecast vs actual reliability for an airport
   * @param {object} tafData - Parsed TAF data including current block
   * @param {object} metarData - Current METAR observation
   * @returns {object|null} Structured reliability information
   */
  static calculateForecastReliability(tafData, metarData) {
    if (!tafData || !metarData) {
      return null;
    }

    const forecastBlocks = Array.isArray(tafData.forecastBlocks) ? tafData.forecastBlocks : [];
    let currentBlock = tafData.currentBlock;

    if (!currentBlock && typeof tafData.currentBlockIndex === 'number' && forecastBlocks[tafData.currentBlockIndex]) {
      currentBlock = forecastBlocks[tafData.currentBlockIndex];
    }

    if (!currentBlock && forecastBlocks.length > 0) {
      currentBlock = forecastBlocks[0];
    }

    if (!currentBlock) {
      return null;
    }

    const comparisons = {};

    let forecastVisibility = null;
    if (currentBlock.visibility) {
      forecastVisibility = { ...currentBlock.visibility };
      if (!forecastVisibility.unit) {
        forecastVisibility.unit = 'SM';
      }
    } else if (typeof currentBlock.visibilitySM === 'number') {
      forecastVisibility = {
        unit: 'SM',
        value: currentBlock.visibilitySM
      };
    }

    const forecastVisibilityValue = forecastVisibility
      ? (ReliabilityCalculator.parseVisibility(forecastVisibility) ?? null)
      : null;

    const normalizeMetarVisibility = typeof TAFFetcher.normalizeMetarVisibility === 'function'
      ? TAFFetcher.normalizeMetarVisibility.bind(TAFFetcher)
      : null;
    const actualVisibilityRaw = normalizeMetarVisibility
      ? normalizeMetarVisibility(metarData.visibility)
      : (typeof metarData.visibility === 'number' ? metarData.visibility : null);
    const actualVisibility = Number.isFinite(actualVisibilityRaw) ? actualVisibilityRaw : null;

    if (forecastVisibility && actualVisibility !== null) {
      comparisons.visibility = {
        forecast: forecastVisibility,
        actual: actualVisibility,
        match: TAFFetcher.compareVisibility(forecastVisibility, actualVisibility)
      };
    }

    let forecastCeiling = null;
    if (currentBlock.ceiling && currentBlock.ceiling.altitude !== undefined) {
      const altitude = Number.isFinite(currentBlock.ceiling.altitude)
        ? currentBlock.ceiling.altitude
        : parseFloat(currentBlock.ceiling.altitude);

      if (Number.isFinite(altitude)) {
        forecastCeiling = {
          altitude,
          coverage: currentBlock.ceiling.coverage || 'BKN',
          unit: 'FT'
        };
      }
    }

    if (!forecastCeiling && typeof currentBlock.ceilingFt === 'number') {
      const inferredCoverage = Array.isArray(currentBlock.clouds)
        ? currentBlock.clouds.find(layer => layer && (layer.coverage === 'BKN' || layer.coverage === 'OVC'))?.coverage
        : null;

      forecastCeiling = {
        altitude: currentBlock.ceilingFt,
        coverage: inferredCoverage || 'BKN',
        unit: 'FT'
      };
    }

    const actualCeiling = this.extractMetarCeiling(metarData);

    if (forecastCeiling && actualCeiling) {
      comparisons.ceiling = {
        forecast: forecastCeiling,
        actual: actualCeiling,
        match: TAFFetcher.compareCeiling(forecastCeiling, actualCeiling)
      };
    }

    const forecastWeather = Array.isArray(currentBlock.weather) ? currentBlock.weather : [];
    const actualWeather = typeof metarData.presentWeather === 'string' ? metarData.presentWeather : '';

    if (forecastWeather.length > 0 || actualWeather) {
      comparisons.weather = {
        forecast: forecastWeather,
        actual: actualWeather,
        match: TAFFetcher.compareWeatherPhenomena(forecastWeather, actualWeather)
      };
    }

    const forecastWind = currentBlock.wind || null;
    const actualWind = typeof TAFFetcher.extractWindFromMetar === 'function'
      ? TAFFetcher.extractWindFromMetar(metarData)
      : (metarData.wind || null);

    if (forecastWind && actualWind) {
      comparisons.wind = {
        forecast: forecastWind,
        actual: actualWind,
        match: TAFFetcher.compareWind(forecastWind, actualWind)
      };
    }

    const hasComparisons = Object.keys(comparisons).length > 0;
    const comparisonPayload = hasComparisons ? {
      timestamp: new Date().toISOString(),
      icao: tafData.icao || metarData.icao || null,
      forecastBlock: currentBlock.type,
      comparisons
    } : null;

    const reliability = hasComparisons
      ? ReliabilityCalculator.calculateOverallReliability(comparisonPayload)
      : {
          score: 0,
          rating: 'UNKNOWN',
          confidence: 0,
          factors: []
        };

    const forecastVisibilityDisplay = Number.isFinite(forecastVisibilityValue)
      ? forecastVisibilityValue
      : (typeof currentBlock.visibilitySM === 'number' ? currentBlock.visibilitySM : null);

    const publicRating = reliability.rating === 'VERY_LOW' ? 'LOW' : reliability.rating;

    return {
      reliability: publicRating,
      score: reliability.score,
      confidence: reliability.confidence,
      vis: {
        taf: forecastVisibilityDisplay,
        metar: actualVisibility
      },
      ceiling: {
        taf: forecastCeiling ? forecastCeiling.altitude : null,
        metar: actualCeiling ? actualCeiling.altitude : null
      },
      weather: {
        taf: forecastWeather,
        metar: actualWeather
      },
      wind: {
        taf: forecastWind,
        metar: actualWind
      },
      factors: reliability.factors,
      comparisons,
      rawComparison: comparisonPayload
    };
  }

  /**
   * Extract METAR ceiling information for reliability comparisons
   * @param {object} metarData - METAR observation data
   * @returns {object|null} Ceiling information with coverage and altitude
   */
  static extractMetarCeiling(metarData) {
    if (!metarData || !Array.isArray(metarData.clouds)) {
      return null;
    }

    if (typeof TAFFetcher.extractCeilingFromClouds === 'function') {
      const adaptedLayers = metarData.clouds
        .map(layer => {
          if (!layer) {
            return null;
          }

          const coverage = layer.coverage || layer.cover || layer.skyCover || null;
          const altitudeValue = layer.altitude ?? layer.base ?? layer.cloudBaseFtAgl ?? null;
          const altitude = typeof altitudeValue === 'number'
            ? altitudeValue
            : altitudeValue !== null && !Number.isNaN(parseFloat(altitudeValue))
              ? parseFloat(altitudeValue)
              : null;

          if (!coverage || altitude === null) {
            return null;
          }

          return {
            cover: coverage,
            base: altitude
          };
        })
        .filter(Boolean);

      const ceiling = TAFFetcher.extractCeilingFromClouds(adaptedLayers);
      if (ceiling) {
        return {
          coverage: ceiling.cover || ceiling.coverage || null,
          altitude: ceiling.altitude ?? ceiling.base ?? null,
          unit: 'FT'
        };
      }
    }

    const ceilingLayers = metarData.clouds
      .map(layer => {
        if (!layer) {
          return null;
        }

        const coverage = layer.coverage || layer.cover || null;
        const altitudeValue = layer.altitude ?? layer.base ?? layer.cloudBaseFtAgl ?? null;
        const altitude = typeof altitudeValue === 'number'
          ? altitudeValue
          : altitudeValue !== null && !Number.isNaN(parseFloat(altitudeValue))
            ? parseFloat(altitudeValue)
            : null;

        if (!coverage || altitude === null) {
          return null;
        }

        return {
          coverage,
          altitude
        };
      })
      .filter(layer => layer && (layer.coverage === 'BKN' || layer.coverage === 'OVC'))
      .sort((a, b) => a.altitude - b.altitude);

    if (ceilingLayers.length === 0) {
      return null;
    }

    return {
      coverage: ceilingLayers[0].coverage,
      altitude: ceilingLayers[0].altitude,
      unit: 'FT'
    };
  }

  /**
   * Categorize PIREPs by phenomenon type
   * @param {Array} pireps - Array of PIREP objects
   * @returns {object} PIREPs categorized by type
   */
  static categorizePIREPs(pireps) {
    const categories = {
      turbulence: [],
      icing: [],
      clouds: [],
      precipitation: [],
      wind: [],
      convective: [],
      other: []
    };

    pireps.forEach(pirep => {
      if (!pirep || typeof pirep !== 'object') {
        return;
      }

      const categorySources = new Set();

      if (typeof pirep.type === 'string' && pirep.type.trim()) {
        categorySources.add(pirep.type.toUpperCase());
      }

      if (Array.isArray(pirep.phenomenon)) {
        pirep.phenomenon.forEach(item => {
          if (typeof item === 'string') {
            categorySources.add(item.toUpperCase());
          }
        });
      }

      if (Array.isArray(pirep._legacy?.phenomenon)) {
        pirep._legacy.phenomenon.forEach(item => {
          if (typeof item === 'string') {
            categorySources.add(item.toUpperCase());
          }
        });
      }

      if (categorySources.size === 0) {
        categories.other.push(pirep);
        return;
      }

      categorySources.forEach(phenomenon => {
        switch (phenomenon) {
          case 'TURBULENCE':
            categories.turbulence.push(pirep);
            break;
          case 'ICING':
            categories.icing.push(pirep);
            break;
          case 'CLOUDS':
            categories.clouds.push(pirep);
            break;
          case 'PRECIPITATION':
            categories.precipitation.push(pirep);
            break;
          case 'WIND':
            categories.wind.push(pirep);
            break;
          case 'CONVECTIVE':
            categories.convective.push(pirep);
            break;
          default:
            categories.other.push(pirep);
        }
      });
    });

    return categories;
  }

  /**
   * Categorize SIGMETs by phenomenon type
   * @param {Array} sigmets - Array of SIGMET objects
   * @returns {object} SIGMETs categorized by type
   */
  static categorizeSIGMETs(sigmets) {
    const categories = {};
    
    sigmets.forEach(sigmet => {
      const phenomenon = sigmet.phenomenon;
      if (!categories[phenomenon]) {
        categories[phenomenon] = [];
      }
      categories[phenomenon].push(sigmet);
    });

    return categories;
  }

  /**
   * Categorize International SIGMETs by phenomenon type
   * @param {Array} isigmets - Array of International SIGMET objects
   * @returns {object} International SIGMETs categorized by type
   */
  static categorizeISIGMETs(isigmets) {
    const categories = {};
    
    isigmets.forEach(isigmet => {
      const phenomenon = isigmet.phenomenon;
      if (!categories[phenomenon]) {
        categories[phenomenon] = [];
      }
      categories[phenomenon].push(isigmet);
    });

    return categories;
  }

  /**
   * Get briefing summary statistics
   * @param {string} icaoCsv - Comma-separated ICAO codes
   * @returns {Promise<object>} Summary statistics only
   */
  static async getBriefingSummary(icaoCsv) {
    try {
      const fullBriefing = await this.getBriefing(icaoCsv);
      
      return {
        generatedAt: fullBriefing.generatedAt,
        route: fullBriefing.route,
        summary: fullBriefing.summary,
        airports: fullBriefing.airports.map(airport => ({
          icao: airport.icao,
          name: airport.name,
          hasData: airport.hasMetar
        }))
      };
    } catch (error) {
      throw error;
    }
  }

    /**
     * Parse bounding box string into numeric limits
     * @param {string} bboxString - Bounding box string (minLon,minLat,maxLon,maxLat)
     * @returns {{minLon:number,maxLon:number,minLat:number,maxLat:number}|null}
     */
    static parseBoundingBox(bboxString) {
      if (!bboxString || typeof bboxString !== 'string') {
        return null;
      }

      const parts = bboxString.split(',').map(Number);
      if (parts.length !== 4 || parts.some(num => Number.isNaN(num))) {
        return null;
      }

      const [minLon, minLat, maxLon, maxLat] = parts;
      const isDatelineWrapped = minLon > maxLon;

      const segments = isDatelineWrapped
        ? [
            { minLon, minLat, maxLon: 180, maxLat },
            { minLon: -180, minLat, maxLon, maxLat }
          ]
        : [{ minLon, minLat, maxLon, maxLat }];

      return {
        original: { minLon, minLat, maxLon, maxLat },
        segments,
        isDatelineWrapped
      };
    }

    /**
     * Filter hazard entries based on bounding box intersection
     * @param {Array} hazards - Hazard objects with geometry
     * @param {object} bbox - Bounding box boundaries
     * @returns {Array} Filtered hazards
     */
    static filterHazardsByBBox(hazards, bboxInfo) {
      if (!Array.isArray(hazards) || !bboxInfo) {
        return hazards || [];
      }

      const segments = Array.isArray(bboxInfo.segments)
        ? bboxInfo.segments
        : [bboxInfo];

      if (segments.length === 0) {
        return hazards;
      }

      return hazards.filter(hazard => {
        if (!hazard || !hazard.geometry) {
          console.warn('Dropping hazard without geometry:', hazard?.id || hazard?.name || 'unknown');
          return false;
        }

        const geometry = hazard.geometry;
        if (!isValidGeometry(geometry)) {
          console.warn('Dropping hazard with invalid geometry:', {
            id: hazard.id,
            type: hazard.type,
            phenomenon: hazard.phenomenon
          });
          return false;
        }

        const geomBBox = this.calculateGeometryBounds(geometry);
        if (!geomBBox) {
          console.warn('Unable to compute geometry bounds for hazard:', hazard.id || hazard.type);
          return false;
        }

        const intersectsAny = segments.some(segment => this.geometryIntersectsBBox(geometry, segment, geomBBox));
        if (!intersectsAny) {
          console.debug('Hazard outside bbox after precise intersection test:', hazard.id || hazard.type);
        }

        return intersectsAny;
      });
    }

    /**
     * Clamp geometry coordinates to fall within bounding box
     * @param {object} geometry - GeoJSON geometry
     * @param {object} bbox - Bounding box limits
     * @returns {object} Clamped geometry
     */
    static clampGeometryToBBox(geometry, bbox) {
      if (!geometry || !geometry.coordinates) {
        return geometry;
      }

      const clampCoordinate = ([lon, lat]) => ([
        Math.min(Math.max(lon, bbox.minLon), bbox.maxLon),
        Math.min(Math.max(lat, bbox.minLat), bbox.maxLat)
      ]);

      const clampNested = coords => coords.map(item => Array.isArray(item[0]) ? clampNested(item) : clampCoordinate(item));

      switch (geometry.type) {
        case 'Point':
          return { ...geometry, coordinates: clampCoordinate(geometry.coordinates) };
        case 'MultiPoint':
        case 'LineString':
          return { ...geometry, coordinates: geometry.coordinates.map(clampCoordinate) };
        case 'MultiLineString':
        case 'Polygon':
          return { ...geometry, coordinates: geometry.coordinates.map(clampNested) };
        case 'MultiPolygon':
          return { ...geometry, coordinates: geometry.coordinates.map(poly => clampNested(poly)) };
        default:
          return geometry;
      }
    }

    /**
     * Validate normalized ISIGMET entry structure
     * @param {object} entry - ISIGMET record
     * @returns {boolean} True when entry satisfies required properties
     */
    static validateISIGMETEntry(entry) {
      if (!entry || typeof entry !== 'object') {
        return false;
      }

      const requiredFields = ['id', 'type', 'phenomenon', 'severity'];
      const missingField = requiredFields.find(field => entry[field] === undefined || entry[field] === null);
      if (missingField) {
        console.warn('ISIGMET missing required field:', missingField, 'for entry', entry.id || entry.phenomenon || 'unknown');
        return false;
      }

      if (!entry.geometry || !isValidGeometry(entry.geometry)) {
        console.warn('ISIGMET has invalid geometry:', entry.id);
        return false;
      }

      return true;
    }

    static filterValidPIREPs(pireps) {
      if (!Array.isArray(pireps)) {
        return { valid: [], dropped: 0 };
      }

      const valid = [];
      let dropped = 0;

      pireps.forEach(pirep => {
        const validation = this.validatePirepStructure(pirep);
        if (!validation.valid) {
          dropped += 1;
          console.warn('Dropping PIREP due to validation errors:', {
            id: pirep?.id,
            errors: validation.errors
          });
          return;
        }
        valid.push(pirep);
      });

      return { valid, dropped };
    }

    static validatePirepStructure(pirep) {
      const errors = [];

      if (!pirep || typeof pirep !== 'object') {
        return { valid: false, errors: ['Missing PIREP object'] };
      }

      if (!Number.isFinite(pirep.lat) || pirep.lat < -90 || pirep.lat > 90) {
        errors.push('Invalid latitude');
      }

      if (!Number.isFinite(pirep.lon) || pirep.lon < -180 || pirep.lon > 180) {
        errors.push('Invalid longitude');
      }

      if (pirep.fl !== null && pirep.fl !== undefined && !Number.isFinite(Number(pirep.fl))) {
        errors.push('Invalid flight level');
      }

      if (typeof pirep.type !== 'string' || !pirep.type.trim()) {
        errors.push('Missing primary phenomenon type');
      }

      if (pirep.intensity === undefined || pirep.intensity === null) {
        errors.push('Missing intensity');
      }

      if (!pirep.time) {
        errors.push('Missing observation time');
      } else {
        const rawTime = pirep.time;
        let parsedTime = null;

        if (typeof rawTime === 'number') {
          const millis = rawTime < 1e12 ? rawTime * 1000 : rawTime;
          parsedTime = new Date(millis);
        } else if (typeof rawTime === 'string') {
          const numeric = Number(rawTime);
          if (!Number.isNaN(numeric)) {
            const millis = numeric < 1e12 ? numeric * 1000 : numeric;
            parsedTime = new Date(millis);
          } else {
            parsedTime = new Date(rawTime);
          }
        } else if (rawTime instanceof Date) {
          parsedTime = rawTime;
        }

        if (!parsedTime || Number.isNaN(parsedTime.getTime())) {
          errors.push('Invalid observation time');
        }
      }

      return {
        valid: errors.length === 0,
        errors
      };
    }

    /**
     * Determine if geometry intersects the provided bounding box
     * @param {object} geometry - GeoJSON geometry
     * @param {object} bbox - Bounding box limits
     * @param {object|null} precomputedBounds - Optional bounding box of geometry
     * @returns {boolean} True if geometry intersects bbox
     */
    static geometryIntersectsBBox(geometry, bbox, precomputedBounds = null) {
      const bounds = precomputedBounds || this.calculateGeometryBounds(geometry);
      if (!bounds) {
        return false;
      }

      const separated =
        bounds.maxLon < bbox.minLon ||
        bounds.minLon > bbox.maxLon ||
        bounds.maxLat < bbox.minLat ||
        bounds.minLat > bbox.maxLat;
      if (separated) {
        return false;
      }

      switch (geometry.type) {
        case 'Point':
          return this.pointInBBox(geometry.coordinates, bbox);
        case 'MultiPoint':
          return geometry.coordinates.some(point => this.pointInBBox(point, bbox));
        case 'LineString':
          return this.lineStringIntersectsBBox(geometry.coordinates, bbox);
        case 'MultiLineString':
          return geometry.coordinates.some(line => this.lineStringIntersectsBBox(line, bbox));
        case 'Polygon':
          return this.polygonIntersectsBBox(geometry.coordinates, bbox);
        case 'MultiPolygon':
          return geometry.coordinates.some(polygon => this.polygonIntersectsBBox(polygon, bbox));
        default:
          return false;
      }
    }

    static pointInBBox(point, bbox) {
      if (!Array.isArray(point) || point.length < 2) {
        return false;
      }

      const lon = Number(point[0]);
      const lat = Number(point[1]);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
        return false;
      }

      return lon >= bbox.minLon && lon <= bbox.maxLon && lat >= bbox.minLat && lat <= bbox.maxLat;
    }

    static lineStringIntersectsBBox(coords, bbox) {
      if (!Array.isArray(coords) || coords.length < 2) {
        return false;
      }

      const rectEdges = this.getBBoxEdges(bbox);

      for (let i = 0; i < coords.length - 1; i += 1) {
        const p1 = coords[i];
        const p2 = coords[i + 1];

        if (this.pointInBBox(p1, bbox) || this.pointInBBox(p2, bbox)) {
          return true;
        }

        if (this.segmentIntersectsRectangle(p1, p2, rectEdges, bbox)) {
          return true;
        }
      }

      return false;
    }

    static polygonIntersectsBBox(rings, bbox) {
      if (!Array.isArray(rings) || rings.length === 0) {
        return false;
      }

      const outerRing = rings[0];
      if (this.ringIntersectsBBox(outerRing, bbox)) {
        return true;
      }

      const rectCorners = this.getBBoxCorners(bbox);
      if (rectCorners.some(corner => this.pointInPolygon(corner, rings))) {
        return true;
      }

      // Check if polygon completely contains rectangle edges
      const rectEdges = this.getBBoxEdges(bbox);
      const ringsToTest = [outerRing, ...rings.slice(1)];
      for (const ring of ringsToTest) {
        if (!Array.isArray(ring) || ring.length < 2) {
          continue;
        }

        for (let i = 0; i < ring.length - 1; i += 1) {
          const p1 = ring[i];
          const p2 = ring[i + 1];
          if (this.segmentIntersectsRectangle(p1, p2, rectEdges, bbox)) {
            return true;
          }
        }
      }

      return false;
    }

    static ringIntersectsBBox(ring, bbox) {
      if (!Array.isArray(ring) || ring.length < 2) {
        return false;
      }

      if (ring.some(point => this.pointInBBox(point, bbox))) {
        return true;
      }

      const rectEdges = this.getBBoxEdges(bbox);
      const ringLength = ring.length;
      for (let i = 0; i < ringLength - 1; i += 1) {
        const p1 = ring[i];
        const p2 = ring[i + 1];
        if (this.segmentIntersectsRectangle(p1, p2, rectEdges, bbox)) {
          return true;
        }
      }

      // Ensure closed ring segments (last point to first)
      const first = ring[0];
      const last = ring[ringLength - 1];
      if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
        if (this.segmentIntersectsRectangle(first, last, rectEdges, bbox)) {
          return true;
        }
      }

      return false;
    }

    static segmentIntersectsRectangle(segStart, segEnd, rectEdges, bbox) {
      if (this.pointInBBox(segStart, bbox) || this.pointInBBox(segEnd, bbox)) {
        return true;
      }

      for (const [edgeStart, edgeEnd] of rectEdges) {
        if (this.segmentsIntersect(segStart, segEnd, edgeStart, edgeEnd)) {
          return true;
        }
      }

      return false;
    }

    static getBBoxCorners(bbox) {
      return [
        [bbox.minLon, bbox.minLat],
        [bbox.maxLon, bbox.minLat],
        [bbox.maxLon, bbox.maxLat],
        [bbox.minLon, bbox.maxLat]
      ];
    }

    static getBBoxEdges(bbox) {
      const corners = this.getBBoxCorners(bbox);
      return [
        [corners[0], corners[1]],
        [corners[1], corners[2]],
        [corners[2], corners[3]],
        [corners[3], corners[0]]
      ];
    }

    static segmentsIntersect(p1, p2, q1, q2) {
      const o1 = this.orientation(p1, p2, q1);
      const o2 = this.orientation(p1, p2, q2);
      const o3 = this.orientation(q1, q2, p1);
      const o4 = this.orientation(q1, q2, p2);

      if (o1 !== o2 && o3 !== o4) {
        return true;
      }

      if (o1 === 0 && this.onSegment(p1, q1, p2)) return true;
      if (o2 === 0 && this.onSegment(p1, q2, p2)) return true;
      if (o3 === 0 && this.onSegment(q1, p1, q2)) return true;
      if (o4 === 0 && this.onSegment(q1, p2, q2)) return true;

      return false;
    }

    static orientation(a, b, c) {
      const val = (Number(b[1]) - Number(a[1])) * (Number(c[0]) - Number(b[0])) -
        (Number(b[0]) - Number(a[0])) * (Number(c[1]) - Number(b[1]));

      if (Math.abs(val) < 1e-12) return 0;
      return val > 0 ? 1 : 2;
    }

    static onSegment(a, b, c) {
      const bx = Number(b[0]);
      const by = Number(b[1]);
      const ax = Number(a[0]);
      const ay = Number(a[1]);
      const cx = Number(c[0]);
      const cy = Number(c[1]);

      return bx >= Math.min(ax, cx) - 1e-12 && bx <= Math.max(ax, cx) + 1e-12 &&
        by >= Math.min(ay, cy) - 1e-12 && by <= Math.max(ay, cy) + 1e-12;
    }

    static pointInPolygon(point, rings) {
      if (!Array.isArray(rings) || rings.length === 0) {
        return false;
      }

      if (!this.pointInRing(point, rings[0])) {
        return false;
      }

      for (let i = 1; i < rings.length; i += 1) {
        if (this.pointInRing(point, rings[i])) {
          return false;
        }
      }

      return true;
    }

    static pointInRing(point, ring) {
      if (!Array.isArray(ring) || ring.length < 3) {
        return false;
      }

      let inside = false;
      const x = Number(point[0]);
      const y = Number(point[1]);

      for (let i = 0, j = ring.length - 1; i < ring.length; j = i += 1) {
        const xi = Number(ring[i][0]);
        const yi = Number(ring[i][1]);
        const xj = Number(ring[j][0]);
        const yj = Number(ring[j][1]);

        const intersect = ((yi > y) !== (yj > y)) &&
          (x < ((xj - xi) * (y - yi)) / (yj - yi + (yj === yi ? Number.EPSILON : 0)) + xi);
        if (intersect) inside = !inside;
      }

      return inside;
    }

    /**
     * Calculate geometry bounds
     * @param {object} geometry - GeoJSON geometry
     * @returns {{minLon:number,maxLon:number,minLat:number,maxLat:number}|null}
     */
    static calculateGeometryBounds(geometry) {
      const coords = this.extractAllCoordinates(geometry);
      if (coords.length === 0) {
        return null;
      }

      let minLon = coords[0][0];
      let maxLon = coords[0][0];
      let minLat = coords[0][1];
      let maxLat = coords[0][1];

      coords.forEach(([lon, lat]) => {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      });

      return { minLon, maxLon, minLat, maxLat };
    }

    /**
     * Extract all coordinates from GeoJSON geometry regardless of type
     * @param {object} geometry - GeoJSON geometry
     * @returns {Array<Array<number>>} Flattened coordinates
     */
    static extractAllCoordinates(geometry) {
      if (!geometry || !geometry.type) {
        return [];
      }

      const { type, coordinates } = geometry;
      if (!coordinates) {
        return [];
      }

      switch (type) {
        case 'Point':
          return [coordinates];
        case 'MultiPoint':
        case 'LineString':
          return coordinates;
        case 'MultiLineString':
        case 'Polygon':
          return coordinates.flat();
        case 'MultiPolygon':
          return coordinates.flat(2);
        default:
          return [];
      }
    }
}

module.exports = BriefingService;