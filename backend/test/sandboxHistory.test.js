import test from 'node:test';
import assert from 'node:assert';
import app from '../src/app.js';
import {
  calculateCurrentStreak,
  calculateBestStreak,
  getStreakBonusPoints
} from '../src/history.js';

test('Unit 10 Interactive Sandbox & Historical Analytics Test Suite', async (t) => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  await t.test('Helper: streak calculation logic', () => {
    const days = [
      { date: '2026-09-16', qualified: false },
      { date: '2026-09-17', qualified: true },
      { date: '2026-09-18', qualified: true },
      { date: '2026-09-19', qualified: true },
      { date: '2026-09-20', qualified: false },
      { date: '2026-09-21', qualified: true },
      { date: '2026-09-22', qualified: true }
    ];

    const currentStreak = calculateCurrentStreak(days, (d) => d.qualified);
    assert.strictEqual(currentStreak, 2, 'Current streak should be 2 (Sep 21, 22)');

    const bestStreak = calculateBestStreak(days, (d) => d.qualified);
    assert.strictEqual(bestStreak, 3, 'Best streak should be 3 (Sep 17-19)');

    assert.strictEqual(getStreakBonusPoints(0), 0);
    assert.strictEqual(getStreakBonusPoints(2), 0);
    assert.strictEqual(getStreakBonusPoints(3), 50);
    assert.strictEqual(getStreakBonusPoints(5), 100);
    assert.strictEqual(getStreakBonusPoints(7), 150);
  });

  await t.test('POST /api/health/simulate-validation accepts legitimate consensus', async () => {
    const payload = {
      patientId: 'P001',
      date: '2026-09-22',
      sources: [
        { source: 'Mock Fitbit', steps: 10450, heartRate: 72, sleepHours: 7.5, calories: 2350 },
        { source: 'Mock Smartwatch', steps: 10380, heartRate: 74, sleepHours: 7.3, calories: 2320 },
        { source: 'Mock Phone', steps: 10420, heartRate: 71, sleepHours: 7.4, calories: 2360 }
      ]
    };

    const res = await fetch(`${baseUrl}/api/health/simulate-validation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.validated, true);
    assert.strictEqual(typeof body.data.canonicalHash, 'string');
    assert.strictEqual(body.data.canonicalHash.length, 64);
    assert.strictEqual(body.data.consensusMetrics.steps, 10417);
  });

  await t.test('POST /api/health/simulate-validation detects pedometer fraud anomaly', async () => {
    const payload = {
      patientId: 'P001',
      date: '2026-09-22',
      sources: [
        { source: 'Mock Fitbit', steps: 24000, heartRate: 72, sleepHours: 7.5, calories: 2350 },
        { source: 'Mock Smartwatch', steps: 8000, heartRate: 74, sleepHours: 7.3, calories: 2100 },
        { source: 'Mock Phone', steps: 8100, heartRate: 71, sleepHours: 7.4, calories: 2120 }
      ]
    };

    const res = await fetch(`${baseUrl}/api/health/simulate-validation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.validated, false);
    assert.strictEqual(body.data.canonicalHash, null);
    assert.ok(body.data.reasons.some((r) => r.includes('Steps discrepancy')));
  });

  await t.test('POST /api/health/simulate-validation detects heart rate outlier anomaly', async () => {
    const payload = {
      patientId: 'P001',
      date: '2026-09-22',
      sources: [
        { source: 'Mock Fitbit', steps: 10000, heartRate: 70, sleepHours: 7.5, calories: 2300 },
        { source: 'Mock Smartwatch', steps: 10050, heartRate: 145, sleepHours: 7.3, calories: 2320 },
        { source: 'Mock Phone', steps: 9980, heartRate: 71, sleepHours: 7.4, calories: 2310 }
      ]
    };

    const res = await fetch(`${baseUrl}/api/health/simulate-validation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.validated, false);
    assert.ok(body.data.reasons.some((r) => r.includes('Heart rate discrepancy')));
  });

  await t.test('POST /api/health/simulate-validation rejects invalid body', async () => {
    const res = await fetch(`${baseUrl}/api/health/simulate-validation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(res.status, 400);
  });

  await t.test('GET /api/health/:patientId/history returns 7-day analytics and streaks', async () => {
    const res = await fetch(`${baseUrl}/api/health/P001/history`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    const data = body.data;

    assert.strictEqual(data.patientId, 'P001');
    assert.strictEqual(data.totalDays, 7);
    assert.strictEqual(data.verifiedDays, 6, 'Should have 6 verified days out of 7 (Sep 20 is anomaly)');
    assert.strictEqual(data.integrityScore, 86, '6/7 is ~86% integrity');
    assert.ok(Array.isArray(data.history));
    assert.strictEqual(data.history.length, 7);

    // Check chronological ordering
    assert.strictEqual(data.history[0].date, '2026-09-16');
    assert.strictEqual(data.history[6].date, '2026-09-22');

    // Check P001 streaks
    // Sep 22: steps 10427 (qualified)
    // Sep 21: steps 8210 (not qualified)
    assert.strictEqual(data.currentStepStreak, 1);
    assert.strictEqual(data.bestStepStreak, 3, 'P001 had a 3-day 10k streak on Sep 17-19');

    // Check averages
    assert.ok(data.averages.steps > 0);
    assert.ok(data.averages.heartRate > 0);
    assert.ok(data.averages.sleepHours > 0);
  });

  await t.test('GET /api/health/:patientId/history returns 404 for unknown patient', async () => {
    const res = await fetch(`${baseUrl}/api/health/P999/history`);
    assert.strictEqual(res.status, 404);
  });
});
