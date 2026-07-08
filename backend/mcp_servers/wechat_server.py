#!/usr/bin/env python3
"""
微信/企微/Bark MCP 工具服务器
WECHAT_MODE=mock   → 打印日志，返回模拟成功（默认）
WECHAT_MODE=wecom  → 调企业微信 API（需配置 WECOM_CORP_ID / WECOM_SECRET）

"""
import json
import os
import sys
import logging
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [wechat_server] %(levelname)s %(message)s",
    handlers=[logging.StreamHandler(sys.stderr)],
)
logger = logging.getLogger(__name__)

WECHAT_MODE = os.environ.get("WECHAT_MODE", "mock")
BARK_KEY = os.environ.get("BARK_DEVICE_KEY", "")
BARK_SERVER = os.environ.get("BARK_SERVER", "https://api.day.app")


def handle_add_wechat_contact(params: dict) -> dict:
    phone = params.get("phone", "")
    greeting = params.get("greeting", "您好，我是贝特瑞的销售助手，刚才给您致电，这是产品资料。")
    remark = params.get("remark", "")

    if WECHAT_MODE == "mock":
        logger.info("[MOCK] 模拟添加微信好友: phone=%s greeting=%s", phone, greeting)
        return {
            "success": True,
            "mode": "mock",
            "message": f"[模拟] 已向 {phone} 发送好友申请，验证语：{greeting[:20]}...",
            "timestamp": datetime.now().isoformat(),
        }
    elif WECHAT_MODE == "wecom":
        # 真实企微 API（后期实现）
        # TODO: 调用企微外部联系人 API
        return {"success": False, "mode": "wecom", "message": "企微 API 尚未实现"}
    else:
        return {"success": False, "error": f"未知模式: {WECHAT_MODE}"}


def handle_send_wechat_message(params: dict) -> dict:
    wechat_id = params.get("wechat_id", "")
    content = params.get("content", "")
    msg_type = params.get("type", "text")

    if WECHAT_MODE == "mock":
        logger.info("[MOCK] 模拟发送微信消息: to=%s content=%s", wechat_id, content[:50])
        return {
            "success": True,
            "mode": "mock",
            "message": f"[模拟] 已向 {wechat_id} 发送消息",
            "timestamp": datetime.now().isoformat(),
        }
    else:
        return {"success": False, "error": f"模式 {WECHAT_MODE} 未实现"}


def main():
    logger.info("微信 MCP 服务启动，模式: %s", WECHAT_MODE)
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            tool_name = req.get("tool")
            params = req.get("params", {})
            call_id = req.get("id", "")

            if tool_name not in TOOL_HANDLERS:
                result = {"error": f"未知工具: {tool_name}"}
            else:
                result = TOOL_HANDLERS[tool_name](params)

            response = {"id": call_id, "result": result}
        except Exception as e:
            response = {"error": str(e)}

        sys.stdout.write(json.dumps(response, ensure_ascii=False) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
