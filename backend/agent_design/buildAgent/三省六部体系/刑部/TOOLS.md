# TOOLS.md — 刑部工具手册

## 审查标准
- Python: PEP 8
- Shell: shellcheck 规范
- YAML: 缩进 2 空格，无重复 key
- Dockerfile: 多阶段构建，最小镜像
- LiteLLM config: 参照官方 schema

## 审查命令
- Python 语法: `python3 -m py_compile [文件]`
- YAML 校验: `python3 -c "import yaml; yaml.safe_load(open('[文件]'))"`
- JSON 校验: `python3 -m json.tool [文件]`

## 审查输出格式
每个问题按：问题点 → 规范要求 → 修改建议 → 示例代码
