"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {addWrong, answerStats, bucket, ensureTestBuckets, resolveReview} = require("../progress-state.js");
const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

function state() {
  return {answers:{}, wrong:{}, hints:{}, questionIndex:{}, testAnswers:{}, testWrong:{}, testHints:{}, testQuestionIndex:{}};
}

test("同一题的练习与检测答案、提示和题目位置互不覆盖", () => {
  const value = state();
  bucket(value, "practice").answers.Q1 = {status:"correct", value:"A"};
  bucket(value, "test").answers.Q1 = {status:"wrong", value:"B"};
  bucket(value, "practice").hints.Q1 = 1;
  bucket(value, "test").hints.Q1 = 2;
  bucket(value, "practice").questionIndex.day03 = 4;
  bucket(value, "test").questionIndex.day03 = 1;
  assert.deepEqual(value.answers.Q1, {status:"correct", value:"A"});
  assert.deepEqual(value.testAnswers.Q1, {status:"wrong", value:"B"});
  assert.equal(value.hints.Q1, 1);
  assert.equal(value.testHints.Q1, 2);
  assert.equal(value.questionIndex.day03, 4);
  assert.equal(value.testQuestionIndex.day03, 1);
});

test("练习与检测错题独立，已解决错题再次答错会重新进入队列", () => {
  const value = state();
  addWrong(value, "practice", "Q1", "答错", "2026-08-19");
  addWrong(value, "test", "Q1", "不会做", "2026-08-19");
  value.wrong.Q1.resolved = true;
  value.wrong.Q1.reviewIndex = 4;
  addWrong(value, "practice", "Q1", "答错", "2026-08-20");
  assert.equal(value.wrong.Q1.resolved, false);
  assert.equal(value.wrong.Q1.reviewIndex, 0);
  assert.equal(value.wrong.Q1.due, "2026-08-20");
  assert.equal(value.testWrong.Q1.reason, "不会做");
});

test("家长练习统计可只读取日常练习答案", () => {
  const value = state();
  value.answers.Q1 = {status:"correct"};
  value.testAnswers.Q2 = {status:"correct"};
  assert.deepEqual(answerStats(value, "practice", ["Q1", "Q2"]), {attempted:1, correct:1, total:2});
  assert.deepEqual(answerStats(value, "test", ["Q1", "Q2"]), {attempted:1, correct:1, total:2});
  assert.match(app, /function answeredQuestions\(day\) \{ return day\.questions\.filter\(id => state\.answers\[id\]\?\.status === "correct"\)\.length; \}/);
  assert.match(app, /const stats = PROGRESS\.answerStats\(state,"test",day\.test\);/);
});

test("已到期错题答对后按独立检测桶推进复习", () => {
  const value = state();
  addWrong(value, "test", "Q1", "答错", "2026-08-19");
  resolveReview(value, "test", "Q1", "2026-08-19", (date, days) => `${date}+${days}`, [0, 1, 3, 7]);
  assert.equal(value.testWrong.Q1.due, "2026-08-19+1");
  assert.equal(value.wrong.Q1, undefined);
});

test("旧进度 JSON 加载时保留日常记录并补齐新版检测字段", () => {
  const legacy = {answers:{Q1:{status:"correct"}}, wrong:{Q1:{resolved:false}}, hints:{Q1:1}, questionIndex:{day01:2}};
  ensureTestBuckets(legacy);
  assert.equal(legacy.answers.Q1.status, "correct");
  assert.equal(legacy.wrong.Q1.resolved, false);
  assert.deepEqual(legacy.testAnswers, {});
  assert.deepEqual(legacy.testWrong, {});
  assert.deepEqual(legacy.testHints, {});
  assert.deepEqual(legacy.testQuestionIndex, {});
});

test("重置与导入提示覆盖整份状态的真实影响范围", () => {
  assert.match(app, /导入会覆盖当前账号全部进度；选择文件后还会再次确认/);
  assert.match(app, /会清除日常练习和检测的答案、错题、任务、家长验收、题目位置、提示和提醒，并同步到云端/);
  assert.match(app, /清除日常练习和检测的答案、错题、任务、家长验收、题目位置、提示和提醒/);
  assert.match(app, /导入会覆盖当前账号的全部进度：日常练习和检测的答案、错题、任务、家长验收、题目位置、提示和提醒/);
});
