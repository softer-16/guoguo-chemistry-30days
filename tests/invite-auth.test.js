"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const callbackSource = fs.readFileSync(path.join(__dirname, "..", "invite-callback.js"), "utf8");
const callbackWindow = {};
new Function("window", callbackSource)(callbackWindow);

test("登录页仅面向已开通用户，不提供自主注册", () => {
  assert.match(app, /已开通用户登录/);
  assert.match(app, /邀请制，不开放自主注册/);
  assert.match(app, /请通过购买平台联系商家，并提供当前登录邮箱/);
  assert.doesNotMatch(app, /auth\.signUp/);
});

test("邀请回调要求用户设置密码，再进入既有授权流程", () => {
  assert.match(app, /detectSessionInUrl:true/);
  assert.match(app, /inviteCallback\.type !== "none"/);
  assert.match(app, /id="invite-password-form"/);
  assert.match(app, /cloud\.auth\.updateUser\(\{password\}\)/);
  assert.match(app, /if \(invitePasswordSetupRequested\) \{ renderInvitePasswordSetup\(\); return; \}/);
  assert.ok(app.indexOf("await enterCourse();", app.indexOf("completeInvitePassword")) > app.indexOf("cloud.auth.updateUser({password})"));
});

test("邀请回调同时识别 PKCE code 与隐式 hash token，不保留凭据", () => {
  const parse = callbackWindow.CHEM_INVITE_CALLBACK.parseInviteCallback;
  assert.deepEqual(parse("https://course.example/?code=one-time-code"), {type:"pkce"});
  assert.deepEqual(parse("https://course.example/#access_token=token&refresh_token=refresh&type=invite"), {type:"implicit"});
  assert.deepEqual(parse("https://course.example/#type=invite"), {type:"none"});
  assert.doesNotMatch(callbackSource, /console\.|localStorage|sessionStorage/);
});
