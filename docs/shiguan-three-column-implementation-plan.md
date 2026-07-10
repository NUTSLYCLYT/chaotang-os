# 史馆三栏改造实施方案

## 1. 目标

按照 `docs/shiguan-three-column-redesign.md` 的定义，把史馆页面改造成三栏结构：

```text
左侧：案卷索引
中间：史馆卷轴
右侧：复盘与召回
```

改造目标不是重做视觉，而是把页面逻辑对齐史馆真实职责：

- 归档
- 复盘
- 旧案召回
- 可信留痕

核心交付：

- 页面不再混用无标记 mock 数据。
- 所有模块都有明确数据来源。
- fallback 数据只作为空态或降级态，不伪装成真实案卷。
- 中间卷轴成为史馆主阅读区。
- 左右两侧面板分别承担检索和复盘召回。

## 2. 当前问题

### 2.1 页面结构问题

当前 `ShiguanPage` 同时承载：

- 案卷统计
- Turso archive records
- 史馆分析
- 经营闭环 mock
- build ledger
- release gate
- IMA knowledge
- promo archive
- lessons
- drawer
- bottom dock

问题是这些内容没有按“史馆主流程”组织，导致用户无法判断：

- 哪些是真案卷
- 哪些是 fallback
- 哪些只是前端静态材料
- 哪些内容能反哺上书房/丞相/军机处

### 2.2 前后端契约问题

已有接口存在 shape 不一致问题，例如：

- 前端期待 `promo-archive.data.curated`
- 后端原来返回 `items`

说明史馆页面需要先统一契约，再做组件拆分。

### 2.3 来源可信度问题

当前部分模块展示“成功率”“知识图谱”“复盘”等内容时，没有统一展示 `sourceLabel`。

史馆必须明确区分：

- `LIVE`
- `MIXED`
- `FALLBACK`
- `DEMO`

## 3. 实施原则

1. 不一次性大重构。
2. 先稳定数据契约，再拆组件。
3. 保留现有视觉资产，优先重排信息架构。
4. 每个面板都必须知道自己的数据来源。
5. fallback 时展示空态，不展示伪真实内容。
6. 中间卷轴只展示当前案卷或史馆总览。
7. 左右面板不再抢主叙事。

## 4. 目标文件结构

建议新增/调整如下结构：

```text
frontend/src/features/shiguan-ui/
  components/
    ShiguanPage.tsx
    ShiguanThreeColumnLayout.tsx
    ShiguanArchiveIndexPanel.tsx
    ShiguanScrollPanel.tsx
    ShiguanReviewRecallPanel.tsx
    ShiguanSourceBadge.tsx
    ShiguanEmptyState.tsx
  lib/
    shiguan-data.ts
    shiguan-view-model.ts
    shiguan-source.ts
```

后端建议补充：

```text
backend/web/routers/
  shiguan.py                 # 如果后续独立史馆 router
  governance_compat.py       # 当前兼容接口可先继续承载 fallback
```

如果短期不新增 `shiguan.py`，可以继续在现有 router 中补齐契约，但需要把注释写清楚：哪些是正式能力，哪些是 compat fallback。

## 5. 数据模型

### 5.1 前端统一 ViewModel

新增 `shiguan-view-model.ts`。

核心类型：

```ts
export type ShiguanSourceLabel = 'LIVE' | 'MIXED' | 'FALLBACK' | 'DEMO';

export type ShiguanArchiveType =
  | 'memorial'
  | 'decision'
  | 'task'
  | 'knowledge'
  | 'promo'
  | 'release_gate';

export type ShiguanRetrospectiveStatus =
  | 'pending'
  | 'achieved'
  | 'failed'
  | 'partial'
  | 'watching';

export interface ShiguanArchiveListItem {
  id: string;
  title: string;
  type: ShiguanArchiveType;
  department?: string;
  status: string;
  sourceLabel: ShiguanSourceLabel;
  updatedAt?: string;
  retrospectiveStatus?: ShiguanRetrospectiveStatus;
}

export interface ShiguanArchiveDetail {
  id: string;
  title: string;
  type: ShiguanArchiveType;
  sourceLabel: ShiguanSourceLabel;
  summary: string;
  conclusion?: string;
  decisionChain: ShiguanDecisionStep[];
  evidence: ShiguanEvidenceItem[];
  lessons: ShiguanLesson[];
  retrospectiveStatus?: ShiguanRetrospectiveStatus;
}
```

