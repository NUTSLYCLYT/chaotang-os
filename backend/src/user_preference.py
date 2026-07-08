"""UserPreference: 用户偏好记忆，跨对话持久化。

解决问题：
- 每次 run 都是全新开始，不记住用户习惯、偏好、历史协作模式
- 相同错误重复犯（如价格单位、输出格式）
- 无法从历史交互中学习

设计参考：
- cc_src Session Memory: 后台自动维护 SESSION.md
- jiqun_ai 已有 TypedMemory: 文件系统存储

存储位置：data/{tenant}/preferences/{user_id}.json

触发时机：
- run 结束后：分析 QA 结果 + 用户修改记录 → 提取模式
- run 启动时：读取偏好 → 注入 system prompt
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_PREFERENCE_DIR = "data/preferences"


@dataclass
class UserPreference:
    """用户偏好记忆。"""
    
    user_id: str
    tenant: str = "default"
    
    preference_data: dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        if not self.preference_data:
            self._load()
    
    @property
    def file_path(self) -> Path:
        return Path(DEFAULT_PREFERENCE_DIR) / self.tenant / f"{self.user_id}.json"
    
    def _load(self) -> None:
        if self.file_path.exists():
            try:
                self.preference_data = json.loads(self.file_path.read_text(encoding="utf-8"))
                logger.debug(f"Loaded preference for user {self.user_id}")
            except Exception as e:
                logger.warning(f"Failed to load preference: {e}")
                self.preference_data = {}
        else:
            self.preference_data = self._default_preference()
    
    def _default_preference(self) -> dict[str, Any]:
        return {
            "version": 1,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "preferred_model": None,
            "common_tasks": [],
            "style_preferences": {
                "output_detail": "detailed",
                "language": "zh-CN",
                "format": "markdown",
            },
            "past_corrections": [],
            "workflow_patterns": [],
            "domain_expertise": [],
            "avoid_patterns": [],
        }
    
    def save(self) -> None:
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        self.preference_data["updated_at"] = datetime.now().isoformat()
        self.file_path.write_text(
            json.dumps(self.preference_data, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
        logger.debug(f"Saved preference for user {self.user_id}")
    
    def get(self, key: str, default: Any = None) -> Any:
        return self.preference_data.get(key, default)
    
    def set(self, key: str, value: Any) -> None:
        self.preference_data[key] = value
        self.save()
    
    def record_correction(
        self,
        step_id: str,
        issue: str,
        fix: str,
        severity: str = "medium",
    ) -> None:
        corrections = self.preference_data.get("past_corrections", [])
        corrections.append({
            "step": step_id,
            "issue": issue,
            "fix": fix,
            "severity": severity,
            "timestamp": datetime.now().isoformat(),
        })
        if len(corrections) > 50:
            corrections = corrections[-50:]
        self.preference_data["past_corrections"] = corrections
        self.save()
        logger.info(f"Recorded correction: {issue} → {fix}")
    
    def record_accepted_design(
        self,
        step_id: str,
        design_choice: str,
        context: str = "",
    ) -> None:
        """记录用户接受的设计选择，避免 critic 重复质疑。
        
        当用户明确接受某个 critic 质疑点时调用。
        
        Args:
            step_id: 步骤 ID
            design_choice: 设计选择（如"三元电芯用于低温场景"）
            context: 上下文说明
        """
        accepted = self.preference_data.get("accepted_designs", [])
        
        existing = next(
            (a for a in accepted if a.get("choice") == design_choice),
            None
        )
        
        if existing:
            existing["count"] = existing.get("count", 0) + 1
            existing["last_accepted"] = datetime.now().isoformat()
        else:
            accepted.append({
                "step": step_id,
                "choice": design_choice,
                "context": context,
                "count": 1,
                "first_accepted": datetime.now().isoformat(),
                "last_accepted": datetime.now().isoformat(),
            })
        
        if len(accepted) > 30:
            accepted = accepted[-30:]
        
        self.preference_data["accepted_designs"] = accepted
        self.save()
        logger.info(f"Recorded accepted design: {design_choice}")
    
    def get_accepted_designs(self, limit: int = 10) -> list[str]:
        """获取用户已接受的设计选择列表（按接受次数排序）。
        
        用于 critic 检查时排除这些偏好。
        
        Args:
            limit: 最大返回数量
        
        Returns:
            设计选择内容列表
        """
        accepted = self.preference_data.get("accepted_designs", [])
        sorted_accepted = sorted(
            accepted,
            key=lambda x: x.get("count", 0),
            reverse=True
        )
        return [a.get("choice", "") for a in sorted_accepted[:limit] if a.get("choice")]
    
    def record_workflow_pattern(
        self,
        trigger: str,
        flow_name: str,
        success: bool = True,
    ) -> None:
        patterns = self.preference_data.get("workflow_patterns", [])
        
        existing = next(
            (p for p in patterns if p.get("trigger") == trigger and p.get("flow") == flow_name),
            None
        )
        
        if existing:
            existing["count"] = existing.get("count", 0) + 1
            existing["last_used"] = datetime.now().isoformat()
            _current_rate = existing.get("success_rate", 1.0)
            if success:
                existing["success_rate"] = _current_rate * 0.9 + 0.1
            else:
                existing["success_rate"] = _current_rate * 0.9
        else:
            patterns.append({
                "trigger": trigger,
                "flow": flow_name,
                "count": 1,
                "success_rate": 1.0 if success else 0.0,
                "last_used": datetime.now().isoformat(),
            })
        
        if len(patterns) > 30:
            patterns = sorted(patterns, key=lambda x: x.get("count", 0), reverse=True)[:30]
        
        self.preference_data["workflow_patterns"] = patterns
        self.save()
    
    def add_avoid_pattern(self, pattern: str, reason: str) -> None:
        avoid = self.preference_data.get("avoid_patterns", [])
        if not any(p.get("pattern") == pattern for p in avoid):
            avoid.append({
                "pattern": pattern,
                "reason": reason,
                "added_at": datetime.now().isoformat(),
            })
            self.preference_data["avoid_patterns"] = avoid[-20:]
            self.save()
    
    def add_domain_expertise(self, domain: str, keywords: list[str]) -> None:
        expertise = self.preference_data.get("domain_expertise", [])
        existing = next((e for e in expertise if e.get("domain") == domain), None)
        if existing:
            existing["keywords"] = list(set(existing.get("keywords", []) + keywords))
        else:
            expertise.append({
                "domain": domain,
                "keywords": keywords,
                "added_at": datetime.now().isoformat(),
            })
        self.preference_data["domain_expertise"] = expertise
        self.save()
    
    def to_injection_text(self, max_chars: int = 800) -> str:
        lines = ["## 用户偏好记忆\n"]
        
        style = self.preference_data.get("style_preferences", {})
        if style:
            lines.append(f"- 输出风格：{style.get('output_detail', 'detailed')}")
            lines.append(f"- 语言：{style.get('language', 'zh-CN')}")
            lines.append(f"- 格式：{style.get('format', 'markdown')}")
        
        corrections = self.preference_data.get("past_corrections", [])[-5:]
        if corrections:
            lines.append("\n### 历史纠错（避免重复犯错）")
            for c in corrections:
                lines.append(f"- [{c.get('step', '?')}] {c.get('issue', '')} → 改为：{c.get('fix', '')}")
        
        avoid = self.preference_data.get("avoid_patterns", [])[-3:]
        if avoid:
            lines.append("\n### 避免的模式")
            for a in avoid:
                lines.append(f"- {a.get('pattern', '')}（原因：{a.get('reason', '')}）")
        
        expertise = self.preference_data.get("domain_expertise", [])
        if expertise:
            lines.append("\n### 用户专业领域")
            for e in expertise:
                lines.append(f"- {e.get('domain', '')}：{', '.join(e.get('keywords', [])[:5])}")
        
        text = "\n".join(lines)
        if len(text) > max_chars:
            text = text[:max_chars].rsplit("\n", 1)[0] + "\n…（已截断）"
        
        return text
    
    def suggest_flow(self, task_input: str) -> str | None:
        patterns = self.preference_data.get("workflow_patterns", [])
        if not patterns:
            return None
        
        task_lower = task_input.lower()
        for p in sorted(patterns, key=lambda x: x.get("success_rate", 0), reverse=True):
            trigger = p.get("trigger", "").lower()
            if trigger and trigger in task_lower:
                if p.get("success_rate", 0) >= 0.7:
                    return p.get("flow")
        
        return None


def analyze_run_for_preference(
    run_log: dict,
    user_preference: UserPreference,
) -> dict[str, Any]:
    """分析 run 结果，提取用户偏好模式。
    
    Args:
        run_log: RunLog.to_dict() 的输出
        user_preference: 用户偏好实例
    
    Returns:
        提取的模式摘要
    """
    patterns_found = {
        "corrections": 0,
        "workflow": None,
        "style_hints": [],
    }
    
    qa_result = run_log.get("qa_result", {})
    issues = qa_result.get("issues", [])
    
    for issue in issues:
        dimension = issue.get("dimension", "")
        description = issue.get("description", "")
        
        if "格式" in description or "输出" in description:
            user_preference.add_avoid_pattern(
                pattern=description[:50],
                reason=f"QA检测到问题（{dimension}）"
            )
            patterns_found["corrections"] += 1
        
        if "单位" in description or "数字" in description:
            user_preference.add_avoid_pattern(
                pattern=description[:50],
                reason="数据准确性问题"
            )
            patterns_found["corrections"] += 1
    
    flow_name = run_log.get("flow_name", "")
    task_input = run_log.get("task_input", "")[:100]
    total_score = qa_result.get("total_score", 0)
    
    if flow_name and task_input:
        user_preference.record_workflow_pattern(
            trigger=task_input,
            flow_name=flow_name,
            success=total_score >= 3.5,
        )
        patterns_found["workflow"] = flow_name
    
    return patterns_found


def get_user_preference(user_id: str, tenant: str = "default") -> UserPreference:
    """获取用户偏好实例。"""
    return UserPreference(user_id=user_id, tenant=tenant)
