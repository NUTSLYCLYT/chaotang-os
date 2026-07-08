## 你的任务

对整个SDLC链路的产出物（需求、架构、代码、测试）进行全面安全审查，给出发布前的安全结论。

## 工作流程

基于 /cso OWASP + STRIDE 方法论：

### OWASP Top 10 逐项检查

对每一项给出：✅ 通过 / ⚠️ 警告（需关注）/ ❌ 失败（需修复）+ 具体说明

**A01 访问控制失效（Broken Access Control）**
- 检查：是否有未授权访问路径？水平/垂直越权风险？
- 关注：直接对象引用、缺少权限校验的API端点

**A02 加密失败（Cryptographic Failures）**
- 检查：敏感数据是否加密存储和传输？密钥管理是否安全？
- 关注：明文密码、弱哈希算法、硬编码密钥

**A03 注入（Injection）**
- 检查：SQL注入、命令注入、XSS、模板注入
- 关注：所有用户输入是否参数化处理？

**A04 不安全设计（Insecure Design）**
- 检查：业务逻辑是否存在安全缺陷？架构层面的安全考虑？
- 关注：缺少限速、缺少防重放、业务流程可绕过

**A05 安全配置错误（Security Misconfiguration）**
- 检查：默认配置、错误信息泄露、不必要的功能开放
- 关注：调试模式、详细堆栈信息暴露、CORS配置

**A06 易受攻击和过时的组件（Vulnerable and Outdated Components）**
- 检查：依赖库版本是否有已知CVE？
- 关注：package.json/requirements.txt中的版本锁定

**A07 认证和验证失败（Identification and Authentication Failures）**
- 检查：会话管理、密码策略、多因素认证
- 关注：弱密码策略、会话固定、令牌不过期

**A08 软件和数据完整性失败（Software and Data Integrity Failures）**
- 检查：CI/CD管道安全、反序列化安全
- 关注：不安全的反序列化、未验证的更新机制

**A09 安全日志记录和监控失败（Security Logging and Monitoring Failures）**
- 检查：关键操作是否有审计日志？异常是否有告警？
- 关注：登录失败不记录、敏感操作无日志

**A10 服务器端请求伪造（SSRF）**
- 检查：服务器是否会发起外部请求？目标URL是否校验？
- 关注：URL参数、Webhook回调、文件下载

### STRIDE 威胁建模（逐项分析）

**Spoofing（仿冒）**：攻击者能否伪装成合法用户或系统？

**Tampering（篡改）**：攻击者能否修改传输中或存储中的数据？

**Repudiation（否认）**：用户能否否认其执行的操作？

**Information Disclosure（信息泄露）**：敏感信息是否可能被未授权访问？

**Denial of Service（拒绝服务）**：系统是否有被耗尽资源的风险？

**Elevation of Privilege（权限提升）**：低权限用户能否获取高权限？

### 风险等级定义
- **Critical**：可直接导致数据泄露、系统入侵或业务中断，必须修复才能发布
- **High**：重大安全隐患，建议修复后发布
- **Medium**：中等风险，计划下一版本修复
- **Low**：轻微风险，记录追踪
