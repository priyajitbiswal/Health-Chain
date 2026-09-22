import express from 'express';
import cors from 'cors';
import {
  getAllPatients,
  getPatientById,
  getHealthRecords,
  getGroupedSourcesByPatient,
  getAllPolicies,
  getPolicyByPatientId,
  getAllClaims,
  getClaimsByPatientId,
  saveNewClaim,
  updateClaimStatusInStore
} from './dataLoader.js';
import { validatePatientHealthData, simulateValidation } from './validation.js';
import { calculateWellnessReward } from './rewards.js';
import { getPatientHistory } from './history.js';
import blockchainService from './blockchainService.js';

const app = express();

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Health-Chain API is running',
    timestamp: new Date().toISOString()
  });
});

// List all demo patients
app.get('/api/patients', async (req, res) => {
  try {
    const patients = await getAllPatients();
    res.json({ success: true, data: patients });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load patients data' });
  }
});

// Get a single patient by ID
app.get('/api/patients/:patientId', async (req, res) => {
  try {
    const patient = await getPatientById(req.params.patientId);
    if (!patient) {
      return res.status(404).json({ success: false, error: `Patient ${req.params.patientId} not found` });
    }
    res.json({ success: true, data: patient });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load patient data' });
  }
});

// Get health records for a patient (optional query: ?date=YYYY-MM-DD)
app.get('/api/health/:patientId', async (req, res) => {
  const { patientId } = req.params;
  const { date } = req.query;

  try {
    const patient = await getPatientById(patientId);
    if (!patient) {
      return res.status(404).json({ success: false, error: `Patient ${patientId} not found` });
    }

    const records = await getHealthRecords(patientId, date);
    res.json({
      success: true,
      patientId,
      filterDate: date || null,
      count: records.length,
      data: records
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load health records' });
  }
});

// Get multi-source comparison data grouped by date (optional query: ?date=YYYY-MM-DD)
app.get('/api/health/:patientId/sources', async (req, res) => {
  const { patientId } = req.params;
  const { date } = req.query;

  try {
    const patient = await getPatientById(patientId);
    if (!patient) {
      return res.status(404).json({ success: false, error: `Patient ${patientId} not found` });
    }

    const groupedSources = await getGroupedSourcesByPatient(patientId, date);
    res.json({
      success: true,
      patientId,
      filterDate: date || null,
      data: groupedSources
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load source comparison data' });
  }
});

// Validate multi-source health records and compute canonical hash (optional query: ?date=YYYY-MM-DD)
app.get('/api/health/:patientId/validation', async (req, res) => {
  const { patientId } = req.params;
  const { date } = req.query;

  try {
    const patient = await getPatientById(patientId);
    if (!patient) {
      return res.status(404).json({ success: false, error: `Patient ${patientId} not found` });
    }

    const validationResults = await validatePatientHealthData(patientId, date);
    res.json({
      success: true,
      patientId,
      filterDate: date || null,
      count: validationResults.length,
      data: validationResults
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to perform health data validation' });
  }
});

// Interactive Anomaly Injection Sandbox: simulate validation on arbitrary source values
app.post('/api/health/simulate-validation', (req, res) => {
  const { sources, tolerances, patientId, date } = req.body;

  if (!sources || !Array.isArray(sources) || sources.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'sources array is required in request body'
    });
  }

  try {
    const simulationResult = simulateValidation(sources, tolerances, patientId, date);
    res.json({
      success: true,
      data: simulationResult
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Simulation validation failed: ${err.message}`
    });
  }
});

// Historical Analytics & Streak Tracking: retrieve 7-day trends and streak calculations
app.get('/api/health/:patientId/history', async (req, res) => {
  const { patientId } = req.params;

  try {
    const patient = await getPatientById(patientId);
    if (!patient) {
      return res.status(404).json({ success: false, error: `Patient ${patientId} not found` });
    }

    const historyData = await getPatientHistory(patientId);
    res.json({
      success: true,
      data: historyData
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Failed to load historical analytics: ${err.message}`
    });
  }
});

// -------------------------------------------------------------
// Blockchain Integration Endpoints (Unit 05)
// -------------------------------------------------------------

// Get blockchain connection and contract metadata
app.get('/api/blockchain/info', async (req, res) => {
  try {
    const info = await blockchainService.getContractInfo();
    res.json({ success: true, data: info });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Commit validated health-record hash to blockchain
// Invariant: Backend validation MUST happen before writing to blockchain
app.post('/api/health/:patientId/record', async (req, res) => {
  const { patientId } = req.params;
  const { date } = req.body;

  if (!date) {
    return res.status(400).json({ success: false, error: 'Date is required in request body' });
  }

  try {
    const patient = await getPatientById(patientId);
    if (!patient) {
      return res.status(404).json({ success: false, error: `Patient ${patientId} not found` });
    }

    // Step 1: Validate data first
    const validationResults = await validatePatientHealthData(patientId, date);
    if (validationResults.length === 0) {
      return res.status(404).json({ success: false, error: `No health data found for date ${date}` });
    }

    const dayValidation = validationResults[0];
    if (!dayValidation.validated) {
      return res.status(400).json({
        success: false,
        error: 'Cannot record out-of-tolerance health data to blockchain',
        reasons: dayValidation.reasons
      });
    }

    // Step 2: Write canonical hash to blockchain
    const txResult = await blockchainService.addHealthRecord(
      patientId,
      date,
      dayValidation.canonicalHash,
      'consensus-v1'
    );

    res.json({
      success: true,
      message: 'Health record hash successfully written to blockchain',
      data: {
        ...txResult,
        canonicalHash: dayValidation.canonicalHash,
        consensusMetrics: dayValidation.consensusMetrics
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Blockchain transaction failed: ${err.message}`
    });
  }
});

// Retrieve on-chain recorded health record
app.get('/api/health/:patientId/record-onchain', async (req, res) => {
  const { patientId } = req.params;
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ success: false, error: 'Date query parameter is required' });
  }

  try {
    const onChainRecord = await blockchainService.getHealthRecord(patientId, date);
    res.json({ success: true, data: onChainRecord });
  } catch (err) {
    res.status(500).json({ success: false, error: `Failed to query blockchain: ${err.message}` });
  }
});

// Grant or revoke patient consent for an entity
app.post('/api/consent', async (req, res) => {
  const { patientId, entityAddress, granted } = req.body;

  if (!patientId || !entityAddress) {
    return res.status(400).json({
      success: false,
      error: 'patientId and entityAddress are required'
    });
  }

  try {
    let result;
    if (granted !== false) {
      result = await blockchainService.grantConsent(patientId, entityAddress);
    } else {
      result = await blockchainService.revokeConsent(patientId, entityAddress);
    }
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: `Failed to update consent: ${err.message}` });
  }
});

// Check patient consent status
app.get('/api/consent/:patientId', async (req, res) => {
  const { patientId } = req.params;
  const { entity } = req.query;

  if (!entity) {
    return res.status(400).json({ success: false, error: 'entity address query parameter is required' });
  }

  try {
    const status = await blockchainService.hasConsent(patientId, entity);
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ success: false, error: `Failed to query consent: ${err.message}` });
  }
});

// Retrieve patient wellness reward points
app.get('/api/rewards/:patientId', async (req, res) => {
  const { patientId } = req.params;

  try {
    const points = await blockchainService.getRewardPoints(patientId);
    res.json({ success: true, patientId, rewardPoints: points });
  } catch (err) {
    res.status(500).json({ success: false, error: `Failed to fetch reward points: ${err.message}` });
  }
});

// Check daily wellness reward eligibility and claim status
app.get('/api/rewards/:patientId/status', async (req, res) => {
  const { patientId } = req.params;
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ success: false, error: 'date query parameter is required' });
  }

  try {
    const validationResults = await validatePatientHealthData(patientId, date);
    const dayValidation = validationResults.length > 0 ? validationResults[0] : null;
    const rewardCalculation = calculateWellnessReward(dayValidation);
    const isClaimed = await blockchainService.isRewardProcessed(patientId, date);
    const totalPoints = await blockchainService.getRewardPoints(patientId);

    res.json({
      success: true,
      patientId,
      date,
      points: rewardCalculation.points,
      eligible: rewardCalculation.eligible,
      isClaimed,
      breakdown: rewardCalculation.breakdown,
      reasons: rewardCalculation.reasons,
      totalPoints
    });
  } catch (err) {
    res.status(500).json({ success: false, error: `Failed to fetch reward status: ${err.message}` });
  }
});

// Claim daily wellness reward on blockchain (with on-chain duplicate prevention)
app.post('/api/rewards/:patientId/claim', async (req, res) => {
  const { patientId } = req.params;
  const { date } = req.body;

  if (!date) {
    return res.status(400).json({ success: false, error: 'date is required in request body' });
  }

  try {
    // 1. Check if already claimed on-chain
    const alreadyProcessed = await blockchainService.isRewardProcessed(patientId, date);
    if (alreadyProcessed) {
      return res.status(400).json({
        success: false,
        error: 'Reward already awarded for this record'
      });
    }

    // 2. Validate data and calculate points
    const validationResults = await validatePatientHealthData(patientId, date);
    const dayValidation = validationResults.length > 0 ? validationResults[0] : null;
    const rewardCalculation = calculateWellnessReward(dayValidation);

    if (!rewardCalculation.eligible || rewardCalculation.points === 0) {
      return res.status(400).json({
        success: false,
        error: 'Health activity does not qualify for wellness points or contains discrepancies',
        reasons: rewardCalculation.reasons
      });
    }

    // 3. Award points on smart contract
    const txResult = await blockchainService.addRewardPoints(
      patientId,
      date,
      rewardCalculation.points
    );

    res.json({
      success: true,
      message: `Successfully awarded ${rewardCalculation.points} wellness points on-chain`,
      data: {
        ...txResult,
        breakdown: rewardCalculation.breakdown
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Failed to claim wellness reward: ${err.message}`
    });
  }
});

// -------------------------------------------------------------
// Insurance Workflow Endpoints (Unit 07)
// -------------------------------------------------------------

const DEFAULT_INSURER_ADDRESS = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

// Get list of demo patients who have granted on-chain consent to the insurer
app.get('/api/insurance/authorized-patients', async (req, res) => {
  const insurerAddress = req.query.entity || DEFAULT_INSURER_ADDRESS;

  try {
    const allPatients = await getAllPatients();
    const authorized = [];

    for (const patient of allPatients) {
      try {
        const consentResult = await blockchainService.hasConsent(patient.id, insurerAddress);
        if (consentResult && consentResult.hasConsent) {
          authorized.push({
            ...patient,
            onChainConsent: true
          });
        }
      } catch {
        // If query fails, do not authorize
      }
    }

    res.json({
      success: true,
      insurerAddress,
      count: authorized.length,
      data: authorized
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch authorized patients' });
  }
});

// Retrieve policy and calculate live smart-contract dynamic premium
app.get('/api/policies/:patientId', async (req, res) => {
  const { patientId } = req.params;

  try {
    const policy = await getPolicyByPatientId(patientId);
    if (!policy) {
      return res.status(404).json({ success: false, error: `Policy not found for patient ${patientId}` });
    }

    // Attempt to fetch latest validated metrics to compute discounted premium
    let metricsUsed = null;
    let finalPremium = policy.basePremium || 10000;
    let discount = 0;

    try {
      const validationResults = await validatePatientHealthData(patientId, '2026-09-22');
      if (validationResults.length > 0 && validationResults[0].validated) {
        metricsUsed = validationResults[0].consensusMetrics;
        finalPremium = await blockchainService.calculatePremium(
          metricsUsed.steps,
          metricsUsed.sleepHours
        );
        discount = (policy.basePremium || 10000) - finalPremium;
      }
    } catch (err) {
      console.warn('Could not compute dynamic premium from blockchain:', err.message);
    }

    res.json({
      success: true,
      data: {
        ...policy,
        basePremium: policy.basePremium || 10000,
        finalPremium,
        discountAmount: discount,
        discountPercent: Math.round((discount / (policy.basePremium || 10000)) * 100),
        metricsUsed
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load policy' });
  }
});

// Get all claims or filter by patient
app.get('/api/claims', async (req, res) => {
  try {
    const claims = await getAllClaims();
    res.json({ success: true, count: claims.length, data: claims });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load claims' });
  }
});

app.get('/api/claims/:patientId', async (req, res) => {
  const { patientId } = req.params;
  try {
    const claims = await getClaimsByPatientId(patientId);
    res.json({ success: true, patientId, count: claims.length, data: claims });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load patient claims' });
  }
});

// Submit a new claim (records on-chain and in claims store)
app.post('/api/claims', async (req, res) => {
  const { policyId, patientId, amount, description } = req.body;

  if (!policyId || !patientId || !amount) {
    return res.status(400).json({
      success: false,
      error: 'policyId, patientId, and amount are required'
    });
  }

  try {
    // 1. Submit to blockchain smart contract
    let onChainTx = null;
    try {
      onChainTx = await blockchainService.submitClaim(
        policyId,
        patientId,
        Number(amount),
        description || ''
      );
    } catch (err) {
      console.warn('On-chain claim submission notice:', err.message);
    }

    // 2. Save to local claims store
    const newClaim = {
      id: Date.now(),
      onChainClaimId: onChainTx?.claimId || null,
      claimCode: `CLM-${Math.floor(1000 + Math.random() * 9000)}`,
      policyId,
      patientId,
      amount: Number(amount),
      description: description || 'Medical reimbursement claim',
      status: 'Pending',
      timestamp: Math.floor(Date.now() / 1000),
      onChainTxHash: onChainTx?.txHash || null,
      decisionReason: ''
    };

    await saveNewClaim(newClaim);

    res.json({
      success: true,
      message: 'Claim submitted successfully',
      data: newClaim
    });
  } catch (err) {
    res.status(500).json({ success: false, error: `Failed to submit claim: ${err.message}` });
  }
});

// Approve a claim
app.post('/api/claims/:claimId/approve', async (req, res) => {
  const { claimId } = req.params;
  const { reason } = req.body;

  try {
    const allClaims = await getAllClaims();
    const existingClaim = allClaims.find((c) => String(c.id) === String(claimId));
    const targetOnChainId = existingClaim?.onChainClaimId || (Number(claimId) < 1000000 ? Number(claimId) : null);

    // Update on-chain if feasible
    if (targetOnChainId) {
      try {
        await blockchainService.approveClaim(
          targetOnChainId,
          reason || 'Approved by insurance adjudicator'
        );
      } catch (err) {
        console.warn(`On-chain approve notice for claim ${claimId}:`, err.reason || err.shortMessage || err.message);
      }
    }

    // Update in claims store
    const updatedClaim = await updateClaimStatusInStore(
      claimId,
      'Approved',
      reason || 'Approved by insurance adjudicator'
    );

    res.json({
      success: true,
      message: 'Claim approved successfully',
      data: updatedClaim
    });
  } catch (err) {
    res.status(500).json({ success: false, error: `Failed to approve claim: ${err.message}` });
  }
});

// Reject a claim
app.post('/api/claims/:claimId/reject', async (req, res) => {
  const { claimId } = req.params;
  const { reason } = req.body;

  try {
    const allClaims = await getAllClaims();
    const existingClaim = allClaims.find((c) => String(c.id) === String(claimId));
    const targetOnChainId = existingClaim?.onChainClaimId || (Number(claimId) < 1000000 ? Number(claimId) : null);

    // Update on-chain if feasible
    if (targetOnChainId) {
      try {
        await blockchainService.rejectClaim(
          targetOnChainId,
          reason || 'Rejected by insurance adjudicator'
        );
      } catch (err) {
        console.warn(`On-chain reject notice for claim ${claimId}:`, err.reason || err.shortMessage || err.message);
      }
    }

    // Update in claims store
    const updatedClaim = await updateClaimStatusInStore(
      claimId,
      'Rejected',
      reason || 'Not covered under policy terms'
    );

    res.json({
      success: true,
      message: 'Claim rejected',
      data: updatedClaim
    });
  } catch (err) {
    res.status(500).json({ success: false, error: `Failed to reject claim: ${err.message}` });
  }
});

export default app;
