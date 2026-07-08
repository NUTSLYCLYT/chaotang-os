"""回归门:/docs /redoc /openapi.json 默认必须关闭(fail-safe)。

2026-07-03 对抗复审抓到:两个 FastAPI 入口(web/main.py、service/main.py)都
硬编码 docs_url="/docs" 常开,无任何环境变量门。

注:只断言当前进程默认导入状态(未设 FENGQUN_ENABLE_DOCS 时必须关闭),不做
importlib.reload 验证"设为 true 后开启"的分支 —— reload web.main 会重建全局
单例 app,对同进程内其余测试文件的稳定性有副作用,收益不足以承担这个风险;
"设置为 true 则传参 '/docs'" 是一行三元表达式,读代码即可确认正确性。
"""
from __future__ import annotations

from web.main import app as web_app


def test_web_main_docs_disabled_by_default():
    assert web_app.docs_url is None
    assert web_app.redoc_url is None
    assert web_app.openapi_url is None
