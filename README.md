# T o T 匿名信箱

To Tyycc 的个人匿名信箱。  
默认匿名，默认私密；公开、删除和回信都只由管理员决定。

## 本地运行

先准备 `.env.local`：

```powershell
Copy-Item .env.example .env.local
```

然后填写：

```text
NEXT_PUBLIC_SUPABASE_URL=你的 Supabase Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的 Supabase anon/publishable key
SUPABASE_SERVICE_ROLE_KEY=你的 Supabase service_role/secret key
TOT_ADMIN_PASSWORD=后台登录密码
TOT_SESSION_SECRET=一段很长的随机字符串
```

启动：

```powershell
pnpm install
pnpm dev
```

访问：

- 首页：http://localhost:3000/
- 后台：http://localhost:3000/admin
- 公开页：http://localhost:3000/public
- ToT 便利贴：http://localhost:3000/tot

## Supabase 设置

1. 打开 Supabase Dashboard。
2. 进入你的项目。
3. 左侧点 `SQL Editor`。
4. 新建 Query。
5. 粘贴并执行 `SUPABASE_RLS.sql`。

这个项目的设计是：浏览器不直接读写 `messages` 表，所有提交、公开读取、点赞、后台管理和回信都通过 Vercel 的服务端 API 完成。  
`SUPABASE_SERVICE_ROLE_KEY` 只允许放在服务端环境变量里，不要写进前端代码，不要提交到 GitHub。

## Vercel 免费部署

1. 把项目推送到 GitHub。
2. 打开 Vercel Dashboard。
3. 点击 `Add New` -> `Project`。
4. 选择这个 GitHub 仓库。
5. `Framework Preset` 选择 `Next.js`。
6. 在 `Environment Variables` 填入：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `TOT_ADMIN_PASSWORD`
   - `TOT_SESSION_SECRET`
7. 点击 `Deploy`。

如果之后修改环境变量，需要在 Vercel 里重新部署一次。

## EdgeOne Pages 国内镜像

如果需要给国内朋友使用，可以把同一个 GitHub 仓库导入腾讯 EdgeOne Pages。  
EdgeOne 镜像站和 Vercel 原站共用同一个 Supabase 项目，详细步骤见 `EDGEONE_DEPLOYMENT.md`。

## Cloudflare Pages 免费镜像

如果需要一个不买域名的长期免费镜像，可以把同一个 GitHub 仓库导入 Cloudflare Pages。  
Cloudflare 会提供长期 `*.pages.dev` 域名，详细步骤见 `CLOUDFLARE_DEPLOYMENT.md`。

## 上线后测试

- 首页空内容不能投递。
- 首页能正常提交匿名留言。
- 后台未登录时不能看到留言。
- 后台登录后按时间倒序显示全部留言。
- 未勾选允许公开的留言不能被公开。
- 已公开留言会出现在首页下方和 `/public`。
- 昵称为空时公开显示“匿名”。
- 后台可以删除留言，删除后前台不再显示。
- 后台可以确认回信，用户回访时看到“你有一封新的回信”。
- 后台可以自动生成 ToT 便利贴访问密码、设置有效时间、发布便利贴、修改或删除便利贴。
- `/tot` 未输入正确访问密码时不会显示便利贴内容；后台修改密码后旧口令立即失效。
- 手机微信、QQ、Safari、Chrome 均使用 Vercel HTTPS 地址测试。

## 旧本地版本

仓库里仍保留了早期的 `server.py`、静态 HTML 和本地 SQLite 文件用于回看。正式上线使用 Next.js + Supabase，不依赖 `tot_messages.sqlite3`。
