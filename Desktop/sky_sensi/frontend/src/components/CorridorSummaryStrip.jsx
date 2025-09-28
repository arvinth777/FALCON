import React from 'react';

// Helper functions outside component to prevent recreation on each render
const formatTime = (timestamp) => {
  if (!timestamp) return 'N/A';
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toUTCString().slice(-12, -4) + 'Z'; // Extract HH:MMZ format
  } catch {
    return 'N/A';
  }
};

const formatNumber = (value) => {
  return value !== null && value !== undefined ? value : 'N/A';
};

const CorridorSummaryStrip = ({ summary, updatedAt }) => {
  // Early return if no summary
  if (!summary) {
    return null;
  }

  const SummaryPill = ({ label, value, color = 'bg-gray-100 text-gray-800' }) => (
    <div className={`px-3 py-1 rounded-full text-sm font-medium ${color}`}>
      <span className="font-semibold">{label}:</span> {value}
    </div>
  );

  const getSigmetColor = (type, count) => {
    if (count === 0) return 'bg-gray-100 text-gray-600';
    switch (type) {
      case 'convective':
        return 'bg-red-100 text-red-800';
      case 'icing':
        return 'bg-blue-100 text-blue-800';
      case 'turbulence':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getVisibilityColor = (vis) => {
    if (vis === null || vis === undefined || vis === 'N/A') return 'bg-gray-100 text-gray-600';
    if (vis < 3) return 'bg-red-100 text-red-800';
    if (vis < 5) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getCeilingColor = (ceiling) => {
    if (ceiling === null || ceiling === undefined || ceiling === 'N/A') return 'bg-gray-100 text-gray-600';
    if (ceiling < 500) return 'bg-red-100 text-red-800';
    if (ceiling < 1000) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        {/* SIGMETs Summary */}
        <SummaryPill
          label="SIGMETs"
          value={summary.sigmets?.total || 0}
          color="bg-purple-100 text-purple-800"
        />

        {/* SIGMET Breakdown */}
        {summary.sigmets?.convective > 0 && (
          <SummaryPill
            label="Conv"
            value={summary.sigmets.convective}
            color={getSigmetColor('convective', summary.sigmets.convective)}
          />
        )}

        {summary.sigmets?.icing > 0 && (
          <SummaryPill
            label="Ice"
            value={summary.sigmets.icing}
            color={getSigmetColor('icing', summary.sigmets.icing)}
          />
        )}

        {summary.sigmets?.turbulence > 0 && (
          <SummaryPill
            label="Turb"
            value={summary.sigmets.turbulence}
            color={getSigmetColor('turbulence', summary.sigmets.turbulence)}
          />
        )}

        {/* PIREPs Summary */}
        <SummaryPill
          label="PIREPs"
          value={summary.pireps?.total || 0}
          color="bg-indigo-100 text-indigo-800"
        />

        {summary.pireps?.turbulenceMODplus > 0 && (
          <SummaryPill
            label="Turb MOD+"
            value={summary.pireps.turbulenceMODplus}
            color="bg-orange-100 text-orange-800"
          />
        )}

        {summary.pireps?.icingMODplus > 0 && (
          <SummaryPill
            label="Ice MOD+"
            value={summary.pireps.icingMODplus}
            color="bg-cyan-100 text-cyan-800"
          />
        )}

        {/* Weather Conditions */}
        <SummaryPill
          label="Worst Vis"
          value={summary.worstVisibilitySM !== null ? `${summary.worstVisibilitySM}SM` : 'N/A'}
          color={getVisibilityColor(summary.worstVisibilitySM)}
        />

        <SummaryPill
          label="Low Ceiling"
          value={summary.lowestCeilingFt !== null ? `${summary.lowestCeilingFt}ft` : 'N/A'}
          color={getCeilingColor(summary.lowestCeilingFt)}
        />

        {/* Updated Time */}
        <SummaryPill
          label="Updated"
          value={formatTime(updatedAt)}
          color="bg-gray-100 text-gray-600"
        />
      </div>
    </div>
  );
};

export default React.memo(CorridorSummaryStrip);