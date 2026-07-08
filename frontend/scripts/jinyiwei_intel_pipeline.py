#!/usr/bin/env python3
"""锦衣卫情报管线(方案甲增强 · 2026-06-21)
采集(Google News RSS) → 话题聚类交叉印证 → vet_intel 把关 → 入库/待核入表,拒挡门外。

可信度 SSOT:复用 ~/.claude/skills/锦衣卫/scripts/intel.py 的 vet_intel(不另造一份,守铁律2)。
边界(§13.2 #9 + 领域准入):情报=资讯,仅采集/核查/呈现公开新闻,不出买卖结论。
网络:curl 走环境代理(HTTPS_PROXY);Node fetch 不读代理故本管线用 curl。
写入:前端 intel_signals 表(.chaotang-main-dev.db),与 /intel 同库。
用法:python3 scripts/jinyiwei_intel_pipeline.py
"""

import sys, os, re, json, html, hashlib, sqlite3, subprocess
from email.utils import parsedate_to_datetime
from datetime import datetime, timezone

# —— 复用锦衣卫 skill 的 vet_intel(单一真相源)——
sys.path.insert(0, os.path.expanduser("~/.claude/skills/锦衣卫/scripts"))
import intel as jinyiwei  # noqa: E402  vet_intel / detect_change

# DB 目标可配(前提2的备选):默认 dev 库;生产挂 cron 时 export INTEL_DB_PATH 指向 prod 库,
# 一套管线 dev/prod 通吃,不硬编。
DB = os.environ.get("INTEL_DB_PATH") or os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", ".chaotang-main-dev.db"
)
# 默认主题(用户可在 scripts/jinyiwei_topics.json 里增删/开关 enabled 来"选")。
DEFAULT_TOPICS = [
    {"name": "国际形势", "query": "国际形势 地缘政治 中美关系 外交", "enabled": True},
    {"name": "科技前沿", "query": "科技前沿 前沿科技 重大突破", "enabled": True},
    {"name": "AI进展", "query": "人工智能 AI 大模型 突破 进展", "enabled": True},
    # 业务域(默认关,需要时改 enabled=true 即可监看):
    {"name": "储能产业", "query": "储能 电池 政策 价格", "enabled": False},
]


def load_topics() -> list[tuple[str, str]]:
    """主题可选:读 scripts/jinyiwei_topics.json(用户编辑 enabled 即选);无/坏则用默认。"""
    cfg = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "jinyiwei_topics.json"
    )
    topics = DEFAULT_TOPICS
    try:
        with open(cfg, encoding="utf-8") as f:
            loaded = json.load(f).get("topics")
            if isinstance(loaded, list) and loaded:
                topics = loaded
    except Exception:
        pass
    return [
        (t["name"], t["query"])
        for t in topics
        if t.get("enabled", True) and t.get("query")
    ]


FEEDS = load_topics()
PER_FEED = 8

# 一手源白名单:发布方/URL 命中即判 tier=一手(官方/标准/公告/交易所披露)。
# 诚实:只有真官方源升一手,媒体转载仍二手——不靠查询意图,只认实际来源。
FIRST_HAND_KW = (
    "gov.cn",
    "miit",
    "ndrc",
    "政府网",
    "工信部",
    "发改委",
    "国家能源局",
    "cnesa",
    "国家标准",
    "标准化",
    "全国标准",
    "巨潮",
    "cninfo",
    "证监会",
    "上交所",
    "深交所",
    "披露",
    "公告",
    "招标",
    "中国政府采购网",
    "采购网",
    # 通用官方/一手(国际/政策/科技域):官方媒体、部委、原始论文/官网。
    "新华",
    "人民网",
    "人民日报",
    "央视",
    "国务院",
    "外交部",
    "官方",
    "白皮书",
    "arxiv",
    "nature",
    "science",
)


def source_tier(name: str, url: str) -> str:
    blob = f"{name} {url}".lower()
    return "一手" if any(k.lower() in blob for k in FIRST_HAND_KW) else "二手"


JACCARD_THR = 0.4  # 标题字符集相似度 ≥ 此值 = 同一事件(交叉印证)


# 出口策略(前提1的备选):先试代理(dev/cron 本机代理),再试直连(prod 干净外网)。
# 任一返回含 <item> 即用 → 不死绑本机 127.0.0.1:8000,生产无代理也自愈。
PROXY = (
    os.environ.get("HTTPS_PROXY")
    or os.environ.get("https_proxy")
    or "http://127.0.0.1:8000"
)


