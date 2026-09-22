import React, { useState, useEffect } from 'react';
import StatusBadge from './StatusBadge.jsx';

const PRESETS = {
  legitimate: {
    label: '🟢 Legitimate Consensus',
    desc: 'All 3 devices report consistent metrics within <1% variance (≥ 10,000 steps qualifies 15% discount)',
    sources: [
      { source: 'Mock Fitbit', steps: 10450, heartRate: 72, sleepHours: 7.5, calories: 2350 },
      { source: 'Mock Smartwatch', steps: 10380, heartRate: 74, sleepHours: 7.3, calories: 2320 },
      { source: 'Mock Phone', steps: 10420, heartRate: 71, sleepHours: 7.4, calories: 2360 }
    ]
  },
  pedometerFraud: {
    label: '🔴 Pedometer Shaking Fraud',
    desc: 'Fitbit is shaken vigorously to spoof 24,000 steps while phone in pocket records only 8,100 steps (>10% breach)',
    sources: [
      { source: 'Mock Fitbit', steps: 24000, heartRate: 72, sleepHours: 7.5, calories: 2350 },
      { source: 'Mock Smartwatch', steps: 8000, heartRate: 74, sleepHours: 7.3, calories: 2100 },
      { source: 'Mock Phone', steps: 8100, heartRate: 71, sleepHours: 7.4, calories: 2120 }
    ]
  },
  sleepDesync: {
    label: '🔴 Sleep Tracker Desync',
    desc: 'Smartwatch logs 8.0h sleep, but phone detects active screen use with only 2.5h sleep (>1.0h breach)',
    sources: [
      { source: 'Mock Fitbit', steps: 9500, heartRate: 68, sleepHours: 7.8, calories: 2200 },
      { source: 'Mock Smartwatch', steps: 9450, heartRate: 70, sleepHours: 8.0, calories: 2180 },
      { source: 'Mock Phone', steps: 9520, heartRate: 69, sleepHours: 2.5, calories: 2210 }
    ]
  },
  heartRateOutlier: {
    label: '🔴 Tachycardia / HR Outlier',
    desc: 'Smartwatch optical sensor glitches to 145 bpm while Fitbit reads 70 bpm (>10 bpm breach)',
    sources: [
      { source: 'Mock Fitbit', steps: 10200, heartRate: 70, sleepHours: 7.5, calories: 2300 },
      { source: 'Mock Smartwatch', steps: 10150, heartRate: 145, sleepHours: 7.3, calories: 2320 },
      { source: 'Mock Phone', steps: 10220, heartRate: 71, sleepHours: 7.4, calories: 2310 }
    ]
  }
};

