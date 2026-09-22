import React, { useState, useEffect, useCallback } from 'react';
import MetricCard from './components/MetricCard.jsx';
import SourceComparison from './components/SourceComparison.jsx';
import ConsentToggle from './components/ConsentToggle.jsx';
import BlockchainRecord from './components/BlockchainRecord.jsx';
import WellnessCard from './components/WellnessCard.jsx';
import PatientSelector from './components/PatientSelector.jsx';
import StatusBadge from './components/StatusBadge.jsx';
import InsuranceDashboard from './components/InsuranceDashboard.jsx';
import AnomalySandbox from './components/AnomalySandbox.jsx';
import HealthTrends from './components/HealthTrends.jsx';

const DEFAULT_INSURER = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const AVAILABLE_DATES = [
  '2026-09-22',
  '2026-09-21',
  '2026-09-20',
  '2026-09-19',
  '2026-09-18',
  '2026-09-17',
  '2026-09-16'
];

export default function App() {
  const [portalMode, setPortalMode] = useState('patient'); // 'patient' | 'insurer'
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('P001');
  const [selectedDate, setSelectedDate] = useState('2026-09-22');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [sources, setSources] = useState([]);
  const [validationResult, setValidationResult] = useState(null);
  const [onChainRecord, setOnChainRecord] = useState(null);
  const [hasConsent, setHasConsent] = useState(false);
  const [rewardPoints, setRewardPoints] = useState(0);
  const [rewardStatus, setRewardStatus] = useState(null);
  const [blockchainInfo, setBlockchainInfo] = useState(null);

  // Historical analytics & streak tracking state
  const [historyData, setHistoryData] = useState(null);

  // Sandbox simulation override state
  const [sandboxActive, setSandboxActive] = useState(false);
  const [sandboxSources, setSandboxSources] = useState([]);
  const [sandboxValidation, setSandboxValidation] = useState(null);

  // Load patients list and blockchain info once on mount
  useEffect(() => {
    fetch('/api/patients')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setPatients(data.data);
        }
      })
      .catch((err) => console.error('Failed to load patients:', err));

    fetch('/api/blockchain/info')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setBlockchainInfo(data.data);
        }
      })
      .catch((err) => console.error('Failed to load blockchain info:', err));
  }, []);

  // Fetch 7-day historical telemetry and streak analytics
  const loadHistory = useCallback(async () => {
    if (!selectedPatientId) return;
    try {
      const res = await fetch(`/api/health/${selectedPatientId}/history`);
      const data = await res.json();
      if (data.success) {
        setHistoryData(data.data);
      }
    } catch (err) {
      console.error('Failed to load patient history:', err);
    }
  }, [selectedPatientId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Reset sandbox override when patient or date changes
  useEffect(() => {
    setSandboxActive(false);
    setSandboxSources([]);
    setSandboxValidation(null);
  }, [selectedPatientId, selectedDate]);

  // Fetch patient telemetry, validation, on-chain record, consent, and rewards
  const loadPatientData = useCallback(async () => {
    if (!selectedPatientId) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch sources
      const sourcesRes = await fetch(
        `/api/health/${selectedPatientId}/sources?date=${selectedDate}`
      );
      const sourcesData = await sourcesRes.json();
      if (sourcesData.success && sourcesData.data.length > 0) {
        setSources(sourcesData.data[0].sources || []);
      } else {
        setSources([]);
      }

      // 2. Fetch validation & consensus metrics
      const valRes = await fetch(
        `/api/health/${selectedPatientId}/validation?date=${selectedDate}`
      );
      const valData = await valRes.json();
      if (valData.success && valData.data.length > 0) {
        setValidationResult(valData.data[0]);
      } else {
        setValidationResult(null);
      }

      // 3. Fetch on-chain record status
      try {
        const onChainRes = await fetch(
          `/api/health/${selectedPatientId}/record-onchain?date=${selectedDate}`
        );
        const onChainData = await onChainRes.json();
        if (onChainData.success) {
          setOnChainRecord(onChainData.data);
        } else {
          setOnChainRecord(null);
        }
      } catch {
        setOnChainRecord(null);
      }

      // 4. Fetch consent status
      try {
        const consentRes = await fetch(
          `/api/consent/${selectedPatientId}?entity=${DEFAULT_INSURER}`
        );
        const consentData = await consentRes.json();
        if (consentData.success) {
          setHasConsent(consentData.data?.hasConsent || false);
        }
      } catch {
        setHasConsent(false);
      }

      // 5. Fetch wellness reward points and daily eligibility status
      try {
        const rewardsRes = await fetch(`/api/rewards/${selectedPatientId}`);
        const rewardsData = await rewardsRes.json();
        if (rewardsData.success) {
          setRewardPoints(rewardsData.rewardPoints || 0);
        }

        const statusRes = await fetch(
          `/api/rewards/${selectedPatientId}/status?date=${selectedDate}`
        );
        const statusData = await statusRes.json();
        if (statusData.success) {
          setRewardStatus(statusData);
        } else {
          setRewardStatus(null);
        }
      } catch {
        setRewardPoints(0);
        setRewardStatus(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedPatientId, selectedDate]);

  useEffect(() => {
    loadPatientData();
  }, [loadPatientData]);

  // Handle toggling consent
  const handleToggleConsent = async (granted, entityAddress) => {
    const res = await fetch('/api/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: selectedPatientId,
        entityAddress,
        granted
      })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update consent');
    }
    setHasConsent(granted);
    return data;
  };

  // Handle recording validated hash to blockchain
  const handleRecordToBlockchain = async (date) => {
    const res = await fetch(`/api/health/${selectedPatientId}/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to write record to blockchain');
    }
    // Refresh on-chain status
    await loadPatientData();
    return data;
  };

  // Handle claiming daily wellness reward on blockchain
  const handleClaimReward = async (date) => {
    const res = await fetch(`/api/rewards/${selectedPatientId}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to claim reward');
    }
    // Refresh accrued points and status
    await loadPatientData();
    await loadHistory();
    return data;
  };

  // Handle applying and resetting sandbox override
  const handleApplySandbox = useCallback((sSources, simResult) => {
    setSandboxActive(true);
    setSandboxSources(sSources);
    setSandboxValidation(simResult);
  }, []);

  const handleResetSandbox = useCallback(() => {
    setSandboxActive(false);
    setSandboxSources([]);
    setSandboxValidation(null);
  }, []);

  // Compute active sources and validation result (sandbox overrides baseline when active)
  const activeSources = sandboxActive && sandboxSources.length > 0 ? sandboxSources : sources;
  const activeValidation = sandboxActive && sandboxValidation ? sandboxValidation : validationResult;

  const currentPatient = patients.find((p) => p.id === selectedPatientId);
  const consensus = activeValidation?.consensusMetrics;

  return (
    <div className="container">
      {/* Top Navigation Bar */}
      <header>
        <div className="brand">
          <div className="brand-icon">H</div>
          <div>
            <h1 className="brand-title">Health-Chain</h1>
            <p className="brand-subtitle">Decentralized Patient Health & Insurance Portal</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'inline-flex', backgroundColor: '#E2E8F0', padding: '3px', borderRadius: '8px' }}>
            <button
              id="switch-to-patient-portal"
              className="btn"
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                borderRadius: '6px',
                backgroundColor: portalMode === 'patient' ? '#FFFFFF' : 'transparent',
                color: portalMode === 'patient' ? 'var(--primary)' : 'var(--muted)',
                boxShadow: portalMode === 'patient' ? 'var(--shadow-sm)' : 'none',
                fontWeight: portalMode === 'patient' ? 600 : 500
              }}
              onClick={() => setPortalMode('patient')}
            >
              👤 Patient Portal
            </button>
            <button
              id="switch-to-insurer-portal"
              className="btn"
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                borderRadius: '6px',
                backgroundColor: portalMode === 'insurer' ? '#FFFFFF' : 'transparent',
                color: portalMode === 'insurer' ? 'var(--primary)' : 'var(--muted)',
                boxShadow: portalMode === 'insurer' ? 'var(--shadow-sm)' : 'none',
                fontWeight: portalMode === 'insurer' ? 600 : 500
              }}
              onClick={() => setPortalMode('insurer')}
            >
              🏢 Insurer Portal
            </button>
          </div>

          {blockchainInfo?.connected ? (
            <StatusBadge
              status="Connected"
              type="success"
              label={`Node (${blockchainInfo.network})`}
            />
          ) : (
            <StatusBadge
              status="Offline"
              type="warning"
              label="Local Node Ready"
            />
          )}
        </div>
      </header>

      {portalMode === 'insurer' ? (
        <InsuranceDashboard />
      ) : (
        <>
          {/* Patient & Date Selection */}
          <PatientSelector
            patients={patients}
            selectedPatientId={selectedPatientId}
            onSelectPatient={setSelectedPatientId}
            availableDates={AVAILABLE_DATES}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            currentPatient={currentPatient}
          />

          {error && (
            <div
              className="card"
              style={{ backgroundColor: 'var(--danger-bg)', borderColor: '#FECACA', color: 'var(--danger)' }}
            >
              <strong>Error loading telemetry:</strong> {error}
            </div>
          )}

          {/* Interactive Anomaly Injection Sandbox */}
          <AnomalySandbox
            baselineSources={sources}
            onApplySandbox={handleApplySandbox}
            onResetSandbox={handleResetSandbox}
            isApplied={sandboxActive}
            patientId={selectedPatientId}
            selectedDate={selectedDate}
          />

          {/* Health Metrics Dashboard */}
          <section style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text)' }}>
                Daily Consensus Metrics ({selectedDate})
              </h2>
              <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                {activeValidation?.validated
                  ? 'Computed via cross-device consensus'
                  : 'Discrepancy detected between sources'}
              </span>
            </div>

            <div className="grid">
              <MetricCard
                title="Daily Steps"
                value={consensus?.steps ?? (activeSources[0]?.steps || null)}
                unit="steps"
                icon="🏃"
                subtitle={activeValidation?.validated ? 'Target: ≥ 10,000 steps' : 'Unverified reading'}
                qualifiesDiscount={(consensus?.steps || 0) >= 10000}
              />
              <MetricCard
                title="Heart Rate"
                value={consensus?.heartRate ?? (activeSources[0]?.heartRate || null)}
                unit="bpm"
                icon="💓"
                subtitle="Resting average"
              />
              <MetricCard
                title="Sleep Duration"
                value={consensus?.sleepHours ?? (activeSources[0]?.sleepHours || null)}
                unit="hours"
                icon="🌙"
                subtitle={activeValidation?.validated ? 'Target: ≥ 7.0 hours' : 'Unverified reading'}
                qualifiesDiscount={(consensus?.sleepHours || 0) >= 7.0}
              />
              <MetricCard
                title="Active Burn"
                value={consensus?.calories ?? (activeSources[0]?.calories || null)}
                unit="kcal"
                icon="🔥"
                subtitle="Consensus calories"
              />
            </div>
          </section>

          {/* 7-Day Health Trends & Streak Analytics */}
          <HealthTrends
            historyData={historyData}
            onSelectDate={setSelectedDate}
            selectedDate={selectedDate}
          />

          {/* Multi-Source Comparison */}
          <SourceComparison sources={activeSources} validationResult={activeValidation} />

          {/* Blockchain Record & Cryptographic Proof */}
          <BlockchainRecord
            patientId={selectedPatientId}
            date={selectedDate}
            validationResult={activeValidation}
            onChainRecord={onChainRecord}
            onRecordToBlockchain={handleRecordToBlockchain}
            loading={loading}
          />

          {/* Insurance Consent & Wellness Rewards in 2 columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            <ConsentToggle
              patientId={selectedPatientId}
              hasConsent={hasConsent}
              onToggle={handleToggleConsent}
              loading={loading}
            />
            <WellnessCard
              points={rewardPoints}
              selectedDate={selectedDate}
              rewardStatus={rewardStatus}
              onClaimReward={handleClaimReward}
              loading={loading}
            />
          </div>
        </>
      )}
    </div>
  );
}
