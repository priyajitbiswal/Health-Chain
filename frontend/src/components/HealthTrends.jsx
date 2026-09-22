import React, { useState } from 'react';

export default function HealthTrends({ historyData, onSelectDate, selectedDate }) {
  const [activeTab, setActiveTab] = useState('steps'); // 'steps' | 'sleepHeart'
  const [hoveredDay, setHoveredDay] = useState(null);

  if (!historyData || !historyData.history || historyData.history.length === 0) {
    return (
      <section className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>📈</span>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
              7-Day Health Analytics & Streak Tracker
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '4px 0 0' }}>
              Loading historical telemetry... (Note: If your backend server was started before this update, please restart it with <code>npm start</code> in the backend terminal so it serves the new history API).
            </p>
          </div>
        </div>
      </section>
    );
  }

  const {
    history,
    currentStepStreak,
    bestStepStreak,
    currentSleepStreak,
    integrityScore,
    verifiedDays,
    totalDays,
    streakBonusPoints,
    averages
  } = historyData;

  // Chart coordinate math
  const maxSteps = Math.max(...history.map((d) => d.steps), 12000);
  const chartHeight = 160;
  const chartWidth = 520;
  const barWidth = 44;
  const gap = (chartWidth - barWidth * history.length) / (history.length + 1);

  // Threshold line position for steps (10,000)
  const thresholdStepsY = chartHeight - (10000 / maxSteps) * (chartHeight - 30) - 20;

  // Threshold line position for sleep (7.0 hours out of max 10.0h)
  const maxSleep = 10.0;
  const thresholdSleepY = chartHeight - (7.0 / maxSleep) * (chartHeight - 30) - 20;

  return (
    <section className="card" style={{ marginBottom: '24px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '18px'
        }}
      >
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
            📈 7-Day Health Analytics & Streak Tracker
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '2px 0 0' }}>
            Multi-device telemetry trends and habit streak underwriting
          </p>
        </div>

        <div style={{ display: 'inline-flex', backgroundColor: '#F1F5F9', padding: '3px', borderRadius: '8px' }}>
          <button
            type="button"
            className="btn"
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              borderRadius: '6px',
              backgroundColor: activeTab === 'steps' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'steps' ? 'var(--primary)' : 'var(--muted)',
              fontWeight: activeTab === 'steps' ? 600 : 500,
              boxShadow: activeTab === 'steps' ? 'var(--shadow-sm)' : 'none'
            }}
            onClick={() => setActiveTab('steps')}
          >
            🏃 Step Trends
          </button>
          <button
            type="button"
            className="btn"
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              borderRadius: '6px',
              backgroundColor: activeTab === 'sleepHeart' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'sleepHeart' ? 'var(--primary)' : 'var(--muted)',
              fontWeight: activeTab === 'sleepHeart' ? 600 : 500,
              boxShadow: activeTab === 'sleepHeart' ? 'var(--shadow-sm)' : 'none'
            }}
            onClick={() => setActiveTab('sleepHeart')}
          >
            🌙 Sleep & Heart Rate
          </button>
        </div>
      </div>

      {/* 4 Streak & Integrity Metric Badges */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
          marginBottom: '20px'
        }}
      >
        <div className="streak-badge-card">
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
            🔥 10k Step Streak
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: currentStepStreak > 0 ? '#16A34A' : 'var(--text)' }}>
            {currentStepStreak} {currentStepStreak === 1 ? 'Day' : 'Days'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
            Best: {bestStepStreak} days
          </div>
        </div>

        <div className="streak-badge-card">
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
            🌙 Sleep Streak (≥7h)
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: currentSleepStreak > 0 ? '#2563EB' : 'var(--text)' }}>
            {currentSleepStreak} {currentSleepStreak === 1 ? 'Day' : 'Days'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
            Avg: {averages.sleepHours}h / night
          </div>
        </div>

        <div className="streak-badge-card">
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
            🛡️ Consensus Score
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: integrityScore >= 80 ? '#16A34A' : 'var(--danger)' }}>
            {integrityScore}%
          </div>
          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
            {verifiedDays} / {totalDays} days verified
          </div>
        </div>

        <div className="streak-badge-card">
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
            💎 Streak Bonus
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: streakBonusPoints > 0 ? '#D97706' : 'var(--muted)' }}>
            +{streakBonusPoints} PTS
          </div>
          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
            {streakBonusPoints > 0 ? 'Active bonus awarded' : 'Reach 3 days for +50'}
          </div>
        </div>
      </div>

      {/* SVG Interactive Visual Charts */}
      <div style={{ overflowX: 'auto', paddingBottom: '8px' }}>
        {activeTab === 'steps' ? (
          <div style={{ minWidth: '520px' }}>
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight + 30}`}
              style={{ width: '100%', height: 'auto', display: 'block' }}
            >
              {/* Background gridlines */}
              <line x1="0" y1={thresholdStepsY} x2={chartWidth} y2={thresholdStepsY} stroke="#16A34A" strokeDasharray="4,4" strokeWidth="1.5" />
              <text x={chartWidth - 8} y={thresholdStepsY - 4} textAnchor="end" fill="#16A34A" fontSize="10" fontWeight="600">
                10,000 Target (10% Discount Threshold)
              </text>

              {/* Bars for each day */}
              {history.map((day, idx) => {
                const x = gap + idx * (barWidth + gap);
                const barHeight = Math.max(((day.steps / maxSteps) * (chartHeight - 30)), 12);
                const y = chartHeight - barHeight - 10;
                const isSelected = selectedDate === day.date;
                const isHovered = hoveredDay === day.date;

                let fillColor = '#2563EB'; // Normal verified
                if (!day.validated) {
                  fillColor = '#DC2626'; // Anomaly
                } else if (day.stepsQualified) {
                  fillColor = '#16A34A'; // Qualified
                }

                const displayDate = day.date.slice(5); // MM-DD

                return (
                  <g
                    key={day.date}
                    style={{ cursor: 'pointer' }}
                    onClick={() => onSelectDate(day.date)}
                    onMouseEnter={() => setHoveredDay(day.date)}
                    onMouseLeave={() => setHoveredDay(null)}
                  >
                    {/* Selection highlight aura */}
                    {(isSelected || isHovered) && (
                      <rect
                        x={x - 4}
                        y={10}
                        width={barWidth + 8}
                        height={chartHeight + 16}
                        fill="#F1F5F9"
                        rx="8"
                        opacity={isSelected ? 0.9 : 0.5}
                      />
                    )}

                    {/* Bar */}
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx="4"
                      fill={fillColor}
                      opacity={isSelected || isHovered ? 1.0 : 0.85}
                    />

                    {/* Step count label on top of bar */}
                    <text
                      x={x + barWidth / 2}
                      y={y - 5}
                      textAnchor="middle"
                      fill="var(--text)"
                      fontSize="10"
                      fontWeight="600"
                    >
                      {day.steps.toLocaleString()}
                    </text>

                    {/* Date label at bottom */}
                    <text
                      x={x + barWidth / 2}
                      y={chartHeight + 12}
                      textAnchor="middle"
                      fill={isSelected ? 'var(--primary)' : 'var(--muted)'}
                      fontSize="11"
                      fontWeight={isSelected ? '700' : '500'}
                    >
                      {displayDate}
                    </text>

                    {/* Status indicator dot */}
                    <circle
                      cx={x + barWidth / 2}
                      cy={chartHeight + 22}
                      r="3"
                      fill={day.validated ? (day.stepsQualified ? '#16A34A' : '#2563EB') : '#DC2626'}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Legend & Details */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                marginTop: '10px',
                fontSize: '12px',
                color: 'var(--muted)',
                paddingTop: '8px',
                borderTop: '1px solid #F1F5F9'
              }}
            >
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '10px', height: '10px', backgroundColor: '#16A34A', borderRadius: '2px' }} />
                  Qualified (≥ 10,000)
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '10px', height: '10px', backgroundColor: '#2563EB', borderRadius: '2px' }} />
                  Normal Habit (&lt; 10,000)
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '10px', height: '10px', backgroundColor: '#DC2626', borderRadius: '2px' }} />
                  Integrity Anomaly
                </span>
              </div>
              <span style={{ fontSize: '11px' }}>
                💡 Click any bar to load that date into the Patient Portal
              </span>
            </div>
          </div>
        ) : (
          <div style={{ minWidth: '520px' }}>
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight + 30}`}
              style={{ width: '100%', height: 'auto', display: 'block' }}
            >
              {/* Threshold line for 7.0h sleep */}
              <line x1="0" y1={thresholdSleepY} x2={chartWidth} y2={thresholdSleepY} stroke="#3B82F6" strokeDasharray="4,4" strokeWidth="1.5" />
              <text x={chartWidth - 8} y={thresholdSleepY - 4} textAnchor="end" fill="#3B82F6" fontSize="10" fontWeight="600">
                7.0h Sleep Target (5% Discount Threshold)
              </text>

              {/* Connected line for sleep */}
              <polyline
                fill="none"
                stroke="#3B82F6"
                strokeWidth="2.5"
                points={history
                  .map((d, i) => {
                    const x = gap + i * (barWidth + gap) + barWidth / 2;
                    const y = chartHeight - (d.sleepHours / maxSleep) * (chartHeight - 30) - 15;
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />

              {/* Plot points and values */}
              {history.map((day, idx) => {
                const x = gap + idx * (barWidth + gap) + barWidth / 2;
                const ySleep = chartHeight - (day.sleepHours / maxSleep) * (chartHeight - 30) - 15;
                const isSelected = selectedDate === day.date;
                const displayDate = day.date.slice(5);

                return (
                  <g key={day.date} style={{ cursor: 'pointer' }} onClick={() => onSelectDate(day.date)}>
                    {isSelected && (
                      <circle cx={x} cy={ySleep} r="9" fill="#93C5FD" opacity="0.4" />
                    )}
                    <circle
                      cx={x}
                      cy={ySleep}
                      r="4.5"
                      fill={day.sleepQualified ? '#2563EB' : '#94A3B8'}
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                    />
                    <text x={x} y={ySleep - 8} textAnchor="middle" fill="#1E40AF" fontSize="10" fontWeight="600">
                      {day.sleepHours}h
                    </text>
                    <text
                      x={x}
                      y={chartHeight + 12}
                      textAnchor="middle"
                      fill={isSelected ? 'var(--primary)' : 'var(--muted)'}
                      fontSize="11"
                      fontWeight={isSelected ? '700' : '500'}
                    >
                      {displayDate}
                    </text>
                    <text x={x} y={chartHeight + 24} textAnchor="middle" fill="#DC2626" fontSize="9" fontWeight="500">
                      {day.heartRate} bpm
                    </text>
                  </g>
                );
              })}
            </svg>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                marginTop: '10px',
                fontSize: '12px',
                color: 'var(--muted)',
                paddingTop: '8px',
                borderTop: '1px solid #F1F5F9'
              }}
            >
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '12px', height: '3px', backgroundColor: '#3B82F6' }} />
                  Sleep Duration (hours)
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ color: '#DC2626', fontWeight: 600 }}>●</span>
                  Resting Heart Rate (bpm)
                </span>
              </div>
              <span style={{ fontSize: '11px' }}>
                7-day average: {averages.sleepHours}h sleep, {averages.heartRate} bpm HR
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
