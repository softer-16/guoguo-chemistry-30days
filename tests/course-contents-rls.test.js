"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const migration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260817_add_course_contents.sql"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

test("课程内容 RLS 只允许有效授权用户读取，不用学习计划日期锁课", () => {
  assert.match(migration, /alter table public\.course_contents enable row level security/);
  assert.match(migration, /revoke all on public\.course_contents from anon/);
  assert.match(migration, /grant select on public\.course_contents to authenticated/);
  assert.match(migration, /entitlement\.status = 'active'/);
  assert.match(migration, /entitlement\.expires_at is null or entitlement\.expires_at > now\(\)/);
  assert.doesNotMatch(migration, /plan_start_date/);
});

test("公开页面不再加载课程数据，授权后才从受保护表读取", () => {
  assert.doesNotMatch(index, /src="data(?:-days\d+-\d+)?\.js/);
  assert.doesNotMatch(app, /window\.CHEM_DATA/);
  assert.match(app, /from\("course_contents"\)/);
  assert.ok(app.indexOf("await loadCourseContent()") < app.indexOf("await loadCloudState()"));
  ["data.js", "data-days11-20.js", "data-days21-30.js"].forEach(file => {
    assert.equal(fs.existsSync(path.join(root, file)), false, `${file} 不得留在公开根目录`);
  });
});
