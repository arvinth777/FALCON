/**
 * Open-Meteo Weather Service for Aviation Applications
 * Provides high-quality weather forecasts without API key requirements
 */

const axios = require('axios');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 300, checkperiod: 120 });

const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1';

const AVIATION_PARAMETERS = {
  current: [
    'temperature_2m',
    'relative_humidity_2m',
    'apparent_temperature',
    'precipitation',
    'weather_code',
    'cloud_cover',
    'pressure_msl',
    'surface_pressure',
    'wind_speed_10m',
    'wind_direction_10m',
    'wind_gusts_10m'
  ],
  hourly: [
    'temperature_2m',
    'relative_humidity_2m',
    'precipitation_probability',
    'precipitation',
    'weather_code',
    'pressure_msl',
    'surface_pressure',
    'cloud_cover',
    'cloud_cover_low',
    'cloud_cover_mid',
    'cloud_cover_high',
    'visibility',
    'wind_speed_10m',
    'wind_direction_10m',
    'wind_gusts_10m',
    'temperature_80m',
    'wind_speed_80m',
    'wind_direction_80m'
  ]
};

const WMO_WEATHER_CODES = {
  0: { description: 'Clear sky', severity: 'none', aviation_impact: 'minimal' },
  1: { description: 'Mainly clear', severity: 'none', aviation_impact: 'minimal' },
  2: { description: 'Partly cloudy', severity: 'low', aviation_impact: 'minimal' },
  3: { description: 'Overcast', severity: 'low', aviation_impact: 'minimal' },
  45: { description: 'Fog', severity: 'high', aviation_impact: 'significant' },
  48: { description: 'Depositing rime fog', severity: 'high', aviation_impact: 'significant' },
  51: { description: 'Light drizzle', severity: 'moderate', aviation_impact: 'moderate' },
  53: { description: 'Moderate drizzle', severity: 'moderate', aviation_impact: 'moderate' },
  55: { description: 'Dense drizzle', severity: 'moderate', aviation_impact: 'moderate' },
  61: { description: 'Slight rain', severity: 'moderate', aviation_impact: 'moderate' },
  63: { description: 'Moderate rain', severity: 'moderate', aviation_impact: 'moderate' },
  65: { description: 'Heavy rain', severity: 'high', aviation_impact: 'significant' },
  71: { description: 'Slight snow', severity: 'moderate', aviation_impact: 'moderate' },
  73: { description: 'Moderate snow', severity: 'high', aviation_impact: 'significant' },
  75: { description: 'Heavy snow', severity: 'high', aviation_impact: 'significant' },
  80: { description: 'Slight rain showers', severity: 'moderate', aviation_impact: 'moderate' },
  81: { description: 'Moderate rain showers', severity: 'moderate', aviation_impact: 'moderate' },
  82: { description: 'Violent rain showers', severity: 'high', aviation_impact: 'significant' },
  95: { description: 'Thunderstorm', severity: 'high', aviation_impact: 'critical' },
  96: { description: 'Thunderstorm with slight hail', severity: 'high', aviation_impact: 'critical' },
  99: { description: 'Thunderstorm with heavy hail', severity: 'high', aviation_impact: 'critical' }
};

class OpenMeteoService {
  constructor() {
    this.cache = cache;
    this.baseUrl = OPEN_METEO_BASE_URL;
  }

  async getCurrentWeather(latitude, longitude) {
    const cacheKey = `current_${latitude}_${longitude}`;
    const cached = this.cache.get(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const params = {
        latitude: latitude.toFixed(4),
        longitude: longitude.toFixed(4),
        current: AVIATION_PARAMETERS.current.join(','),
        wind_speed_unit: 'kn',
        temperature_unit: 'celsius'
      };

      const response = await axios.get(`${this.baseUrl}/forecast`, { params });
      const data = this.parseCurrentWeather(response.data);

      this.cache.set(cacheKey, data, 300); // Cache for 5 minutes
      return data;
    } catch (error) {
      console.error('Open-Meteo current weather fetch failed:', error.message);
      throw new Error(`Weather data unavailable: ${error.message}`);
    }
  }

