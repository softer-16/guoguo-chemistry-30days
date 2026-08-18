# 果果的化学·30天通关系统

面向零基础九年级学生的化学学习网站。现已开放 Day 01–Day 30，包含每天30题、分段讲解、滚动检测、四套综合模拟、提示阶梯、错题复习、家长验收、账号登录和跨设备学习记录，共900题。

## 商业产品路线

- 当前商品是 Day 01–Day 30 完整课程，一次性买断，不采用订阅或分阶段二次收费。
- 有效授权生效后，Day 01–Day 30 全部立即开放；学习计划日期不限制课程访问。
- `plan_start_date` 只用于首页今日建议、30天时间轴和日历提醒。
- 当前阶段采用用户自主注册：用户创建并确认邮箱账号后，通过闲鱼订单消息发送注册邮箱；管理员再手动授予课程权限。不包含支付或管理员后台。

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
3. 在 Authentication 设置中启用邮箱注册和邮箱确认。
4. 已付款用户在网站创建并确认账号后，通过闲鱼订单消息发送注册邮箱；管理员在 SQL Editor 中为该账号授予课程权限。
5. 在项目设置的 API 页面复制 Project URL 和 publishable key，填入 `config.js`：

```js
window.CHEM_SUPABASE_CONFIG = {
  url: "https://项目编号.supabase.co",
  publishableKey: "sb_publishable_..."
};
```

`publishableKey` 可以出现在前端。不要把 `service_role` 密钥或 Supabase 登录密码写入仓库。

数据库启用了行级安全策略：登录用户只能读取和修改 `user_id` 等于自己账号 ID 的学习档案。

执行Schema后，管理员在SQL Editor中为已购买用户授予完整课程权限。把示例UUID和日期替换为实际值：

```sql
insert into public.course_entitlements (
  user_id,
  course_id,
  status,
  plan_start_date,
  expires_at
) values (
  '00000000-0000-0000-0000-000000000000',
  'guoguo-chemistry-30days',
  'active',
  '2026-08-23',
  null
)
on conflict (user_id, course_id) do update
set status = excluded.status,
    plan_start_date = excluded.plan_start_date,
    expires_at = excluded.expires_at,
    updated_at = now();
```

普通浏览器用户只能读取自己的授权，不能新增、修改或删除授权。删除Auth用户时，其课程授权会随账号删除，但不会影响其他用户或现有 `user_progress` 表结构。

邮箱确认邮件会默认跳转至 Supabase Auth 的 Site URL；上线前必须将正式网站地址配置为 Site URL，并添加到 Redirect URLs。密码重置还需要将正式网站的 `https://你的域名/?reset-password=1` 加入 Redirect URLs。网页不写死个人联系方式；未开通用户统一通过闲鱼订单消息联系商家，并提供注册邮箱。

## 课程正文保护与私有导入

课程正文、900题、答案和提示不再作为公开静态 JavaScript 文件发布。有效授权用户登录后，前端才从 `course_contents` 读取完整课程；RLS 会同时检查自己的同课程授权为 `active` 且未过期。`plan_start_date` 不参与此检查，因此 Day01–Day30 始终一次性开放。

新项目直接执行 [`supabase/schema.sql`](supabase/schema.sql)。已有 Task01 项目只执行 [`supabase/migrations/20260817_add_course_contents.sql`](supabase/migrations/20260817_add_course_contents.sql)。两者都只创建表、约束和 RLS，不包含任何课程正文。

课程内容必须从受控的本地数据副本生成一次性导入 SQL，生成结果应放在 Git 忽略的 `private/` 目录。以下命令只生成本地文件，不会连接 Supabase：

```powershell
node scripts/prepare-course-content-import.js --source <受控旧数据目录> --output private/course-content-import.sql
```

脚本会校验30天、900题、题目 ID 和所有题目引用，并输出 SHA-256 checksum。只有在负责人明确确认线上数据库操作后，才能将该私有 SQL 导入 Supabase SQL Editor。不得把导入 SQL、课程 JSON、`service_role` 或数据库密码提交到仓库。

回滚文件为 [`supabase/rollbacks/20260817_remove_course_contents.sql`](supabase/rollbacks/20260817_remove_course_contents.sql)。它会删除课程内容表，必须先回滚前端且取得明确确认后才能执行。

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

## 商业化开发任务顺序

1. 完整30天买断授权与用户独立学习计划日期。
2. 课程正文从公开静态JavaScript迁移至受Supabase RLS保护的数据层。
3. 云端与本地同步可靠性修复。
4. 练习与检测状态隔离及首发体验打磨。
5. 正式托管迁移、仓库Private、安全与真机验收。
6. 闲鱼商品包装、定价、首图、详情页、FAQ与正式上线。
