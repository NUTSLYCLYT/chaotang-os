from __future__ import annotations
import json
from datetime import datetime
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

from src.runtime_paths import resolve_runtime_paths

FEEDBACK_DIR = resolve_runtime_paths().direct_feedback

@dataclass
class Feedback:
    task_id: str
    command: str
    mode: str
    target: str
    rating: Literal["good", "bad", "neutral"]
    user_comment: str = ""
    corrected_mode: str = ""
    corrected_target: str = ""
    created_at: str = ""

class FeedbackLearner:
    def __init__(self, feedback_dir=FEEDBACK_DIR):
        self.feedback_dir = Path(feedback_dir)
        self.feedback_dir.mkdir(parents=True, exist_ok=True)
        self._patterns = self._load_patterns()
    
    def _load_patterns(self):
        patterns_file = self.feedback_dir / "patterns.json"
        if patterns_file.exists():
            return json.loads(patterns_file.read_text(encoding="utf-8"))
        return {"keyword_overrides": {}, "routing_history": []}
    
    def _save_patterns(self):
        patterns_file = self.feedback_dir / "patterns.json"
        patterns_file.write_text(json.dumps(self._patterns, ensure_ascii=False, indent=2), encoding="utf-8")
    
    def record(self, task_id, command, mode, target, rating, comment="", corrected_mode="", corrected_target=""):
        fb = Feedback(
            task_id=task_id,
            command=command,
            mode=mode,
            target=target,
            rating=rating,
            user_comment=comment,
            corrected_mode=corrected_mode,
            corrected_target=corrected_target,
            created_at=datetime.now().isoformat()
        )
        # 保存反馈
        fb_file = self.feedback_dir / f"{task_id}.json"
        fb_file.write_text(json.dumps({
            "task_id": fb.task_id,
            "command": fb.command,
            "mode": fb.mode,
            "target": fb.target,
            "rating": fb.rating,
            "user_comment": fb.user_comment,
            "corrected_mode": fb.corrected_mode,
            "corrected_target": fb.corrected_target,
            "created_at": fb.created_at
        }, ensure_ascii=False), encoding="utf-8")
        
        # 学习：如果用户修正了路由，更新patterns
        if rating == "bad" and (corrected_mode or corrected_target):
            cmd_lower = command.lower()[:50]
            if cmd_lower not in self._patterns["keyword_overrides"]:
                self._patterns["keyword_overrides"][cmd_lower] = {
                    "original": {"mode": mode, "target": target},
                    "corrected": {"mode": corrected_mode or mode, "target": corrected_target or target},
                    "count": 1,
                    "last_updated": datetime.now().isoformat()
                }
            else:
                self._patterns["keyword_overrides"][cmd_lower]["count"] += 1
                self._patterns["keyword_overrides"][cmd_lower]["last_updated"] = datetime.now().isoformat()
            
            # 只有被修正超过3次才真正覆盖默认路由
            if self._patterns["keyword_overrides"][cmd_lower]["count"] >= 3:
                self._save_patterns()
        
        # 记录历史
        self._patterns["routing_history"].append({
            "command": command[:100],
            "mode": mode,
            "target": target,
            "rating": rating,
            "timestamp": datetime.now().isoformat()
        })
        # 只保留最近1000条
        if len(self._patterns["routing_history"]) > 1000:
            self._patterns["routing_history"] = self._patterns["routing_history"][-1000:]
        
        return fb
    
    def get_override(self, command):
        cmd_lower = command.lower()[:50]
        return self._patterns["keyword_overrides"].get(cmd_lower)
    
    def get_stats(self):
        fb_files = list(self.feedback_dir.glob("*.json"))
        # 排除patterns.json
        fb_files = [f for f in fb_files if f.name != "patterns.json"]
        
        ratings = {"good": 0, "bad": 0, "neutral": 0}
        for f in fb_files:
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
                r = data.get("rating", "neutral")
                ratings[r] = ratings.get(r, 0) + 1
            except Exception:
                pass
        
        return {
            "total_feedback": len(fb_files),
            "ratings": ratings,
            "overrides_count": len(self._patterns["keyword_overrides"]),
            "accuracy_rate": ratings["good"] / max(1, sum(ratings.values())) * 100
        }

learner = FeedbackLearner()
