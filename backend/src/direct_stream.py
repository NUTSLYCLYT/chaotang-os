from __future__ import annotations
import json
import queue
import threading
from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal

@dataclass
class StreamEvent:
    type: str
    content: str = ""
    progress: float = 0.0
    sentiment: str = "neutral"  # neutral, positive, cautious, excited
    minister: str = ""
    metadata: dict = field(default_factory=dict)

class StreamFormatter:
    MINISTER_EMOJI = {
        "taizi": "皇子",
        "zhongshu": "中书",
        "shangshu": "尚书",
        "menxia": "门下",
        "jin_yi_wei": "锦衣卫",
        "qin_tian_jian": "秦天监",
        "li_bu": "吏部",
        "hu_bu": "户部",
        "xing_bu": "刑部",
        "gong_bu": "工部",
        "li_bu_rites": "礼部",
        "bing_bu": "兵部",
    }
    
    SENTIMENT_COLORS = {
        "positive": "#4CAF50",
        "cautious": "#FF9800",
        "excited": "#E91E63",
        "neutral": "#9E9E9E"
    }
    
    def format_event(self, event: StreamEvent) -> dict:
        base = {
            "type": event.type,
            "timestamp": datetime.now().isoformat(),
        }
        
        if event.type == "thinking":
            return {
                **base,
                "content": event.content,
                "progress": event.progress,
                "icon": "brain",
                "style": "thinking"
            }
        
        elif event.type == "routing":
            return {
                **base,
                "content": event.content,
                "confidence": event.metadata.get("confidence", 0),
                "icon": "route",
                "style": "routing"
            }
        
        elif event.type == "minister_opinion":
            emoji = self.MINISTER_EMOJI.get(event.minister, event.minister)
            return {
                **base,
                "minister": emoji,
                "minister_code": event.minister,
                "content": event.content,
                "sentiment": event.sentiment,
                "sentiment_color": self.SENTIMENT_COLORS.get(event.sentiment, "#9E9E9E"),
                "icon": "person",
                "style": "opinion"
            }
        
        elif event.type == "group_progress":
            return {
                **base,
                "group": event.content,
                "progress": event.progress,
                "icon": "group",
                "style": "progress"
            }
        
        elif event.type == "conclusion":
            return {
                **base,
                "summary": event.content,
                "icon": "flag",
                "style": "conclusion"
            }
        
        elif event.type == "error":
            return {
                **base,
                "message": event.content,
                "icon": "error",
                "style": "error"
            }
        
        elif event.type == "done":
            return {
                **base,
                "message": "执行完成",
                "icon": "check",
                "style": "success"
            }
        
        elif event.type == "heartbeat":
            return {**base, "type": "heartbeat"}
        
        return base
    
    def thinking(self, content: str, progress: float = 0) -> StreamEvent:
        return StreamEvent(type="thinking", content=content, progress=progress, sentiment="neutral")
    
    def routing(self, content: str, confidence: float) -> StreamEvent:
        return StreamEvent(type="routing", content=content, sentiment="cautious", metadata={"confidence": confidence})
    
    def minister(self, minister: str, content: str, sentiment: str = "neutral") -> StreamEvent:
        return StreamEvent(type="minister_opinion", minister=minister, content=content, sentiment=sentiment)
    
    def group(self, content: str, progress: float) -> StreamEvent:
        return StreamEvent(type="group_progress", content=content, progress=progress)
    
    def conclusion(self, content: str) -> StreamEvent:
        return StreamEvent(type="conclusion", content=content, sentiment="positive")

class StreamEmitter:
    def __init__(self, q: queue.Queue):
        self.q = q
        self.formatter = StreamFormatter()
    
    def emit(self, event: StreamEvent):
        formatted = self.formatter.format_event(event)
        self.q.put({"type": "stream_event", "data": formatted})
    
    def emit_thinking(self, content: str, progress: float = 0):
        self.emit(self.formatter.thinking(content, progress))
    
    def emit_routing(self, content: str, confidence: float):
        self.emit(self.formatter.routing(content, confidence))
    
    def emit_minister(self, minister: str, content: str, sentiment: str = "neutral"):
        self.emit(self.formatter.minister(minister, content, sentiment))
    
    def emit_done(self):
        self.emit(StreamEvent(type="done", content="执行完成"))

stream_formatter = StreamFormatter()