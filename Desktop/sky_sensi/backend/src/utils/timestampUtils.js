function normalizeTimestamp(value, { context } = {}) {
  if (value === null || value === undefined) {
    return null;
  }

  const logContext = context ? `${context}:` : 'Timestamp normalization:';

  const toMilliseconds = (numericValue) => {
    const absValue = Math.abs(numericValue);

    if (absValue >= 1e14 && absValue < 1e17) {
      // 14-16 digit epochs are interpreted as microseconds; scale down to milliseconds.
      return numericValue / 1000;
    }

    if (absValue < 1e12) {
      // Values below 1e12 represent epoch seconds; scale up to milliseconds.
      return numericValue * 1000;
    }

    return numericValue;
  };

  const finalize = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      console.warn(`${logContext} invalid timestamp`, value);
      return null;
    }
    return date.toISOString();
  };

  if (value instanceof Date) {
    return finalize(value);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      console.warn(`${logContext} non-finite numeric timestamp`, value);
      return null;
    }

    const millis = toMilliseconds(value);
    return finalize(new Date(millis));
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return null;
    }

    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric)) {
      if (!Number.isFinite(numeric)) {
        console.warn(`${logContext} non-finite numeric string timestamp`, value);
        return null;
      }

      const millis = toMilliseconds(numeric);
      return finalize(new Date(millis));
    }

    return finalize(new Date(trimmed));
  }

  console.warn(`${logContext} unsupported timestamp type`, typeof value);
  return null;
}

function normalizeTimestampFields(target, fields, { context } = {}) {
  if (!target || typeof target !== 'object') {
    return target;
  }

  if (!Array.isArray(fields) || fields.length === 0) {
    return { ...target };
  }

  const normalized = { ...target };

  fields.forEach(field => {
    if (!Object.prototype.hasOwnProperty.call(normalized, field)) {
      return;
    }

    const nextValue = normalizeTimestamp(normalized[field], { context: context ? `${context}.${field}` : field });
    if (nextValue !== null) {
      normalized[field] = nextValue;
    }
  });

  return normalized;
}

module.exports = {
  normalizeTimestamp,
  normalizeTimestampFields
};
