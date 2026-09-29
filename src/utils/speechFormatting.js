/**
 * Speech Formatting Utility for ORCA Marine Intelligence
 * 
 * Transforms authoritative backend marine assessments into natural,
 * human-friendly, conversational spoken text for female voice delivery.
 * 
 * Ensures:
 * 1. Strict semantic fidelity with backend response.decision (GO / CAUTION / NO-GO)
 * 2. Units and numbers are translated into natural spoken words (e.g. 2.4 m -> 2.4 metres)
 * 3. Priority ordering: Decision -> Immediate Action -> Warnings -> Conditions -> Context
 * 4. No robotic jargon, no raw JSON, no technical field keys.
 */

/**
 * Format numeric value for natural speech
 */
function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return null;
  return Math.round(num * 10) / 10;
}

/**
 * Speech formatter for the authoritative assessment
 * @param {Object} assessment - Authoritative ORCA response from /api/assess
 * @param {'mr' | 'hi' | 'en'} language - Selected application language
 * @param {'fisherman' | 'coast_guard' | 'researcher'} role - Active operational role
 * @returns {string} Natural speech text matching the displayed assessment
 */
export function formatAssessmentForSpeech(assessment, language = 'en', role = 'fisherman') {
  if (!assessment) {
    if (language === 'mr') return 'सध्या सागरी मूल्यांकन उपलब्ध नाही. कृपया स्क्रीनवर माहिती पहा.';
    if (language === 'hi') return 'वर्तमान समुद्री मूल्यांकन उपलब्ध नहीं है। कृपया स्क्रीन पर विवरण देखें।';
    return 'Marine assessment is currently unavailable. Please review the displayed screen details.';
  }

  const decision = assessment.decision || assessment.deterministic_decision || 'GO';
  const isVeto = assessment.veto?.is_veto || assessment.veto?.triggered || decision === 'NO-GO';
  const vetoReasons = assessment.veto?.veto_reasons || [];
  const warnings = assessment.warnings || [];
  const ocean = assessment.ocean || {};
  const weather = assessment.weather || {};
  const waveHeight = formatNumber(ocean.wave_height_m);
  const windSpeed = formatNumber(weather.wind_speed_kmph);
  const windGust = formatNumber(weather.wind_gust_kmph);
  const driftVelocity = formatNumber(assessment.drift?.leeway_drift_velocity_kmph || assessment.drift?.prediction?.leeway_drift_velocity_kmph);
  const searchRadius = formatNumber(assessment.search_radius?.radius_nm || assessment.drift?.prediction?.search_radius_nm);
  const sst = formatNumber(ocean.sea_surface_temperature_c);
  const _locationLabel = assessment.location?.label || 'Maharashtra Coastal Waters';

  // ==========================================
  // MARATHI (mr-IN) NATURAL SPEECH
  // ==========================================
  if (language === 'mr') {
    const parts = [];

    // 1. Primary Decision (Most important first)
    if (decision === 'NO-GO' || isVeto) {
      parts.push('सध्या समुद्रात जाणे सुरक्षित नाही. समुद्र मोहीम त्वरित स्थगित करावी.');
    } else if (decision === 'CAUTION') {
      parts.push('सावधगिरी बाळगा. समुद्रात मध्यम धोका असून लहान नौकांनी विशेष दक्षता घ्यावी.');
    } else {
      parts.push('सध्या समुद्राची स्थिती सामान्य आणि अनुकूल आहे.');
    }

    // 2. Official warnings / Veto triggers
    if (warnings.length > 0) {
      const firstWarn = warnings[0];
      const warnHeadline = firstWarn.headline || firstWarn.message;
      if (warnHeadline) {
        parts.push(`हवामान खात्याचा अधिकृत इशारा लागू आहे: ${warnHeadline}.`);
      } else {
        parts.push('हवामान खात्याचा अधिकृत सागरी इशारा लागू आहे.');
      }
    } else if (isVeto && vetoReasons.length > 0) {
      parts.push(`सुरक्षा कारण: ${vetoReasons[0]}.`);
    }

    // 3. Environmental conditions (Numbers and units naturally converted)
    const condTokens = [];
    if (waveHeight !== null) {
      condTokens.push(`लाटांची उंची सुमारे ${waveHeight} मीटर`);
    }
    if (windSpeed !== null) {
      let windText = `वाऱ्याचा वेग ${windSpeed} किलोमीटर प्रति तास`;
      if (windGust !== null && windGust > windSpeed) {
        windText += `, आणि वाऱ्याचे झोके ${windGust} किलोमीटर प्रति तास`;
      }
      condTokens.push(windText);
    }
    if (condTokens.length > 0) {
      parts.push(`सध्या ${condTokens.join(' असून, ')} आहे.`);
    }

    // 4. Role-specific context
    if (role === 'coast_guard' && driftVelocity !== null) {
      parts.push(`शोध मोहिमेसाठी वाहून जाण्याचा वेग सुमारे ${driftVelocity} किलोमीटर प्रति तास, आणि शोध त्रिज्या ${searchRadius || '2.5'} नॉटिकल मैल आहे.`);
    } else if (role === 'researcher' && sst !== null) {
      parts.push(`समुद्र पृष्ठभागाचे तापमान ${sst} अंश सेल्सिअस नोंदवले गेले आहे.`);
    }

    // 5. Official guidance reminder
    parts.push('कृपया अधिकृत सागरी हवामान सूचनांचे नेहमी पालन करा.');

    return parts.join(' ');
  }

  // ==========================================
  // HINDI (hi-IN) NATURAL SPEECH
  // ==========================================
  if (language === 'hi') {
    const parts = [];

    // 1. Primary Decision
    if (decision === 'NO-GO' || isVeto) {
      parts.push('अभी समुद्र में जाना सुरक्षित नहीं है। समुद्री परिचालन तुरंत स्थगित करें।');
    } else if (decision === 'CAUTION') {
      parts.push('सावधानी बरतें। समुद्र में मध्यम जोखिम है, और छोटी नौकाओं को तट के पास ही रहना चाहिए।');
    } else {
      parts.push('समुद्र की स्थिति वर्तमान में सामान्य और अनुकूल है।');
    }

    // 2. Official warnings / Veto triggers
    if (warnings.length > 0) {
      const firstWarn = warnings[0];
      const warnHeadline = firstWarn.headline || firstWarn.message;
      if (warnHeadline) {
        parts.push(`मौसम विभाग की आधिकारिक चेतावनी प्रभावी है: ${warnHeadline}.`);
      } else {
        parts.push('आधिकारिक समुद्री मौसम चेतावनी प्रभावी है।');
      }
    } else if (isVeto && vetoReasons.length > 0) {
      parts.push(`सुरक्षा कारण: ${vetoReasons[0]}.`);
    }

    // 3. Environmental conditions
    const condTokens = [];
    if (waveHeight !== null) {
      condTokens.push(`लहरों की ऊंचाई लगभग ${waveHeight} मीटर`);
    }
    if (windSpeed !== null) {
      let windText = `हवा की गति ${windSpeed} किलोमीटर प्रति घंटा`;
      if (windGust !== null && windGust > windSpeed) {
        windText += `, और हवा के झोंके ${windGust} किलोमीटर प्रति घंटा`;
      }
      condTokens.push(windText);
    }
    if (condTokens.length > 0) {
      parts.push(`वर्तमान में ${condTokens.join(' तथा ')} है।`);
    }

    // 4. Role-specific context
    if (role === 'coast_guard' && driftVelocity !== null) {
      parts.push(`तटरक्षक राहत कार्य के लिए लीवे ड्रिफ्ट वेग ${driftVelocity} किलोमीटर प्रति घंटा और खोज दायरा ${searchRadius || '2.5'} नॉटिकल मील अनुमानित है।`);
    } else if (role === 'researcher' && sst !== null) {
      parts.push(`समुद्र सतह का तापमान ${sst} डिग्री सेल्सियस दर्ज किया गया है।`);
    }

    // 5. Official guidance reminder
    parts.push('कृपया आधिकारिक मौसम बुलेटिन के निर्देशों का हमेशा पालन करें।');

    return parts.join(' ');
  }

  // ==========================================
  // ENGLISH (en-IN) NATURAL SPEECH
  // ==========================================
  const parts = [];

  // 1. Primary Decision
  if (decision === 'NO-GO' || isVeto) {
    parts.push('Please do not go to sea right now. Sea operations are currently vetoed due to hazardous marine conditions.');
  } else if (decision === 'CAUTION') {
    parts.push('Please exercise high caution. Conditions are moderately rough, and small coastal craft should remain vigilant.');
  } else {
    parts.push('Marine conditions appear generally manageable and safe for coastal operations.');
  }

  // 2. Official warnings / Veto triggers
  if (warnings.length > 0) {
    const firstWarn = warnings[0];
    const warnHeadline = firstWarn.headline || firstWarn.message;
    if (warnHeadline) {
      parts.push(`An official warning is in effect: ${warnHeadline}.`);
    } else {
      parts.push('An official meteorological marine warning is currently active.');
    }
  } else if (isVeto && vetoReasons.length > 0) {
    parts.push(`Primary safety factor: ${vetoReasons[0]}.`);
  }

  // 3. Environmental conditions
  const condTokens = [];
  if (waveHeight !== null) {
    condTokens.push(`wave height is around ${waveHeight} metres`);
  }
  if (windSpeed !== null) {
    let windText = `winds are about ${windSpeed} kilometres per hour`;
    if (windGust !== null && windGust > windSpeed) {
      windText += ` with gusts reaching ${windGust} kilometres per hour`;
    }
    condTokens.push(windText);
  }
  if (condTokens.length > 0) {
    parts.push(`Currently, ${condTokens.join(', and ')}.`);
  }

  // 4. Role-specific context
  if (role === 'coast_guard' && driftVelocity !== null) {
    parts.push(`Estimated leeway drift velocity is ${driftVelocity} kilometres per hour, with a recommended search radius of ${searchRadius || '2.5'} nautical miles.`);
  } else if (role === 'researcher' && sst !== null) {
    parts.push(`Sea surface temperature is measured at ${sst} degrees Celsius.`);
  }

  // 5. Official guidance reminder
  parts.push('This is an advisory assessment. Always follow official Coast Guard and IMD bulletins.');

  return parts.join(' ');
}
