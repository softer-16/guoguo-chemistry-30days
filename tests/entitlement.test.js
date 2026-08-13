"use strict";

const assert = require("node:assert/strict");
const {
  COURSE_ID,
  addNaturalDays,
  learningPlanStatus,
  evaluateEntitlement,
  canAccessDay,
  calendarDates
} = require("../entitlement.js");

const NOW = new Date("2026-08-23T12:00:00+08:00");
const active = overrides => ({
  user_id: "00000000-0000-0000-0000-000000000001",
  course_id: COURSE_ID,
  status: "active",
  plan_start_date: "2026-08-23",
  expires_at: null,
  ...overrides
});

assert.deepEqual(evaluateEntitlement(null, NOW), {allowed:false, reason:"missing", entitlement:null});
assert.equal(evaluateEntitlement(active(), NOW).allowed, true);
assert.equal(evaluateEntitlement(active({status:"suspended"}), NOW).reason, "suspended");
assert.equal(evaluateEntitlement(active({status:"revoked"}), NOW).reason, "revoked");
assert.equal(evaluateEntitlement(active({expires_at:null}), NOW).allowed, true);
assert.equal(evaluateEntitlement(active({expires_at:"2026-08-24T00:00:00+08:00"}), NOW).allowed, true);
assert.equal(evaluateEntitlement(active({expires_at:"2026-08-23T11:59:59+08:00"}), NOW).reason, "expired");

assert.deepEqual(learningPlanStatus("2026-08-23", "2026-08-23"), {phase:"active", suggestedDay:1, daysElapsed:0});
assert.deepEqual(learningPlanStatus("2026-08-22", "2026-08-23"), {phase:"active", suggestedDay:2, daysElapsed:1});
assert.deepEqual(learningPlanStatus("2026-07-25", "2026-08-23"), {phase:"active", suggestedDay:30, daysElapsed:29});
assert.deepEqual(learningPlanStatus("2026-07-14", "2026-08-23"), {phase:"completed", suggestedDay:30, daysElapsed:40});
assert.deepEqual(learningPlanStatus("2026-08-24", "2026-08-23"), {phase:"upcoming", suggestedDay:null, daysElapsed:-1});

assert.equal(evaluateEntitlement(active({plan_start_date:"2026-08-24"}), NOW).allowed, true);
assert.equal(evaluateEntitlement(active({plan_start_date:"2026-07-14"}), NOW).allowed, true);
for (let day = 1; day <= 30; day += 1) assert.equal(canAccessDay(active({plan_start_date:"2026-08-24"}), day, NOW), true);
assert.equal(canAccessDay(null, 1, NOW), false);
assert.equal(canAccessDay(active(), 31, NOW), false);

const dates = calendarDates("2026-08-23");
assert.equal(dates.length, 30);
assert.equal(dates[0], "2026-08-23");
assert.equal(dates[29], "2026-09-21");
assert.equal(addNaturalDays("2028-02-28", 1), "2028-02-29");
assert.deepEqual(calendarDates("invalid"), []);

console.log("entitlement and learning-plan tests passed");
