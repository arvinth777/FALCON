/**
 * TAF (Terminal Aerodrome Forecast) parser
 * Extracts forecast time blocks and weather conditions from raw TAF strings
 * Supports FM, BECMG, TEMPO, and PROB blocks along with wind, visibility, and ceiling data.
 */

class TAFParser {
  /**
   * Normalize timestamps to ISO format
   * @param {*} t - Timestamp value (number, string, or Date)
   * @returns {string|null} ISO string or null if invalid
   */
  static toISO(t) {
    const ms = typeof t === 'number' ? t * 1000 : Date.parse(t);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
  }

  /**
   * Parse raw TAF string into structured forecast blocks
   * @param {string} rawTAF - Raw TAF string from AWC API
   * @returns {Array} Array of forecast blocks with time periods and conditions
   */
  static parse(rawTAF) {
    if (!rawTAF || typeof rawTAF !== 'string') {
      return {
        raw: rawTAF || '',
        blocks: [],
        currentBlockIndex: -1
      };
    }

    try {
      let cleaned = rawTAF
        .replace(/\r/g, ' ')
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      cleaned = cleaned.replace(/\s*=+$/, '');

      const remarkIndex = cleaned.indexOf(' RMK');
      if (remarkIndex !== -1) {
        cleaned = cleaned.substring(0, remarkIndex).trim();
      }

      const headerRegex = /^TAF(?:\s+(?:AMD|COR))?\s+[A-Z]{4}\s+(\d{6})Z\s+(\d{4})\/(\d{4})\s*/;
      const headerMatch = headerRegex.exec(cleaned);

      let baseTime = null;
      let validPeriod = null;
      let body = cleaned;

      if (headerMatch) {
        const issueTime = headerMatch[1];
        const validStart = headerMatch[2];
        const validEnd = headerMatch[3];
        baseTime = this.parseIssueTime(issueTime);
        validPeriod = this.parseValidPeriod(`${validStart}/${validEnd}`, baseTime);
        body = cleaned.substring(headerMatch[0].length).trim();
      }

      if (!body) {
        return {
          raw: rawTAF || '',
          blocks: [],
          currentBlockIndex: -1
        };
      }

      const blockTexts = this.splitIntoBlocks(body);
      const detailedBlocks = blockTexts
        .map((blockText, index) => this.parseWeatherBlock(blockText, baseTime, validPeriod, index === 0))
        .filter(Boolean);

      this.fillBlockTimings(detailedBlocks, validPeriod, baseTime);

      const forecastBlocks = this.buildTimelineBlocks(detailedBlocks, validPeriod);
      let blocks = forecastBlocks.length > 0
        ? forecastBlocks
        : [];

      // If no blocks parsed but taf.validFrom/validTo exist, return one fallback block
      if (blocks.length === 0 && validPeriod?.start && validPeriod?.end) {
        blocks = [{
          start: this.toISO(validPeriod.start),
          end: this.toISO(validPeriod.end),
          category: 'UNKNOWN',
          visibilitySM: null,
          ceilingFT: null,
          wind: { dir: null, spd: null, gst: null },
          raw: null,
          sourceType: 'FALLBACK',
          probability: null
        }];
      }

      const currentBlockIndex = this.getActivePrimaryBlockIndex(blocks);

      return {
        raw: rawTAF,
        blocks,
        currentBlockIndex
      };
    } catch (error) {
      console.error('TAF parsing error:', error);
      return {
        raw: rawTAF,
        blocks: [],
        currentBlockIndex: -1
      };
    }
  }

  /**
   * Determine if a line represents a new forecast block
   * @param {string} line - TAF line
   * @returns {boolean} True if line starts a new block
   */
  static isNewBlockLine(line) {
    return /^FM\d{6}/.test(line) ||
      line.startsWith('BECMG') ||
      line.startsWith('TEMPO') ||
      /^PROB\d{2}/.test(line);
  }

