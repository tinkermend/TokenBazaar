# 集合体跨仓契约

`hub-contract.json` 是 TokenBazaar 与 PriceAI **共享事实的唯一来源**。

在此之前，同一份事实在两边各写一份、靠人工同步。仅 2026-07-30～31 两天里就咬了三次：
`/auth/*` 差点整体划错、`/home` 漏登记、`/admin` 前缀冲突。

## 谁拥有、谁跟随

| 角色 | 仓库 | 文件 |
| --- | --- | --- |
| **owner** | TokenBazaar | `contracts/hub-contract.json` |
| follower | PriceAI | `src/lib/hub-contract.json`（**逐字节副本**） |

TokenBazaar 是 owner，因为账号、网关与反代契约都在这边，且它已有 CI 守卫。

## 里面有什么

| 字段 | 用途 | 谁在消费 |
| --- | --- | --- |
| `portalModules[]` | 门户五模块：key / path / 中英文案（含窄屏缩写）/ 高亮前缀 | TB `portalHome.ts` + i18n；PA `SiteHeader` 的 `navItems` |
| `paths` | 跨应用硬编码路径常量 | 两边深链、反代、桥 |

`activePrefixes` / `excludePrefixes` 是把 PriceAI 原本写成 JS 闭包的 `match()` **声明化**——
闭包没法跨语言共享，前缀数组可以。

## 改动流程

1. 改 TokenBazaar 的 `contracts/hub-contract.json`
2. 逐字节复制到 PriceAI `src/lib/hub-contract.json`
3. 两边各跑一次校验（见下）
4. **同一天内两仓一起提交**——不要只合一边

同步与比对：

```bash
make check-contract     # 比对兄弟仓副本，不一致则退出码 1
make push-contract      # 把本仓版本复制到 PriceAI
make install-hooks      # 装 pre-push 钩子（见下），装一次即可
```

## 自动校验能挡住什么

| 检查 | 位置 | 挡住 |
| --- | --- | --- |
| `hubContract.spec.ts` | TB，进 CI | TB 的模块常量 / i18n 文案与契约不一致 |
| `verify-hub-contract.mjs` | PA，挂 `prebuild` | PA 的副本被手改、或 `navItems` 与副本不一致 |
| **pre-push 钩子** | TokenBazaar 本地，`make install-hooks` | **改了 `contracts/` 却没同步到 PriceAI 就 push** |
| `make check-contract` | 本地 / 有两仓的环境 | 两仓副本互相漂移 |
| `/hub-e2e` | 本地真浏览器 | 运行时真实跳转错误 |

**挡不住**：语义漂移（路径没变但页面含义变了）。那只能靠 e2e 和人。

### 一个诚实的限制

PriceAI 的 CI 里没有 TokenBazaar 仓库，所以**它无法自动发现 owner 端的改动**。
PA 侧的校验只保证「副本没被手改」和「代码是从副本派生的、不是另抄一份」。
真正的跨仓比对靠 `sync.mjs check`（本地或同时 checkout 两仓的环境）与 e2e 兜底。

**因此强制点放在 owner 的 pre-push 钩子上**——那是唯一同时存在两个 checkout 的地方。
钩子只在本次 push 含 `contracts/` 变更时才检查，平时零打扰；确需绕过用 `git push --no-verify`。

这是双仓形态的固有代价。不接受的话，出路是 monorepo——但 TokenBazaar 需要持续同步上游
`sub2api`，合仓会让每次 `make sync-upstream` 都变成灾难，所以当前不做。