def fetch_rss(q: str) -> str:
    base = [
        "curl",
        "-s",
        "--max-time",
        "20",
        "-G",
        "https://news.google.com/rss/search",
        "--data-urlencode",
        f"q={q}",
        "--data-urlencode",
        "hl=zh-CN",
        "--data-urlencode",
        "gl=CN",
        "--data-urlencode",
        "ceid=CN:zh-Hans",
    ]
    for egress in (["-x", PROXY], ["--noproxy", "*"]):
        try:
            r = subprocess.run(
                base[:2] + egress + base[2:],
                capture_output=True,
                text=True,
                timeout=35,
            )
            if r.stdout and "<item>" in r.stdout:
                return r.stdout
        except Exception:
            continue
    return ""


def clean(s: str) -> str:
    return html.unescape(re.sub(r"<!\[CDATA\[|\]\]>", "", s)).strip()


def parse(xml: str, tag: str):
    items = []
    for blk in xml.split("<item>")[1:]:
        seg = blk.split("</item>")[0]

        def pick(t):
            m = re.search(rf"<{t}[^>]*>(.*?)</{t}>", seg, re.S)
            return clean(m.group(1)) if m else ""

        rt, link, pub, src = (
            pick("title"),
            pick("link"),
            pick("pubDate"),
            pick("source"),
        )
        if not src and " - " in rt:
            src = rt.rsplit(" - ", 1)[1]
        title = rt.rsplit(" - ", 1)[0] if " - " in rt else rt
        if title and link:
            items.append(
                {
                    "title": title,
                    "link": link,
                    "pub": pub,
                    "src": src or "未知源",
                    "tag": tag,
                }
            )
    return items


def charset(t: str):
    return set(re.findall(r"[一-龥A-Za-z0-9]", t))


def jaccard(a: str, b: str) -> float:
    A, B = charset(a), charset(b)
    return len(A & B) / len(A | B) if (A | B) else 0.0


def cluster(items):
    clusters = []
    for it in items:
        for c in clusters:
            if jaccard(it["title"], c[0]["title"]) > JACCARD_THR:
                c.append(it)
                break
        else:
            clusters.append([it])
    return clusters


def classify(t: str):
    if re.search(
        r"下滑|亏损|事故|起火|召回|处罚|风险|预警|减产|停产|违规|诉讼|反垄断|暴跌|爆雷",
        t,
    ):
        return "risk", "warning", 72
    if re.search(
        r"中标|增长|突破|新高|利好|签约|投产|扩产|订单|补贴|获批|领先|量产", t
    ):
        return "opportunity", "watch", 58
    return "neutral", "info", 42


def iso(p: str) -> str:
    try:
        return parsedate_to_datetime(p).astimezone(timezone.utc).isoformat()
    except Exception:
        return datetime.now(timezone.utc).isoformat()


