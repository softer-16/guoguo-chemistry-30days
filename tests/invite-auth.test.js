"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const index = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const entitlement = fs.readFileSync(path.join(__dirname, "..", "entitlement.js"), "utf8");

test("登录页提供自主注册入口，未开通用户可按购买平台流程联系商家", () => {
  assert.match(app, /创建账号/);
  assert.match(app, /data-action="show-signup"/);
  assert.match(app, /请通过购买平台联系商家，并提供注册邮箱/);
  assert.match(app, /cloud\.auth\.signUp\(\{email,password\}\)/);
});

test("注册成功后可直接登录并等待人工开通，且不自动进入课程", () => {
  assert.match(app, /id="signup-form"/);
  assert.match(app, /账号创建成功，请直接使用注册邮箱和密码登录。已付款用户请通过购买平台发送注册邮箱，等待管理员开通课程。/);
  assert.match(app, /data-action="show-login"/);
  assert.match(app, /if \(data\.session\) await cloud\.auth\.signOut\(\);/);
  assert.ok(app.indexOf("renderSignup(\"\", \"账号创建成功") > app.indexOf("cloud.auth.signUp({email,password})"));
});

test("登录反馈覆盖凭据错误与暂时异常，且未授权仍是已登录状态", () => {
  assert.doesNotMatch(app, /email_not_confirmed|邮箱尚未确认|确认邮件|确认链接/);
  assert.match(app, /邮箱或密码不正确，请检查后重试/);
  assert.match(app, /登录服务暂时异常，请稍后重试/);
  assert.match(app, /你已登录，课程正在等待管理员开通/);
  assert.ok(app.indexOf("if \(!entitlementDecision.allowed\) { renderEntitlementStatus\(\); return; }") < app.indexOf("await loadCourseContent()"));
  assert.match(entitlement, /entitlement\.status !== "active"/);
});

test("邀请设密流程已从公开页面停用", () => {
  assert.doesNotMatch(app, /invite-password-form|completeInvitePassword|renderInvitePasswordSetup/);
  assert.doesNotMatch(index, /invite-callback\.js/);
});

test("忘记密码通过邮件重置，回跳后仅由用户自行设置新密码", () => {
  assert.match(app, /data-action="show-password-reset"/);
  assert.match(app, /id="password-reset-request-form"/);
  assert.match(app, /cloud\.auth\.resetPasswordForEmail\(email,\{redirectTo:passwordResetRedirectUrl\(\)\}\)/);
  assert.match(app, /\?reset-password=1/);
  assert.match(app, /id="password-reset-form"/);
  assert.match(app, /cloud\.auth\.updateUser\(\{password\}\)/);
  assert.match(app, /if \(passwordResetRequested\) \{ renderPasswordReset\(\); return; \}/);
  assert.doesNotMatch(app, /console\.log\(|localStorage\.setItem\([^)]*password/);
});
