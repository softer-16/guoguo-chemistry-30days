# 首批用户开通 SOP

适用范围：果果的化学·30天通关首批用户。本 SOP 只处理用户提供的注册邮箱和课程授权；管理员永远不接触顾客密码。

## 顾客流程

1. 打开课程网站。
2. 点击“创建账号”。
3. 自己填写邮箱和密码并创建账号。
4. 直接使用注册邮箱和密码登录。
5. 页面显示“课程正在等待管理员开通”。这表示账号已登录，但尚未获得课程授权。
6. 通过闲鱼订单消息发送注册邮箱，等待管理员开通。

## 管理员开通流程

1. 仅处理购买平台订单消息中顾客主动提供的注册邮箱。
2. 不要在 Supabase 预先创建用户；用户必须自己在网站创建账号。
3. 不向顾客索取、记录或发送密码。
4. 在 Supabase Dashboard 的 SQL Editor 中，将下方 SQL 的 `<顾客注册邮箱>` 替换为顾客提供的邮箱后执行。

```sql
with target_user as (
  select id, email
  from auth.users
  where lower(email) = lower('<顾客注册邮箱>')
), granted as (
  insert into public.course_entitlements (
    user_id,
    course_id,
    status,
    plan_start_date,
    expires_at
  )
  select
    id,
    'guoguo-chemistry-30days',
    'active',
    current_date,
    null
  from target_user
  on conflict (user_id, course_id) do update
  set status = 'active',
      plan_start_date = excluded.plan_start_date,
      expires_at = null,
      updated_at = now()
  returning user_id, course_id, status, plan_start_date, expires_at
)
select target_user.email, granted.course_id, granted.status, granted.plan_start_date, granted.expires_at
from granted
join target_user on target_user.id = granted.user_id;
```

5. 成功标准：查询结果恰好返回 1 行，且 `status` 为 `active`。返回 0 行时，不要猜测邮箱；请让顾客重新通过闲鱼订单消息确认其注册邮箱。
6. 请顾客刷新网站。有效 `active` 授权后，Day01–Day30 会全部立即可访问；`plan_start_date` 只用于学习建议和日历提醒，不锁课。

## 暂停、恢复与撤销

日常停售、纠纷处理或临时暂停使用授权状态，不删除 Auth 用户。这样用户账号和 `user_progress` 学习进度都会保留。

以下每条 SQL 都把 `<顾客注册邮箱>` 替换为购买平台消息中的邮箱。执行后检查返回行的 `status`；应恰好为 1 行。

### 暂停

```sql
update public.course_entitlements
set status = 'suspended'
where user_id = (
  select id from auth.users where lower(email) = lower('<顾客注册邮箱>')
)
and course_id = 'guoguo-chemistry-30days'
returning user_id, course_id, status, updated_at;
```

### 恢复

```sql
update public.course_entitlements
set status = 'active',
    expires_at = null
where user_id = (
  select id from auth.users where lower(email) = lower('<顾客注册邮箱>')
)
and course_id = 'guoguo-chemistry-30days'
returning user_id, course_id, status, updated_at;
```

### 撤销

```sql
update public.course_entitlements
set status = 'revoked'
where user_id = (
  select id from auth.users where lower(email) = lower('<顾客注册邮箱>')
)
and course_id = 'guoguo-chemistry-30days'
returning user_id, course_id, status, updated_at;
```

暂停、恢复和撤销都保留学习进度。不要把删除用户作为日常停售、暂停或撤销课程的方式。

## 常见问题

- “课程正在等待管理员开通”：代表顾客已成功登录，但还没有 `active` 课程授权；不是登录失败。
- “邮箱或密码不正确”：只表示登录凭据无法通过验证。顾客应检查输入，或使用网站的“忘记密码？”自行重设；管理员不处理密码。
- 旧邀请邮件链接：不要使用。早期邀请制已废弃，当前顾客流程是自主注册邮箱和密码。
- 邮箱确认或邀请制：当前版本不以邮箱确认或邀请制作为顾客流程。

## 安全边界

- 本文档、订单备注和任何外部消息中不得写入真实邮箱、密码、token、Supabase 密钥或订单信息。
- 只按购买平台消息中顾客主动提供的注册邮箱授予课程。
- 管理员只修改 `course_entitlements` 授权状态；不得在前端或聊天中处理高权限密钥。
