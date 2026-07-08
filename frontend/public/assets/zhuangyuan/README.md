# /assets/zhuangyuan — 资源说明

## 当前实现：原图 1:1 复刻

原始设计是一张**电影级写实场景**（帝王俯瞰宫苑 / 六部浮空卡片 / 金色光路 /
左右玻璃栏 / 底部指令栏），无法用 CSS/HTML 重画。因此采用：

> **原图作全幅背景（保证比例·风格·内容像素级一致）+ 其上叠加与原图位置对齐的「透明可交互热区」**

- `03-zhuangyuan.png`（1672×941）— 页面全幅背景，由 `.stage` 以 `cover` 居中铺满。
- `03-zhuangyuan.webp` — 同图 webp，备用（更小）。
- 交互层见 `src/components/chaotang/ZhuangyuanPage.tsx`：九部导航(Link)、六部卡片、
  发起任务、六宫格快捷、查看建议、查看详情、铃铛/帮助/头像等，全部为真实
  `button`/`Link`，默认隐形不破坏构图，hover 现金色微光。坐标用百分比，缩放比例不变。

## 来源

来自用户提供的 PRD 设计稿：
`C:\Users\admin\Desktop\t1\chaotang-prd\images\20260528\03-zhuangyuan.png`
（Figma 文件 `rLc7fo6KH4HH7rzXi5XPCl` 对 MCP 登录账号 `yx3957@gmail.com` 无访问权限，
故改用用户直接提供的整帧导出图。）

## 若要换图 / 接矢量化重构

- 换背景：替换 `03-zhuangyuan.png` 即可（同比例最佳，否则调 `.stage` 的 `aspect-ratio`）。
- 若日后拿到分层 Figma（含干净背景底图），可把六部卡片/左右栏改为纯 HTML/CSS
  矢量重构（分辨率无关、文字可选中），届时仅保留写实宫苑作背景。
