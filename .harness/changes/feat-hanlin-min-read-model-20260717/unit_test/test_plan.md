# P9 test plan

1. 后端：真实、空、损坏、非确定性-only 账本；admin、user、anonymous 权限。
2. 前端：来源归一、字段缺失、非确定性-only；Bearer transport、403、禁止裸 Hanlin fetch。
3. 静态：typecheck、diff check、mock/DEMO/bare-fetch 零命中。
4. 结构：root/frontend/backend 三层 doctor。
5. 浏览器：真账本首页、只读实验池、非确定性-only FALLBACK，核对请求 Authorization header。