  async getHourlyForecast(latitude, longitude, forecastDays = 7) {
    const cacheKey = `hourly_${latitude}_${longitude}_${forecastDays}`;
    const cached = this.cache.get(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const params = {
        latitude: latitude.toFixed(4),
        longitude: longitude.toFixed(4),
        hourly: AVIATION_PARAMETERS.hourly.join(','),
        forecast_days: Math.min(forecastDays, 16), // Max 16 days
        wind_speed_unit: 'kn',
        temperature_unit: 'celsius'
      };

      const response = await axios.get(`${this.baseUrl}/forecast`, { params });
      const data = this.parseHourlyForecast(response.data);

      this.cache.set(cacheKey, data, 600); // Cache for 10 minutes
      return data;
    } catch (error) {
      console.error('Open-Meteo hourly forecast fetch failed:', error.message);
      throw new Error(`Forecast data unavailable: ${error.message}`);
    }
  }

  async getAviationBriefing(latitude, longitude, forecastDays = 5) {
    try {
      const [current, hourly] = await Promise.all([
        this.getCurrentWeather(latitude, longitude),
        this.getHourlyForecast(latitude, longitude, forecastDays)
      ]);

      return {
        current,
        hourly,
        aviation_summary: this.generateAviationSummary(current, hourly),
        generated_at: new Date().toISOString(),
        coordinates: { latitude, longitude },
        source: 'Open-Meteo'
      };
    } catch (error) {
      console.error('Open-Meteo aviation briefing failed:', error.message);
      throw error;
    }
  }

  parseCurrentWeather(data) {
    if (!data.current) {
      throw new Error('Invalid current weather data from Open-Meteo');
    }

    const current = data.current;
    const weatherCode = current.weather_code || 0;
    const weatherInfo = WMO_WEATHER_CODES[weatherCode] || WMO_WEATHER_CODES[0];

    return {
      timestamp: current.time,
      temperature: {
        actual: current.temperature_2m,
        apparent: current.apparent_temperature,
        unit: '°C'
      },
      wind: {
        speed: current.wind_speed_10m,
        direction: current.wind_direction_10m,
        gusts: current.wind_gusts_10m,
        unit: 'kn'
      },
      pressure: {
        msl: current.pressure_msl,
        surface: current.surface_pressure,
        unit: 'hPa'
      },
      humidity: current.relative_humidity_2m,
      cloud_cover: current.cloud_cover,
      precipitation: current.precipitation,
      weather: {
        code: weatherCode,
        description: weatherInfo.description,
        severity: weatherInfo.severity,
        aviation_impact: weatherInfo.aviation_impact
      },
      coordinates: {
        latitude: data.latitude,
        longitude: data.longitude,
        elevation: data.elevation
      }
    };
  }

  parseHourlyForecast(data) {
    if (!data.hourly || !data.hourly.time) {
      throw new Error('Invalid hourly forecast data from Open-Meteo');
    }

    const hourly = data.hourly;
    const forecasts = [];

    for (let i = 0; i < hourly.time.length; i++) {
      const weatherCode = hourly.weather_code[i] || 0;
      const weatherInfo = WMO_WEATHER_CODES[weatherCode] || WMO_WEATHER_CODES[0];

      forecasts.push({
        timestamp: hourly.time[i],
        temperature: hourly.temperature_2m[i],
        wind: {
          speed_10m: hourly.wind_speed_10m[i],
          direction_10m: hourly.wind_direction_10m[i],
          gusts_10m: hourly.wind_gusts_10m[i],
          speed_80m: hourly.wind_speed_80m ? hourly.wind_speed_80m[i] : null,
          direction_80m: hourly.wind_direction_80m ? hourly.wind_direction_80m[i] : null
        },
        pressure: {
          msl: hourly.pressure_msl[i],
          surface: hourly.surface_pressure[i]
        },
        humidity: hourly.relative_humidity_2m[i],
        cloud_cover: {
          total: hourly.cloud_cover[i],
          low: hourly.cloud_cover_low[i],
          mid: hourly.cloud_cover_mid[i],
          high: hourly.cloud_cover_high[i]
        },
        visibility: hourly.visibility[i],
        precipitation: {
          amount: hourly.precipitation[i],
          probability: hourly.precipitation_probability[i]
        },
        weather: {
          code: weatherCode,
          description: weatherInfo.description,
          severity: weatherInfo.severity,
          aviation_impact: weatherInfo.aviation_impact
        }
      });
    }

    return {
      coordinates: {
        latitude: data.latitude,
        longitude: data.longitude,
        elevation: data.elevation
      },
      timezone: data.timezone,
      forecasts
    };
  }

