import test from "node:test";
import assert from "node:assert/strict";
import {
  alternativeDrop,
  calibrationBucket,
  chooseStrategicCandidate,
  marketAgreement
} from "../src/survivor-analytics.js";

test("market agreement classifies tight, moderate, and mixed books", () => {
  assert.equal(marketAgreement([80, 81, 79.5]).label, "Strong");
  assert.equal(marketAgreement([75, 80, 81]).label, "Moderate");
  assert.equal(marketAgreement([68, 80, 84]).label, "Mixed");
});

test("alternative strength reports probability drop-off", () => {
  assert.equal(alternativeDrop(80.7, 77.3), 3.4);
  assert.equal(alternativeDrop(null, 77.3), null);
});

test("calibration buckets preserve visible probability bands", () => {
  assert.equal(calibrationBucket(58), "50–59.9%");
  assert.equal(calibrationBucket(66), "60–69.9%");
  assert.equal(calibrationBucket(74), "70–79.9%");
  assert.equal(calibrationBucket(88), "80–89.9%");
  assert.equal(calibrationBucket(92), "90%+");
});

test("strategic candidate stays within four points of pure safety and can preserve future value", () => {
  const result = chooseStrategicCandidate([
    {
      team: "Kansas City Chiefs",
      winProbability: 82,
      available: true,
      futureValue: { bestFutureProbability: 92 }
    },
    {
      team: "Detroit Lions",
      winProbability: 79,
      available: true,
      futureValue: { bestFutureProbability: 79 }
    },
    {
      team: "Chicago Bears",
      winProbability: 70,
      available: true,
      futureValue: { bestFutureProbability: 70 }
    }
  ], { "Kansas City Chiefs": 2, "Detroit Lions": 0 });
  assert.equal(result.team, "Detroit Lions");
  assert.equal(result.safetyDifference, 3);
  assert.ok(result.reasons.some((reason) => reason.includes("safest")));
});

test("strategic candidate never sacrifices more than four probability points", () => {
  const result = chooseStrategicCandidate([
    { team: "A", winProbability: 83, available: true, futureValue: { bestFutureProbability: 95 } },
    { team: "B", winProbability: 78, available: true, futureValue: { bestFutureProbability: 78 } }
  ], {});
  assert.equal(result.team, "A");
});
