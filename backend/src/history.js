import { getGroupedSourcesByPatient } from './dataLoader.js';
import { validateSources } from './validation.js';

/**
 * Historical Analytics & Streak Calculation Engine
 * 
 * Aggregates daily telemetry, cross-evaluates consensus, and calculates
 * consecutive habit streaks (steps >= 10k, sleep >= 7h) and integrity scores.
 */

/**
 * Calculate consecutive active streak going backwards from the latest date.
 * @param {Array} days Array of day objects sorted chronologically (oldest to newest)
 * @param {Function} predicate Function returning boolean for qualification
 * @returns {number}
 */
export function calculateCurrentStreak(days, predicate) {
  if (!days || days.length === 0) return 0;
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (predicate(days[i])) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Calculate the best (longest) streak across the entire historical period.
 * @param {Array} days 
 * @param {Function} predicate 
 * @returns {number}
 */
export function calculateBestStreak(days, predicate) {
  if (!days || days.length === 0) return 0;
  let best = 0;
  let current = 0;
  for (const day of days) {
    if (predicate(day)) {
      current++;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  }
  return best;
}

/**
 * Calculate projected streak bonus wellness points based on current step streak.
 * @param {number} streak 
 * @returns {number}
 */
export function getStreakBonusPoints(streak) {
  if (streak >= 7) return 150;
  if (streak >= 5) return 100;
  if (streak >= 3) return 50;
  return 0;
}

/**
 * Retrieve historical analytics and streak metrics for a patient.
 * @param {string} patientId 
 * @returns {Promise<object>}
 */
export async function getPatientHistory(patientId) {
  const groupedDays = await getGroupedSourcesByPatient(patientId);

  // Sort chronologically (oldest to newest)
  groupedDays.sort((a, b) => a.date.localeCompare(b.date));

  const history = groupedDays.map((day) => {
    const val = validateSources(day.sources);
    const metrics = val.consensusMetrics || {
      steps: Math.round(day.sources.reduce((sum, s) => sum + s.steps, 0) / day.sources.length),
      heartRate: Math.round(day.sources.reduce((sum, s) => sum + s.heartRate, 0) / day.sources.length),
      sleepHours: Number((day.sources.reduce((sum, s) => sum + s.sleepHours, 0) / day.sources.length).toFixed(1)),
      calories: Math.round(day.sources.reduce((sum, s) => sum + s.calories, 0) / day.sources.length)
    };

    const stepsQualified = val.validated && metrics.steps >= 10000;
    const sleepQualified = val.validated && metrics.sleepHours >= 7.0;
    const qualifiesDiscount = stepsQualified && sleepQualified;

    return {
      date: day.date,
      validated: val.validated,
      reasons: val.reasons,
      steps: metrics.steps,
      heartRate: metrics.heartRate,
      sleepHours: metrics.sleepHours,
      calories: metrics.calories,
      stepsQualified,
      sleepQualified,
      qualifiesDiscount
    };
  });

  const totalDays = history.length;
  const verifiedDays = history.filter((d) => d.validated).length;
  const integrityScore = totalDays > 0 ? Math.round((verifiedDays / totalDays) * 100) : 0;

  const currentStepStreak = calculateCurrentStreak(history, (d) => d.stepsQualified);
  const bestStepStreak = calculateBestStreak(history, (d) => d.stepsQualified);

  const currentSleepStreak = calculateCurrentStreak(history, (d) => d.sleepQualified);
  const bestSleepStreak = calculateBestStreak(history, (d) => d.sleepQualified);

  const streakBonusPoints = getStreakBonusPoints(currentStepStreak);

  // Calculate averages across verified days
  const verifiedHistory = history.filter((d) => d.validated);
  const avg = (fn) =>
    verifiedHistory.length > 0
      ? Math.round(verifiedHistory.reduce((sum, d) => sum + fn(d), 0) / verifiedHistory.length)
      : 0;

  const averages = {
    steps: avg((d) => d.steps),
    heartRate: avg((d) => d.heartRate),
    sleepHours: Number(
      (
        verifiedHistory.length > 0
          ? verifiedHistory.reduce((sum, d) => sum + d.sleepHours, 0) / verifiedHistory.length
          : 0
      ).toFixed(1)
    ),
    calories: avg((d) => d.calories)
  };

  return {
    patientId,
    totalDays,
    verifiedDays,
    integrityScore,
    currentStepStreak,
    bestStepStreak,
    currentSleepStreak,
    bestSleepStreak,
    streakBonusPoints,
    averages,
    history
  };
}
