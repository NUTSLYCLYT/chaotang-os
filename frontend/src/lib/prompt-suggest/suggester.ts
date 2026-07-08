import { callLLM } from '@/lib/llm/router'
import { logger } from '@/lib/logger'
import type {
  PromptSuggestion,
  SuggestionOption,
  DeptCode,
  TaskIntent,
  UserHistoryStats,
} from './types'
import { extractUserIntent } from './intentDetector'
import { analyzeUserHistory, recommendMode, suggestSplit } from './historyAnalyzer'

/**
 * 核心：生成下旨建议
 * 集成意图识别 + 历史分析 + LLM 润色
 */

const POLISH_PROMPTS: Record<'fast' | 'standard' | 'deep', string> = {
  fast: `你是朝堂丞相的御前书记官。用户想做一个任务，需要快速处理（3-10 秒内）。

请把用户的粗命令精简成一句话的下旨。
格式：[部门]，[动词] [目标]，需要：[核心指标]

例如：
- 输入："户部，看看财务"
  输出："户部，汇总 Q1 财务三大指标：收入、成本、利润"

不要啰嗦，不要加"深度分析"等词。用户时间宝贵。
必须把"优化/完善/搞好/全做"翻译成可观察的结果。
不得承诺 mock/fallback 是真能力。
只输出下旨文本，不要解释。`,

  standard: `你是朝堂丞相的御前书记官。用户想做一个标准深度的任务（10-20 秒）。

请把用户的粗命令润色成简单、可执行的下旨，自动补齐重点。
只有当输入过短、空泛、缺少验收、出现"全做/搞好/优化/完善/脑雾/上线"等词时，才做提示词引导。
如果用户命令已经足够具体，不要重写成模板，只补一条简短风险提醒。
格式：
我基于这些上下文判断：
  - [当前项目/页面/部门/用户目标/不确定项]

更好的说法：
  [一段可复制的下旨]

重点：
  - 要做什么：[目标]
  - 不做什么：[禁区]
  - 怎么算完成：[验收/证据]
  - 下一步先做什么：[第一步]

例如：
- 输入："户部，分析财务"
  输出："我基于这些上下文判断：
          - 当前任务是财务分析，部门已明确为户部。
          - 还缺少时间范围、数据来源和验收标准。

        更好的说法：
          户部，分析 Q1 财务并形成可裁决奏折；列出收入、成本、利润，标明同比/环比变化、主要风险和数据来源，最后给出下一步建议。
        重点：
          - 要做什么：分析 Q1 财务并形成奏折
          - 不做什么：不使用未标明来源的数据
          - 怎么算完成：有核心指标、风险、数据来源和建议
          - 下一步先做什么：先确认可用财务数据"

保持专业但简洁。必须明示真数据/待核/降级，不许把 mock 说成真。
只输出润色结果。`,

  deep: `你是朝堂丞相，负责把用户脑雾中的粗命令润色成顶级 Codex 黄金命令（30-60 秒）。

请按以下结构输出，不要省略栏目：

目标：
  [一句话定义真实结果]

用户：
  [谁使用这个结果、为什么重要]

上下文：
  - [已知事实]
  - [关键文件/页面/接口，如未知就写"待定位"]

禁区：
  - 不伪装 mock/fallback 为真
  - 不扩大到无关页面或新功能
  - 不牺牲安全、证据链和可回滚性

验收：
  - [构建/测试/截图/日志/业务结果中最相关的 3-5 条]

输出：
  - [交付物清单]
  - [剩余风险]
  - [下一步最小动作]

例如：
- 输入："帮我把上线搞好，我脑子乱了"
  输出："目标：
          把先知和导师最小真闭环上线到可演示状态。
        用户：
          第一个真实老板/客户，需要用它完成一次真实决策。
        上下文：
          - 前端 SoT：chaotang-web-lyt
          - 后端 SoT：jiqun_ai
        禁区：
          - 不新增页面、插件、skill
          - 不伪装 mock/fallback 为真
        验收：
          - production build pass
          - 上书房/军机处/史馆浏览器截图
          - 生成一份真实奏折并归档
        输出：
          - 改动清单、验证结果、截图路径、剩余风险"

要全面、要有边界。只输出润色后的命令。`
}

