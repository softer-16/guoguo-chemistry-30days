"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {buildUpsertSql, checksum, validateCourseData} = require("../scripts/course-content-lib");

function fixture() {
  const questions = Array.from({length:900}, (_, index) => ({id:`Q${index + 1}`}));
  const days = Array.from({length:30}, (_, index) => ({
    id:`day${String(index + 1).padStart(2, "0")}`,
    day:index + 1,
    questions:questions.slice(index * 30, index * 30 + 30).map(question => question.id),
    test:index === 2 ? ["Q1"] : []
  }));
  return {version:"test-v1", route:days.map(day => ({id:day.id})), days, questions};
}

test("课程导入数据必须保持30天、900题和稳定引用", () => {
  const data = fixture();
  assert.deepEqual(validateCourseData(data), {days:30, questions:900, version:"test-v1"});
  assert.match(checksum(data), /^[0-9a-f]{64}$/);
});

test("导入 SQL 只写入课程内容表且携带完整性校验值", () => {
  const result = buildUpsertSql(fixture());
  assert.match(result.sql, /insert into public\.course_contents/);
  assert.match(result.sql, /on conflict \(course_id\) do update/);
  assert.equal(result.summary.days, 30);
  assert.equal(result.summary.questions, 900);
});

test("缺失题目引用会拒绝生成导入数据", () => {
  const data = fixture();
  data.days[0].questions[0] = "missing";
  assert.throws(() => validateCourseData(data), /不存在的题目/);
});
