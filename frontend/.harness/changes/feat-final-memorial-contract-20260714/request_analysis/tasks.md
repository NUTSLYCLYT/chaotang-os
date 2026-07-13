# 任务拆解

## 任务 1：正式奏折读契约

- 目标：让上书房状态与首页摘要能类型安全消费后端唯一正式奏折。
- 输入：后端 `formal_memorial`/`formal_memorial_id` additive contract。
- 输出：`src/lib/jiqun-api.ts` 类型更新。
- 验收：tsc、contract baseline、doctor 均 exit 0。
- 依赖：后端 FinalMemorial 纵切面。