### 5.2 后端统一响应 envelope

所有史馆接口建议统一：

```json
{
  "success": true,
  "data": {},
  "error": null,
  "sourceLabel": "LIVE"
}
```

如果 `sourceLabel` 在 `data` 内，也必须保持一致。

## 6. 后端接口计划

### 6.1 当前可复用接口

| 功能 | 接口 | 用途 |
| --- | --- | --- |
| 统计 | `GET /api/court/shiguan/stats` | 左侧总览 |
| 案卷列表 | `GET /api/chaotang/archive?limit=80` | 左侧列表 |
| 分析 | `POST /api/court/shiguan/analyze` | 中间判词/分析 |
| lessons | `GET /api/scribe/lessons` | 右侧可复用教训 |
| 复盘状态 | `POST /api/shiguan/archives/{archive_id}/retrospective` | 右侧复盘操作 |
| 发布门禁 | `GET /api/court/shiguan/release-gates` | 归档证据 |
| 宣传归档 | `GET /api/court/shiguan/promo-archive` | promo 类型案卷 |
| 知识条目 | `GET /api/court/ima-knowledge` | knowledge 类型案卷 |

### 6.2 建议新增接口

第一阶段可以不新增，先由前端 adapter 聚合现有接口。

第二阶段建议新增：

```text
GET /api/court/shiguan/archives
GET /api/court/shiguan/archives/{archive_id}
GET /api/court/shiguan/archives/{archive_id}/similar
POST /api/court/shiguan/archives/{archive_id}/verdict
```

用途：

- `archives`：统一左侧列表
- `archives/{id}`：统一中间卷轴详情
- `similar`：右侧旧案召回
- `verdict`：史馆判词生成或读取

## 7. 前端实施步骤

### Step 1：新增 source badge 和空态组件

新增：

- `ShiguanSourceBadge.tsx`
- `ShiguanEmptyState.tsx`

用途：

- 所有模块统一展示 `sourceLabel`
- fallback/空数据有统一呈现

验收：

- `LIVE`、`MIXED`、`FALLBACK`、`DEMO` 颜色和文案统一。
- 无数据时不崩溃。

### Step 2：新增 ViewModel adapter

新增：

- `shiguan-view-model.ts`

职责：

- 把 `/api/chaotang/archive` 结果转为 `ShiguanArchiveListItem`
- 把 IMA knowledge 转为 knowledge 案卷
- 把 promo archive 转为 promo 案卷
- 把 release gate 转为 release gate 证据项
- 统一 sourceLabel

验收：

- 所有列表项都有 `id/title/type/sourceLabel/status`
- fallback 项不会被标成 LIVE

### Step 3：拆左侧案卷索引

新增：

- `ShiguanArchiveIndexPanel.tsx`

输入：

```ts
items: ShiguanArchiveListItem[]
selectedId: string | null
onSelect(id: string): void
stats: ShiguanStats
```

职责：

- 展示统计
- 展示案卷列表
- 支持筛选
- 支持 sourceLabel 标记

验收：

- 左侧只负责检索，不展示长正文。
- 点击案卷后，中间卷轴切换。

### Step 4：拆中间卷轴

新增：

- `ShiguanScrollPanel.tsx`

输入：

```ts
detail: ShiguanArchiveDetail | null
overview: ShiguanOverview
```

职责：

- 无选中时展示史馆总览卷轴
- 有选中时展示案卷详情
- 展示事实摘要、决策链、证据链、史馆判词

验收：

- 中间卷轴是页面视觉和业务主轴。
- 不展示没有来源的数据。

### Step 5：拆右侧复盘与召回

新增：

