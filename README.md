# 果果的化学·30天通关系统

面向零基础九年级学生的化学学习网站。现已开放 Day 01–Day 30，包含每天30题、分段讲解、滚动检测、四套综合模拟、提示阶梯、错题复习、家长验收、账号登录和跨设备学习记录，共900题。

## 在线访问

<https://softer-16.github.io/guoguo-chemistry-30days/>

## 本地预览

在本目录启动静态文件服务器：

```powershell
python -m http.server 4173
```

浏览器访问 <http://127.0.0.1:4173/>。

未配置 Supabase 时，网站只显示配置提示，不会显示学习内容。

## 配置账号与云端进度

1. 在 Supabase 创建项目。
2. 打开 SQL Editor，执行 [`supabase/schema.sql`](supabase/schema.sql)。
3. 在 Authentication 设置中关闭公开注册。第一阶段由管理员创建或邀请用户。
4. 在 Authentication 的 Users 页面创建妹妹的邮箱账号。
5. 在项目设置的 API 页面复制 Project URL 和 publishable key，填入 `config.js`：

```js
window.CHEM_SUPABASE_CONFIG = {
  url: "https://项目编号.supabase.co",
  publishableKey: "sb_publishable_..."
};
```

`publishableKey` 可以出现在前端。不要把 `service_role` 密钥或 Supabase 登录密码写入仓库。

数据库启用了行级安全策略：登录用户只能读取和修改 `user_id` 等于自己账号 ID 的学习档案。

## 首次登录与同步规则

- 第一次登录且云端没有记录时，网站会迁移当前浏览器原有的本地进度。
- 云端已有记录时，以云端记录为准，并刷新当前设备缓存。
- 做题、任务、错题和设置变更后，先保存到当前设备，再自动上传云端。
- 顶部会显示“保存中”“已保存”或“保存失败”。
- 两台设备不要同时答题；当前规则为最后一次成功保存覆盖前一次。
- JSON 导出和导入继续保留，用于人工备份。

## 发布

现有项目可以继续通过 GitHub Pages 发布，也可以连接 Cloudflare Pages。无论使用哪一种，都要把 Supabase 中的 Site URL 和允许跳转网址设置为最终网站地址。

Cloudflare Pages 使用当前 GitHub 仓库时：

- Framework preset：`None`
- Build command：留空
- Build output directory：`.`

发布后按以下顺序验收：

1. 未登录时只能看到登录页。
2. 在 Safari 登录并完成一道题，等待显示“已保存”。
3. 在 Edge 使用同一账号登录，确认能看到相同答案和错题。
4. 在 Edge 修改进度，再回到 Safari 刷新确认同步。
5. 使用第二个测试账号登录，确认看不到第一个账号的数据。

## 项目唯一来源

本仓库是网站代码的唯一来源。不同 Codex 对话不会自动共享完整聊天记录，因此继续开发时应先读取本 README 和 `supabase/schema.sql`，并且不要让两个对话同时修改同一批文件。

## 后续：安装到 iPad 主屏幕

账号同步稳定后，可以增加 Web App Manifest、应用图标和缓存规则，把网站完善为可安装的 PWA。妹妹从 Safari 添加到主屏幕后，可以像独立 App 一样打开；它仍使用同一个网址、账号和 Supabase 学习进度，不会形成第二套数据。

## 数据与版权

- 学习记录按用户保存在 Supabase，并在当前设备保留账号隔离的缓存。
- 网站不包含教材或教辅扫描页。
- 知识讲解与题目依据人教版九年级上册课程范围重新组织，题目为原创或改编表达。
