"""EventBus 事件总线测试。"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.event_bus import EventBus, Event


def test_publish_subscribe():
    """发布事件后，订阅者收到回调。"""
    bus = EventBus(session_id="test_ps")
    received = []

    def handler(event: Event):
        received.append(event)

    bus.subscribe("test_topic", handler)
    bus.publish("test_topic", source="test", payload={"key": "value"})

    assert len(received) == 1
    assert received[0].topic == "test_topic"
    assert received[0].payload == {"key": "value"}
    assert received[0].source == "test"


def test_multiple_subscribers():
    """同一 topic 多个订阅者都收到事件。"""
    bus = EventBus(session_id="test_multi")
    results_a = []
    results_b = []

    bus.subscribe("topic_x", lambda e: results_a.append(e))
    bus.subscribe("topic_x", lambda e: results_b.append(e))

    bus.publish("topic_x", source="src", payload={})

    assert len(results_a) == 1
    assert len(results_b) == 1


def test_no_cross_topic():
    """不同 topic 的订阅者互不干扰。"""
    bus = EventBus(session_id="test_cross")
    received = []

    bus.subscribe("topic_a", lambda e: received.append(e))
    bus.publish("topic_b", source="src", payload={})

    assert len(received) == 0


def test_unsubscribe():
    """取消订阅后不再收到事件。"""
    bus = EventBus(session_id="test_unsub")
    received = []

    def handler(event: Event):
        received.append(event)

    bus.subscribe("topic", handler)
    bus.publish("topic", source="src", payload={})
    assert len(received) == 1

    bus.unsubscribe("topic", handler)
    bus.publish("topic", source="src", payload={})
    assert len(received) == 1  # 没有新增


def test_event_history():
    """事件历史记录。"""
    bus = EventBus(session_id="test_hist")

    bus.publish("a", source="s1", payload={"v": 1})
    bus.publish("b", source="s2", payload={"v": 2})
    bus.publish("a", source="s3", payload={"v": 3})

    all_events = bus.get_history()
    assert len(all_events) == 3

    a_events = bus.get_history(topic="a")
    assert len(a_events) == 2
    assert a_events[0].payload["v"] == 1
    assert a_events[1].payload["v"] == 3


def test_get_topics():
    """获取已注册的 topic 列表。"""
    bus = EventBus(session_id="test_topics")
    bus.subscribe("alpha", lambda e: None)
    bus.subscribe("beta", lambda e: None)

    topics = bus.get_topics()
    assert "alpha" in topics
    assert "beta" in topics


def test_clear():
    """清空后无订阅无历史。"""
    bus = EventBus(session_id="test_clear")
    bus.subscribe("x", lambda e: None)
    bus.publish("x", source="s", payload={})

    bus.clear()
    assert bus.get_history() == []
    assert bus.get_topics() == []


def test_publish_returns_event():
    """publish 返回 Event 对象。"""
    bus = EventBus(session_id="test_ret")
    event = bus.publish("t", source="s", payload={"a": 1})

    assert isinstance(event, Event)
    assert event.topic == "t"
    assert event.event_id  # 非空
    assert event.timestamp  # 非空
    assert event.session_id == "test_ret"