  generateAviationSummary(current, hourly) {
    const alerts = [];
    const next24Hours = hourly.forecasts.slice(0, 24);

    // Wind alerts
    const strongWinds = next24Hours.filter(f => f.wind.speed_10m > 25); // >25kn
    if (strongWinds.length > 0) {
      alerts.push({
        type: 'wind',
        severity: 'moderate',
        message: `Strong winds expected: ${Math.max(...strongWinds.map(f => f.wind.speed_10m))}kn`
      });
    }

    const gustAlerts = next24Hours.filter(f => f.wind.gusts_10m > 35); // >35kn
    if (gustAlerts.length > 0) {
      alerts.push({
        type: 'gusts',
        severity: 'high',
        message: `Strong gusts expected: ${Math.max(...gustAlerts.map(f => f.wind.gusts_10m))}kn`
      });
    }

    // Visibility alerts
    const lowVisibility = next24Hours.filter(f => f.visibility < 5000); // <5km
    if (lowVisibility.length > 0) {
      alerts.push({
        type: 'visibility',
        severity: 'high',
        message: `Reduced visibility expected: ${Math.min(...lowVisibility.map(f => f.visibility))}m`
      });
    }

    // Weather alerts
    const criticalWeather = next24Hours.filter(f => f.weather.aviation_impact === 'critical');
    if (criticalWeather.length > 0) {
      alerts.push({
        type: 'weather',
        severity: 'critical',
        message: `Thunderstorms expected in next 24 hours`
      });
    }

    // Precipitation alerts
    const heavyPrecip = next24Hours.filter(f => f.precipitation.probability > 70);
    if (heavyPrecip.length > 0) {
      alerts.push({
        type: 'precipitation',
        severity: 'moderate',
        message: `High precipitation probability: ${Math.max(...heavyPrecip.map(f => f.precipitation.probability))}%`
      });
    }

    return {
      current_conditions: current.weather.description,
      wind_summary: `${current.wind.speed}kn from ${current.wind.direction}°`,
      alerts,
      forecast_confidence: this.calculateConfidence(hourly),
      aviation_recommendation: this.getAviationRecommendation(alerts)
    };
  }

  calculateConfidence(hourly) {
    // Simplified confidence calculation based on data consistency
    const forecasts = hourly.forecasts.slice(0, 24);
    const weatherVariability = new Set(forecasts.map(f => f.weather.code)).size;
    const windVariability = this.calculateWindVariability(forecasts);

    let confidence = 'HIGH';
    if (weatherVariability > 3 || windVariability > 20) {
      confidence = 'MEDIUM';
    }
    if (weatherVariability > 5 || windVariability > 30) {
      confidence = 'LOW';
    }

    return confidence;
  }

  calculateWindVariability(forecasts) {
    const windSpeeds = forecasts.map(f => f.wind.speed_10m).filter(s => s !== null);
    if (windSpeeds.length === 0) return 0;

    const max = Math.max(...windSpeeds);
    const min = Math.min(...windSpeeds);
    return max - min;
  }

  getAviationRecommendation(alerts) {
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    const highAlerts = alerts.filter(a => a.severity === 'high');

    if (criticalAlerts.length > 0) {
      return 'AVOID - Critical weather conditions expected';
    }
    if (highAlerts.length > 2) {
      return 'CAUTION - Multiple adverse conditions expected';
    }
    if (highAlerts.length > 0) {
      return 'MONITOR - Adverse conditions possible';
    }
    return 'FAVORABLE - Good flying conditions expected';
  }
}

module.exports = new OpenMeteoService();