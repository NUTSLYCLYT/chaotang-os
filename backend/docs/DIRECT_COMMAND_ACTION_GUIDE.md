# 密旨直通车 - 上线行动指南 v1.0

**日期**: 2026-06-05  
**目标**: 立即开始，收集数据，持续优化

---

## 一、大神说：不要想太多，先跑起来！

> "很多团队花几个月准备一个AI系统，结果上线后发现用户不买单。密旨直通车测试集已经100%准确率，具备试点上线条件。先上线1周，收集真实反馈，比你想象100种边界情况有用100倍。"

---

## 二、立即行动（今天）

### 2.1 启动服务

```bash
# 在服务器上执行
cd /path/to/jiqun_ai

# 启动服务
python -m uvicorn web.main:app --host 0.0.0.0 --port 8081 --workers 4

# 或者使用nohup后台运行
nohup python -m uvicorn web.main:app --host 0.0.0.0 --port 8081 > /var/log/direct_command.log 2>&1 &
```

### 2.2 验证服务

```bash
# 健康检查
curl http://localhost:8081/api/direct/health

# 测试路由
curl "http://localhost:8081/api/direct/explain?command=分析客户线索"
```

### 2.3 配置反向代理（Nginx）

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location /api/direct {
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 三、第一周计划

### Day 1-2: 内部试点
- [ ] 选择5-10个内部用户
- [ ] 分配测试账号
- [ ] 收集使用反馈

### Day 3-4: 问题修复
- [ ] 统计路由错误率
- [ ] 修复高频错误
- [ ] 优化关键词

### Day 5-7: 扩大试点
- [ ] 扩大到20-50用户
- [ ] 建立反馈渠道
- [ ] 开始积累数据

---

## 四、核心用户操作指南

### 4.1 发送命令

```bash
curl -X POST http://localhost:8081/api/direct/execute \
  -H "Content-Type: application/json" \
  -d "{\"command\": \"分析今天的客户线索\"}"
```

### 4.2 查看路由解释

```bash
curl "http://localhost:8081/api/direct/explain?command=分析客户线索"
```

### 4.3 提交反馈

```bash
curl -X POST http://localhost:8081/api/direct/feedback \
  -H "Content-Type: application/json" \
  -d "{\"task_id\": \"xxx\", \"command\": \"分析客户线索\", \"mode\": \"swarm\", \"target\": \"haolong\", \"rating\": \"good\"}"
```

### 4.4 查看监控

```bash
# Prometheus指标
curl http://localhost:8081/api/direct/metrics

# 统计信息
curl http://localhost:8081/api/direct/stats
```

---

## 五、每日必看指标

### 5.1 核心指标

| 指标 | 目标 | 告警 |
|------|------|------|
| 请求量 | >100次/天 | <10 |
| 错误率 | <5% | >10% |
| 平均延迟 | <2s | >5s |

### 5.2 路由质量

| 指标 | 目标 | 告警 |
|------|------|------|
| 路由准确率 | >85% | <75% |
| court占比 | 10-30% | >50% |
| swarm占比 | 50-80% | <30% |

### 5.3 查看命令

```bash
# 查看Grafana仪表板
# http://grafana:3000/d/direct-command

# 或直接查看日志
tail -f /var/log/direct_command.log
```

---

## 六、反馈收集模板

### 6.1 用户反馈表

| 用户 | 命令 | 预期路由 | 实际路由 | 评价 | 建议 |
|------|------|---------|---------|------|------|
| 张三 | 分析客户线索 | swarm/haolong | swarm/haolong | ✓ | - |

### 6.2 周报模板

```
# 周报: 密旨直通车使用情况

## 一、核心数据
- 请求量: XXX次
- 错误率: X%
- 平均延迟: X秒

## 二、路由分布
- direct: X%
- swarm: X%
  - haolong: X%
  - opc: X%
  - ...
- court: X%

## 三、问题与优化
1. 问题1: 原因分析
   优化: 添加关键词X

2. 问题2: 原因分析
   优化: 调整关键词权重

## 四、下周计划
- [ ] 继续收集反馈
- [ ] 优化关键词
- [ ] 扩大试点范围
```

---

## 七、常见问题处理

### 7.1 路由错误怎么办？

1. 查看路由解释：`/api/direct/explain?command=你的命令`
2. 提交反馈：`/api/direct/feedback`
3. 记录到反馈表
4. 每天统一优化关键词

### 7.2 性能下降怎么办？

1. 检查监控指标：`/api/direct/metrics`
2. 查看错误日志
3. 重启服务（如果需要）
4. 扩容

### 7.3 用户抱怨响应慢怎么办？

1. 检查是否走错了路由
2. 优化关键词，减少误路由
3. 增加缓存命中率

---

## 八、大神的忠告

### 8.1 不要追求完美

> "测试集100%不等于真实世界100%。用户不会因为少量边界错误放弃一个工具，他们放弃的是用起来麻烦的工具。先上线，再用反馈继续优化。"

### 8.2 数据比算法重要

> "你现在有68个测试用例，但真实用户会有1000种你想象不到的说法。收集数据，用数据驱动优化。"

### 8.3 反馈是最好的老师

> "feedback学习机制是这套系统的灵魂。用户一次修正 = 你写100行关键词。认真对待每一个反馈。"

---

## 九、里程碑

| 阶段 | 时间 | 目标 |
|------|------|------|
| MVP | 第1周 | 50用户，80%准确率 |
| 成长期 | 第2-4周 | 200用户，85%准确率 |
| 成熟期 | 第1-3月 | 500用户，90%准确率 |
| 稳定期 | 3月后 | 1000用户，95%准确率 |

---

## 十、下一步行动

### 今天
- [x] 系统测试完成 ✅
- [x] 文档准备完成 ✅
- [ ] 启动服务
- [ ] 配置Nginx
- [ ] 选择试点用户

### 本周
- [ ] 收集100条反馈
- [ ] 优化关键词
- [ ] 真实用户路由准确率保持在95%以上

### 本月
- [ ] 扩展到200用户
- [ ] 启动ML路由预测
- [ ] 真实用户路由准确率保持在95%以上

---

**行动是最好的准备，现在就开始！**
