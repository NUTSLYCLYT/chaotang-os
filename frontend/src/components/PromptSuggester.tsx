'use client'

import { useState } from 'react'
import { Loader2, Sparkles, ChevronRight } from 'lucide-react'
import type { PromptSuggestion, SuggestionOption } from '@/lib/prompt-suggest/types'
import { logger } from '@/lib/logger'

interface PromptSuggesterProps {
  onSelect: (prompt: string, mode: 'fast' | 'standard' | 'deep') => void
}

export function PromptSuggester({ onSelect }: PromptSuggesterProps) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestion, setSuggestion] = useState<PromptSuggestion | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSuggest = async () => {
    if (!input.trim()) return

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/prompt/suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ input }),
        credentials: 'include' // 发送 cookies，确保认证
      })

      if (!res.ok) throw new Error('Failed to generate suggestions')

      const data = await res.json()
      setSuggestion(data.suggestions)
      setShowDetails(false)
    } catch (err: unknown) {
      logger.error('prompt suggest failed', {
        error: err instanceof Error ? err.message : String(err),
      })
      setError('建议生成失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (mode: 'fast' | 'standard' | 'deep') => {
    if (suggestion) {
      onSelect(suggestion.suggestions[mode].prompt, mode)
      setInput('')
      setSuggestion(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* 输入框 */}
      <div>
        <label className="text-sm font-medium text-gray-300 mb-2 block">
          说你的下旨（越自然越好）
        </label>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="例如：户部，看看财务 / 兵部，分析竞争态势"
          onKeyDown={e => {
            if (e.key === 'Enter' && e.ctrlKey) {
              handleSuggest()
            }
          }}
          className="w-full h-20 bg-gray-900 border border-gray-700 p-3 text-gray-100 rounded-lg text-sm placeholder-gray-500 focus:border-gold-500 focus:outline-none"
        />
      </div>

      {/* 建议按钮 */}
      <button
        onClick={handleSuggest}
        disabled={!input.trim() || loading}
        className="flex items-center gap-2 px-4 py-2 bg-gold-500 hover:bg-gold-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            生成中...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            ✨ 生成建议（3 个方案）
          </>
        )}
      </button>

      {/* 错误提示（内联玻璃面板，替代阻塞式 alert） */}
      {error && (
        <div
          role="alert"
          className="bg-red-900/30 border border-red-700/50 text-red-300 rounded-lg p-3 text-sm"
        >
          {error}
        </div>
      )}

      {/* 建议展示 */}
      {suggestion && (
        <div className="space-y-3 border-t border-gray-700 pt-4">
          {/* 头部信息 */}
          <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700">
            <p className="text-sm text-gray-400">
              🧠 我学到的：
              <span className="text-gray-200 ml-2">{suggestion.recommendedReason}</span>
            </p>
          </div>

          {/* 三个方案 */}
          <div className="space-y-2">
            {/* 快速方案 */}
            <OptionCard
              option={suggestion.suggestions.fast}
              isRecommended={suggestion.recommended === 'fast'}
              successRate={suggestion.userHistory.successRate.fast}
              onSelect={() => handleSelect('fast')}
            />

            {/* 标准方案 */}
            <OptionCard
              option={suggestion.suggestions.standard}
              isRecommended={suggestion.recommended === 'standard'}
              successRate={suggestion.userHistory.successRate.standard}
              onSelect={() => handleSelect('standard')}
            />

            {/* 深度方案 */}
            <OptionCard
              option={suggestion.suggestions.deep}
              isRecommended={suggestion.recommended === 'deep'}
              successRate={suggestion.userHistory.successRate.deep}
              onSelect={() => handleSelect('deep')}
            />
          </div>

          {/* 智能分拆建议 */}
          {suggestion.canSplit && suggestion.splitSuggestion && (
            <div className="bg-blue-900/30 border border-blue-700/50 p-3 rounded-lg">
              <p className="text-sm text-blue-300">
                💡 {suggestion.splitSuggestion.description}
              </p>
              <div className="mt-2 flex gap-1 flex-wrap">
                {suggestion.splitSuggestion.subTasks.map((task, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(task)}
                    className="text-xs px-2 py-1 bg-blue-800 hover:bg-blue-700 text-blue-200 rounded transition-colors"
                  >
                    {task}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 详情按钮 */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-gray-400 hover:text-gray-300 flex items-center gap-1"
          >
            {showDetails ? '隐藏' : '显示'}详情
            <ChevronRight className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-90' : ''}`} />
          </button>

          {/* 详情信息 */}
          {showDetails && (
            <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700 text-xs text-gray-400 space-y-1">
              <p>🎯 识别意图：<span className="text-gray-300">{suggestion.intent}</span></p>
              <p>🏛️ 目标部门：<span className="text-gray-300">{suggestion.dept || '自动'}</span></p>
              <p>📊 历史数据：<span className="text-gray-300">{suggestion.userHistory.totalAttempts} 次尝试</span></p>
              {/* 「系统状态/队列」行已删（大神会审 Bezos）：原显示 Math.random 假队列数，是 value theater。
                  真实队列遥测接通前不显示——给老板假数字比不给更伤信任。 */}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * 单个方案卡片
 */
function OptionCard({
  option,
  isRecommended,
  successRate,
  onSelect
}: {
  option: SuggestionOption
  isRecommended: boolean
  successRate: number
  onSelect: () => void
}) {
  const modeLabel = {
    fast: '⚡ 快速',
    standard: '⭐ 标准',
    deep: '🔬 深度'
  }[option.mode]

  const borderColor = isRecommended ? 'border-gold-500/50 bg-gold-500/5' : 'border-gray-700'

  return (
    <div className={`border ${borderColor} p-3 rounded-lg transition-colors hover:border-gold-400/50 hover:bg-gold-500/5`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-200">{modeLabel}</span>
          {isRecommended && (
            <span className="text-xs px-2 py-0.5 bg-gold-500/20 text-gold-300 rounded border border-gold-500/30">
              推荐 {successRate > 0 ? `(${Math.round(successRate)}%)` : ''}
            </span>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">{option.estimatedTime / 1000}s · ${option.estimatedCost}</p>
        </div>
      </div>

      <div className="bg-gray-900 p-2 rounded mb-2 border border-gray-800">
        <p className="text-sm text-gray-200 whitespace-pre-wrap">{option.prompt}</p>
      </div>

      <button
        onClick={onSelect}
        className={`w-full text-sm py-1.5 rounded transition-colors ${
          isRecommended
            ? 'bg-gold-600 hover:bg-gold-700 text-white'
            : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
        }`}
      >
        {isRecommended ? '✓ 采用推荐方案' : '采用此方案'}
      </button>
    </div>
  )
}
