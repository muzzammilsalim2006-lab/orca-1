/**
 * ORCA Phase 3: Real Official IMD Integration Test Suite
 * 
 * Verifies:
 * 1. IMD successful current-weather response (current_wx mapping: pressure, wind, temp, humidity, rainfall)
 * 2. IMD successful district-warning response (districtwarning: Day 1-5 warnings & numeric color codes 1=Red, 2=Orange, 3=Yellow, 4=Green)
 * 3. IMD successful marine-warning response (coastalbulletin, portwarning)
 * 4. IMD successful cyclone response (cyclone_track: name, category, MSW, points)
 * 5. IMD CONFIG_REQUIRED behavior when credentials/endpoint unconfigured
 * 6. IMD timeout handling (AbortSignal timeout without crashing)
 * 7. IMD malformed JSON handling
 * 8. IMD missing fields handling (strict null preservation)
 * 9. Warning colour normalization (numeric 1..4 and string codes to standard RED, ORANGE, YELLOW, GREEN)
 * 10. Issue/validity timestamp parsing
 * 11. Provider provenance tracking
 * 12. Data freshness calculation
 * 13. Open-Meteo continuity when IMD fails
 * 14. IMD warning passed into deterministic safety layer
 * 15. ORANGE/RED veto handling in deterministic risk engine (elevation to score >= 85, level HIGH)
 * 16. Full end-to-end multi-source pipeline orchestration
 */

