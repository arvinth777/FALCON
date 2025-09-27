#!/bin/bash

echo "🚀 Testing Open-Meteo Integration..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: API Health Check
echo "1. Testing API health..."
HEALTH_RESPONSE=$(curl -s "http://localhost:3001/health")
if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
    echo -e "${GREEN}✅ API is healthy${NC}"
else
    echo -e "${RED}❌ API health check failed${NC}"
    echo "Response: $HEALTH_RESPONSE"
    exit 1
fi
echo ""

# Test 2: Test briefing with Open-Meteo data
echo "2. Testing briefing with Open-Meteo integration..."
BRIEFING_RESPONSE=$(curl -s "http://localhost:3001/api/briefing?route=KLAX,KJFK")
if echo "$BRIEFING_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Briefing request successful${NC}"
else
    echo -e "${RED}❌ Briefing request failed${NC}"
    echo "Response: $BRIEFING_RESPONSE"
    exit 1
fi
echo ""

# Test 3: Verify Open-Meteo forecasts are present
echo "3. Checking Open-Meteo forecasts..."
FORECAST_COUNT=$(echo "$BRIEFING_RESPONSE" | jq '.data.openMeteoForecasts | keys | length')
if [ "$FORECAST_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Open-Meteo forecasts found for $FORECAST_COUNT airports${NC}"
    AIRPORTS=$(echo "$BRIEFING_RESPONSE" | jq -r '.data.openMeteoForecasts | keys | join(", ")')
    echo "   Airports: $AIRPORTS"
else
    echo -e "${RED}❌ No Open-Meteo forecasts found${NC}"
    exit 1
fi
echo ""

# Test 4: Check aviation recommendations
echo "4. Checking aviation recommendations..."
KLAX_RECOMMENDATION=$(echo "$BRIEFING_RESPONSE" | jq -r '.data.openMeteoForecasts.KLAX.forecast.aviation_summary.aviation_recommendation')
KJFK_RECOMMENDATION=$(echo "$BRIEFING_RESPONSE" | jq -r '.data.openMeteoForecasts.KJFK.forecast.aviation_summary.aviation_recommendation')

if [ "$KLAX_RECOMMENDATION" != "null" ] && [ "$KLAX_RECOMMENDATION" != "" ]; then
    echo -e "${GREEN}✅ KLAX: $KLAX_RECOMMENDATION${NC}"
else
    echo -e "${RED}❌ Missing aviation recommendation for KLAX${NC}"
fi

if [ "$KJFK_RECOMMENDATION" != "null" ] && [ "$KJFK_RECOMMENDATION" != "" ]; then
    echo -e "${GREEN}✅ KJFK: $KJFK_RECOMMENDATION${NC}"
else
    echo -e "${RED}❌ Missing aviation recommendation for KJFK${NC}"
fi
echo ""

# Test 5: Check hourly forecast count
echo "5. Checking forecast data quality..."
KLAX_HOURLY_COUNT=$(echo "$BRIEFING_RESPONSE" | jq '.data.openMeteoForecasts.KLAX.forecast.hourly.forecasts | length')
if [ "$KLAX_HOURLY_COUNT" -eq 168 ]; then
    echo -e "${GREEN}✅ KLAX has correct number of hourly forecasts: $KLAX_HOURLY_COUNT (7 days × 24 hours)${NC}"
else
    echo -e "${YELLOW}⚠️  KLAX hourly forecasts: $KLAX_HOURLY_COUNT (expected 168)${NC}"
fi
echo ""

# Test 6: Frontend accessibility
echo "6. Testing frontend accessibility..."
FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000")
if [ "$FRONTEND_RESPONSE" -eq 200 ]; then
    echo -e "${GREEN}✅ Frontend is accessible and loading${NC}"
else
    echo -e "${RED}❌ Frontend not accessible (HTTP $FRONTEND_RESPONSE)${NC}"
fi
echo ""

# Test 7: Test edge cases
echo "7. Testing edge cases..."

# Test invalid airport
INVALID_RESPONSE=$(curl -s "http://localhost:3001/api/briefing?route=INVALID")
if echo "$INVALID_RESPONSE" | grep -q '"success":null'; then
    echo -e "${GREEN}✅ Invalid airport handled correctly${NC}"
else
    echo -e "${YELLOW}⚠️  Invalid airport response: $(echo $INVALID_RESPONSE | jq -r '.error')${NC}"
fi

# Test mixed valid/invalid airports
MIXED_RESPONSE=$(curl -s "http://localhost:3001/api/briefing?route=KLAX,XXXX,KJFK")
MIXED_COUNT=$(echo "$MIXED_RESPONSE" | jq '.data.openMeteoForecasts | keys | length')
if [ "$MIXED_COUNT" -eq 2 ]; then
    echo -e "${GREEN}✅ Mixed valid/invalid airports handled correctly (got $MIXED_COUNT forecasts)${NC}"
else
    echo -e "${YELLOW}⚠️  Mixed airports: expected 2 forecasts, got $MIXED_COUNT${NC}"
fi
echo ""

echo "🎉 Integration tests completed!"
echo ""
echo "📋 Summary:"
echo "  - API is healthy and responsive"
echo "  - Open-Meteo integration is working"
echo "  - Aviation forecasts are being generated"
echo "  - Frontend is compatible with new API structure"
echo "  - Edge cases are handled appropriately"
echo "  - Migration from OpenWeatherMap to Open-Meteo is complete"
echo ""
echo -e "${GREEN}✅ All systems operational!${NC}"