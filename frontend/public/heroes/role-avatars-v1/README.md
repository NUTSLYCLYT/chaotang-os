# Chaotang Role Avatars v1

This folder is a standalone avatar pack. It does not change application code.

## Generated Files

| File | Role | Persona | Source |
| --- | --- | --- | --- |
| `00-principal-throne.png` | 皇帝 / 主理人 | 用户占位：龙椅御案 | `character-roster/scene-overview-throne.webp` |
| `01-chancellor-zhang-liang.png` | 丞相 / 总路由 | 张良 | `character-roster/grand-council-zhang-liang.webp` |
| `02-study-wang-yangming.png` | 上书房师傅 | 王阳明 | `character-roster/study-wang-yangming.png` |
| `03-command-zhuge-liang.png` | 军机处 / 执行总参 | 诸葛亮 | `character-roster/v5-command-center-zhuge-liang.png` |
| `04-scribe-sima-qian.png` | 史馆 / 太史令 | 司马迁 | `character-roster/scribe-sima-qian.webp` |
| `05-bingbu-sun-wu.png` | 兵部 / 战略攻守 | 孙武 | `character-roster/bingbu-sun-wu.png` |
| `06-xingbu-bao-zheng.png` | 刑部 / 合规裁断 | 包拯 | `character-roster/unused-bao-zheng.webp` |
| `07-yushi-wei-zheng.png` | 御史台 / 反对意见 | 魏征 | `character-roster/governance-wei-zheng.webp` |
| `08-jinyiwei-di-renjie.png` | 锦衣卫 / 调查证据 | 狄仁杰 | `character-roster/archive-di-renjie.webp` |
| `09-taiyi-li-shizhen.png` | 太医院 / 健康风控 | 李时珍 | `character-roster/health-li-shizhen.webp` |
| `10-qintian-zhang-heng.png` | 钦天监 / 预测推演 | 张衡 | `character-roster/forecast-zhang-heng.png` |
| `11-libu-su-qin.png` | 礼部 / 对外联盟 | 苏秦 | `character-roster/manors-su-qin.webp` |
| `12-hanlin-su-shi.png` | 翰林院 / 内容材料 | 苏轼 | `character-roster/hanlin-su-shi.png` |
| `13-bingbu-qi-jiguang.png` | 兵部执行 / 防线情报 | 戚继光 | `character-roster/intel-qi-jiguang.webp` |
| `14-reports-ouyang-xiu.png` | 报告主编 / 修史质检 | 欧阳修 | `character-roster/reports-ouyang-xiu.webp` |

## Preview

- `_avatar-contact-sheet.jpg`: final avatar contact sheet.
- `_source-contact-sheet.jpg`: source-image contact sheet used for crop review.

## Missing New Portraits

The image generation service returned `ServerError` while trying to create new portraits. Two core avatars should be generated later rather than faked from unrelated scene art:

- 工部 / 首席营造官：宋应星
- 户部 / 预算与资源闸门：刘晏

See `PENDING_GENERATION_PROMPTS.md` for ready-to-use prompts.
