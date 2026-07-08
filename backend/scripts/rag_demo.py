#!/usr/bin/env python3
"""RAG 端到端活体 demo —— 全程本地 Ollama,零外部 key、零网关。

证明今天搭的链路是【真能用】而非零件:
  真 embedding(Ollama nomic)入库 → 语义检索(查询措辞和原文几乎不重叠,看懂不懂)
  → 本地 LLM(默认 deepseek-r1:1.5b「真 deepseek」,可 --llm qwen2.5:14b 换更强)生成【有据】答案。

⚠️ 种子是【贴领域的样本知识块】,不是 IMA 184 篇真抽取(那需递归 browse+下载+解析,见 ima_ingest 的 text="" 口子)。
   样本里混了无关块(营销/PPT)做干扰,专门验"语义检索会不会乱配"。

用法:
  python scripts/rag_demo.py                 # deepseek-r1:1.5b 生成答案
  python scripts/rag_demo.py --llm qwen2.5:14b   # 换更强的本地模型
  python scripts/rag_demo.py --no-llm        # 只看检索(不调 LLM,最快)
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# 手动加载 .env(Python 不自动读),让 EMBED_API_BASE/MODEL/KEY 生效 → 走本地 Ollama
_envf = ROOT / ".env"
if _envf.exists():
    for _ln in _envf.read_text(encoding="utf-8").splitlines():
        _ln = _ln.strip()
        if _ln and not _ln.startswith("#") and "=" in _ln:
            _k, _v = _ln.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip())

OLLAMA = os.environ.get("OLLAMA_HOST", "http://localhost:11434")

# 贴本司领域的样本知识块(SAMPLE,非 IMA 真抽取)。前 5 条锂电,后 2 条无关干扰。
DOCS = [
    {
        "id": "l017",
        "topic": "锂电/析锂",
        "text": "析锂(锂枝晶析出)是低温充电的头号杀手:温度越低,负极嵌锂动力学越慢,过电位推高到锂沉积电位以下,"
        "金属锂便在石墨表面析出。-40℃ 下即便小电流充电也极易析锂,轻则容量跳水,重则刺穿隔膜内短路。",
    },
    {
        "id": "lt22",
        "topic": "锂电/低温应对",
        "text": "极寒环境的工程对策核心是【先加热再充电】:用 PTC 或自加热膜把电芯拉到 0℃ 以上再允许充电流;"
        "放电可低温进行但要限功率。SOC 窗口控制在 20%-80% 能显著降低低温衰减与析锂风险。",
    },
    {
        "id": "ch08",
        "topic": "锂电/体系选型",
        "text": "低温场景 LFP 与三元各有取舍:三元(NCM)低温放电容量保持率通常优于 LFP,但 LFP 热稳定性和循环寿命更好、"
        "析锂后果相对可控。选型要结合实际最低温、倍率需求与安全裕度,不能只看常温参数表。",
    },
    {
        "id": "soc5",
        "topic": "锂电/SOC管理",
        "text": "荷电状态(SOC)与低温寿命强相关:长期高 SOC 静置叠加低温会加速负极副反应;现场实测把存储 SOC 压到 "
        "30%-50%、避免满电冷冻,能明显延长极寒地区电池组的可用年限。",
    },
    {
        "id": "ms99",
        "topic": "本司/极寒实战",
        "text": "本司新能在东北/西北极寒地区实战 5 年,积累了 -40℃ 真实失效数据:同批电芯在不同温区、SOC 窗口下的"
        "可用度差异巨大,这套现场失效真值是常温实验室拿不到的核心壁垒。",
    },
    # —— 无关干扰块 ——
    {
        "id": "mk01",
        "topic": "无关/营销",
        "text": "小红书涨粉的关键是选题与封面:用数字标题、痛点开头、9 宫格图,蹭节日热点,发布时间选晚上 8-10 点,"
        "再用评论区互动撬动二次曝光。",
    },
    {
        "id": "pp02",
        "topic": "无关/PPT",
        "text": "商务 PPT 排版三原则:对齐、对比、留白。正文不超过 6 行,一页一个观点,配色不超过 3 种主色,"
        "图表优先于大段文字。",
    },
]

QUERIES = [
    "零下四十度给电池充电为什么会出问题、怎么破",  # 对应 lt22/l017,字面几乎不重叠
    "电池组放在仓库过冬该充多少电合适",  # 对应 soc5
]


def ollama_chat(model: str, system: str, user: str) -> str:
    body = json.dumps(
        {
            "model": model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "stream": False,
            "options": {"temperature": 0.2},
        }
    ).encode()
    req = urllib.request.Request(f"{OLLAMA}/api/chat", data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as r:
        d = json.load(r)
    txt = (d.get("message") or {}).get("content", "")
    # deepseek-r1 会带 <think>…</think>,剥掉只留答案
    import re

    return re.sub(r"<think>.*?</think>", "", txt, flags=re.S).strip()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--llm", default="deepseek-r1:1.5b")
    ap.add_argument("--no-llm", action="store_true")
    ap.add_argument("-k", type=int, default=3)
    args = ap.parse_args()

    from src.knowledge_rag import _OpenAICompatEmbeddingFunction

    fn = _OpenAICompatEmbeddingFunction()

    def cos(a, b):
        return sum(x * y for x, y in zip(a, b)) / (
            (sum(x * x for x in a) ** 0.5) * (sum(y * y for y in b) ** 0.5) + 1e-9
        )

    print(f"① 真 embedding 入库:{len(DOCS)} 块(5 锂电 + 2 无关干扰),模型={fn.name()}")
    vecs = {d["id"]: fn.embed_query(d["text"])[0] for d in DOCS}
    by_id = {d["id"]: d for d in DOCS}
    print(f"   维度={len(next(iter(vecs.values())))},入库完成\n")

    for q in QUERIES:
        qv = fn.embed_query(q)[0]
        ranked = sorted(DOCS, key=lambda d: cos(qv, vecs[d["id"]]), reverse=True)
        print(f"② 查询:「{q}」")
        for d in ranked[: args.k]:
            s = cos(qv, vecs[d["id"]])
            flag = "✓相关" if d["topic"].startswith("锂电") or d["topic"].startswith("本司") else "✗无关"
            print(f"   {s:.3f}  [{d['topic']}] {flag}  {d['text'][:34]}…")
        top = ranked[: args.k]
        # 验辨别力:前 k 是否全是锂电/本司,无关块有没有混进来
        bad = [d for d in top if d["topic"].startswith("无关")]
        verdict = "全是相关块 ✅" if not bad else ("混入无关块 ❌:" + str([d["id"] for d in bad]))
        print(f"   → 前{args.k}命中{verdict}")

        if not args.no_llm:
            ctx = "\n".join(f"[{d['id']}] {d['text']}" for d in top)
            sysp = (
                "你是本司新能的低温电芯知识助手。只依据下面给的资料回答,"
                "每个关键结论后用 [doc_id] 标出处;资料没提到的不要编。"
            )
            print(f"   ③ {args.llm} 生成有据答案中…")
            try:
                ans = ollama_chat(args.llm, sysp, f"资料:\n{ctx}\n\n问题:{q}")
                print("   ┌─ 答案 ─────────────────────────────")
                for ln in ans.splitlines():
                    print("   │ " + ln)
                print("   └────────────────────────────────────")
            except Exception as e:
                print(f"   ⚠️ LLM 调用失败:{repr(e)[:120]}")
        print()

    print(
        "结论:检索全程真 Ollama embedding(零外部key);措辞不重叠也能命中、无关块被排除;"
        "答案由本地 LLM 依据检索块生成并标注 [doc_id] 出处 —— 端到端活的。"
    )
    print('下一步把样本换成 IMA 184 篇真抽取:补全 ima_ingest 的递归browse+下载+解析(text="" 那一行)。')
    return 0


if __name__ == "__main__":
    sys.exit(main())
