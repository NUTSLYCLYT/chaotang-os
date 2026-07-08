#!/usr/bin/env python3
"""锦衣卫情报管线 · 回归断言(铁律4:把"不该发生的事"钉成测试,别靠"按构造正确")。

跑:python3 scripts/jinyiwei_intel_pipeline.test.py   (无需网络/pytest,自带退出码)
钉死的红线:
  ① 采集 0 条时绝不清空 intel_signals(fail-secure,治"采集失败退回 mock")
  ② vet 门神:一手→入库、单源二手→非入库(脏情报挡门)
  ③ source_tier 只认真官方源升一手;classify/cluster 确定性正确
"""

import importlib.util
import json
import os
import sqlite3
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
FUNNEL = os.path.join(HERE, "..", "public", "intel-funnel.json")

failures: list[str] = []


def check(name: str, cond: bool) -> None:
    print(("  ✓ " if cond else "  ✗ ") + name)
    if not cond:
        failures.append(name)


def load_pipeline(db_path: str):
    os.environ["INTEL_DB_PATH"] = db_path
    spec = importlib.util.spec_from_file_location(
        "jp", os.path.join(HERE, "jinyiwei_intel_pipeline.py")
    )
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def make_table(db_path: str) -> None:
    con = sqlite3.connect(db_path)
    con.execute("""CREATE TABLE IF NOT EXISTS intel_signals(
            id TEXT PRIMARY KEY, title TEXT, summary TEXT, category TEXT,
            level TEXT, region TEXT, impact_score INTEGER, sources_json TEXT,
            created_at TEXT)""")
    con.commit()
    con.close()


def main() -> int:
    tmp = tempfile.mkdtemp()
    db = os.path.join(tmp, "t.db")
    make_table(db)
    jp = load_pipeline(db)

    print("source_tier(只认真官方源升一手):")
    check("gov.cn → 一手", jp.source_tier("中国政府网", "http://x.gov.cn") == "一手")
    check("新华网 → 一手", jp.source_tier("新华网", "") == "一手")
    check(
        "新浪财经 → 二手(媒体不冒一手)",
        jp.source_tier("新浪财经", "http://sina.com") == "二手",
    )

    print("classify(确定性):")
    check("暴跌 → risk", jp.classify("碳酸锂价格暴跌")[0] == "risk")
    check("扩产 → opportunity", jp.classify("某厂投产扩产")[0] == "opportunity")
    check("例会 → neutral", jp.classify("行业例行会议召开")[0] == "neutral")

    print("cluster(同事件聚合、不相关分开):")
    items = [
        {
            "title": "碳酸锂价格上涨至25万",
            "src": "A",
            "link": "1",
            "pub": "",
            "tag": "t",
        },
        {
            "title": "碳酸锂价格上涨至25万元每吨",
            "src": "B",
            "link": "2",
            "pub": "",
            "tag": "t",
        },
        {
            "title": "完全无关的国际外交领域新闻",
            "src": "C",
            "link": "3",
            "pub": "",
            "tag": "t",
        },
    ]
    check("相似合并、不相关分开 → 2 簇", len(jp.cluster(items)) == 2)

    print("vet 门神(skill SSOT):")
    check(
        "一手 → 入库",
        jp.jinyiwei.vet_intel("某标准发布", [{"name": "cnesa", "tier": "一手"}])[
            "decision"
        ]
        == "入库",
    )
    check(
        "单源二手 → 非入库",
        jp.jinyiwei.vet_intel("某媒体新闻", ["新浪财经"])["decision"] != "入库",
    )

    print("fail-secure 红线(采集0条绝不清表):")
    con = sqlite3.connect(db)
    con.execute(
        "INSERT INTO intel_signals(id,title,created_at) VALUES('intel_vet_keep','真情报','2026-01-01')"
    )
    con.commit()
    con.close()
    backup = None
    if os.path.exists(FUNNEL):
        backup = open(FUNNEL, encoding="utf-8").read()
    jp.fetch_rss = lambda q: ""  # 模拟采集全失败
    jp.run()
    n = (
        sqlite3.connect(db)
        .execute("SELECT COUNT(*) FROM intel_signals WHERE id='intel_vet_keep'")
        .fetchone()[0]
    )
    check("采集0条后,既有真情报仍在(未被清空)", n == 1)
    streak = json.load(open(FUNNEL, encoding="utf-8")).get("empty_streak", 0)
    check("空转后 empty_streak 递增(心跳告警有数据)", streak >= 1)
    if backup is not None:  # 还原真 funnel,别污染开发态
        open(FUNNEL, "w", encoding="utf-8").write(backup)

    print()
    if failures:
        print(f"✗ {len(failures)} 条断言失败: {failures}")
        return 1
    print("✓ 全部回归断言通过")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