export default function AnomalySandbox({
  baselineSources,
  onApplySandbox,
  onResetSandbox,
  isApplied,
  patientId,
  selectedDate
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSourceIndex, setActiveSourceIndex] = useState(0); // 0: Fitbit, 1: Watch, 2: Phone
  const [sandboxSources, setSandboxSources] = useState([]);
  const [simulationResult, setSimulationResult] = useState(null);
  const [simulating, setSimulating] = useState(false);

  // Initialize sandbox sources whenever baseline changes or reset
  useEffect(() => {
    if (baselineSources && baselineSources.length === 3) {
      setSandboxSources(JSON.parse(JSON.stringify(baselineSources)));
    } else {
      setSandboxSources(JSON.parse(JSON.stringify(PRESETS.legitimate.sources)));
    }
  }, [baselineSources]);

  // Run backend simulation check whenever sandbox sources change
  useEffect(() => {
    if (sandboxSources.length !== 3) return;

    let isMounted = true;
    setSimulating(true);

    fetch('/api/health/simulate-validation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        date: selectedDate,
        sources: sandboxSources
      })
    })
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.success) {
          setSimulationResult(data.data);
          if (isApplied) {
            onApplySandbox(sandboxSources, data.data);
          }
        }
      })
      .catch((err) => console.error('Simulation check failed:', err))
      .finally(() => {
        if (isMounted) setSimulating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [sandboxSources, isApplied, patientId, selectedDate, onApplySandbox]);

  const handleMetricChange = (field, value) => {
    const num = field === 'sleepHours' ? parseFloat(value) || 0 : parseInt(value, 10) || 0;
    setSandboxSources((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      if (copy[activeSourceIndex]) {
        copy[activeSourceIndex][field] = num;
      }
      return copy;
    });
  };

  const loadPreset = (presetKey) => {
    const preset = PRESETS[presetKey];
    if (preset) {
      const copy = JSON.parse(JSON.stringify(preset.sources));
      setSandboxSources(copy);
    }
  };

  const handleReset = () => {
    if (baselineSources && baselineSources.length === 3) {
      setSandboxSources(JSON.parse(JSON.stringify(baselineSources)));
    }
    onResetSandbox();
  };

  const currentDevice = sandboxSources[activeSourceIndex] || {
    source: 'Mock Fitbit',
    steps: 10000,
    heartRate: 72,
    sleepHours: 7.5,
    calories: 2300
  };

  return (
    <div
      className="card"
      style={{
        marginBottom: '24px',
        border: isApplied ? '2px solid var(--warning)' : '1px solid var(--border)',
        backgroundColor: '#FFFFFF',
        transition: 'all 0.2s ease'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer'
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>🧪</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text)' }}>
              Interactive Device Spoofing & Anomaly Injection Sandbox
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--muted)' }}>
              Test multi-source anti-spoofing consensus by interactively tampering with IoT vitals in real time
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isApplied && (
            <StatusBadge
              status="Active"
              type="warning"
              label="Live Sandbox Override Active"
            />
          )}
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '4px 10px', fontSize: '12px' }}
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
          >
            {isOpen ? '▲ Collapse' : '▼ Expand Controls'}
          </button>
        </div>
      </div>

      {isOpen && (
        <div style={{ marginTop: '18px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          {/* Quick Preset Buttons */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
              One-Click Evaluation Presets
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {Object.entries(PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  id={`preset-${key}`}
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    fontSize: '12px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#F8FAFC'
                  }}
                  onClick={() => loadPreset(key)}
                  title={preset.desc}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Device Tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
            {sandboxSources.map((s, idx) => (
              <button
                key={s.source}
                id={`sandbox-tab-${idx}`}
                type="button"
                className="btn"
                style={{
                  padding: '6px 14px',
                  fontSize: '13px',
                  borderRadius: '6px',
                  backgroundColor: activeSourceIndex === idx ? 'var(--primary)' : '#F1F5F9',
                  color: activeSourceIndex === idx ? '#FFFFFF' : 'var(--text)',
                  fontWeight: activeSourceIndex === idx ? 600 : 500
                }}
                onClick={() => setActiveSourceIndex(idx)}
              >
                📱 {s.source}
              </button>
            ))}
          </div>

          {/* Sliders and Numerical Controls */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '18px' }}>
            {/* Steps Slider */}
            <div className="sandbox-control-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>🏃 Steps</label>
                <input
                  type="number"
                  min="1000"
                  max="30000"
                  step="50"
                  value={currentDevice.steps}
                  onChange={(e) => handleMetricChange('steps', e.target.value)}
                  style={{ width: '80px', padding: '2px 6px', fontSize: '13px', textAlign: 'right' }}
                />
              </div>
              <input
                type="range"
                min="1000"
                max="30000"
                step="50"
                value={currentDevice.steps}
                onChange={(e) => handleMetricChange('steps', e.target.value)}
                style={{ width: '100%', accentColor: 'var(--primary)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)' }}>
                <span>1,000</span>
                <span>Target: 10k</span>
                <span>30,000</span>
              </div>
            </div>

            {/* Heart Rate Slider */}
            <div className="sandbox-control-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>💓 Heart Rate</label>
                <input
                  type="number"
                  min="40"
                  max="180"
                  value={currentDevice.heartRate}
                  onChange={(e) => handleMetricChange('heartRate', e.target.value)}
                  style={{ width: '70px', padding: '2px 6px', fontSize: '13px', textAlign: 'right' }}
                />
              </div>
              <input
                type="range"
                min="40"
                max="180"
                value={currentDevice.heartRate}
                onChange={(e) => handleMetricChange('heartRate', e.target.value)}
                style={{ width: '100%', accentColor: 'var(--danger)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)' }}>
                <span>40 bpm</span>
                <span>Avg: 72</span>
                <span>180 bpm</span>
              </div>
            </div>

            {/* Sleep Slider */}
            <div className="sandbox-control-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>🌙 Sleep Duration</label>
                <input
                  type="number"
                  min="0"
                  max="14"
                  step="0.1"
                  value={currentDevice.sleepHours}
                  onChange={(e) => handleMetricChange('sleepHours', e.target.value)}
                  style={{ width: '70px', padding: '2px 6px', fontSize: '13px', textAlign: 'right' }}
                />
              </div>
              <input
                type="range"
                min="0"
                max="14"
                step="0.1"
                value={currentDevice.sleepHours}
                onChange={(e) => handleMetricChange('sleepHours', e.target.value)}
                style={{ width: '100%', accentColor: '#3B82F6' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)' }}>
                <span>0.0h</span>
                <span>Target: 7.0h</span>
                <span>14.0h</span>
              </div>
            </div>

            {/* Calories Slider */}
            <div className="sandbox-control-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>🔥 Active Burn</label>
                <input
                  type="number"
                  min="1000"
                  max="4500"
                  step="25"
                  value={currentDevice.calories}
                  onChange={(e) => handleMetricChange('calories', e.target.value)}
                  style={{ width: '75px', padding: '2px 6px', fontSize: '13px', textAlign: 'right' }}
                />
              </div>
              <input
                type="range"
                min="1000"
                max="4500"
                step="25"
                value={currentDevice.calories}
                onChange={(e) => handleMetricChange('calories', e.target.value)}
                style={{ width: '100%', accentColor: '#F59E0B' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)' }}>
                <span>1,000</span>
                <span>2,300 kcal</span>
                <span>4,500</span>
              </div>
            </div>
          </div>

          {/* Real-time Consensus & Anti-Spoofing Feedback */}
          {simulationResult && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: simulationResult.validated ? '#F0FDF4' : '#FEF2F2',
                border: `1px solid ${simulationResult.validated ? '#BBF7D0' : '#FECACA'}`,
                marginBottom: '16px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <StatusBadge
                    status={simulationResult.validated ? 'Verified' : 'Tamper Detected'}
                    type={simulationResult.validated ? 'success' : 'danger'}
                    label={
                      simulationResult.validated
                        ? 'Consensus Passed (≤ 10% tolerance)'
                        : 'Integrity Anomaly (Spoofing Flagged)'
                    }
                  />
                  {simulating && <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Calculating...</span>}
                </div>

                {simulationResult.validated && simulationResult.canonicalHash && (
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--muted)' }}>
                    SHA-256: {simulationResult.canonicalHash.substring(0, 16)}...
                  </span>
                )}
              </div>

              {simulationResult.validated ? (
                <div style={{ fontSize: '13px', color: '#166534' }}>
                  ✓ Multi-source consensus verified. Mean steps:{' '}
                  <strong>{simulationResult.consensusMetrics?.steps.toLocaleString()}</strong>, Heart rate:{' '}
                  <strong>{simulationResult.consensusMetrics?.heartRate} bpm</strong>, Sleep:{' '}
                  <strong>{simulationResult.consensusMetrics?.sleepHours}h</strong>.
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#991B1B', marginBottom: '4px' }}>
                    ⚠️ Anti-Spoofing Rules Breached (Blockchain Write Strictly Blocked):
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#B91C1C' }}>
                    {simulationResult.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons: Apply live vs Reset */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                id="apply-sandbox-btn"
                type="button"
                className="btn btn-primary"
                style={{
                  padding: '8px 18px',
                  fontSize: '13px',
                  backgroundColor: isApplied ? 'var(--warning)' : 'var(--primary)',
                  borderColor: isApplied ? 'var(--warning)' : 'var(--primary)'
                }}
                onClick={() => onApplySandbox(sandboxSources, simulationResult)}
              >
                {isApplied ? '🔄 Refresh Live Telemetry' : '⚡ Apply to Live Telemetry'}
              </button>
              {isApplied && (
                <button
                  id="reset-sandbox-btn"
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '13px' }}
                  onClick={handleReset}
                >
                  ↺ Reset to Baseline
                </button>
              )}
            </div>

            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              {isApplied
                ? '🟢 Live Dashboard updated with sandbox metrics'
                : 'Sandbox isolated. Click "Apply" to test live UI reactions.'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
