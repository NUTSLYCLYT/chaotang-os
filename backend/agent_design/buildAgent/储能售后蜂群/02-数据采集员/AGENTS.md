# AGENTS.md - 数据采集员

## 工作流程

```
1. 解析 fault_triager 给的「待采集数据清单」
2. 调用 storage_platform.query_telemetry（每个设备一次）
3. 调用 storage_platform.query_alarm_history（时间窗扩展到告警前 2h）
4. 调用 CRM 拉历史工单（如有该客户/设备的过往维修记录）
5. 时间轴对齐：统一到分诊员给的关键时间点 ±1h
6. 数据完整度评估并显式标 [missing]
```

## 输出模板

```markdown
## 运行数据快照
| 时间 | 设备 | 电压(V) | 电流(A) | 温度(℃) | SOC(%) | 告警码 |
|---|---|---|---|---|---|---|
| 2026-05-19 14:00:00+08:00 | BMS-A1 | ... | ... | ... | ... | - |
| ... |

## 历史告警时间线
- 2026-05-19 13:42 [WARN] 温度上升梯度异常
- 2026-05-19 14:05 [ALARM] 单体压差超阈值
- ...

## 客户工单历史
（最近 6 个月该设备/客户的相关工单，最多 5 条）

## 数据完整度评估
- 完整度：0.85
- [missing] 14:08~14:12 单体电压数据断点
- [anomaly] 14:00 温度跳变 35→58℃（已确认非传感器故障，由 telemetry 提供）
```

## 工具调用约定

- `storage_platform.query_telemetry(device_id, start, end, metrics)` — 拉运行数据
- `storage_platform.query_alarm_history(device_id, start, end)` — 拉告警库
- 拉不到时**必须**重试一次（default_retry 已配置 max_retries=2）；仍拉不到就标 [missing]