export async function generateSuggestions(
  userInput: string,
  userId: string
): Promise<PromptSuggestion> {
  // Step 1: 意图识别
  const { intent, dept, raw } = extractUserIntent(userInput)

  // Step 2: 历史分析
  const history = await analyzeUserHistory(userId, intent, dept)
  const recommendedMode = recommendMode(history)
  const splitSuggestion = suggestSplit(userInput, intent)

  // Step 3: 生成三个方案（并行调用 LLM）
  const suggestions = await Promise.all([
    generateOption(userInput, intent, dept, 'fast', history),
    generateOption(userInput, intent, dept, 'standard', history),
    generateOption(userInput, intent, dept, 'deep', history)
  ])

  const suggestionMap = {
    fast: suggestions[0],
    standard: suggestions[1],
    deep: suggestions[2]
  }

  // Step 4: 系统状态 —— 已删（大神会审 Bezos 裁定 value theater）。
  // 原为 Math.random 队列/负载 + 硬编码 USD 成本，伪装成"实时系统状态"展示给老板。
  // 真实遥测接通前绝不伪造：宁可不显示，也不给假数字。

  const recommendedReason =
    recommendedMode === 'fast'
      ? `你的「${intent}」历史中，快速模式成功 ${history.successCount.fast} 次，成功率最高。`
      : recommendedMode === 'standard'
        ? `这个任务中等复杂度。标准模式在你的历史中成功率最高。`
        : `这是个复杂任务。深度分析能保证质量。`

  return {
    userInput: raw,
    intent,
    dept,
    suggestions: suggestionMap,
    recommended: recommendedMode,
    recommendedReason,
    canSplit: !!splitSuggestion,
    splitSuggestion: splitSuggestion || undefined,
    userHistory: {
      totalAttempts: history.totalAttempts,
      successRate: {
        fast: history.totalAttempts > 0 ? (history.successCount.fast / history.totalAttempts) * 100 : 0,
        standard: history.totalAttempts > 0 ? (history.successCount.standard / history.totalAttempts) * 100 : 0,
        deep: history.totalAttempts > 0 ? (history.successCount.deep / history.totalAttempts) * 100 : 0
      },
      lastUsedMode: history.totalAttempts > 0 ? recommendedMode : null
    }
  }
}

async function generateOption(
  userInput: string,
  intent: TaskIntent,
  dept: DeptCode | null,
  mode: 'fast' | 'standard' | 'deep',
  history: UserHistoryStats
): Promise<SuggestionOption> {
  const estimatedTime = {
    fast: 3000,
    standard: 15000,
    deep: 60000
  }[mode]

  const estimatedCost = {
    fast: 0.15,
    standard: 0.50,
    deep: 1.50
  }[mode]

  const description = {
    fast: `一句话下旨，${estimatedTime / 1000}秒内得到结果，成本 $${estimatedCost}`,
    standard: `更好的说法 + 四个重点，${estimatedTime / 1000}秒内完成，成本 $${estimatedCost}`,
    deep: `黄金命令：目标/用户/上下文/禁区/验收/证据，${estimatedTime / 1000}秒内完成，成本 $${estimatedCost}`
  }[mode]

  // 调用 LLM 润色
  const systemPrompt = POLISH_PROMPTS[mode]
  const userPrompt = `任务：${userInput}\n部门：${dept || '自动'}\n意图：${intent}`
  let polishedPrompt = ''

  try {
    const result = await callLLM(
      {
        intent: 'polish-prompt',
        requires: [],
        estimatedInputTokens: 100
      },
      userPrompt,
      {
        system: systemPrompt
      }
    )
    const polished = typeof result.data === 'string' ? result.data.trim() : ''
    polishedPrompt =
      polished || `${dept || '朝堂'}，${getDefaultAction(intent)} ${userInput}`
  } catch (error) {
    // 如果 LLM 失败，生成默认下旨
    logger.error('polish prompt failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    polishedPrompt = buildFallbackPrompt(userInput, intent, dept, mode)
  }

  return {
    mode,
    prompt: polishedPrompt,
    estimatedTime,
    estimatedCost,
    description
  }
}

function getDefaultAction(intent: TaskIntent): string {
  const actions: Record<TaskIntent, string> = {
    analysis: '分析',
    forecast: '预测',
    risk: '评估风险',
    optimize: '优化',
    report: '报告',
    decision: '判断',
    other: '处理'
  }
  return actions[intent]
}

function buildFallbackPrompt(
  userInput: string,
  intent: TaskIntent,
  dept: DeptCode | null,
  mode: 'fast' | 'standard' | 'deep'
): string {
  const target = `${dept || '朝堂'}，${getDefaultAction(intent)} ${userInput}`

  if (mode === 'fast') return target

  if (mode === 'standard') {
    return `我基于这些上下文判断：
  - 原始命令是：${userInput}
  - 当前部门：${dept || '自动分派'}
  - 当前意图：${intent}
  - 仍需确认具体数据、范围或验收证据

更好的说法：
  ${target}；请给出可观察结论，标明关键依据、待确认项和风险，最后输出下一步最小动作。

重点：
  - 要做什么：${getDefaultAction(intent)}这个任务
  - 不做什么：不扩大范围，不把待确认信息当事实
  - 怎么算完成：有结论、依据、风险和下一步
  - 下一步先做什么：先确认当前可用上下文`
  }

  return `目标：
  ${target}

用户：
  当前任务的真实使用者；若不明确，先确认用户和成功指标。

上下文：
  - 原始命令：${userInput}
  - 部门：${dept || '自动分派'}
  - 意图：${intent}

禁区：
  - 不扩大到无关页面或新功能
  - 不伪装 mock/fallback 为真
  - 不牺牲安全、证据链和可回滚性

验收：
  - 输出可观察结果
  - 标明依据、待确认项和风险
  - 给出下一步最小动作

输出：
  - 结论、证据、风险、下一步`
}
