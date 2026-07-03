# Cloudflare Pages 免费镜像部署

这个部署用于获得长期免费的 `*.pages.dev` 镜像域名。Vercel 原站不受影响，数据库继续使用同一个 Supabase 项目。

## 1. 导入 GitHub

1. 打开 Cloudflare Dashboard。
2. 进入 `Workers & Pages`。
3. 点击 `Create`。
4. 选择 `Pages` -> `Connect to Git`。
5. 选择仓库 `tyycccat-ai/To-Tyycc`。
6. Production branch 选择 `main`。

## 2. 构建配置

```text
Framework preset: Next.js 或 None
Build command: pnpm build:cloudflare
Build output directory: out
Root directory: /
Node.js version: 20 或更高
```

Cloudflare Pages 会提供长期域名，例如：

```text
https://to-tyycc.pages.dev
```

## 3. 环境变量

在 Cloudflare Pages 项目的 `Settings` -> `Environment variables` 添加：

```text
NEXT_PUBLIC_SUPABASE_URL=你的 Supabase Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的 Supabase anon/publishable key
SUPABASE_SERVICE_ROLE_KEY=你的 Supabase service_role/secret key
TOT_ADMIN_PASSWORD=你的后台密码
TOT_SESSION_SECRET=一段很长的随机字符串
```

注意：

- `SUPABASE_SERVICE_ROLE_KEY` 只放在 Cloudflare/Vercel 服务端环境变量。
- 如果你已经因为截图暴露过密钥，建议先在 Supabase/Vercel/EdgeOne/Cloudflare 全部换新。

## 4. 测试

- 首页能提交留言。
- `/admin` 能登录并看到留言。
- 未允许公开的留言不能公开。
- 允许公开的留言可以公开。
- `/public` 只显示已公开留言。
- 后台确认回信后，原浏览器回到首页能看到回信卡片。

## 5. 重要说明

Cloudflare Pages 的 `*.pages.dev` 是长期免费域名，但它不等于中国大陆加速。  
它适合做不买域名的长期免费镜像，但不能保证所有国内网络都稳定直连。
