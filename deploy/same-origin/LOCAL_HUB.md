# Local hub L2 验收宪法

生产部署宪法：[`docs/PRODUCTION_HUB_DEPLOY.md`](../../docs/PRODUCTION_HUB_DEPLOY.md)（同域方案 A）。本文件是其本地缩小版。

## 默认打开

```
http://127.0.0.1:9080
```

## 拓扑（验收）

| 组件 | 端口 | 说明 |
| --- | --- | --- |
| Caddy | 9080 | 唯一浏览器入口 |
| PriceAI Next | 3000 | 门户 |
| TokenBazaar API | 8081 | `/api/v1` + OAuth 回调 |
| TokenBazaar SPA | **dist 文件** | Caddy `file_server`，**不依赖 Vite** |

Vite `:5173` 仅用于改 TB UI 时热更新，**不是 hub 验收依赖**。

## 命令

```bash
cd /Users/tinker/src/fuye/TokenBazaar
make hub-build    # frontend → backend/internal/web/dist
make hub-up       # 起/补齐 Next+API+Caddy 并健康检查
make hub-verify   # hub-up + Playwright 浏览器自检
make hub-ci       # CI 等价门禁（无浏览器）
make hub-status
```

## AI 铁律

改完 hub/登录/控制台后必须 `make hub-verify`（或等价 browser_smoke），**不要让用户手动点验证**。
截图：`/tmp/hub-browser-verify/`。

## 静态资源

- SPA：`backend/internal/web/dist`
- `/logo.svg`、`/assets/*` 由 Caddy 直出 dist
- `/login` `/console` `/admin`… → `try_files` → `index.html`
