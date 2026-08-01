# 本地共享 Postgres（一实例两库）

TokenBazaar 与 PriceAI **共用同一个 Postgres 实例**，库名分开：

| 应用 | Database | User / Password | 连接串（本机） |
| --- | --- | --- | --- |
| TokenBazaar | `sub2api` | `sub2api` / `sub2api` | `postgres://sub2api:sub2api@127.0.0.1:5432/sub2api?sslmode=disable` |
| PriceAI（数据面） | `priceai` | `priceai` / `priceai` | `postgres://priceai:priceai@127.0.0.1:5432/priceai?sslmode=disable` |

实例容器（Podman）：

- 名称：`tokenbazaar-pg`
- 镜像：`postgres:16-alpine`
- 端口：`127.0.0.1:5432`
- 同机 Redis：`tokenbazaar-redis` → `127.0.0.1:6379`

## 边界说明（重要）

1. **这是「一个 Postgres 实例 + 两个 database」**，不是两套 Postgres 进程。
2. TokenBazaar 后端直连 `sub2api` 库（已完成）。
3. PriceAI **应用层**默认走 Supabase HTTP API（`NEXT_PUBLIC_SUPABASE_URL` + service role），不是裸 `pg` 驱动。
   - 本步骤已在共享实例上建好 `priceai` 库并导入 `PriceAI/supabase/schema.sql` 主体结构。
   - 完整本地 API/Auth（PostgREST / GoTrue）需另起 Supabase 栈并指向该库，或后续把 PriceAI 改为直连 PG。
   - 当前 PriceAI 未配 Supabase 时仍用内置演示数据，**不阻塞**门户前端与 TokenBazaar 登录深链。
4. Schema 中依赖 Supabase 的 `auth` schema / `anon` 等：本地已建 **占位角色 + 最小 `auth.users` + `auth.uid()`**，便于迁移脚本跑通；**不等于**完整 Supabase Auth。

## 初始化脚本

```bash
# 在 TokenBazaar 仓库根目录
./deploy/local-hub/init-shared-postgres.sh
```

## 健康检查

```bash
podman exec tokenbazaar-pg psql -U sub2api -d postgres -c '\l'
podman exec tokenbazaar-pg psql -U sub2api -d sub2api -c 'select 1'
podman exec tokenbazaar-pg psql -U priceai -d priceai -c "select count(*) from information_schema.tables where table_schema = 'public'"
```

## PriceAI 直连 PG（已接通基础路径）

```bash
# PriceAI/.env.local
PRICEAI_DATABASE_URL=postgres://priceai:priceai@127.0.0.1:5432/priceai?sslmode=disable
```

- `src/lib/pg-pool.ts` — 连接池
- `src/lib/direct-pg-client.ts` — supabase 风格兼容（from/select/eq/rpc/limit/single/abortSignal…）
- `src/lib/supabase.ts` — **优先直连**，否则 Supabase HTTP
- `src/lib/env.ts` — `isSupabaseConfigured()` 在直连时为 true（离开演示数据模式）

```bash
cd /Users/tinker/src/fuye/PriceAI
npm run smoke:direct-pg
```

限制：嵌套 select（`!inner`）仍不支持；个别新 RPC 若 migrations 未齐会降级/报错。

### 嵌套 select / RPC（本轮）

直连客户端支持常见 PostgREST 嵌套写法：

- `api_transit_stations!inner(slug,name,published,removed_at)`
- `api_transit_stations(name)`（left embed）
- 关联过滤：`.is("api_transit_stations.removed_at", null)`
- update + nested returning（先筛 id，再 hydrate）

代码用到的 RPC 在共享 `priceai` 库中已齐；样本 RPC 参数为 `p_station_ids / p_limit_per_scope / p_since`。

```bash
cd /Users/tinker/src/fuye/PriceAI
npm run test:direct-pg-nested
```

## 导入中转站数据

```bash
cd /Users/tinker/src/fuye/PriceAI
# 需要 PRICEAI_DATABASE_URL
npm run import:api-transit:seed-pg
```

会写入 seed 站 + `config/api-transit-sources.json`。

### 后续自动入库会进哪里？

**会进当前这个共享 PG 的 `priceai` 库**，前提是：

1. `PriceAI/.env.local` 配置了 `PRICEAI_DATABASE_URL`
2. Next 服务端走 `getSupabaseServerClient()`（已优先直连 PG）
3. 采集/导入脚本走 `createScriptDataClient()`（`collect-api-transit` / `import-*` / `probe-api-transit` 已接）

未配置 `PRICEAI_DATABASE_URL` 时才会退回 Supabase HTTP。

```bash
# 采集后写库示例
npm run collect:api-transit -- --post
```


## PriceAI 内容后台（本地）

- URL: http://127.0.0.1:3000/admin
- 密码: 见 PriceAI `.env.local` 的 `ADMIN_PASSWORD`（当前本地开发默认：`PriceAI-Admin-2026!`）
- 与 TokenBazaar C 端登录无关；改密后以库内密码为准。