def run():
    items = []
    for tag, q in FEEDS:
        items += parse(fetch_rss(q), tag)[:PER_FEED]

    # fail-secure(铁律):采集为 0(网络/代理/限频)时,绝不清表——保留现有数据,
    # 不让"采集失败"退化成"清空真情报、退回 mock"。宁可不更新,不丢真数据。
    if not items:
        # 心跳/空转告警(天才建议):不静默——累加 empty_streak,留 last_success_at 不动。
        # 连续空转 = 代理挂/被限频的可观测信号,前端/运维可据此告警(治"定时任务悄悄失效")。
        fpath = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "..",
            "public",
            "intel-funnel.json",
        )
        prev = {}
        try:
            with open(fpath, encoding="utf-8") as f:
                prev = json.load(f)
        except Exception:
            pass
        prev["stale"] = True
        prev["empty_streak"] = int(prev.get("empty_streak", 0)) + 1
        prev["updatedAt"] = datetime.now(timezone.utc).isoformat()
        try:
            os.makedirs(os.path.dirname(fpath), exist_ok=True)
            with open(fpath, "w", encoding="utf-8") as f:
                json.dump(prev, f, ensure_ascii=False)
        except Exception:
            pass
        print(
            f"采集 0 条 fail-secure:保留数据、不清表。⚠️ 连续空转 {prev['empty_streak']} 次"
            f"(代理/限频?last_success={prev.get('last_success_at', '未知')})"
        )
        return {"入库": 0, "待核": 0, "拒": 0}, 0

    clusters = cluster(items)
    con = sqlite3.connect(DB, timeout=15)
    cur = con.cursor()
    # 仅在采集成功后才清旧(早先生采 + 本管线),避免 vetted 与 un-vetted 混库
    cur.execute(
        "DELETE FROM intel_signals WHERE id LIKE 'intel_live_%' OR id LIKE 'intel_vet_%'"
    )

    stats = {"入库": 0, "待核": 0, "拒": 0}
    records: list[dict] = []
    for c in clusters:
        rep = max(c, key=lambda x: len(x["title"]))
        # 按真实发布方判 tier(官方/公告/标准/招标=一手),交 vet 把关;媒体仍二手。
        seen: dict[str, dict] = {}
        for x in c:
            if x["src"] not in seen:
                seen[x["src"]] = {
                    "name": x["src"],
                    "tier": source_tier(x["src"], x["link"]),
                }
        srcs = list(seen.values())
        v = jinyiwei.vet_intel(rep["title"], srcs)
        d = v["decision"]
        stats[d] = stats.get(d, 0) + 1
        if d == "拒":
            continue  # 脏情报挡门,不入史馆
        cat, lvl, imp = classify(rep["title"])
        if d == "待核":
            lvl, imp = "info", max(imp - 15, 20)  # 待核降级,不充当已核实
        n = v["distinct_sources"]
        sid = "intel_vet_" + hashlib.sha1(rep["link"].encode()).hexdigest()[:16]
        sources = [
            {"name": x["src"], "url": x["link"], "publishedAt": iso(x["pub"])}
            for x in c
        ]
        # 待核主动补证钩子:不做死标签,明示"补什么就能入库",让锦衣卫从门神变将军(派探子补证)。
        if d == "待核":
            action = (
                "需一手来源(官方/公告/招标)或人工核实(含认证/数字硬声明)"
                if v["hard_claim"]
                else "补 1 个独立来源即可入库(加派探子核同一事件)"
            )
            summary = f"【待核·{rep['tag']}·{n}源】补证待办:{action} — {v['reason']}"
        else:
            basis = "一手直采" if v["primary"] else f"{n}源印证"
            summary = f"【入库·{rep['tag']}·{basis}】{v['reason']}"
        records.append(
            {
                "id": sid,
                "title": rep["title"],
                "summary": summary,
                "cat": cat,
                "lvl": lvl,
                "imp": imp,
                "sources": sources,
                "created": iso(rep["pub"]),
            }
        )

    # 异动雷达(skill 另一半):对比上轮快照 → 新增/突变。情报=预警,delta 比快照值十倍。
    snap_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public")
    snap_path = os.path.join(snap_dir, ".intel-prev-snapshot.json")
    try:
        with open(snap_path, encoding="utf-8") as f:
            prev = json.load(f)
    except Exception:
        prev = []
    curr = [{"key": r["title"], "value": r["imp"]} for r in records]
    delta = jinyiwei.detect_change(prev, curr, value_thr=15)
    new_set = set(delta.get("新增", []))

    for r in records:
        summ, imp2 = r["summary"], r["imp"]
        if r["title"] in new_set:
            summ = "🆕异动·新增 " + summ
            imp2 = min(imp2 + 10, 99)  # 新增异动提权,雷达可见
        cur.execute(
            """INSERT OR REPLACE INTO intel_signals
                 (id,title,summary,category,level,region,impact_score,sources_json,created_at)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (
                r["id"],
                r["title"],
                summ,
                r["cat"],
                r["lvl"],
                "CN",
                imp2,
                json.dumps(r["sources"], ensure_ascii=False),
                r["created"],
            ),
        )
    con.commit()
    admitted = len(records)
    con.close()
    try:
        os.makedirs(snap_dir, exist_ok=True)
        with open(snap_path, "w", encoding="utf-8") as f:
            json.dump(curr, f, ensure_ascii=False)
    except Exception:
        pass

    # 漏斗仪表(会审天才建议):把"采/拦/待核/入库"持久化,让"把关在工作"可见——
    # 拦截率是信任凭证,用户信的不是"采得多",是"帮我挡掉了多少不可信的"。
    funnel = {
        "fetched": len(items),
        "events": len(clusters),
        "admitted": stats.get("入库", 0),
        "pending": stats.get("待核", 0),
        "rejected": stats.get("拒", 0),
        "intercept_rate": (
            round(stats.get("拒", 0) / len(clusters), 3) if clusters else 0
        ),
        "new": len(delta.get("新增", [])),
        "gone": len(delta.get("消失", [])),
        "surge": len(delta.get("突变", [])),
        "stale": False,
        "empty_streak": 0,
        "last_success_at": datetime.now(timezone.utc).isoformat(),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    public_dir = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "..", "public"
    )
    try:
        os.makedirs(public_dir, exist_ok=True)
        with open(
            os.path.join(public_dir, "intel-funnel.json"), "w", encoding="utf-8"
        ) as f:
            json.dump(funnel, f, ensure_ascii=False)
    except Exception as e:  # 持久化失败不影响入库
        print("漏斗持久化失败(非致命):", e)

    print(
        f"采集 {len(items)} 条 → 聚类 {len(clusters)} 事件 → 判决 {stats} "
        f"→ 入表 {admitted} · 拦截率 {funnel['intercept_rate']} "
        f"· 异动[新增{funnel['new']}/消失{funnel['gone']}/突变{funnel['surge']}]"
    )
    return stats, admitted


if __name__ == "__main__":
    run()
