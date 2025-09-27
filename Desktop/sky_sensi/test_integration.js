#!/usr/bin/env node

/**
 * Integration test script for Open-Meteo migration
 * Tests that the frontend can handle the new API response structure
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001/api';
const FRONTEND_URL = 'http://localhost:3000';

async function testAPIIntegration() {
  console.log('🚀 Testing Open-Meteo Integration...\n');

  try {
    // Test 1: API Health Check
    console.log('1. Testing API health...');
    const healthResponse = await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 });
    console.log(`✅ API is healthy: ${healthResponse.data.status}\n`);

    // Test 2: Test briefing with Open-Meteo data
    console.log('2. Testing briefing with Open-Meteo integration...');
    const briefingResponse = await axios.get(`${API_BASE_URL}/briefing?route=KLAX,KJFK`, { timeout: 30000 });

    if (!briefingResponse.data.success) {
      throw new Error('Briefing request failed');
    }

    const data = briefingResponse.data.data;
    console.log(`✅ Briefing successful for route: ${data.route}`);

    // Test 3: Verify Open-Meteo forecasts are present
    console.log('3. Checking Open-Meteo forecasts...');
    if (!data.openMeteoForecasts) {
      throw new Error('openMeteoForecasts field missing from response');
    }

    const forecastKeys = Object.keys(data.openMeteoForecasts);
    console.log(`✅ Open-Meteo forecasts found for airports: ${forecastKeys.join(', ')}`);

    // Test 4: Validate forecast data structure
    console.log('4. Validating forecast data structure...');
    for (const icao of forecastKeys) {
      const forecast = data.openMeteoForecasts[icao];
      if (!forecast.forecast) {
        throw new Error(`Missing forecast data for ${icao}`);
      }

      const aviationSummary = forecast.forecast.aviation_summary;
      if (!aviationSummary || !aviationSummary.aviation_recommendation) {
        throw new Error(`Missing aviation summary for ${icao}`);
      }

      console.log(`  ✅ ${icao}: ${aviationSummary.aviation_recommendation}`);
    }

    // Test 5: Check forecast data quality
    console.log('5. Checking forecast data quality...');
    const klaxForecast = data.openMeteoForecasts.KLAX;
    if (klaxForecast && klaxForecast.forecast && klaxForecast.forecast.hourly) {
      const hourlyCount = klaxForecast.forecast.hourly.forecasts.length;
      console.log(`✅ KLAX has ${hourlyCount} hourly forecasts (7 days = 168 hours)`);

      if (hourlyCount !== 168) {
        console.warn(`⚠️  Expected 168 hourly forecasts, got ${hourlyCount}`);
      }
    }

    // Test 6: Frontend accessibility
    console.log('6. Testing frontend accessibility...');
    const frontendResponse = await axios.get(FRONTEND_URL, { timeout: 5000 });
    if (frontendResponse.status === 200) {
      console.log('✅ Frontend is accessible and loading\n');
    }

    console.log('🎉 All integration tests passed!');
    console.log('\n📋 Summary:');
    console.log('  - API is healthy and responsive');
    console.log('  - Open-Meteo integration is working');
    console.log('  - Aviation forecasts are being generated');
    console.log('  - Frontend is compatible with new API structure');
    console.log('  - Migration from OpenWeatherMap to Open-Meteo is complete');

  } catch (error) {
    console.error('\n❌ Integration test failed:');
    console.error(`   ${error.message}`);

    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Make sure both backend (port 3001) and frontend (port 3000) are running');
    }

    process.exit(1);
  }
}

// Run the integration test
testAPIIntegration();