  /**
   * Parse TAF issue time (DDHHMMZ format)
   * @param {string} timeStr - Time string in DDHHMM format without trailing Z
   * @returns {Date} Parsed date
   */
  static parseIssueTime(timeStr) {
    const day = parseInt(timeStr.substring(0, 2), 10);
    const hour = parseInt(timeStr.substring(2, 4), 10);
    const minute = parseInt(timeStr.substring(4, 6), 10);

    const now = new Date();
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, hour, minute, 0));
    return date;
  }

  /**
   * Parse individual weather block (FM, BECMG, TEMPO, PROB, or initial)
   * @param {string} blockText - Text representing a forecast block
   * @param {Date|null} baseTime - Base issue time
   * @returns {object|null} Parsed weather block
   */
  static parseWeatherBlock(blockText, baseTime, validPeriod, isInitialBlock = false) {
    if (!blockText) {
      return null;
    }

    const type = this.determineBlockType(blockText);
    const probability = this.extractProbability(blockText);
    const timeInfo = this.extractTimePeriod(blockText, baseTime, type, validPeriod, isInitialBlock);
    const conditions = this.extractWeatherConditions(blockText);
    const visibilitySM = this.normalizeVisibilityToSM(conditions.visibility);
    const ceilingFt = this.extractCeilingFt(conditions.clouds);

    return {
      type,
      startTime: timeInfo.startTime,
      endTime: timeInfo.endTime,
      probability,
      ...conditions,
      visibilitySM,
      ceilingFt,
      raw: blockText.trim()
    };
  }

  /**
   * Determine block type based on text prefix
   * @param {string} blockText - Forecast block text
   * @returns {string} Block type
   */
  static determineBlockType(blockText) {
    if (/^FM\d{6}/.test(blockText)) {
      return 'FM';
    }
    if (blockText.startsWith('BECMG')) {
      return 'BECMG';
    }
    if (blockText.startsWith('TEMPO')) {
      return 'TEMPO';
    }
    if (/^PROB\d{2}/.test(blockText)) {
      return blockText.includes('TEMPO') ? 'PROB-TEMPO' : 'PROB';
    }
    return 'INITIAL';
  }

  /**
   * Extract probability for PROB blocks
   * @param {string} blockText - Forecast block text
   * @returns {number|null} Probability as percentage
   */
  static extractProbability(blockText) {
    const match = blockText.match(/PROB(\d{2})/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Extract time period from forecast block
   * @param {string} blockText - TAF block text
   * @param {Date|null} baseTime - Base issue time
   * @param {string} type - Block type
   * @returns {object} Start and end times in ISO strings
   */
  static extractTimePeriod(blockText, baseTime, type, validPeriod, isInitialBlock = false) {
    const now = new Date();

    if (type === 'FM') {
      const fmMatch = blockText.match(/FM(\d{2})(\d{2})(\d{2})/);
      if (fmMatch) {
        const [ , day, hour, minute ] = fmMatch.map((val, idx) => idx === 0 ? val : parseInt(val, 10));
        const startTime = this.buildUTCDate(day, hour, minute, baseTime || now);
        return { startTime: startTime.toISOString(), endTime: null };
      }
    }

    if (type === 'BECMG') {
      const match = blockText.match(/BECMG\s+(\d{2})(\d{2})\/(\d{2})(\d{2})/);
      if (match) {
        const [, startDay, startHour, endDay, endHour ] = match.map((val, idx) => idx === 0 ? val : parseInt(val, 10));
        const startTime = this.buildUTCDate(startDay, startHour, 0, baseTime || now);
        const endTime = this.buildUTCDate(endDay, endHour, 0, baseTime || now);
        return { startTime: startTime.toISOString(), endTime: endTime.toISOString() };
      }
    }

    if (type === 'TEMPO' || type === 'PROB' || type === 'PROB-TEMPO') {
      const match = blockText.match(/(?:TEMPO|PROB\d{2})(?:\s+TEMPO)?\s+(\d{2})(\d{2})\/(\d{2})(\d{2})/);
      if (match) {
        const [, startDay, startHour, endDay, endHour ] = match.map((val, idx) => idx === 0 ? val : parseInt(val, 10));
        const startTime = this.buildUTCDate(startDay, startHour, 0, baseTime || now);
        const endTime = this.buildUTCDate(endDay, endHour, 0, baseTime || now);
        return { startTime: startTime.toISOString(), endTime: endTime.toISOString() };
      }
    }

    if (type === 'INITIAL' && isInitialBlock && validPeriod?.start) {
      return {
        startTime: validPeriod.start.toISOString(),
        endTime: validPeriod.end ? validPeriod.end.toISOString() : null
      };
    }

    const start = baseTime ? new Date(baseTime) : new Date(now);
    const end = new Date(start.getTime() + 6 * 60 * 60 * 1000);
    return { startTime: start.toISOString(), endTime: end.toISOString() };
  }

  /**
   * Build UTC date based on day/hour/minute with reference month/year
   * @param {number} day - Day of month
   * @param {number} hour - Hour of day
   * @param {number} minute - Minute of hour
   * @param {Date} reference - Reference date for month/year
   * @returns {Date} UTC date
   */
  static buildUTCDate(day, hour, minute, reference) {
    const ref = new Date(reference);
    const result = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), day, hour, minute, 0));

    // Handle month rollovers (e.g., TAF issued near end of month with next-month forecast day)
    const refDay = ref.getUTCDate();
    if (refDay >= 25 && day <= 5) {
      result.setUTCMonth(result.getUTCMonth() + 1);
    } else if (refDay <= 5 && day >= 25) {
      result.setUTCMonth(result.getUTCMonth() - 1);
    }

    return result;
  }

  /**
   * Extract weather conditions from TAF block
   * @param {string} blockText - Forecast block text
   * @returns {object} Parsed conditions
   */
  static extractWeatherConditions(blockText) {
    const conditions = {
      visibility: this.extractVisibility(blockText),
      ceiling: this.extractCeiling(blockText),
      clouds: this.extractCloudLayers(blockText),
      weather: this.extractWeatherPhenomena(blockText),
      wind: this.extractWind(blockText),
      windShear: this.extractWindShear(blockText),
      temperatures: this.extractTemperatureExtremes(blockText)
    };

    return conditions;
  }

  /**
   * Normalize visibility object to statute miles
   * @param {object|null} visibility - Visibility object returned by extractVisibility
   * @returns {number|null} Visibility in statute miles
   */
  static normalizeVisibilityToSM(visibility) {
    if (!visibility) {
      return null;
    }

    const parseFractional = raw => {
      if (!raw) {
        return null;
      }

      const tokens = raw.trim().split(/\s+/);
      if (tokens.length === 0) {
        return null;
      }

      let total = 0;
      for (const token of tokens) {
        if (!token) {
          continue;
        }

        if (token.includes('/')) {
          const [num, denom] = token.split('/').map(part => parseFloat(part));
          if (Number.isFinite(num) && Number.isFinite(denom) && denom !== 0) {
            total += num / denom;
          } else {
            return null;
          }
        } else {
          const value = parseFloat(token);
          if (Number.isFinite(value)) {
            total += value;
          } else {
            return null;
          }
        }
      }

      return Number.isFinite(total) ? total : null;
    };

    if (visibility.unit === 'SM') {
      if (visibility.greaterThan) {
        return 10;
      }
      if (typeof visibility.value === 'number') {
        return visibility.value;
      }

      const rawValue = String(visibility.value || '').trim().toUpperCase();
      if (!rawValue) {
        return null;
      }

      const parsed = parseFractional(rawValue.replace('SM', '').trim());
      return Number.isFinite(parsed) ? parsed : null;
    }

    if (visibility.unit === 'M') {
      const meters = typeof visibility.value === 'number'
        ? visibility.value
        : parseFloat(visibility.value);

      if (!Number.isFinite(meters)) {
        return null;
      }

      const miles = meters * 0.000621371;
      return Math.round(miles * 100) / 100;
    }

    if (typeof visibility.value === 'number') {
      return visibility.value;
    }

    const parsedFallback = parseFloat(visibility.value);
    return Number.isFinite(parsedFallback) ? parsedFallback : null;
  }

  /**
   * Extract ceiling altitude in feet from cloud layers
   * @param {Array|null} cloudLayers - Cloud layer array
   * @returns {number|null} Ceiling altitude in feet
   */
  static extractCeilingFt(cloudLayers) {
    if (!Array.isArray(cloudLayers) || cloudLayers.length === 0) {
      return null;
    }

    const ceilingLayer = cloudLayers
      .filter(layer => layer && (layer.coverage === 'BKN' || layer.coverage === 'OVC'))
      .sort((a, b) => a.altitude - b.altitude)[0];

    if (!ceilingLayer || !Number.isFinite(ceilingLayer.altitude)) {
      return null;
    }

    return ceilingLayer.altitude;
  }

  /**
   * Extract visibility from block text
   * @param {string} blockText - Forecast block text
   * @returns {object|null} Visibility object
   */
  static extractVisibility(blockText) {
    if (!blockText) {
      return null;
    }

    const normalized = blockText.toUpperCase();

    if (/\bCAVOK\b/.test(normalized)) {
      return {
        unit: 'M',
        value: 9999,
        cavok: true
      };
    }

    const smMatch = blockText.match(/((?:P)?(?:\d+\s+)?\d*\/?\d*SM)/);
    if (smMatch) {
      let value = smMatch[1].replace('SM', '').trim();
      if (value.startsWith('P')) {
        value = value.substring(1);
        return {
          unit: 'SM',
          value,
          greaterThan: true
        };
      }

      return {
        unit: 'SM',
        value
      };
    }

    const tokens = blockText.split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      const upperToken = token.toUpperCase();

      if (upperToken.includes('/')) {
        continue;
      }

      if (/^FM\d{6}$/.test(upperToken)) {
        continue;
      }

      const meterMatch = upperToken.match(/^(\d{4})(NDV)?$/);
      if (meterMatch) {
        return {
          unit: 'M',
          value: parseInt(meterMatch[1], 10)
        };
      }
    }

    return null;
  }

  /**
   * Extract ceiling information from cloud groups
   * @param {string} blockText - Forecast block text
   * @returns {object|null} Ceiling data
   */
  static extractCeiling(blockText) {
    if (!blockText) {
      return null;
    }

    if (/\bCAVOK\b/.test(blockText.toUpperCase())) {
      return null;
    }

    const cloudMatches = [...blockText.matchAll(/\b(FEW|SCT|BKN|OVC)(\d{3})(CB|TCU)?\b/g)]
      .map(match => ({
        coverage: match[1],
        altitude: parseInt(match[2], 10) * 100,
        modifier: match[3] || null
      }));

    const ceilingLayer = cloudMatches.find(layer => layer.coverage === 'BKN' || layer.coverage === 'OVC');
    return ceilingLayer || null;
  }

  /**
   * Extract all cloud layers
   * @param {string} blockText - Forecast block text
   * @returns {Array} Cloud layer objects
   */
  static extractCloudLayers(blockText) {
    return [...blockText.matchAll(/\b(FEW|SCT|BKN|OVC)(\d{3})(CB|TCU)?\b/g)].map(match => ({
      coverage: match[1],
      altitude: parseInt(match[2], 10) * 100,
      modifier: match[3] || null
    }));
  }

  /**
   * Extract wind information from block text
   * @param {string} blockText - Forecast block text
   * @returns {object|null} Wind data
   */
  static extractWind(blockText) {
    const windMatch = blockText.match(/(\d{3}|VRB)(\d{2})(G(\d{2}))?KT/);
    if (!windMatch) {
      return null;
    }

    return {
      direction: windMatch[1] === 'VRB' ? 'VRB' : parseInt(windMatch[1], 10),
      speed: parseInt(windMatch[2], 10),
      gust: windMatch[4] ? parseInt(windMatch[4], 10) : null,
      unit: 'KT'
    };
  }

  /**
   * Extract low-level wind shear information
   * @param {string} blockText - Forecast block text
   * @returns {object|null} Wind shear data
   */
  static extractWindShear(blockText) {
    const shearMatch = blockText.match(/WS(\d{3})\/(\d{3})(\d{2})KT/);
    if (!shearMatch) {
      return null;
    }

    return {
      height: parseInt(shearMatch[1], 10) * 100,
      direction: parseInt(shearMatch[2], 10),
      speed: parseInt(shearMatch[3], 10),
      unit: 'KT'
    };
  }

  /**
   * Extract temperature extremes (TX/TN)
   * @param {string} blockText - Forecast block text
   * @returns {object|null} Temperature information
   */
  static extractTemperatureExtremes(blockText) {
    const tempMatches = [...blockText.matchAll(/T([XN])(\d{2})\/(\d{2})(\d{2})Z/g)];
    if (tempMatches.length === 0) {
      return null;
    }

    return tempMatches.map(match => ({
      type: match[1] === 'X' ? 'MAX' : 'MIN',
      temperatureC: parseInt(match[2], 10),
      day: parseInt(match[3], 10),
      hour: parseInt(match[4], 10)
    }));
  }

  /**
   * Extract list of coded weather phenomena (e.g., RA, TS)
   * @param {string} blockText - Forecast block text
   * @returns {Array} Phenomena codes
   */
  static extractWeatherPhenomena(blockText) {
    const codes = ['BR', 'FG', 'RA', 'SN', 'TS', 'DZ', 'FZ', 'SH', 'SG', 'GR', 'GS', 'PL', 'DS', 'SS'];
    return codes.filter(code => blockText.includes(code));
  }

  /**
   * Get current active forecast block for a given time
   * @param {Array} blocks - Array of forecast blocks
   * @param {Date} time - Time to check (defaults to now)
   * @returns {object|null} Active forecast block
   */
  static getCurrentBlock(blocks, time = new Date()) {
    const blockArray = this.resolveBlocks(blocks);

    if (!Array.isArray(blockArray) || blockArray.length === 0) {
      return null;
    }

    const index = this.getActivePrimaryBlockIndex(blockArray, time);
    return index >= 0 ? blockArray[index] : blockArray[0] || null;
  }

  /**
   * Determine the active primary forecast block index without mutating blocks
   * @param {Array|object} blocks - Forecast blocks or wrapper object
   * @param {Date} time - Time to evaluate
   * @returns {number} Index of active primary block or -1 if none
   */
  static getActivePrimaryBlockIndex(blocks, time = new Date()) {
    const blockArray = this.resolveBlocks(blocks);

    if (!Array.isArray(blockArray) || blockArray.length === 0) {
      return -1;
    }
    const targetMs = this.toMillis(time);
    if (!Number.isFinite(targetMs)) {
      return blockArray.length > 0 ? 0 : -1;
    }

    let activeIndex = -1;
    let fallbackIndex = blockArray.length > 0 ? 0 : -1;

    for (let i = 0; i < blockArray.length; i++) {
      const block = blockArray[i];
      if (!block) {
        continue;
      }

      const startMs = this.toMillis(block.start ?? block.startTime);
      const endMs = this.toMillis(block.end ?? block.endTime);

      if (!Number.isFinite(startMs)) {
        continue;
      }

      if (startMs <= targetMs) {
        fallbackIndex = i;
      }

      const notEnded = !Number.isFinite(endMs) || endMs > targetMs;

      if (startMs <= targetMs && notEnded) {
        activeIndex = i;
      }
    }

    if (activeIndex !== -1) {
      return activeIndex;
    }

    return fallbackIndex;
  }

  /**
   * Split TAF body into forecast blocks based on transition tokens
   * @param {string} body - Body of TAF (without header)
   * @returns {Array<string>} Block texts
   */
  static splitIntoBlocks(body) {
    if (!body) {
      return [];
    }

    const tokens = body.split(/\s+/).filter(Boolean);
    const blocks = [];
    let current = [];

    const isBlockStart = token =>
      /^FM\d{6}$/.test(token) ||
      token === 'BECMG' ||
      token === 'TEMPO' ||
      /^PROB\d{2}$/.test(token);

    for (const token of tokens) {
      const isTempoAfterProb = token === 'TEMPO' && current.length === 1 && /^PROB\d{2}$/.test(current[0]);

      if (isBlockStart(token) && current.length > 0 && !isTempoAfterProb) {
        blocks.push(current.join(' '));
        current = [token];
      } else {
        current.push(token);
      }
    }

    if (current.length > 0) {
      blocks.push(current.join(' '));
    }

    return blocks;
  }

  /**
   * Get current block index at a given time
   * @param {Array|object} blocks - Forecast blocks or wrapper object
   * @param {Date} time - Time to evaluate
   * @returns {number} Index of active block or -1 if none
   */
  static getCurrentBlockIndex(blocks, time = new Date()) {
    return this.getActivePrimaryBlockIndex(blocks, time);
  }

  /**
   * Normalize blocks parameter to an array
   * @param {Array|object} blocksOrWrapper - Blocks array or wrapper containing blocks
   * @returns {Array} Resolved blocks array
   */
  static resolveBlocks(blocksOrWrapper) {
    if (Array.isArray(blocksOrWrapper)) {
      return blocksOrWrapper;
    }

    if (blocksOrWrapper && Array.isArray(blocksOrWrapper.blocks)) {
      return blocksOrWrapper.blocks;
    }

    if (blocksOrWrapper && Array.isArray(blocksOrWrapper.forecastBlocks)) {
      return blocksOrWrapper.forecastBlocks;
    }

    return [];
  }

  /**
   * Parse valid period string into start/end dates
   * @param {string} periodStr - Valid period in DDHH/DDHH format
   * @param {Date|null} reference - Reference issue time
   * @returns {{start: Date|null, end: Date|null}|null}
   */
  static parseValidPeriod(periodStr, reference) {
    if (!periodStr || !/\d{4}\/\d{4}/.test(periodStr)) {
      return null;
    }

    const [startPart, endPart] = periodStr.split('/');
    const refTime = reference ? new Date(reference) : new Date();

    const startDay = parseInt(startPart.substring(0, 2), 10);
    const startHour = parseInt(startPart.substring(2, 4), 10);
    const endDay = parseInt(endPart.substring(0, 2), 10);
    const endHour = parseInt(endPart.substring(2, 4), 10);

    const start = this.buildUTCDate(startDay, startHour, 0, refTime);
    const end = this.buildUTCDate(endDay, endHour % 24, 0, refTime);
    if (endHour === 24) {
      end.setUTCHours(0, 0, 0, 0);
      end.setUTCDate(end.getUTCDate() + 1);
    }

    return {
      start,
      end
    };
  }

  /**
   * Fill in missing start/end times for forecast blocks
   * @param {Array} blocks - Forecast blocks
   * @param {{start: Date|null, end: Date|null}|null} validPeriod - Overall valid period
   * @param {Date|null} baseTime - TAF issue time
   */
  static fillBlockTimings(blocks, validPeriod, baseTime) {
    if (!Array.isArray(blocks) || blocks.length === 0) {
      return;
    }

    const primaryTypes = new Set(['INITIAL', 'FM', 'BECMG']);
    const validStartIso = validPeriod?.start ? validPeriod.start.toISOString() : (baseTime ? new Date(baseTime).toISOString() : null);
    const validEndIso = validPeriod?.end ? validPeriod.end.toISOString() : null;

    const ensureIso = value => (value instanceof Date ? value.toISOString() : value || null);

    if (!blocks[0].startTime && validStartIso) {
      blocks[0].startTime = validStartIso;
    }

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];

      if (primaryTypes.has(block.type)) {
        if (!block.startTime) {
          block.startTime = blocks[i - 1]?.endTime || validStartIso || new Date().toISOString();
        }

        if (!block.endTime) {
          const nextPrimary = blocks.slice(i + 1).find(next => primaryTypes.has(next.type) && next.startTime);
          block.endTime = nextPrimary?.startTime || validEndIso;
        }
      } else {
        // Transient conditions inherit timing from explicit values or parent block
        if (!block.startTime) {
          block.startTime = block.endTime || blocks[i - 1]?.startTime || validStartIso;
        }
        if (!block.endTime) {
          block.endTime = blocks[i - 1]?.endTime || validEndIso;
        }
      }

      block.startTime = ensureIso(block.startTime ? new Date(block.startTime) : null) || block.startTime || null;
      block.endTime = block.endTime ? ensureIso(new Date(block.endTime)) : block.endTime;
      block.validFrom = block.startTime || null;
      block.validTo = block.endTime || null;
    }
  }

  static buildTimelineBlocks(blocks, validPeriod) {
    if (!Array.isArray(blocks) || blocks.length === 0) {
      return [];
    }

    const sortCandidates = blocks
      .map(block => ({
        block,
        start: this.toDate(block.startTime ?? block.validFrom),
        end: this.toDate(block.endTime ?? block.validTo)
      }))
      .filter(entry => entry.start)
      .sort((a, b) => a.start - b.start);

    if (sortCandidates.length === 0) {
      return [];
    }

    const validStart = validPeriod?.start ? new Date(validPeriod.start) : null;
    const validEnd = validPeriod?.end ? new Date(validPeriod.end) : null;

    const timeline = [];
    let previousBlock = null;

    for (let i = 0; i < sortCandidates.length; i++) {
      const { block, start } = sortCandidates[i];
      if (!start) {
        continue;
      }

      const normalizedStart = (() => {
        if (!previousBlock) {
          if (validStart && start > validStart) {
            return validStart;
          }
          if (validStart && start < validStart) {
            return validStart;
          }
        }
        if (previousBlock) {
          const prevEndDate = this.toDate(previousBlock.end);
          if (prevEndDate && start < prevEndDate) {
            return prevEndDate;
          }
        }
        return start;
      })();

      if (previousBlock) {
        previousBlock.end = normalizedStart.toISOString();
      }

      const nextStart = sortCandidates[i + 1]?.start || validEnd || this.toDate(block.endTime ?? block.validTo) || null;
      let normalizedEnd = nextStart ? new Date(nextStart) : null;

      if (normalizedEnd && normalizedEnd <= normalizedStart) {
        normalizedEnd = new Date(normalizedStart.getTime() + 60 * 60 * 1000);
      }

      if (!normalizedEnd && validEnd) {
        normalizedEnd = new Date(validEnd);
      }

      if (!normalizedEnd) {
        normalizedEnd = new Date(normalizedStart.getTime() + 60 * 60 * 1000);
      }

      const timelineBlock = this.createTimelineBlock(block, normalizedStart, normalizedEnd);
      timeline.push(timelineBlock);
      previousBlock = timelineBlock;
    }

    if (previousBlock) {
      if (validEnd) {
        previousBlock.end = new Date(validEnd).toISOString();
      } else if (!previousBlock.end) {
        const endDate = new Date(this.toMillis(previousBlock.start) + 60 * 60 * 1000);
        previousBlock.end = endDate.toISOString();
      }
    }

    return timeline.filter(block => block && block.start && block.end);
  }

  static createTimelineBlock(sourceBlock, startDate, endDate) {
    const visibilitySM = this.sanitizeNumber(sourceBlock.visibilitySM);
    const ceilingFT = this.sanitizeNumber(sourceBlock.ceilingFt ?? sourceBlock.ceilingFT);
    const category = this.deriveFlightCategory(visibilitySM, ceilingFT);

    const windDirRaw = sourceBlock.wind?.direction;
    const wind = {
      dir: typeof windDirRaw === 'number' ? windDirRaw : null,
      spd: this.sanitizeNumber(sourceBlock.wind?.speed),
      gst: this.sanitizeNumber(sourceBlock.wind?.gust)
    };

    return {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      category,
      visibilitySM,
      ceilingFT,
      wind,
      raw: sourceBlock.raw || null,
      sourceType: sourceBlock.type || null,
      probability: sourceBlock.probability ?? null
    };
  }

  static buildFallbackTimeline(validPeriod, baseTime) {
    const startDate = validPeriod?.start
      ? new Date(validPeriod.start)
      : (baseTime ? new Date(baseTime) : new Date());

    const endDate = validPeriod?.end
      ? new Date(validPeriod.end)
      : new Date(startDate.getTime() + 6 * 60 * 60 * 1000);

    return [{
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      category: 'UNKNOWN',
      visibilitySM: null,
      ceilingFT: null,
      wind: { dir: null, spd: null, gst: null },
      raw: null,
      sourceType: 'FALLBACK',
      probability: null
    }];
  }

  static deriveFlightCategory(visibility, ceiling) {
    const vis = Number.isFinite(visibility) ? visibility : null;
    const ceil = Number.isFinite(ceiling) ? ceiling : null;

    if (vis === null && ceil === null) {
      return 'UNKNOWN';
    }

    const visValue = vis === null ? Infinity : vis;
    const ceilValue = ceil === null ? Infinity : ceil;

    if (visValue >= 5 && ceilValue >= 3000) {
      return 'VFR';
    }
    if (visValue >= 3 && ceilValue >= 1000) {
      return 'MVFR';
    }
    if (visValue >= 1 && ceilValue >= 500) {
      return 'IFR';
    }
    if (visValue < 1 || ceilValue < 500) {
      return 'LIFR';
    }
    return 'UNKNOWN';
  }

  static sanitizeNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    const parsed = typeof value === 'string' ? parseFloat(value) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  }

  static toDate(value) {
    if (!value) {
      return null;
    }
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  static toMillis(value) {
    if (value instanceof Date) {
      return value.getTime();
    }
    if (typeof value === 'number') {
      return value;
    }
    if (!value) {
      return NaN;
    }
    const parsed = new Date(value);
    return parsed.getTime();
  }
}

module.exports = TAFParser;