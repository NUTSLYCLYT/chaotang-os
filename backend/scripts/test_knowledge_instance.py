#!/usr/bin/env python3
"""
知识库双源测试实例
测试 IMA (腾讯ima) + 全网 (Jina Reader) 联合检索能力

运行：python3 scripts/test_knowledge_instance.py
"""
import asyncio, json, sys, httpx
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from mcp_servers.ima_server import _load_credentials, SKILL_VERSION

IMA_CLIENT_ID, IMA_API_KEY = _load_credentials()
IMA_HEADERS = {
    'ima-openapi-clientid': IMA_CLIENT_ID,
    'ima-openapi-apikey': IMA_API_KEY,
    'ima-openapi-ctx': f'skill_version={SKILL_VERSION}',
    'Content-Type': 'application/json',
}

QUERY = "低温电池 -40℃ LFP 储能 PACK"

print("=" * 60)
print(f"🔍 知识库双源测试")
print(f"查询：{QUERY}")
print("=" * 60)

async def test_ima(client: httpx.AsyncClient) -> dict:
    """测试 IMA 知识库检索"""
    print("\n📚 [源1] IMA 知识库")
    print(f"  API: {IMA_CLIENT_ID[:8]}...（凭证已配置）")

    # 列出笔记本
    r = await client.post(
        'https://ima.qq.com/openapi/note/v1/list_notebook',
        headers=IMA_HEADERS, json={'limit': 5}, timeout=8
    )
    d = r.json()
    notebooks = d.get('data', {}).get('note_folder_infos', [])
    print(f"  笔记本数量：{len(notebooks)}")

    # 搜索笔记
    r2 = await client.post(
        'https://ima.qq.com/openapi/note/v1/search_note_book',
        headers=IMA_HEADERS,
        json={'query': '低温电池', 'search_type': 1, 'limit': 5},
        timeout=8
    )
    d2 = r2.json()
    notes = d2.get('data', {}).get('notes', [])
    print(f"  笔记搜索「低温电池」：找到 {len(notes)} 条")

    # 搜索知识库
    r3 = await client.post(
        'https://ima.qq.com/openapi/wiki/v1/get_knowledge_list',
        headers=IMA_HEADERS, json={}, timeout=8
    )
    d3 = r3.json()
    kbs = d3.get('data', {}).get('knowledge_base_list', [])
    print(f"  知识库数量：{len(kbs)}")

    status = "✅ API 连通" if r.status_code == 200 else f"❌ 错误 {r.status_code}"
    print(f"  状态：{status}，账户当前为空（待灌入真实失效数据）")
    return {'connected': r.status_code == 200, 'notes': len(notes), 'kbs': len(kbs)}

async def test_web(client: httpx.AsyncClient) -> dict:
    """测试全网 Jina Reader 检索"""
    print("\n🌐 [源2] 全网检索（Jina Reader）")
    results = []
    urls = [
        ('亿纬锂能储能产品线', 'https://r.jina.ai/https://www.evebattery.com/products/energy-storage'),
        ('高工锂电-低温储能报道', 'https://r.jina.ai/https://www.gg-lb.com/asdisp2-89ba1b0d-6786-46bd-a7e3-fca1f9dbcc56-.html'),
        ('电池中国-低温技术', 'https://r.jina.ai/https://www.cbea.com/search/?q=低温电池+PACK'),
    ]
    for name, url in urls:
        try:
            r = await client.get(url, headers={'Accept': 'text/plain', 'X-Return-Format': 'markdown'}, timeout=10)
            content = r.text.strip()
            # 过滤 404/错误页
            if r.status_code == 200 and len(content) > 200 and '404' not in content[:100]:
                results.append({'source': name, 'content': content[:600], 'status': 'ok'})
                print(f"  ✅ {name}: 获取成功（{len(content)} 字符）")
                print(f"     预览: {content[:150].replace(chr(10), ' ')}...")
            else:
                print(f"  ⚠️ {name}: {r.status_code} 或内容不足")
        except Exception as e:
            print(f"  ❌ {name}: {type(e).__name__}")
    return {'fetched': len(results), 'results': results}

async def test_local_case_archive() -> dict:
    """测试本地案例库（公司历史运行结果）"""
    print("\n🗂️ [源3] 本地案例库（已审核高质量运行结果）")
    from pathlib import Path as P
    approved = P('cases/approved')
    cases = list(approved.glob('*.json')) if approved.exists() else []
    print(f"  已审核案例数：{len(cases)}")
    for c in cases[:2]:
        d = json.loads(c.read_text())
        print(f"  - {c.name}: {d.get('flow_name','?')} | 评分: {d.get('quality_score',{}).get('total_score','?')}")
    return {'case_count': len(cases)}

async def run_knowledge_test():
    async with httpx.AsyncClient() as client:
        ima_result = await test_ima(client)
        web_result = await test_web(client)
    case_result = await test_local_case_archive()

    print("\n" + "=" * 60)
    print("📊 测试汇总")
    print("=" * 60)
    print(f"IMA 知识库：{'✅ 连通' if ima_result['connected'] else '❌ 失败'} | 笔记: {ima_result['notes']} | 知识库: {ima_result['kbs']}")
    print(f"全网 Jina：抓取成功 {web_result['fetched']}/{3} 个页面")
    print(f"本地案例库：{case_result['case_count']} 条已审核案例")

    print("\n💡 建议行动：")
    if ima_result['kbs'] == 0:
        print("  1. IMA 库空 → 用 ima_add_url 导入公司低温电池资料（技术文档/测试报告）")
    if web_result['fetched'] < 2:
        print("  2. 配置 TAVILY_API_KEY → 解锁 web_search（支持关键词搜索，非仅 URL 抓取）")
    print("  3. 设置 EMBED_API_KEY → 升级本地 RAG 从假向量到真语义检索")

if __name__ == '__main__':
    asyncio.run(run_knowledge_test())
