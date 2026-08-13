((root, factory) => {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CHEM_ENTITLEMENT = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  const COURSE_ID = "guoguo-chemistry-30days";
  const DAY_MS = 86400000;

  function parseNaturalDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const serial = Date.UTC(year, month - 1, day);
    const date = new Date(serial);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return {year, month, day, serial};
  }

  function formatNaturalDate(year, month, day) {
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function localNaturalDate(date = new Date()) {
    return formatNaturalDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }

  function addNaturalDays(value, days) {
    const parsed = parseNaturalDate(value);
    if (!parsed || !Number.isInteger(days)) return null;
    const date = new Date(parsed.serial + days * DAY_MS);
    return formatNaturalDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  function learningPlanStatus(planStartDate, today = localNaturalDate()) {
    const start = parseNaturalDate(planStartDate);
    const current = parseNaturalDate(today);
    if (!start || !current) return {phase: "unavailable", suggestedDay: null, daysElapsed: null};
    const daysElapsed = Math.round((current.serial - start.serial) / DAY_MS);
    if (daysElapsed < 0) return {phase: "upcoming", suggestedDay: null, daysElapsed};
    if (daysElapsed >= 30) return {phase: "completed", suggestedDay: 30, daysElapsed};
    return {phase: "active", suggestedDay: daysElapsed + 1, daysElapsed};
  }

  function evaluateEntitlement(entitlement, now = new Date()) {
    if (!entitlement) return {allowed: false, reason: "missing", entitlement: null};
    if (entitlement.course_id !== COURSE_ID) return {allowed: false, reason: "missing", entitlement};
    if (entitlement.status === "suspended") return {allowed: false, reason: "suspended", entitlement};
    if (entitlement.status === "revoked") return {allowed: false, reason: "revoked", entitlement};
    if (entitlement.status !== "active") return {allowed: false, reason: "invalid", entitlement};
    if (entitlement.expires_at) {
      const expiresAt = Date.parse(entitlement.expires_at);
      const nowValue = now instanceof Date ? now.getTime() : Date.parse(now);
      if (!Number.isFinite(expiresAt) || !Number.isFinite(nowValue)) return {allowed: false, reason: "invalid", entitlement};
      if (expiresAt <= nowValue) return {allowed: false, reason: "expired", entitlement};
    }
    return {allowed: true, reason: "active", entitlement};
  }

  function canAccessDay(entitlement, day, now = new Date()) {
    return Number.isInteger(day) && day >= 1 && day <= 30 && evaluateEntitlement(entitlement, now).allowed;
  }

  function calendarDates(planStartDate, count = 30) {
    if (!parseNaturalDate(planStartDate) || !Number.isInteger(count) || count < 1) return [];
    return Array.from({length: count}, (_, index) => addNaturalDays(planStartDate, index));
  }

  return Object.freeze({
    COURSE_ID,
    parseNaturalDate,
    localNaturalDate,
    addNaturalDays,
    learningPlanStatus,
    evaluateEntitlement,
    canAccessDay,
    calendarDates
  });
});
