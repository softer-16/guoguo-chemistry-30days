"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

test("登录页仅面向已开通用户，不提供自主注册", () => {
  assert.match(app, /已开通用户登录/);
  assert.match(app, /邀请制，不开放自主注册/);
  assert.match(app, /请通过购买平台联系商家，并提供当前登录邮箱/);
  assert.doesNotMatch(app, /auth\.signUp/);
});

test("邀请回调要求用户设置密码，再进入既有授权流程", () => {
  assert.match(app, /authCallbackParams\.get\("type"\) === "invite"/);
  assert.match(app, /id="invite-password-form"/);
  assert.match(app, /cloud\.auth\.updateUser\(\{password\}\)/);
  assert.match(app, /if \(invitePasswordSetupRequested\) \{ renderInvitePasswordSetup\(\); return; \}/);
  assert.ok(app.indexOf("await enterCourse();", app.indexOf("completeInvitePassword")) > app.indexOf("cloud.auth.updateUser({password})"));
});
