/**
 * Summarize corridor hazards and conditions
 * @param {Object} data - { airports, metarsByIcao, sigmets, isigmets, pireps }
 * @returns {Object} Summary object
 */
function summarizeCorridor({ airports, metarsByIcao, sigmets, isigmets, pireps }) {
  // Initialize summary object
  const summary = {
    sigmets: {
      total: 0,
      convective: 0,
      icing: 0,
      turbulence: 0,
      other: 0
    },
    pireps: {
      total: 0,
      turbulenceMODplus: 0,
      icingMODplus: 0
    },
    lowestCeilingFt: null,
    worstVisibilitySM: null,
    topsMaxFt: null
  };

  // Process SIGMETs
  const allSigmets = [
    ...(sigmets?.features || []),
    ...(isigmets?.features || [])
  ];

  summary.sigmets.total = allSigmets.length;

  allSigmets.forEach(sigmet => {
    const phenomenon = (sigmet.properties?.phenomenon || '').toUpperCase();

    if (phenomenon.includes('CONV')) {
      summary.sigmets.convective++;
    } else if (phenomenon.includes('ICE')) {
      summary.sigmets.icing++;
    } else if (phenomenon.includes('TURB')) {
      summary.sigmets.turbulence++;
    } else {
      summary.sigmets.other++;
    }
  });

  // Process PIREPs
  const allPireps = pireps || [];
  summary.pireps.total = allPireps.length;

  allPireps.forEach(pirep => {
    if (pirep.turbulenceIntensity) {
      const intensity = pirep.turbulenceIntensity.toUpperCase();
      if (['MOD', 'MDT', 'SEV', 'SVR'].includes(intensity)) {
        summary.pireps.turbulenceMODplus++;
      }
    }

    if (pirep.icingIntensity) {
      const intensity = pirep.icingIntensity.toUpperCase();
      if (['MOD', 'MDT', 'SEV', 'SVR'].includes(intensity)) {
        summary.pireps.icingMODplus++;
      }
    }
  });

  // Process airports for ceiling and visibility using metarsByIcao
  const validAirports = airports || [];

  validAirports.forEach(airport => {
    const icao = airport.icao || airport.icaoCode;
    if (!icao || !metarsByIcao || !metarsByIcao[icao]) {
      return;
    }

    const metarData = metarsByIcao[icao];

    if (metarData) {
      // Find lowest ceiling - look for clouds with BKN or OVC
      if (Array.isArray(metarData.clouds)) {
        const ceilingClouds = metarData.clouds.filter(cloud =>
          cloud.cover === 'BKN' || cloud.cover === 'OVC'
        ).sort((a, b) => a.base - b.base);

        if (ceilingClouds.length > 0) {
          const ceilingFt = ceilingClouds[0].base;
          if (summary.lowestCeilingFt === null || ceilingFt < summary.lowestCeilingFt) {
            summary.lowestCeilingFt = ceilingFt;
          }
        }
      }

      // Find worst visibility
      const visibility = metarData.visibility;
      if (visibility !== undefined && visibility !== null && typeof visibility === 'number') {
        if (summary.worstVisibilitySM === null || visibility < summary.worstVisibilitySM) {
          summary.worstVisibilitySM = visibility;
        }
      }
    }
  });

  // Leave topsMaxFt as null for now as specified
  summary.topsMaxFt = null;

  return summary;
}

module.exports = {
  summarizeCorridor
};