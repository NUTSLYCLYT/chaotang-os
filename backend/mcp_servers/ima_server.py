#!/usr/bin/env python3
"""IMA MCP Server — 接入腾讯 ima 笔记 + 知识库 OpenAPI。

凭证加载优先级：环境变量 > ~/.config/ima/ 配置文件

工具：
  ── 笔记（notes，可读正文，团队 RAG 主路径） ──
  - ima_search_notes         按标题/正文搜索笔记
  - ima_get_note_content     读取指定笔记的纯文本正文
  - ima_list_notebooks       列出所有笔记本（含「全部笔记」根目录）
  ── 知识库（wiki，文件管理为主，无法直接读 PDF/docx 正文） ──
  - ima_search_knowledge     在指定知识库中按文件名/标签搜索
  - ima_list_knowledge_bases 列出用户有权访问的知识库
  - ima_browse_knowledge     浏览知识库目录内容
  - ima_get_media_info       获取知识库文件的带签名下载 URL（用于离线解析正文）
  - ima_add_url              添加网页/微信文章到知识库
"""
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from mcp_servers.base_server import BaseServer

IMA_BASE_URL = "https://ima.qq.com"
SKILL_VERSION = "1.1.7"


def _load_credentials() -> tuple[str, str]:
    client_id = os.environ.get("IMA_OPENAPI_CLIENTID", "")
    api_key = os.environ.get("IMA_OPENAPI_APIKEY", "")
    if not client_id:
        try:
            client_id = Path("~/.config/ima/client_id").expanduser().read_text().strip()
        except FileNotFoundError:
            pass
    if not api_key:
        try:
            api_key = Path("~/.config/ima/api_key").expanduser().read_text().strip()
        except FileNotFoundError:
            pass
    return client_id, api_key


def _ima_post(path: str, body: dict) -> dict:
    import urllib.request

    client_id, api_key = _load_credentials()
    if not client_id or not api_key:
        return {"error": "缺少 IMA 凭证，请配置 IMA_OPENAPI_CLIENTID 和 IMA_OPENAPI_APIKEY"}

    url = f"{IMA_BASE_URL}/{path}"
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "ima-openapi-clientid": client_id,
            "ima-openapi-apikey": api_key,
            "ima-openapi-ctx": f"skill_version={SKILL_VERSION}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return {"error": str(e)}

    # 实际 API 用 code/msg 而非文档里的 retcode/errmsg
    code = result.get("code", result.get("retcode", -1))
    if code != 0:
        msg = result.get("msg", result.get("errmsg", "未知错误"))
        return {"error": msg, "retcode": code}
    return result.get("data", {})


