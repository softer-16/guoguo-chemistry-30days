"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const COURSE_ID = "guoguo-chemistry-30days";
const SOURCE_FILES = ["data.js", "data-days11-20.js", "data-days21-30.js"];

function loadLegacyCourseData(sourceDirectory) {
  const context = {window:{}};
  vm.createContext(context);
  SOURCE_FILES.forEach(file => {
    const sourcePath = path.join(sourceDirectory, file);
    vm.runInContext(fs.readFileSync(sourcePath, "utf8"), context, {filename:sourcePath});
  });
  return context.window.CHEM_DATA;
}

function validateCourseData(data) {
  if (!data || typeof data !== "object") throw new Error("课程内容不是对象");
  if (!Array.isArray(data.days) || data.days.length !== 30) throw new Error("课程必须包含30天");
  if (!Array.isArray(data.route) || data.route.length !== 30) throw new Error("课程路线必须包含30天");
  if (!Array.isArray(data.questions) || data.questions.length !== 900) throw new Error("课程必须包含900题");

  const questionIds = new Set(data.questions.map(question => question.id));
  if (questionIds.size !== 900) throw new Error("题目 ID 必须唯一");
  data.days.forEach((day, index) => {
    const expectedId = `day${String(index + 1).padStart(2, "0")}`;
    if (day.id !== expectedId || day.day !== index + 1) throw new Error(`第${index + 1}天标识不正确`);
    if (!Array.isArray(day.questions) || day.questions.length !== 30) throw new Error(`${expectedId} 必须包含30道练习题`);
    [...day.questions, ...(day.test || [])].forEach(id => {
      if (!questionIds.has(id)) throw new Error(`${expectedId} 引用了不存在的题目 ${id}`);
    });
  });
  return {
    days: data.days.length,
    questions: data.questions.length,
    version: data.version
  };
}

function checksum(data) {
  return crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

function dollarQuote(value) {
  let tag = "course_content";
  while (value.includes(`$${tag}$`)) tag += "_x";
  return `$${tag}$${value}$${tag}$`;
}

function buildUpsertSql(data) {
  const summary = validateCourseData(data);
  const payload = JSON.stringify(data);
  const digest = checksum(data);
  return {
    summary: {...summary, checksum:digest},
    sql: `begin;\n\ninsert into public.course_contents (course_id, content_version, payload, checksum)\nvalues (\n  '${COURSE_ID}',\n  ${dollarQuote(String(data.version))},\n  ${dollarQuote(payload)}::jsonb,\n  '${digest}'\n)\non conflict (course_id) do update\nset content_version = excluded.content_version,\n    payload = excluded.payload,\n    checksum = excluded.checksum,\n    updated_at = now();\n\ncommit;\n`
  };
}

module.exports = {COURSE_ID, SOURCE_FILES, loadLegacyCourseData, validateCourseData, checksum, buildUpsertSql};
