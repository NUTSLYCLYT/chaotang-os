/**
 * 朝堂 Console · mock 事件流生成器
 *
 * Week 1 Day 3：先用 mock 把前端卷轴动画跑通。
 * Week 2 接真实 SSE 后，这个文件只会用于单元测试。
 *
 * 严格对齐 docs/court-console/20-ARCHITECTURE.md §B2 Event schema v1。
 */

import type { CourtEvent, PetitionStage, PetitionStation } from '../types'

/** ULID-ish id（非真 ULID，mock 够用） */
function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

interface MockStageSpec {
  stage: PetitionStage
  station: PetitionStation
  durationMs: number
  model?: string
  tokensIn?: number
  tokensOut?: number
  costUsd?: number
  reasoning?: string
  decision?: 'approved' | 'rejected' | 'suspended' | 'forwarded'
}

const DEFAULT_FLOW: MockStageSpec[] = [
  {
    stage: 'taizi',
    station: 'taizi',
    durationMs: 450,
    model: 'claude-haiku-4-5',
    tokensIn: 120,
    tokensOut: 60,
    costUsd: 0.0008,
    reasoning: '已受理此奏折，识别为**合同分析类**需求，转中书省起草方案。',
    decision: 'forwarded',
  },
  {
    stage: 'zhongshu',
    station: 'zhongshu',
    durationMs: 1800,
    model: 'claude-sonnet-4-6',
    tokensIn: 350,
    tokensOut: 420,
    costUsd: 0.009,
    reasoning: '起草三步方案：\n1. 抽取合同关键条款\n2. 识别潜在风险\n3. 对比行业基准',
    decision: 'forwarded',
  },
  {
    stage: 'menxia',
    station: 'menxia',
    durationMs: 900,
    model: 'claude-sonnet-4-6',
    tokensIn: 500,
    tokensOut: 180,
    costUsd: 0.006,
    reasoning: '审议通过。提醒：第 3 步需要接入法规库。',
    decision: 'approved',
  },
  {
    stage: 'shangshu',
    station: 'shangshu',
    durationMs: 300,
    model: 'claude-haiku-4-5',
    tokensIn: 90,
    tokensOut: 40,
    costUsd: 0.0005,
    reasoning: '分派到**法律庄园**（擅长合同与合规）。',
    decision: 'forwarded',
  },
  {
    stage: 'liubu',
    station: 'xingbu',
    durationMs: 600,
    reasoning: '刑部备案。',
    decision: 'forwarded',
  },
  {
    stage: 'manor',
    station: 'legal',
    durationMs: 2600,
    model: 'claude-sonnet-4-6',
    tokensIn: 1200,
    tokensOut: 850,
    costUsd: 0.027,
    reasoning: '法律庄园 7+2 蜂群协作：\n- 合同专家：提取 12 条关键条款\n- 合规专家：发现 3 处与 GDPR 冲突\n- 红队：质疑条款 5 的赔偿上限\n- 蓝队：确认通过终审\n\n最终产出归档至史馆。',
    decision: 'approved',
  },
]

/** 生成一个完整奏折的事件序列（committed 为主，演示友好） */
export function generateMockPetitionEvents(
  petitionId: string,
  opts?: { startAt?: Date; flow?: MockStageSpec[] },
): CourtEvent[] {
  const flow = opts?.flow ?? DEFAULT_FLOW
  const startAt = opts?.startAt ?? new Date()

  const events: CourtEvent[] = []
  let cursor = startAt.getTime()
  let seq = 0
  let parent: string | null = null

  for (const step of flow) {
    const startedAt = new Date(cursor).toISOString()

    // 每站一个 "started" 事件
    const startedEvent: CourtEvent = {
      event_id: makeId('evt'),
      petition_id: petitionId,
      seq: seq++,
      parent_event_id: parent,
      span_id: makeId('span'),
      stage: step.stage,
      station: step.station,
      event_type: 'started',
      status_kind: null,
      produced_at: startedAt,
      started_at: startedAt,
      ended_at: null,
      duration_ms: null,
      model: step.model ?? null,
      tokens_in: null,
      tokens_out: null,
      cost_usd: null,
      reasoning_ref: null,
      redaction_version: 'v1',
    }
    events.push(startedEvent)

    cursor += step.durationMs
    const endedAt = new Date(cursor).toISOString()

    // 每站一个 "committed" 事件
    const commitEvent: CourtEvent = {
      event_id: makeId('evt'),
      petition_id: petitionId,
      seq: seq++,
      parent_event_id: startedEvent.event_id,
      span_id: startedEvent.span_id,
      stage: step.stage,
      station: step.station,
      event_type: 'committed',
      status_kind: step.decision ?? 'forwarded',
      produced_at: endedAt,
      started_at: startedAt,
      ended_at: endedAt,
      duration_ms: step.durationMs,
      model: step.model ?? null,
      tokens_in: step.tokensIn ?? null,
      tokens_out: step.tokensOut ?? null,
      cost_usd: step.costUsd ?? null,
      reasoning_ref: step.reasoning ?? null,
      redaction_version: 'v1',
    }
    events.push(commitEvent)

    parent = commitEvent.event_id
  }

  return events
}

/**
 * 异步按真实时序推送事件流（mock SSE 的核心逻辑）。
 * 使用 AsyncIterable 便于前端 `for await` 消费。
 */
export async function* streamMockPetition(
  petitionId: string,
  opts?: { speed?: number; startAt?: Date; flow?: MockStageSpec[] },
): AsyncGenerator<CourtEvent> {
  const speed = opts?.speed ?? 1
  const events = generateMockPetitionEvents(petitionId, opts)

  const baseMs = new Date(events[0]?.produced_at ?? Date.now()).getTime()
  let wallBase = Date.now()

  for (const event of events) {
    const target = new Date(event.produced_at).getTime() - baseMs
    const now = Date.now() - wallBase
    const wait = Math.max(0, (target - now) / speed)
    if (wait > 0) {
      await new Promise((r) => setTimeout(r, wait))
    }
    yield event
  }
}
