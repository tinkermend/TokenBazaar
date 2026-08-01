.PHONY: build build-backend build-frontend init-upstream sync-upstream test test-backend test-frontend test-frontend-critical

FRONTEND_CRITICAL_VITEST := \
	src/views/auth/__tests__/LinuxDoCallbackView.spec.ts \
	src/views/auth/__tests__/WechatCallbackView.spec.ts \
	src/views/user/__tests__/PaymentView.spec.ts \
	src/views/user/__tests__/PaymentResultView.spec.ts \
	src/components/user/profile/__tests__/ProfileInfoCard.spec.ts \
	src/views/admin/__tests__/SettingsView.spec.ts \
	src/utils/__tests__/portalHome.spec.ts \
	src/components/layout/__tests__/PortalNav.spec.ts \
	src/router/__tests__/consoleRedirect.spec.ts \
	src/router/__tests__/sameOriginRouteMap.spec.ts

# 一键编译前后端
build: build-backend build-frontend

# 编译后端（复用 backend/Makefile）
build-backend:
	@$(MAKE) -C backend build

# 编译前端（需要已安装依赖）
build-frontend:
	@pnpm --dir frontend run build

# 首次将当前仓库接入 sub2api 的提交历史（仅限尚无提交时执行一次）
init-upstream:
	@./tools/sync-upstream.sh --initialize

# 创建包含最新 sub2api 变更的同步分支；不会自动推送或合并
sync-upstream:
	@./tools/sync-upstream.sh

# 运行测试（后端 + 前端）
# Frontend CI gate = full vitest (not the critical allowlist). Keep
# test-frontend-critical for local smoke only; do not hide failures by omitting files.
test: test-backend test-frontend

test-backend:
	@$(MAKE) -C backend test

test-frontend:
	@pnpm --dir frontend run lint:check
	@pnpm --dir frontend run typecheck
	@pnpm --dir frontend run test:run

# Local fast smoke only — not the CI gate.
test-frontend-critical:
	@pnpm --dir frontend exec vitest run $(FRONTEND_CRITICAL_VITEST)

# 安装 git hooks（pre-push 校验跨仓契约同步）
install-hooks:
	@./tools/install-hooks.sh

# 跨仓契约：与 PriceAI 的副本比对 / 推送
check-contract:
	@node contracts/sync.mjs check

push-contract:
	@node contracts/sync.mjs push

# ---------------------------------------------------------------------------
# Local same-origin hub L2 (PriceAI :3000 + TB dist + API :8081 → :9080)
# ---------------------------------------------------------------------------
.PHONY: hub-proxy hub-proxy-check hub-up hub-down hub-status hub-build hub-verify hub-ci hub-check hub-package hubctl

## Build TokenBazaar SPA into backend/internal/web/dist
hub-build:
	cd frontend && pnpm exec vite build

## Foreground Caddy only
hub-proxy:
	@command -v caddy >/dev/null || (echo "caddy not found: brew install caddy" && exit 1)
	caddy run --config deploy/same-origin/Caddyfile.local

## Ensure dist + Next + API + Caddy; health-check (preferred)
hub-up:
	./deploy/same-origin/hub-up.sh

## hub-up + Playwright browser smoke (AI must run after hub changes)
hub-verify: hub-up
	/Users/tinker/.local/pipx/venvs/playwright/bin/python .agents/skills/hub-e2e/scripts/browser_smoke.py

## Show status
hub-status:
	@lsof -iTCP:9080,3000,5173,8081 -sTCP:LISTEN -P -n 2>/dev/null || true
	@curl -sS -o /dev/null -w "next:%{http_code}\n" --max-time 3 http://127.0.0.1:3000/ || true
	@curl -sS -o /dev/null -w "api:%{http_code}\n" --max-time 3 http://127.0.0.1:8081/api/v1/settings/public || true
	@curl -sS -o /dev/null -w "hub:%{http_code}\n" --max-time 3 http://127.0.0.1:9080/ || true
	@curl -sS -o /dev/null -w "login:%{http_code}\n" --max-time 3 http://127.0.0.1:9080/login || true
	@curl -sS -o /dev/null -w "logo:%{http_code}\n" --max-time 3 http://127.0.0.1:9080/logo.svg || true
	@curl -sS -o /dev/null -w "vite(optional):%{http_code}\n" --max-time 2 http://127.0.0.1:5173/ || true

hub-down:
	-@launchctl bootout "gui/$$(id -u)/com.tokenbazaar.hub-supervisor" 2>/dev/null || true
	-@pkill -f hub-supervisor.sh 2>/dev/null || true
	-@pkill -f 'Caddyfile.local' 2>/dev/null || true
	@echo "hub proxy/supervisor stopped"

hub-proxy-check:
	@curl -sf -o /dev/null -w "root:%{http_code}\n" http://127.0.0.1:9080/
	@curl -sf -o /dev/null -w "api:%{http_code}\n" http://127.0.0.1:9080/api/v1/settings/public
	@curl -sf -o /dev/null -w "login:%{http_code}\n" http://127.0.0.1:9080/login
	@curl -sf -o /dev/null -w "logo:%{http_code}\n" http://127.0.0.1:9080/logo.svg
	@echo "hub-proxy-check ok"

## CI-equivalent deployability gates (no browser, no running servers)
hub-ci:
	node deploy/same-origin/check-route-map.mjs
	cd frontend && pnpm exec vitest run \
		src/router/__tests__/sameOriginRouteMap.spec.ts \
		src/utils/__tests__/hubContract.spec.ts \
		src/utils/__tests__/portalHome.spec.ts \
		src/router/__tests__/consoleRedirect.spec.ts
	cd frontend && pnpm exec vite build
	test -f backend/internal/web/dist/index.html
	test -f backend/internal/web/dist/logo.svg
	@echo "hub-ci OK"

## Hub env/contract/route-map check (no compile)
hub-check:
	./deploy/same-origin/hubctl.sh check

## Build TB production image with hub origin (requires ORIGIN=https://...)
## Example: make hub-package ORIGIN=https://www.example.com
hub-package:
	@test -n "$(ORIGIN)" || (echo "usage: make hub-package ORIGIN=https://www.example.com" && exit 2)
	./deploy/same-origin/hubctl.sh package --origin "$(ORIGIN)" $(if $(TAG),--tag $(TAG),)

## Pass-through: make hubctl ARGS='check --origin https://...'
hubctl:
	./deploy/same-origin/hubctl.sh $(ARGS)
