# EdgeOne Pages 国内镜像部署

这个部署作为 ToT 的国内朋友访问镜像站使用。Vercel 原站保留不动，数据库仍然连接同一个 Supabase 项目。

## 1. 导入 GitHub 仓库

1. 打开 EdgeOne 控制台。
2. 进入 `Pages`。
3. 点击 `新建项目`。
4. 选择 `从 Git 仓库导入`。
5. 授权并选择仓库：`tyycccat-ai/To-Tyycc`。
6. 分支选择：`main`。

## 2. 构建配置

EdgeOne Pages 通常可以自动识别 Next.js。若需要手动填写：

```text
Framework: Next.js
Install Command: pnpm install
Build Command: pnpm build
Output Directory: .next
Node.js Version: 20 或更新
```

## 3. 环境变量

在 EdgeOne Pages 项目设置里添加以下变量，Production 环境都要填写：

```text
NEXT_PUBLIC_SUPABASE_URL=你的 Supabase Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的 Supabase anon/publishable key
SUPABASE_SERVICE_ROLE_KEY=你的 Supabase service_role/secret key
TOT_ADMIN_PASSWORD=你的后台密码
TOT_SESSION_SECRET=一段很长的随机字符串
```

注意：

- `SUPABASE_SERVICE_ROLE_KEY` 不要发到聊天里，不要写进代码。
- 这个 key 只能放在 EdgeOne/Vercel 的服务端环境变量里。
- EdgeOne 镜像站和 Vercel 原站会共用 Supabase 数据，所以两边后台看到的是同一批信。

## 4. 部署后测试

用 EdgeOne 提供的访问地址测试：

- 首页能提交留言。
- `/admin` 未登录不能看到后台内容。
- `/admin` 登录后能看到刚提交的留言。
- 允许公开的留言可以公开。
- `/public` 只显示已公开留言。
- 后台确认回信后，原浏览器回到首页能看到回信卡片。
- 微信和 QQ 内置浏览器能直接打开 EdgeOne 地址。

## 5. 镜像站说明

Vercel 原站不需要修改。  
如果未来同时保留两个入口，建议把正式分享给国内朋友的链接换成 EdgeOne Pages 地址。