class IMAServer(BaseServer):
    def __init__(self):
        super().__init__(name="ima", version="1.0")

    def register_tools(self):
        self.add_tool(
            "ima_search_knowledge",
            "在 IMA 知识库中语义搜索，返回相关文档标题和高亮片段",
            {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "搜索关键词或问题"},
                    "knowledge_base_id": {
                        "type": "string",
                        "description": "知识库 ID（不知道时先调用 ima_list_knowledge_bases）",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "最多返回条数（默认10）",
                        "default": 10,
                    },
                },
                "required": ["query", "knowledge_base_id"],
            },
            self.search_knowledge,
        )
        self.add_tool(
            "ima_list_knowledge_bases",
            "列出用户在 IMA 中有权访问的知识库（返回 ID 和名称）",
            {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "按名称过滤（空字符串返回全部）",
                        "default": "",
                    },
                },
                "required": [],
            },
            self.list_knowledge_bases,
        )
        self.add_tool(
            "ima_browse_knowledge",
            "浏览 IMA 知识库目录，列出文件和文件夹",
            {
                "type": "object",
                "properties": {
                    "knowledge_base_id": {"type": "string", "description": "知识库 ID"},
                    "folder_id": {
                        "type": "string",
                        "description": "文件夹 ID（省略则浏览根目录）",
                    },
                    "limit": {"type": "integer", "description": "每页条数（1-50）", "default": 20},
                },
                "required": ["knowledge_base_id"],
            },
            self.browse_knowledge,
        )
        self.add_tool(
            "ima_add_url",
            "将网页或微信公众号文章添加到 IMA 知识库",
            {
                "type": "object",
                "properties": {
                    "urls": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "URL 列表（1-10 个）",
                    },
                    "knowledge_base_id": {"type": "string", "description": "目标知识库 ID"},
                },
                "required": ["urls", "knowledge_base_id"],
            },
            self.add_url,
        )
        # ── notes 工具（团队 RAG 主路径：能直接读笔记正文）──
        self.add_tool(
            "ima_search_notes",
            "搜索 IMA 笔记，返回标题/摘要/doc_id；按 doc_id 调 ima_get_note_content 读全文",
            {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "搜索关键词"},
                    "search_type": {
                        "type": "integer",
                        "description": "0=按标题搜（默认）, 1=按正文全文搜",
                        "default": 0,
                    },
                    "limit": {
                        "type": "integer",
                        "description": "最多返回条数（默认 10）",
                        "default": 10,
                    },
                },
                "required": ["query"],
            },
            self.search_notes,
        )
        self.add_tool(
            "ima_get_note_content",
            "读取指定笔记的完整正文（纯文本），doc_id 来自 ima_search_notes 或 ima_list_notebooks",
            {
                "type": "object",
                "properties": {
                    "doc_id": {"type": "string", "description": "笔记 doc_id"},
                },
                "required": ["doc_id"],
            },
            self.get_note_content,
        )
        self.add_tool(
            "ima_list_notebooks",
            "列出所有 IMA 笔记本（folder），返回 folder_id + 名称",
            {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "数量上限（默认 20）",
                        "default": 20,
                    },
                },
                "required": [],
            },
            self.list_notebooks,
        )
        # ── 知识库文件下载（用于离线解析 PDF/docx 正文）──
        self.add_tool(
            "ima_get_media_info",
            "获取知识库文件的下载 URL（含签名 header）。返回的 URL 5 分钟内有效，需立即下载",
            {
                "type": "object",
                "properties": {
                    "media_id": {
                        "type": "string",
                        "description": "知识库文件 media_id（来自 ima_search_knowledge / ima_browse_knowledge）",
                    },
                },
                "required": ["media_id"],
            },
            self.get_media_info,
        )

    def search_knowledge(self, query: str, knowledge_base_id: str, limit: int = 10) -> dict:
        results = []
        cursor = ""
        while len(results) < limit:
            data = _ima_post(
                "openapi/wiki/v1/search_knowledge",
                {"query": query, "knowledge_base_id": knowledge_base_id, "cursor": cursor},
            )
            if "error" in data:
                return data
            for item in data.get("info_list", []):
                results.append(
                    {
                        "title": item.get("title", ""),
                        "highlight": item.get("highlight_content", ""),
                        "media_id": item.get("media_id", ""),
                    }
                )
            if data.get("is_end", True) or len(results) >= limit:
                break
            cursor = data.get("next_cursor", "")

        return {
            "status": "ok",
            "count": len(results),
            "query": query,
            "results": results[:limit],
        }

    def list_knowledge_bases(self, query: str = "") -> dict:
        data = _ima_post(
            "openapi/wiki/v1/search_knowledge_base",
            {"query": query, "cursor": "", "limit": 20},
        )
        if "error" in data:
            return data
        bases = [
            {
                "id": item.get("kb_id", item.get("id", "")),
                "name": item.get("kb_name", item.get("name", "")),
                "description": item.get("description", ""),
                "content_count": item.get("content_count", ""),
            }
            for item in data.get("info_list", [])
        ]
        return {"status": "ok", "count": len(bases), "knowledge_bases": bases}

    def browse_knowledge(
        self, knowledge_base_id: str, folder_id: str = "", limit: int = 20
    ) -> dict:
        body: dict = {"knowledge_base_id": knowledge_base_id, "cursor": "", "limit": limit}
        if folder_id:
            body["folder_id"] = folder_id
        data = _ima_post("openapi/wiki/v1/get_knowledge_list", body)
        if "error" in data:
            return data
        items = []
        for item in data.get("knowledge_list", []):
            if "folder_id" in item:
                items.append(
                    {
                        "type": "folder",
                        "name": item.get("name"),
                        "folder_id": item.get("folder_id"),
                        "file_count": item.get("file_number", 0),
                    }
                )
            else:
                items.append(
                    {
                        "type": "file",
                        "title": item.get("title"),
                        "media_id": item.get("media_id"),
                    }
                )
        return {
            "status": "ok",
            "count": len(items),
            "is_end": data.get("is_end", True),
            "items": items,
        }

    def add_url(self, urls: list, knowledge_base_id: str) -> dict:
        data = _ima_post(
            "openapi/wiki/v1/import_urls",
            {
                "knowledge_base_id": knowledge_base_id,
                "folder_id": knowledge_base_id,
                "urls": urls[:10],
            },
        )
        if "error" in data:
            return data
        results = data.get("results", {})
        successes = [u for u, r in results.items() if r.get("ret_code") == 0]
        failures = [u for u, r in results.items() if r.get("ret_code") != 0]
        return {
            "status": "ok",
            "success_count": len(successes),
            "fail_count": len(failures),
            "failures": failures,
        }

    # ── notes 工具实现 ──────────────────────────────────────────

    def search_notes(self, query: str, search_type: int = 0, limit: int = 10) -> dict:
        # search_type: 0=标题, 1=正文
        body = {
            "search_type": search_type,
            "query_info": {"title": query} if search_type == 0 else {"content": query},
            "start": 0,
            "end": max(1, min(limit, 50)),
        }
        data = _ima_post("openapi/note/v1/search_note_book", body)
        if "error" in data:
            return data
        results = []
        for item in data.get("docs", []):
            basic = (item.get("doc") or {}).get("basic_info", {})
            results.append({
                "doc_id": basic.get("docid", ""),
                "title": basic.get("title", ""),
                "summary": basic.get("summary", "")[:200],
                "folder_name": basic.get("folder_name", ""),
                "modify_time": basic.get("modify_time", ""),
            })
        return {
            "status": "ok",
            "count": len(results),
            "total_hit": data.get("total_hit_num", "0"),
            "results": results,
        }

    def get_note_content(self, doc_id: str) -> dict:
        data = _ima_post(
            "openapi/note/v1/get_doc_content",
            {"doc_id": doc_id, "target_content_format": 0},  # 0=纯文本
        )
        if "error" in data:
            return data
        return {
            "status": "ok",
            "doc_id": doc_id,
            "content": data.get("content", ""),
            "char_count": len(data.get("content", "")),
        }

    def list_notebooks(self, limit: int = 20) -> dict:
        data = _ima_post(
            "openapi/note/v1/list_notebook",
            {"cursor": "0", "limit": max(1, min(limit, 50))},
        )
        if "error" in data:
            return data
        # 兼容字段名（文档/实测可能不一致）
        folders = (
            data.get("note_book_folders")
            or data.get("note_folder_infos")
            or []
        )
        items = [
            {
                "folder_id": f.get("folder_id") or f.get("notebook_id", ""),
                "name": f.get("name") or f.get("notebook_name", ""),
                "note_count": f.get("note_count", f.get("doc_count", 0)),
            }
            for f in folders
        ]
        return {
            "status": "ok",
            "count": len(items),
            "is_end": data.get("is_end", True),
            "notebooks": items,
        }

    # ── 知识库文件下载（拿带签名 URL）────────────────────────────

    def get_media_info(self, media_id: str) -> dict:
        data = _ima_post("openapi/wiki/v1/get_media_info", {"media_id": media_id})
        if "error" in data:
            return data
        url_info = data.get("url_info") or {}
        return {
            "status": "ok",
            "media_type": data.get("media_type"),
            "url": url_info.get("url", ""),
            "headers": url_info.get("headers", {}),
            "notebook_id": (data.get("notebook_ext_info") or {}).get("notebook_id", ""),
        }


if __name__ == "__main__":
    IMAServer().run()
