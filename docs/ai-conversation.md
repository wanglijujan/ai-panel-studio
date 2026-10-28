# AI 协作对话记录（节选）

## 14:44 需求拆解
**我**：我现在是小白，图片中的任务怎么做？
**AI**：这不是"做一个产品"，而是"用 AI 把开发过程拆成可控段落并写下来"。文档与过程占分更高，建议先文档后代码，拆成 9 个阶段。
**结果**：确定"文档先行"的推进顺序。

## 16:20 路径排查
**我**：`npm run seed` 报 Cannot find module ... `src/db/seed.ts`
**AI**：先用 `dir` 确认真实目录名，怀疑拼写问题。
**结果**：文件夹实际叫 `scr`，改名 `src` 后通过。

## 17:05 依赖版本冲突
**我**：`npm install` 报 ERESOLVE，typescript@7 与 typescript-eslint peer 冲突。
**AI**：读报错的 `Found:` 与 `peer:` 两行，判断版本区间不重叠；建议把 `typescript` 降到 `^5.9.0`，而不是用 `--legacy-peer-deps` 强装。
**结果**：降版本后安装成功。

## 20:40 SSE 不推送
**我**：轮次一直显示第 0 轮，刷新才发现已结束。
**AI**：先在 3001 直连验证服务端是否正常，再判断为 Vite 代理缓冲 SSE。
**结果**：`EventSource` 改直连 + 加日志，实时推送恢复。

## 21:20 Playwright 缺浏览器
**我**：`browserType.launch: Executable doesn't exist`
**AI**：`@playwright/test` 与浏览器二进制分离安装，需 `npx playwright install chromium`；网络中断时改用 `channel: 'msedge'` 复用系统浏览器。
**结果**：改用系统 Edge，2 条 E2E 全部通过。
