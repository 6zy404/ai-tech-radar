# AI Tech Radar

**中文** | [English](README.en.md)

一个技术信号的追踪与解读平台。系统从外部信源导入新发布的内容，经编辑审核后发布为
**技术信号**；每条信号附带「为什么重要、谁该关注、需要什么背景」的说明，并通过带类型的
关系与**技能**、**背景知识**条目相连。站点界面为中文。

![公开首页：今日简报、优先信号，以及技能与背景知识入口](docs/images/home.png)

## 系统组成

- **用户端**：首页、技术信号列表（精选 / 全部快讯 / 按话题 / 我关注的 / 稍后读）、
  信号详情、每日简报与本周回顾、技能、知识、关系网络、话题页、站内搜索、RSS / JSON
  订阅。只读取已发布内容。
- **内部工作台**：信源配置与导入、候选审核、去重、草稿编辑、发布检查、简报编辑、
  投递渠道、定时任务、运维看板。可用令牌保护，且不进入公开构建。

## 数据流程

```text
外部信源（RSS / Atom / GitHub Release / 官方博客）
  → 定时导入 → 候选池
  → 自动剔除：预发布版本、站内已发布过的内容
  → 编辑处置：去重、转草稿、补充说明、关联技能与知识
  → 发布检查（阻塞项 / 警告项）→ 技术信号
  → 每日简报 → 页面、RSS / JSON、投递渠道
```

候选池在编辑处置之前会以「自动聚合，未经编辑精选」的标注出现在快讯视图中；精选信号
与简报只包含经过编辑发布的内容。

截至 2026-09-19，已发布 77 条技术信号、16 条技能、19 条知识、28 期每日简报，
在用信源 13 个；内容关系图谱共 112 个节点、722 条带类型的边。

## 设计要点

### 公开与内部数据的边界

导入的候选包含原始载荷、审核状态、去重信息、信源健康度等内部字段。只有一个映射函数
（`src/lib/news.ts`）可以把候选转换为公开数据，技术信号同样经由单一映射输出公开形态；
校验脚本断言内部字段不会出现在公开页面与订阅中。这项检查曾发现 `priority` 与
`intelligenceStatus` 两个字段虽然没有被任何页面渲染，却随客户端组件的 RSC 载荷发送到
浏览器，之后已从公开形态中移除。

访问控制分两层：运行时由 `src/middleware.ts` 按令牌保护内部路由；构建时
`npm run build:public` 在构建前移除全部内部路由目录（69 条路由），公开构建中不存在
这些路由。

### 可解释的排序

排序不使用不透明的综合分数。信号的优先级档位由编辑标注的重要程度决定，发布时间只能
使档位下降、不能上升；每条信号记录判定它的规则，个性化视图会注明命中的关注话题。
此前按分数分档的方案在实测中将 31 条信号全部归入同一档，其余两档无法取到，因此改为
现在的规则。

### 带类型的内容图谱

技术、技能、知识之间的每条关系带有八种类型之一（渊源、借助、释义、必备、延伸、续作、
印证、关联）和一段附注。编辑修改以写时复制的覆盖层保存，内置种子数据保持只读。
兜底类型「关联」约占全部边的 11%。同一张图谱用于信号页的版本脉络、话题页，以及 AI
生成学习路径时的依据。

![信号详情页：版本脉络、发布方类型、中文 / 原文切换](docs/images/signal-detail.png)

![内容关系图谱全图](docs/images/network.png)

## 技术栈

- Next.js 15（App Router）、React 19、TypeScript
- 存储：本地 JSON（默认），可选 SQLite 驱动（Node 内置 `node:sqlite`）
- LLM：服务端调用边界，默认本地 mock，可配置任意 OpenAI 兼容接口
- 测试：Vitest 单元测试 + 按子系统划分的 `validate:*` 校验脚本

## 本地运行

需要 Node.js 22.5 或以上。

```bash
npm install
npm run dev          # http://localhost:3000
```

无需 API Key 或外部服务：LLM 默认使用本地 mock，运行状态保存在 `config/*.json`。

## 测试与验证

```bash
npm run typecheck      # 类型检查
npm run test           # 单元测试
npm run lint
npm run build:public   # 公开构建（不含内部路由），并校验构建产物
```

各子系统的校验脚本（`validate:*`，共 22 个）见 [`docs/reference.md`](docs/reference.md)。
性能问题与验证方法的排查记录见 [`docs/engineering-stories.md`](docs/engineering-stories.md)。

## 文档

- [`docs/reference.md`](docs/reference.md)：完整功能、路由与命令（英文）
- [`docs/architecture.md`](docs/architecture.md)：系统设计与数据生命周期
- [`docs/data-model.md`](docs/data-model.md)：数据模型
- [`docs/security-boundary.md`](docs/security-boundary.md)：公开 / 内部边界
- [`docs/decisions.md`](docs/decisions.md)：设计决策记录
- [`CHANGELOG.md`](CHANGELOG.md)：变更记录