- `ShiguanReviewRecallPanel.tsx`

输入：

```ts
detail: ShiguanArchiveDetail | null
lessons: ShiguanLesson[]
similarCases: ShiguanArchiveListItem[]
onRetroUpdate(id, status): Promise<void>
```

职责：

- 展示复盘状态
- 展示 lessons
- 展示相似旧案
- 展示下一步动作

验收：

- 未选案卷时显示“选择案卷后查看复盘”。
- fallback 时动作按钮禁用或标明不可执行。

### Step 6：替换 ShiguanPage 主布局

在 `ShiguanPage.tsx` 内将现有大段布局替换为：

```tsx
<ShiguanThreeColumnLayout
  left={<ShiguanArchiveIndexPanel ... />}
  center={<ShiguanScrollPanel ... />}
  right={<ShiguanReviewRecallPanel ... />}
/>
```

保留：

- 页面背景
- 顶部信息
- drawer 如仍需要
- bottom dock 如仍需要

弱化或移出：

- 静态建设复盘
- 无来源知识图谱
- 与当前案卷无关的大块运营内容

## 8. 后端实施步骤

### Step 1：补齐现有兼容接口 shape

已知需要保持：

- `promo-archive.data.curated`
- `promo-archive.data.curatedCount`
- `promo-archive.data.source`
- `promo-archive.data.sourceLabel`

继续检查：

- `release-gates`
- `ima-knowledge`
- `scribe/lessons`
- `shiguan/analyze`

所有接口都要保证空态 shape 稳定。

### Step 2：增加契约测试

补充测试：

```text
backend/tests/test_shiguan_page_contract.py
```

覆盖：

- stats 返回稳定字段
- archive list 可被 adapter 消费
- promo archive 空态不缺字段
- lessons 空态不缺字段
- retrospective 更新返回 archiveId/status/sourceLabel

### Step 3：后端正式史馆接口

如果前端 adapter 复杂度升高，再新增正式接口：

```text
GET /api/court/shiguan/archives
GET /api/court/shiguan/archives/{id}
```

这样前端不再同时聚合 6 个接口。

## 9. 验证计划

### 9.1 前端验证

运行：

```bash
cd frontend
npx tsc --noEmit
```

手动验证：

- 打开 `/chaotang/shiguan`
- 无真实数据时不报错
- fallback 数据有明确标记
- 左侧点击案卷，中间切换
- 右侧复盘状态不崩

### 9.2 后端验证

运行：

```bash
cd backend
python -m pytest -q tests/test_contract_alignment_p0.py
python -m pytest -q tests/test_shiguan_page_contract.py
```

接口验证：

```bash
GET /api/court/shiguan/promo-archive
GET /api/court/shiguan/release-gates
GET /api/scribe/lessons
GET /api/court/ima-knowledge
POST /api/shiguan/archives/{id}/retrospective
```

## 10. 分阶段交付

### Phase 1：不改后端主逻辑，只修页面结构

交付：

- 三栏布局
- ViewModel adapter
- source badge
- 空态
- 左中右三个主组件

风险最低。

### Phase 2：补后端契约测试

交付：

- 史馆页面契约测试
- fallback shape 固定
- 所有空态不崩

### Phase 3：正式史馆聚合接口

交付：

- `/api/court/shiguan/archives`
- `/api/court/shiguan/archives/{id}`
- `/similar`
- `/verdict`

这一步可以让前端逻辑明显变薄。

## 11. 不做事项

本轮不做：

- 不重写视觉系统
- 不接真实 RAG 召回
- 不生成新的假案卷
- 不把 fallback 当真实成果
- 不删除现有后端数据
- 不改上书房/军机处流程

## 12. 最终验收标准

史馆页面改造完成后，用户应该能清楚看到：

- 左侧：史馆里有哪些案卷
- 中间：当前案卷完整事实链
- 右侧：这份案卷带来的复盘、教训和下一步

并且任何内容都能回答：

```text
它从哪里来？
它是否真实？
它能不能复用？
它下次怎么帮助决策？
```

