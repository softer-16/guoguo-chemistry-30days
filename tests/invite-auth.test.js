"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const index = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("登录页提供自主注册入口，未开通用户可按购买平台流程联系商家", () => {
  assert.match(app, /创建账号/);
  assert.match(app, /data-action="show-signup"/);
  assert.match(app, /请通过购买平台联系商家，并提供注册邮箱/);
  assert.match(app, /cloud\.auth\.signUp\(\{email,password\}\)/);
});

test("注册后提示邮箱确认与人工开通，且不自动进入课程", () => {
  assert.match(app, /id="signup-form"/);
  assert.match(app, /注册后请完成邮箱确认；已付款用户请通过购买平台发送注册邮箱，等待开通/);
  assert.match(app, /if \(data\.session\) await cloud\.auth\.signOut\(\);/);
  assert.ok(app.indexOf("renderSignup(\"\", \"账号已创建") > app.indexOf("cloud.auth.signUp({email,password})"));
});

test("邀请设密流程已从公开页面停用", () => {
  assert.doesNotMatch(app, /invite-password-form|completeInvitePassword|updateUser\(\{password\}\)/);
  assert.doesNotMatch(index, /invite-callback\.js/);
});
