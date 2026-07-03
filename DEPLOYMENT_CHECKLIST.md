# T o T 上线前检查

## GitHub

- 本机安装 Git for Windows，或使用 GitHub Desktop。
- 仓库里不要提交 `.env.local`、`.env`、`tot_messages.sqlite3`。
- 推送到 GitHub 后再导入 Vercel。

## Supabase

- `SQL Editor` 执行 `SUPABASE_RLS.sql`。
- `messages` 表启用 RLS。
- `anon` 和 `authenticated` 不应直接拥有 `messages` 的全表读写权限。
- 管理员能力通过 Vercel 服务端 API + `SUPABASE_SERVICE_ROLE_KEY` 完成。

## Vercel Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TOT_ADMIN_PASSWORD`
- `TOT_SESSION_SECRET`

注意：`SUPABASE_SERVICE_ROLE_KEY` 只放 Vercel 环境变量，不写进前端代码。

## 回归测试

- 空内容不能提交。
- 同一 IP 1 分钟第 4 次提交会被限制。
- 昵称为空时，公开页显示“匿名”。
- 未勾选允许公开时，后台不显示“公开”按钮。
- 已公开留言可以取消公开。
- 删除后首页和公开页不再显示。
- 点赞数量能更新。
- 公开页搜索能按关键词或日期过滤。
- 确认回信后，原留言者回访首页会看到回信卡片。
- `/reply` 页面以信纸形式展示，不是聊天界面。
- 手机端 390px 宽度无横向溢出。