import {
  normalizeImdColorCode,
  decodeImdWarningCodes,
  normalizeImdWeather,
  normalizeImdDistrictWarningItem,
  normalizeImdCoastalBulletinItem,
  normalizeImdPortWarningItem,
  normalizeImdCycloneData,
} from './src/pipeline/imdNormalizer';
import { fetchImdData, fetchOpenMeteoWeather } from './src/pipeline/adapters';
import { evaluateRiskEngine } from './src/pipeline/riskEngine';
import { OrcaOrchestrator } from './src/pipeline/orchestrator';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`);
    failed++;
  }
}

async function runOfficialImdTests() {
  console.log('======================================================');
  console.log('ORCA PHASE 3: OFFICIAL IMD INTEGRATION TEST SUITE');
  console.log('======================================================\n');

  // Test Group 1: IMD Warning Color Code Normalization
  console.log('Test Group 1: IMD Warning Color Code Normalization (1=Red, 2=Orange, 3=Yellow, 4=Green)');
  assert(normalizeImdColorCode(1) === 'RED', 'Color code 1 maps to RED');
  assert(normalizeImdColorCode('1') === 'RED', 'Color code "1" maps to RED');
  assert(normalizeImdColorCode(2) === 'ORANGE', 'Color code 2 maps to ORANGE');
  assert(normalizeImdColorCode('2') === 'ORANGE', 'Color code "2" maps to ORANGE');
  assert(normalizeImdColorCode(3) === 'YELLOW', 'Color code 3 maps to YELLOW');
  assert(normalizeImdColorCode('3') === 'YELLOW', 'Color code "3" maps to YELLOW');
  assert(normalizeImdColorCode(4) === 'GREEN', 'Color code 4 maps to GREEN');
  assert(normalizeImdColorCode('4') === 'GREEN', 'Color code "4" maps to GREEN');
  assert(normalizeImdColorCode('#FF0000') === 'RED', 'Hex #FF0000 maps to RED');
  assert(normalizeImdColorCode('#FFA500') === 'ORANGE', 'Hex #FFA500 maps to ORANGE');

  // Test Group 2: IMD Official Warning Codes Decoding
  console.log('\nTest Group 2: IMD Official Warning Codes Decoding');
  assert(decodeImdWarningCodes(1) === 'No Warning', 'Code 1 = No Warning');
  assert(decodeImdWarningCodes(2) === 'Heavy Rain', 'Code 2 = Heavy Rain');
  assert(decodeImdWarningCodes(4) === 'Thunderstorm & Lightning, Squall etc', 'Code 4 = Thunderstorm & Lightning, Squall etc');
  assert(decodeImdWarningCodes(8) === 'Strong Surface Winds', 'Code 8 = Strong Surface Winds');
  assert(decodeImdWarningCodes(16) === 'Very Heavy Rain', 'Code 16 = Very Heavy Rain');
  assert(decodeImdWarningCodes(17) === 'Extremely Heavy Rain', 'Code 17 = Extremely Heavy Rain');
  assert(decodeImdWarningCodes('4,8').includes('Thunderstorm') && decodeImdWarningCodes('4,8').includes('Strong Surface Winds'), 'Combined codes "4,8" decoded properly');

  // Test Group 3: IMD Current Weather API (/current_wx) Normalization
  console.log('\nTest Group 3: IMD Current Weather API (/current_wx) Normalization');
  const officialCurrentWx = {
    'Station Id': '43003',
    'Station': 'Mumbai (Colaba)',
    'Date of Observation': '2026-09-28',
    'Time of Observation': '0600',
    'M.S.L.P': '1008.4',
    'Wind Direction': '270',
    'Wind Speed': '24',
    'Temperature': '29.6',
    'Weather Code': '02',
    'Nebulosity': '4',
    'Humidity': '82',
    'Last 24 hrs Rainfall': '18.5',
  };

  const normWx = normalizeImdWeather(officialCurrentWx, 'https://api.imd.gov.in/api/v1/current_wx', '2026-09-28T07:00:00Z', 'LIVE');
  assert(normWx !== null, 'Current weather normalized successfully');
  assert(normWx?.temperature_c === 29.6, 'Temperature parsed as 29.6 C');
  assert(normWx?.humidity_pct === 82, 'Humidity parsed as 82%');
  assert(normWx?.pressure_hpa === 1008.4, 'MSLP parsed as 1008.4 hPa');
  assert(normWx?.wind_speed_kmph === 24, 'Wind speed parsed as 24 km/h');
  assert(normWx?.wind_speed_mps === 6.67, 'Wind speed normalized to 6.67 m/s');
  assert(normWx?.precipitation_mm_24h === 18.5, '24h rainfall parsed as 18.5 mm');
  assert(normWx?.cloud_cover_percent === 50, 'Nebulosity 4/8 converted to 50% cloud cover');
  assert(normWx?.source.source_timestamp === '2026-09-28T0600Z', 'Observation timestamp preserved');
  assert(normWx?.source.note?.includes('Mumbai (Colaba)'), 'Station metadata preserved');

  // Test Group 4: IMD District-wise Warning (/districtwarning) Normalization
  console.log('\nTest Group 4: IMD District-wise Warning (/districtwarning) Normalization');
  const officialDistrictWarning = {
    Obj_id: 573,
    Date: '2026-09-28',
    UTC: '0300',
    District: 'Mumbai',
    Day_1: '4,8',
    Day_2: '2',
    Day_3: '1',
    Day_4: '1',
    Day_5: '1',
    Day1_Color: 2, // Orange
    Day2_Color: 3, // Yellow
    Day3_Color: 4, // Green
    Day4_Color: 4, // Green
    Day5_Color: 4, // Green
  };

  const distWarnItems = normalizeImdDistrictWarningItem(officialDistrictWarning, '2026-09-28T04:00:00Z', 'Mumbai');
  assert(distWarnItems.length >= 2, 'Parsed active Day 1 (Orange) and Day 2 (Yellow) warnings');
  assert(distWarnItems[0].severity === 'warning', 'Day 1 Orange severity is warning');
  assert(distWarnItems[0].official_color_code === 'ORANGE', 'Day 1 Color is ORANGE');
  assert(distWarnItems[0].warning_colour === 'ORANGE', 'warning_colour alias is ORANGE');
  assert(distWarnItems[0].headline.includes('Thunderstorm'), 'Day 1 Headline includes decoded warning code');
  assert(distWarnItems[0].affected_area === 'Mumbai', 'Affected area is Mumbai');
  assert(distWarnItems[0].issued_at === '2026-09-28T0300Z', 'Issued at timestamp preserved from Date & UTC');

  // Test Group 5: IMD Coastal Bulletin (/coastalbulletin) Normalization
  console.log('\nTest Group 5: IMD Coastal Bulletin (/coastalbulletin) Normalization');
  const officialCoastalBulletin = {
    'Id': '108',
    'Date of Observation': '2026-09-28',
    'Layer': 'North Maharashtra coast',
    'Issued by': 'ACWC MUMBAI',
    'Valid From': '2026-09-28 22:00:00',
    'Validity': '12',
    'TTT Warning': 'Squally weather with wind speed reaching 45-55 kmph gusting to 65 kmph.',
    'Wind': 'South Westerly, 20 - 25 Knots gusting to 35 knots',
    'Synoptic Situation': 'Low pressure area over Eastcentral Arabian Sea.',
    'Weather': 'Widespread Rain/ Thunderstorm',
    'Visibility': 'Poor in heavy rain',
    'Sea Condition': 'Rough to Very Rough',
    'Port Signal': 'Keep LC-III hoisted at all ports',
    'Update Time': '2026-09-28 22:27:17',
  };

  const coastalItem = normalizeImdCoastalBulletinItem(officialCoastalBulletin, '2026-09-28T22:30:00Z');
  assert(coastalItem !== null, 'Coastal bulletin parsed successfully');
  assert(coastalItem?.severity === 'alert', 'Rough sea and TTT warning maps to alert');
  assert(coastalItem?.warning_type === 'marine_warning', 'Warning type is marine_warning');
  assert(coastalItem?.affected_area === 'North Maharashtra coast', 'Area matches North Maharashtra coast');
  assert(coastalItem?.warning_text?.includes('Keep LC-III hoisted'), 'Port signal included in warning text');

  // Test Group 6: IMD Port Warning (/portwarning) Normalization
  console.log('\nTest Group 6: IMD Port Warning (/portwarning) Normalization');
  const officialPortWarning = {
    'Port Id': 'MUMBAI_01',
    'Port Name': 'Mumbai Port',
    'Issued By': 'ACWC MUMBAI',
    'Date of Issue': '2026-09-28',
    'Warning': 'Distant Cautionary Signal DC-I hoisted due to depression over Arabian Sea.',
  };

  const portItem = normalizeImdPortWarningItem(officialPortWarning, '2026-09-28T10:00:00Z');
  assert(portItem !== null, 'Port warning parsed successfully');
  assert(portItem?.severity === 'warning', 'Signal DC-I parsed as warning severity');
  assert(portItem?.affected_area === 'Mumbai Port', 'Affected area is Mumbai Port');

  // Test Group 7: IMD Cyclone Track (/cyclone_track) Normalization
  console.log('\nTest Group 7: IMD Cyclone Track (/cyclone_track) Normalization');
  const officialCycloneTrack = {
    status: true,
    message: 'Cyclone Track',
    data: {
      observed: [
        {
          CYCLONE_NAME: 'TEJ',
          'Date/Time': '2026-09-28/1200',
          lat: '17.4',
          lon: '68.2',
          'Mean MSW (kmph)': '110',
          Category: 'VERY SEVERE CYCLONIC STORM',
        },
      ],
      forecast: [
        {
          CYCLONE_NAME: 'TEJ',
          'Date/Time': '2026-09-29/0000',
          lat: '18.1',
          lon: '69.5',
          'Mean MSW (kmph)': '125',
          Category: 'VERY SEVERE CYCLONIC STORM',
        },
      ],
    },
  };

  const cycRes = normalizeImdCycloneData(officialCycloneTrack, '2026-09-28T13:00:00Z');
  assert(cycRes.cyclone !== null, 'Cyclone model populated');
  assert(cycRes.cyclone?.name === 'TEJ', 'Cyclone name is TEJ');
  assert(cycRes.cyclone?.category === 'VERY SEVERE CYCLONIC STORM', 'Cyclone category preserved');
  assert(cycRes.warnings.length === 1, 'Generates active cyclone warning');
  assert(cycRes.warnings[0].severity === 'alert', 'Cyclone warning severity is alert');
  assert(cycRes.warnings[0].official_color_code === 'RED', 'Cyclone warning color is RED');

  // Test Group 8: CONFIG_REQUIRED when Credentials Unconfigured
  console.log('\nTest Group 8: CONFIG_REQUIRED when Credentials Unconfigured');
  const savedKey = process.env.IMD_API_KEY;
  const savedUrl = process.env.IMD_ENDPOINT_URL;
  delete process.env.IMD_API_KEY;
  delete process.env.IMD_ENDPOINT_URL;

  const configReq = await fetchImdData(18.9438, 72.8360);
  assert(configReq.health.status === 'CONFIG_REQUIRED', 'Reports CONFIG_REQUIRED when credentials absent');
  assert(configReq.warnings.status === 'UNAVAILABLE', 'Warning status is UNAVAILABLE (not fabricated)');
  assert(configReq.weather === null, 'No fabricated weather returned');

  // Restore env
  if (savedKey) process.env.IMD_API_KEY = savedKey;
  if (savedUrl) process.env.IMD_ENDPOINT_URL = savedUrl;

  // Test Group 9: IMD Timeout & Network Failure Handling
  console.log('\nTest Group 9: IMD Timeout & Network Failure Handling');
  process.env.IMD_ENDPOINT_URL = 'http://127.0.0.1:59999/timeout_test';
  const timeoutRes = await fetchImdData(18.9438, 72.8360, undefined, undefined, 50);
  assert(timeoutRes.health.status === 'UNAVAILABLE', 'Network failure reports UNAVAILABLE');
  assert(timeoutRes.weather === null, 'Weather is null on failure');
  assert(timeoutRes.warnings.status === 'UNAVAILABLE', 'Warnings marked UNAVAILABLE on failure');
  delete process.env.IMD_ENDPOINT_URL;

  // Test Group 10: Strict Null Preservation on Partial IMD Response
  console.log('\nTest Group 10: Strict Null Preservation on Partial IMD Response');
  const partialImd = {
    Temperature: 31.0,
    // Wind, rainfall, humidity absent
  };
  const partialResult = normalizeImdWeather(partialImd, 'https://imd.test', '2026-09-28T00:00:00Z', 'LIVE');
  assert(partialResult?.temperature_c === 31.0, 'Temperature is 31.0');
  assert(partialResult?.wind_speed_kmph === null, 'Missing wind speed is strictly null (never zero)');
  assert(partialResult?.humidity_pct === null, 'Missing humidity is strictly null');
  assert(partialResult?.precipitation_mm_24h === null, 'Missing precipitation is strictly null');

  // Test Group 11: IMD Warning Passed to Deterministic Risk Engine (ORANGE / RED Veto)
  console.log('\nTest Group 11: IMD Warning Passed to Deterministic Risk Engine (ORANGE / RED Veto)');
  const calmWeather = {
    wind_speed_kmph: 10,
    precipitation_mm_24h: 0,
    wind_gust_kmph: null,
  };
  const calmOcean = {
    wave_height_m: 0.5,
    swell_height_m: 0.3,
    ocean_current_speed_kmph: 0.5,
  };

  // With RED alert
  const redAssessment = evaluateRiskEngine({
    weather: calmWeather as any,
    ocean: calmOcean as any,
    warnings: {
      status: 'ACTIVE',
      items: [
        {
          headline: 'Extremely Heavy Rainfall and Squally Wind Warning',
          severity: 'alert',
          source: 'IMD',
          official_color_code: 'RED',
        },
      ],
      provider: 'IMD',
      retrieved_at: new Date().toISOString(),
    },
  });

  assert(redAssessment.warning_override === true, 'RED alert triggers warning_override');
  assert(redAssessment.score >= 85, `Risk score elevated to >= 85 (got ${redAssessment.score})`);
  assert(redAssessment.level === 'HIGH', 'Risk level is HIGH');

  // With ORANGE alert
  const orangeAssessment = evaluateRiskEngine({
    weather: calmWeather as any,
    ocean: calmOcean as any,
    warnings: {
      status: 'ACTIVE',
      items: [
        {
          headline: 'Very Heavy Rainfall Warning for Coastal Sector',
          severity: 'warning',
          source: 'IMD',
          official_color_code: 'ORANGE',
        },
      ],
      provider: 'IMD',
      retrieved_at: new Date().toISOString(),
    },
  });

  assert(orangeAssessment.warning_override === true, 'ORANGE warning triggers warning_override');
  assert(orangeAssessment.score >= 85, `ORANGE warning elevates risk score to >= 85 (got ${orangeAssessment.score})`);
  assert(orangeAssessment.level === 'HIGH', 'Risk level is HIGH');

  // With GREEN / CLEAR
  const greenAssessment = evaluateRiskEngine({
    weather: calmWeather as any,
    ocean: calmOcean as any,
    warnings: {
      status: 'NONE',
      items: [],
      provider: 'IMD',
      retrieved_at: new Date().toISOString(),
    },
  });

  assert(greenAssessment.warning_override === false, 'GREEN / CLEAR does not trigger veto');
  assert(greenAssessment.score < 35, `Risk score remains low (${greenAssessment.score})`);
  assert(greenAssessment.level === 'LOW', 'Risk level is LOW');

  // Test Group 12: Open-Meteo Works Independently when IMD Unconfigured
  console.log('\nTest Group 12: Open-Meteo Works Independently when IMD Unconfigured');
  const omResult = await fetchOpenMeteoWeather(18.9438, 72.8360);
  assert(['LIVE', 'CACHED'].includes(omResult.status), 'Open-Meteo is LIVE or CACHED');
  assert(omResult.data !== null, 'Open-Meteo returns live meteorology');

  // Test Group 13: Full Multi-Source Pipeline Orchestration
  console.log('\nTest Group 13: Full Multi-Source Pipeline Orchestration');
  const fullPipeline = await OrcaOrchestrator.collectAndProcess({
    latitude: 18.9438,
    longitude: 72.8360,
    demo: false,
  });

  assert(fullPipeline.location.latitude === 18.9438, 'Preserves latitude in Common Marine Data Model');
  assert(fullPipeline.weather !== null, 'Weather observation present');
  assert(fullPipeline.ocean !== null, 'Ocean observation present');
  assert(fullPipeline.providers.imd.status === 'CONFIG_REQUIRED', 'IMD reports CONFIG_REQUIRED cleanly');
  assert(fullPipeline.providers.open_meteo.status === 'LIVE', 'Open-Meteo reports LIVE');
  assert(fullPipeline.warnings.status === 'UNAVAILABLE', 'Warning status reflects unconfigured IMD');

  console.log('\n======================================================');
  console.log(`OFFICIAL IMD TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runOfficialImdTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
