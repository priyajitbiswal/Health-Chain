import crypto from 'crypto';
import { getGroupedSourcesByPatient } from './dataLoader.js';

export const DEFAULT_TOLERANCES = {
  stepsPercent: 10,       // Max acceptable discrepancy as % of average steps
  heartRateDelta: 10,     // Max acceptable discrepancy in beats per minute
  sleepHoursDelta: 1.0,   // Max acceptable discrepancy in hours of sleep
  caloriesPercent: 15     // Max acceptable discrepancy as % of average calories
};

export const REQUIRED_SOURCES = ['Mock Fitbit', 'Mock Smartwatch', 'Mock Phone'];

/**
 * Validate records from multiple sources for consistency against tolerances.
 * @param {Array} sources 
 * @param {object} tolerances 
 * @returns {object} { validated: boolean, reasons: string[], consensusMetrics?: object }
 */
export function validateSources(sources, tolerances = DEFAULT_TOLERANCES) {
  const reasons = [];

  if (!Array.isArray(sources) || sources.length === 0) {
    return {
      validated: false,
      reasons: ['No source records provided'],
      consensusMetrics: null
    };
  }

  // Check that all required sources are present
  const sourceNames = sources.map((s) => s.source);
  const missingSources = REQUIRED_SOURCES.filter((s) => !sourceNames.includes(s));
  if (missingSources.length > 0) {
    reasons.push(`Missing required source(s): ${missingSources.join(', ')}`);
  }

  // Extract metric arrays
  const steps = sources.map((s) => s.steps);
  const heartRates = sources.map((s) => s.heartRate);
  const sleepHours = sources.map((s) => s.sleepHours);
  const calories = sources.map((s) => s.calories);

  // Helper calculations
  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const range = (arr) => Math.max(...arr) - Math.min(...arr);

  const avgSteps = avg(steps);
  const stepsRange = range(steps);
  const stepsDiscrepancyPct = avgSteps > 0 ? (stepsRange / avgSteps) * 100 : 0;
  if (stepsDiscrepancyPct > tolerances.stepsPercent) {
    reasons.push(
      `Steps discrepancy of ${stepsDiscrepancyPct.toFixed(1)}% exceeds allowed ${tolerances.stepsPercent}% tolerance (range: ${stepsRange}, avg: ${Math.round(avgSteps)})`
    );
  }

  const hrRange = range(heartRates);
  if (hrRange > tolerances.heartRateDelta) {
    reasons.push(
      `Heart rate discrepancy of ${hrRange} bpm exceeds allowed ${tolerances.heartRateDelta} bpm tolerance`
    );
  }

  const sleepRange = range(sleepHours);
  if (sleepRange > tolerances.sleepHoursDelta) {
    reasons.push(
      `Sleep duration discrepancy of ${sleepRange.toFixed(1)}h exceeds allowed ${tolerances.sleepHoursDelta}h tolerance`
    );
  }

  const avgCalories = avg(calories);
  const calRange = range(calories);
  const calDiscrepancyPct = avgCalories > 0 ? (calRange / avgCalories) * 100 : 0;
  if (calDiscrepancyPct > tolerances.caloriesPercent) {
    reasons.push(
      `Calories discrepancy of ${calDiscrepancyPct.toFixed(1)}% exceeds allowed ${tolerances.caloriesPercent}% tolerance`
    );
  }

  const validated = reasons.length === 0;

  let consensusMetrics = null;
  if (validated) {
    consensusMetrics = {
      steps: Math.round(avgSteps),
      heartRate: Math.round(avg(heartRates)),
      sleepHours: Number(avg(sleepHours).toFixed(1)),
      calories: Math.round(avgCalories)
    };
  }

  return {
    validated,
    reasons,
    consensusMetrics
  };
}

/**
 * Generate a sorted, canonical JSON string representation.
 * Keys are ordered alphabetically to guarantee deterministic serialization.
 * @param {object} obj 
 * @returns {string}
 */
export function stringifyCanonical(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(stringifyCanonical).join(',') + ']';
  }
  const sortedKeys = Object.keys(obj).sort();
  const entries = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${stringifyCanonical(obj[key])}`
  );
  return '{' + entries.join(',') + '}';
}

/**
 * Create canonical record object.
 */
export function generateCanonicalRecord(patientId, date, consensusMetrics, sources) {
  return {
    patientId,
    date,
    metrics: consensusMetrics,
    sources: sources.map((s) => s.source).sort()
  };
}

/**
 * Generate SHA-256 hash from a canonical record.
 * @param {object} canonicalRecord 
 * @returns {string} 64-character lowercase hex SHA-256 digest
 */
export function computeCanonicalHash(canonicalRecord) {
  const canonicalString = stringifyCanonical(canonicalRecord);
  return crypto.createHash('sha256').update(canonicalString, 'utf8').digest('hex');
}

/**
 * Validate patient health data for a given date or all available dates.
 * @param {string} patientId 
 * @param {string|null} date 
 */
export async function validatePatientHealthData(patientId, date = null) {
  const groupedDays = await getGroupedSourcesByPatient(patientId, date);

  if (groupedDays.length === 0) {
    return [];
  }

  return groupedDays.map((day) => {
    const validation = validateSources(day.sources);
    let canonicalRecord = null;
    let canonicalHash = null;

    if (validation.validated) {
      canonicalRecord = generateCanonicalRecord(
        patientId,
        day.date,
        validation.consensusMetrics,
        day.sources
      );
      canonicalHash = computeCanonicalHash(canonicalRecord);
    }

    return {
      patientId,
      date: day.date,
      validated: validation.validated,
      reasons: validation.reasons,
      consensusMetrics: validation.consensusMetrics,
      canonicalRecord,
      canonicalHash,
      sources: day.sources
    };
  });
}

/**
 * Perform simulation validation on arbitrary sources and optional custom tolerances.
 * Useful for interactive sandbox evaluation and anomaly injection.
 * @param {Array} sources 
 * @param {object|null} customTolerances 
 * @param {string} patientId 
 * @param {string} date 
 * @returns {object}
 */
export function simulateValidation(sources, customTolerances = null, patientId = 'P001', date = '2026-09-22') {
  const tolerances = customTolerances
    ? { ...DEFAULT_TOLERANCES, ...customTolerances }
    : DEFAULT_TOLERANCES;

  const validation = validateSources(sources, tolerances);
  let canonicalRecord = null;
  let canonicalHash = null;

  if (validation.validated) {
    canonicalRecord = generateCanonicalRecord(
      patientId,
      date,
      validation.consensusMetrics,
      sources
    );
    canonicalHash = computeCanonicalHash(canonicalRecord);
  }

  return {
    patientId,
    date,
    validated: validation.validated,
    reasons: validation.reasons,
    consensusMetrics: validation.consensusMetrics,
    canonicalRecord,
    canonicalHash,
    tolerances,
    sources
  };
}
