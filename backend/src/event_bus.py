"""EventBus: 轻量级内存事件总线，实现蜂群间 Pub/Sub 通信。

设计原则：
- 纯 Python 内存实现，零外部依赖
- 接口稳定：将来可替换为 Redis Pub/Sub，上层无感知
- 事件持久化：所有事件写入 JSON 日志，可审计可回溯
"""

from __future__ import annotations

import json
import threading
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Callable

EVENTS_DIR = Path(__file__).resolve().parent.parent / "events"


@dataclass
class Event:
    """一条事件消息。"""

    topic: str              # 事件主题，如 "lead_generated", "solution_ready"
    source: str             # 发布者标识，如 "haolong_pipeline"
    payload: dict           # 事件数据
    event_id: str = ""      # 自动生成
    timestamp: str = ""     # 自动生成
    session_id: str = ""    # 所属编排会话

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().astimezone().isoformat()
        if not self.event_id:
            self.event_id = datetime.now().strftime("%Y%m%d_%H%M%S_%f")


# 订阅者回调签名: (event: Event) -> None
Subscriber = Callable[[Event], None]


class EventBus:
    """内存 Pub/Sub 事件总线。

    用法:
        bus = EventBus()
        bus.subscribe("lead_generated", my_handler)
        bus.publish("lead_generated", source="haolong", payload={...})
    """

    def __init__(self, session_id: str = ""):
        self._subscribers: dict[str, list[Subscriber]] = {}
        self._history: list[Event] = []
        self._lock = threading.Lock()
        self.session_id = session_id or datetime.now().strftime("%Y%m%d_%H%M%S")

    def subscribe(self, topic: str, callback: Subscriber) -> None:
        """订阅某个主题。"""
        with self._lock:
            self._subscribers.setdefault(topic, []).append(callback)

    def unsubscribe(self, topic: str, callback: Subscriber) -> None:
        """取消订阅。"""
        with self._lock:
            if topic in self._subscribers:
                self._subscribers[topic] = [
                    cb for cb in self._subscribers[topic] if cb is not callback
                ]

    def publish(self, topic: str, source: str, payload: dict) -> Event:
        """发布事件，同步通知所有订阅者。

        Returns:
            发布的 Event 对象。
        """
        event = Event(
            topic=topic,
            source=source,
            payload=payload,
            session_id=self.session_id,
        )

        with self._lock:
            self._history.append(event)
            subscribers = list(self._subscribers.get(topic, []))

        # 在锁外执行回调，避免死锁
        for cb in subscribers:
            cb(event)

        # 持久化事件日志
        self._persist_event(event)

        return event

    def get_history(self, topic: str | None = None) -> list[Event]:
        """获取事件历史，可按 topic 过滤。"""
        with self._lock:
            if topic:
                return [e for e in self._history if e.topic == topic]
            return list(self._history)

    def get_topics(self) -> list[str]:
        """获取所有已注册的 topic 列表。"""
        with self._lock:
            return list(self._subscribers.keys())

    def clear(self) -> None:
        """清空所有订阅和历史（主要用于测试）。"""
        with self._lock:
            self._subscribers.clear()
            self._history.clear()

    def _persist_event(self, event: Event) -> None:
        """将事件写入 events/{session_id}/ 目录。"""
        d = EVENTS_DIR / self.session_id
        d.mkdir(parents=True, exist_ok=True)
        path = d / f"{event.event_id}.json"
        path.write_text(
            json.dumps(asdict(event), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )


def load_session_events(session_id: str) -> list[Event]:
    """加载某个会话的所有事件日志。"""
    d = EVENTS_DIR / session_id
    if not d.exists():
        return []
    events = []
    for f in sorted(d.glob("*.json")):
        data = json.loads(f.read_text(encoding="utf-8"))
        events.append(Event(**data))
    return events


def list_sessions() -> list[str]:
    """列出所有事件会话。"""
    if not EVENTS_DIR.exists():
        return []
    return sorted(
        [d.name for d in EVENTS_DIR.iterdir() if d.is_dir()],
        reverse=True,
    )
