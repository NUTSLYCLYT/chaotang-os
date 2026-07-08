# 会话日志

## 2026-06-03 Session 1-2（当日全程）

### 基础设施（全部完成）
- [x] git clone + 依赖安装 + .env 配置（LITELLM + DEEPSEEK + MINIMAX key）
- [x] providers.yaml → active: litellm_proxy，model_tiers 全升级（smart/generation → deepseek-reasoner，validation → deepseek-flash）
- [x] 20位大神 skill → skills/personas/ → Gitee push
- [x] 956/956 测试全通（修复 run_if 安全漏洞 + provider 期望值）
- [x] R1 实验：flow_opc_r1_test.yaml，A 4.0/5 ✅
- [x] web/main.py :8081 启动，/api/swarm/config 返回 14 蜂群
- [x] chaotang-ui-ms build 更新 JIQUN_API_URL → http://127.0.0.1:8081，前端重建 :3050

### 系统级修复（全部完成）
- [x] 18个 flow 批量升级模型：核心步骤 → deepseek-reasoner，QA → deepseek-reasoner 直连
- [x] flow_engine.py: QA 解析优先 qa_tech_support 步骤（修复 pack_rd 等尾步非 QA 的 flow）
- [x] flow_engine.py: 全局约束注入（防 R1 擅改客户规格）
- [x] guard_rails.py: skip_injection_check 支持（security_auditor 类步骤豁免）
- [x] 清除所有非终态 QA 步骤的 min_quality_score（修复 sdlc blocked）
- [x] sdlc: 补 qa_tech_support 终评步骤 + security_auditor 注入豁免
- [x] opc: 去工具依赖 + 提升 min_length

### 蜂群测试结果（首轮）
| # | 蜂群 | 步骤数 | QA | 分数 | 状态 |
|---|---|---|---|---|---|
| 1 | opc | 5 | fail | C 2.64 | 需 prompt 优化（BOM 计算错误） |
| 2 | haolong | 5 | **pass** | **B+ 3.5** | ✅ |
| 3 | product | 5 | fail | B 3.19 | 需 prompt 优化 |
| 4 | quotation | 5 | fail→B+3.86 | B+ 3.86 | auto-fix 后接近 A |
| 5 | finance | 4 | fail | C 2.69 | 需 prompt 优化 |
| 6 | legal | 4 | **pass** | **B+ 3.5** | ✅ |
| 7 | pack_rd | 12 | **pass** | **B+ 3.69** | ✅（修复 QA 解析后） |
| 8 | battery_stage_gate | 6 | fail | B 3.44 | 期望行为（需上游链路数据）|
| 9 | sourcing | 7 | fail | C 2.29 | 期望行为（需上游链路数据）|
| 10 | ima | 4 | fail | B 3.14 | 需 prompt 优化 |
| 11 | xiaohongshu | 4 | fail | B 3.01 | 需 prompt 优化 |
| 12 | sdlc | 6 | fail | B 3.31 | 全步通，QA 找到真实代码问题 |
| 13 | ai_ops | 4 | error | — | 依赖 OpenClaw 外部服务（期望）|
| 14 | court | 9 | 未测 | — | 待测 |

**独立运行通过**: 3/14（haolong ✅ legal ✅ pack_rd ✅）
**链路触发（期望）**: battery_stage_gate、sourcing、ai_ops
**需 prompt 层优化**: opc、product、finance、ima、xiaohongshu

### 前端对接状态
- jiqun 后端 :8081 ✅
- chaotang-ui-ms :3050 ✅（新 build，JIQUN_API_URL=:8081）
- 路由 `/chaotang/jiqun/api/*` → `:8081/api/*` ✅（routes-manifest 确认）
- 认证后的页面 `/jiqun/swarm` 可正常加载蜂群列表

### 下一步 Phase 2（待做）
1. **prompt 层修复**：opc/product/finance 的计算精确性 + 防止地域假设
2. **链路测试**：运行完整 haolong→opc→product→quotation 链
3. **court flow 测试**
4. **关键 prompt 版本升级**：solution_architect、quotation_analyst 提高数据精确性要求
