---
name: hub-e2e
description: "Launch and drive the TokenBazaar + PriceAI hub locally in a real browser. Use when asked to run/start the app, take screenshots, self-test, or verify anything spanning both apps — portal nav, 控制台 entry, /console role split, B1 session bridge, login flows. ALWAYS use the Caddy same-origin hub URL http://127.0.0.1:9080 for cross-app verification (not bare :3000/:5173)."
---

# Running the hub (TokenBazaar + PriceAI)

两应用、一产品。**凡跨应用验证（登录桥、退出、控制台往返、检测硬门禁）必须走同域 Caddy 代理**，不要用裸端口拼凑——那是「登录完又要登录」复发的主因。


## Skill location

Project skill path (repo-local, discovered with other Agent Skills):

`.agents/skills/hub-e2e/`

Compat symlink: `skills/hub-e2e` → `.agents/skills/hub-e2e` (legacy path).
Do not put new project skills only under repo-root `skills/` — use `.agents/skills/<name>/`.



## AI 自检铁律

改完 hub / 登录 / 控制台 / Caddy 后，**禁止只让用户去点**。必须：

1. `make hub-up` 或确认 :3000/:5173/:8081/:9080 健康  
2. 浏览器验收：
   ```bash
   /Users/tinker/.local/pipx/venvs/playwright/bin/python .agents/skills/hub-e2e/scripts/browser_smoke.py
   ```
3. 看截图 `/tmp/hub-browser-verify/`，确认 logo 有 naturalWidth、无 502、控制台不狂刷  
4. 向用户汇报 **PASS/FAIL 清单 + 截图路径**，而不是“请你刷新试试”

## 0. 验证入口（强制）

| 用途 | URL | 说明 |
| --- | --- | --- |
| **默认验收入口** | **`http://127.0.0.1:9080`** | Caddy：PA:3000 + **TB dist** + API:8081 |
| 单改 PriceAI UI | `http://127.0.0.1:3000` | 不要用它验登录桥 |
| 单改 TB 控制台 UI | `http://127.0.0.1:5173`（Vite） | 热更新；改完需 `make hub-build` 再 `hub-verify` |

配置：`deploy/same-origin/Caddyfile.local`  
启动：`make hub-up` 或  
`make hub-up   # or ./deploy/same-origin/hub-up.sh`

**AI / 自动化规则：**

1. 打开浏览器、截图、Playwright、curl 会话桥 → **base URL = `http://127.0.0.1:9080`**
2. 禁止混用 `localhost` 与 `127.0.0.1`（两个 cookie jar）
3. 禁止「PA 用 :3000、登录却跳 :5173」的分裂拓扑做 B1 验收
4. 断言会话时必须检查 `priceai_cend_session` + 无 `auth_error`，不能只看是否回到 PriceAI 域名

## 1. 服务拓扑

| 服务 | 直连地址 | 同域后 |
| --- | --- | --- |
| Caddy hub | — | **`http://127.0.0.1:9080`** |
| PriceAI (Next) | `http://127.0.0.1:3000` | `/` 与 `/auth/tokenbazaar/*` |
| TokenBazaar Vite | `http://127.0.0.1:5173` | `/login` `/console` `/admin` … |
| TokenBazaar API | `http://127.0.0.1:8081` | `/api/v1/*` |
| Postgres / Redis | `127.0.0.1:5432` / `6379` | `deploy/local-hub/README.md` |

**先查再起：**

```bash
lsof -iTCP -sTCP:LISTEN -P -n | grep -E ":(3000|5173|8081|9080|5432)\b"
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:9080/
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:9080/api/v1/settings/public
```

上游未起时 Caddy 会 502——先起 Next + API + `make hub-build` dist，再起 Caddy（**验收不依赖 Vite**）。

### 必需环境变量（hub 模式）

```bash
# PriceAI/.env.local
NEXT_PUBLIC_TOKENBAZAAR_ORIGIN=http://127.0.0.1:9080
TOKENBAZAAR_API_ORIGIN=http://127.0.0.1:9080

# TokenBazaar/frontend/.env.local
VITE_PRICEAI_PUBLIC_ORIGIN=http://127.0.0.1:9080
VITE_DEV_PROXY_TARGET=http://127.0.0.1:8081   # Vite 自己的 API 代理仍指直连后端

# TokenBazaar deploy/data/config.yaml
priceai_bridge.return_origins:
  - http://127.0.0.1:9080
  - http://127.0.0.1:3000   # 直连调试可选保留
```

改 `NEXT_PUBLIC_*` / `VITE_*` 后必须重启 Next / Vite。改 `config.yaml` 后必须重启 Go API。

一键代理：

```bash
cd /Users/tinker/src/fuye/TokenBazaar && make hub-up
```

## 2. 本地测试账号

| 项 | 值 |
| --- | --- |
| 邮箱 | `admin@tokenbazaar.local` |
| 密码 | `Admin123456!` |

仅开发环境。角色 admin；普通用户分支需另建号。

