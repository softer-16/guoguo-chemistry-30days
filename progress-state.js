((root, factory) => {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CHEM_PROGRESS_STATE = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  function bucket(state, context = "practice") {
    return context === "test"
      ? {answers:state.testAnswers, wrong:state.testWrong, hints:state.testHints, questionIndex:state.testQuestionIndex}
      : {answers:state.answers, wrong:state.wrong, hints:state.hints, questionIndex:state.questionIndex};
  }

  function ensureTestBuckets(state) {
    ["testAnswers", "testWrong", "testHints", "testQuestionIndex"].forEach(key => {
      if (!state[key] || typeof state[key] !== "object" || Array.isArray(state[key])) state[key] = {};
    });
    return state;
  }

  function addWrong(state, context, questionId, reason, today) {
    const wrong = bucket(state, context).wrong;
    const existing = wrong[questionId];
    wrong[questionId] = existing || {questionId, reason, firstAt:today, due:today, reviewIndex:0, resolved:false};
    wrong[questionId].reason = reason;
    if (wrong[questionId].resolved) {
      wrong[questionId].resolved = false;
      wrong[questionId].resolvedAt = undefined;
      wrong[questionId].reviewIndex = 0;
      wrong[questionId].due = today;
    }
    return wrong[questionId];
  }

  function resolveReview(state, context, questionId, today, addDays, intervals) {
    const item = bucket(state, context).wrong[questionId];
    if (!item || item.resolved || item.due > today) return item;
    item.reviewIndex += 1;
    if (item.reviewIndex >= intervals.length) { item.resolved = true; item.resolvedAt = today; }
    else item.due = addDays(today, intervals[item.reviewIndex]);
    return item;
  }

  function answerStats(state, context, ids) {
    const answers = bucket(state, context).answers;
    const attempted = ids.filter(id => answers[id]).length;
    const correct = ids.filter(id => answers[id]?.status === "correct").length;
    return {attempted, correct, total:ids.length};
  }

  return Object.freeze({bucket, ensureTestBuckets, addWrong, resolveReview, answerStats});
});
