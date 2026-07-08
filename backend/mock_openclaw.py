"""最小 Mock OpenClaw Gateway —— 仅用于本地验证 step_type: openclaw 的成功路径。
实现 OpenAI 兼容的 POST /v1/chat/completions，把收到的请求写入 /tmp/mock_openclaw.log，
返回一段含 done_signal(TASK_DONE) 的助手回复。用法: python3 mock_openclaw.py 18799
"""
import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 18799
LOG = "/tmp/mock_openclaw.log"


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(n).decode("utf-8") if n else ""
        try:
            req = json.loads(body) if body else {}
        except Exception:
            req = {}
        with open(LOG, "a", encoding="utf-8") as f:
            f.write("=== POST " + self.path + " ===\n")
            f.write("model=" + str(req.get("model")) + "\n")
            f.write("stream=" + str(req.get("stream")) + "\n")
            f.write("messages=" + json.dumps(req.get("messages"), ensure_ascii=False) + "\n")
        resp = {
            "id": "mock-openclaw-1",
            "object": "chat.completion",
            "model": req.get("model", "openclaw/test-agent"),
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": "【Mock OpenClaw】已收到任务并完成演示处理。\nTASK_DONE",
                    },
                    "finish_reason": "stop",
                }
            ],
        }
        data = json.dumps(resp).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    open(LOG, "w").close()
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