## 3. B1 会话桥最小验收（优先 curl / 脚本）

在 **9080** 上：

1. `POST /api/v1/auth/login` → access_token  
2. `GET /auth/tokenbazaar/start?return_to=/api-transit/detector` → 302 到 **同 host** `/login?...&return_url=http://127.0.0.1:9080/auth/tokenbazaar/callback&state=...`，并种 `priceai_cend_oauth_state`  
3. `POST /api/v1/auth/priceai/bridge/issue`（Bearer）→ code  
4. `GET /auth/tokenbazaar/callback?code&state` → 302 `/api-transit/detector`，**无** `auth_error`，种 `priceai_cend_session`  
5. `GET /api/account/me` 带 session cookie → `user` 非 null  

失败码速查：`state_mismatch`（host 混用/cookie 丢）、`exchange_failed` / `exchange_network`（secret 或 API origin）、`bridge_config`（env 缺）。

## 4. 浏览器自测

```bash
/Users/tinker/.local/pipx/venvs/playwright/bin/python .agents/skills/hub-e2e/scripts/browser_smoke.py
# 全量 drive（可选）:
/Users/tinker/.local/pipx/venvs/playwright/bin/python .agents/skills/hub-e2e/scripts/drive.py
```

脚本 **必须** 以 `http://127.0.0.1:9080` 为 base（见 `scripts/drive.py`）。Playwright 用 pipx venv，locale=`zh-CN`。

覆盖：TB 登录 → `/console` 角色分流 → 门户导航 → 回 PriceAI → B1 桥 → 控制台回跳。看截图，别只看退出码。

### 4.1 Playwright `en-US` 会把 UI 变成英文

```python
page = browser.new_page(locale="zh-CN")
```

门户导航用 `nav.portal-nav`，别绑会变的中文 `aria-label`。

### 4.2 新手引导遮罩吞点击

登录后立刻标记已看（key 版本见 `useOnboardingTour.ts`）：

```python
page.evaluate("""() => {
  const u = JSON.parse(localStorage.getItem('auth_user') || '{}');
  for (const base of ['admin_guide', 'user_guide']) {
    localStorage.setItem(`${base}_${u.id}_${u.role}_v4_interactive`, 'true');
  }
}""")
```


### 4.3 控制台「疯狂刷新」（仅 Vite 反代模式）

**L2 验收不依赖 Vite HMR**：控制台由 dist 静态托管。下列仅在你把 TB 指回 Vite 时适用。


同域 hub 下 Vite 默认 HMR websocket 打到 `/`，而 Caddy 把 `/` 交给 PriceAI，HMR 失败后会整页 reload。

已修复：`vite` 使用 `hmr.path=/__vite_hmr`，Caddy 将该路径反代到 `:5173`。若复发，检查：

- `frontend/.env.local` 有 `VITE_HMR_CLIENT_PORT=9080`
- Caddyfile.local 含 `/__vite_hmr`
- 已重启 Vite + `make hub-up` / launchctl kickstart

## 5. 咬过人的坑（认症状）

| 症状 | 先查 |
| --- | --- |
| 登录完检测页又弹登录 | 是否用了 :9080？是否混用 localhost？URL 有无 `auth_error`？ |
| `auth_error=state_mismatch` | start 与 callback 是否同一 host；cookie 是否被清 |
| `auth_error=exchange_network` | HTTP 头名是否被非 ASCII 污染；`TOKENBAZAAR_API_ORIGIN` 是否可达 |
| issue 200 无 exchange | 前端未 `location.assign` 或 callback 在兑换前失败 |
| TB 已进控制台、PA 仍未登录 | 旧 bug：桥失败仍 `router.push(/console)`——应停在 `/login` 并报错 |
| PriceAI 显示登录、TB 要重登 | localStorage 与 cookie 分 origin |

**弱断言**：只断言「回到了 PriceAI 域名」不够——PA cookie 可能是 7 天前的残留。必须断言无 `auth_error` + 种下/读到 `priceai_cend_session`。

## 6. 断言点速查

| 行为 | 期望 |
| --- | --- |
| 验收 base | `http://127.0.0.1:9080` |
| admin `/console` | → `/admin/dashboard` |
| 用户 `/console` | → `/dashboard` |
| 已登录页门户导航 | `nav.portal-nav`，5 链 |
| B1 桥 | 无 `auth_error`、同 origin、`priceai_cend_session`、`/api/account/me` 有 user |
| TB 退出 | 走 PA `/auth/tokenbazaar/logout`，PA 会话一并清 |
| PriceAI Admin | `/pa-admin`（`/admin` 归 TB） |

契约：`docs/PRICEAI_PORTAL_NAV_SPEC.md`、`docs/PRICEAI_HUB.md`、`deploy/same-origin/route-map.json`。

## 7. 单元测试（不起 Caddy）

```bash
cd frontend && pnpm test:run
cd frontend && npx vitest run src/router src/utils/__tests__/portalHome.spec.ts src/utils/__tests__/hubContract.spec.ts
```
