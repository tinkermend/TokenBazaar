# 同域反代（PriceAI 门户 + TokenBazaar 控制台）

把两个应用放到同一个域名下，消除跨端口/跨域割裂感。

**生产默认方案与硬约束见 [docs/PRODUCTION_HUB_DEPLOY.md](../../docs/PRODUCTION_HUB_DEPLOY.md)。** 改路由或登录相关行为前必读，避免发版不可部署。契约见
[`docs/PRICEAI_PORTAL_NAV_SPEC.md`](../../docs/PRICEAI_PORTAL_NAV_SPEC.md) §8。

## 文件

| 文件 | 用途 |
| --- | --- |
| `route-map.json` | 路由归属的机器可读契约，**单一事实来源** |
| `nginx.conf` | Nginx 示例（`map` + 单 `location`，26 条前缀集中在一处） |
| `Caddyfile` | Caddy 等价示例（生产：TB 嵌入式 :8080） |
| `Caddyfile.local` | **本机 L2 验收**（Next:3000 + **TB dist 静态** + API:8081）→ `:9080`；不依赖 Vite |
| `LOCAL_HUB.md` | 本地启动与 AI 自检 |
| `hubctl.sh` | **检查/打包统一入口**（check、package、build-tb、verify-local） |
| [`docs/PRODUCTION_HUB_DEPLOY.md`](../../docs/PRODUCTION_HUB_DEPLOY.md) | **生产同域部署宪法** |

CI 守卫：`frontend/src/router/__tests__/sameOriginRouteMap.spec.ts` 在 TokenBazaar
新增顶级路由却没登记到 `route-map.json` 时失败——上游 `sub2api` 同步是这类漂移的主要来源。
**守卫只检查 JSON，改了 JSON 记得同步改 `nginx.conf` / `Caddyfile`。**

## 上游

| 应用 | 地址 | 说明 |
| --- | --- | --- |
| PriceAI | `127.0.0.1:3000` | Next.js |
| TokenBazaar | `127.0.0.1:8080` | Go 二进制内嵌 SPA，同端口提供控制台与 `/api/v1` |

## 分流规则

> **默认 → PriceAI；只有显式列出的前缀 → TokenBazaar。最长前缀优先。**

三条硬约束（违反任意一条都会在上线当天出事）：

| # | 约束 | 后果 |
| --- | --- | --- |
| A | `/auth/*` **不能**整体给 PriceAI，只有 `/auth/tokenbazaar/*` 归门户 | TB 的 OAuth / OIDC / 微信 / 钉钉登录与微信支付回调全部 404 |
| B | PriceAI 永不新增 `/api/v1` 前缀 | 与 TB 网关 API 抢路由 |
| D | ~~`/admin` 归属~~ **已决策**：PriceAI Admin 改到 `/pa-admin`，`/admin` 全归 TB | — |

## `/admin` 归属（已决策）

**2026-07-31 采用方案 A：PriceAI Admin 改前缀 `/pa-admin`。** `/admin` 及其全部子路径归
TokenBazaar，PriceAI Admin 走默认兜底规则，反代表无需为它写任何一行。

改动记录（PriceAI 仓）：`src/app/admin/` → `src/app/pa-admin/`，并同步 21 处路径引用
（含 13 处 `revalidatePath()` —— 漏改会让后台缓存失效静默失灵）、用户可见文案与文档。

曾评估但未采用：

| 方案 | 未采用原因 |
| --- | --- |
| B 移子域 `admin.example.com` | 又多一个 hostname 与证书要长期维护 |
| C 裸 `/admin` 留给 PriceAI | 反代要列 TB 25 条 admin 路由；且会削弱 `sameOriginRouteMap` 守卫——它按**首段**判归属，无法表达子路径分裂 |

> 运营者书签失效一次：`/admin` → `/pa-admin`。

## 应用侧配置

**TokenBazaar**（同域也必须显式配 origin，见 spec §4.3）：

```bash
VITE_PRICEAI_PUBLIC_ORIGIN=https://www.example.com   # 前端构建期注入
```

```yaml
priceai_bridge:
  return_origins:
    - https://www.example.com
  secret: <与 PriceAI PRICEAI_CEND_BRIDGE_SECRET 相同>
```

**PriceAI**：

```bash
NEXT_PUBLIC_TOKENBAZAAR_ORIGIN=https://www.example.com
TOKENBAZAAR_API_ORIGIN=https://www.example.com
PRICEAI_CEND_BRIDGE_SECRET=<shared>
PRICEAI_CEND_SESSION_SECRET=<random>
```

origin 与页面同源时，门户菜单自动输出相对 path（`/channels`），不带外链暗示。

## 上线检查清单

- [x] `/admin` 方案已决策（A）并落实到 nginx/Caddy/route-map
- [ ] `pnpm test:run` 通过（含路由契约守卫）
- [ ] 逐条验证约束 A 的 7 个回调：真实走一遍任一第三方登录
- [ ] 验证 `/api/v1/chat/completions` 流式响应不被缓冲（`proxy_buffering off`）
- [ ] 验证 B1 会话桥：`/auth/tokenbazaar/start` → TB `/login` → callback 落回门户
- [ ] 验证退出：TB 退出后回到门户首页而非 `/login`

## 存储命名空间

**已于 2026-07-30 审计，零冲突**：TB 的 28 个 localStorage key（`auth_token`、`theme`、
`sub2api:*` …）与 PriceAI 唯一的 `priceai-theme` 不重叠；TB cookie 全部是 `*_oauth_*`，
PriceAI 全部是 `priceai_*`。同源合并命名空间后无需改名。

约束：**两边新增 key 必须带项目前缀**（TB 用 `sub2api:` / `tb_`，PriceAI 用 `priceai_`）。
