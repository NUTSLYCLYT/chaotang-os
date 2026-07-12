# 需求说明

## 背景

礼部现有纯函数能力没有用户可达入口，canonical route 仍是 404。

## 范围

启用礼部路由，接入 4 司 LOCAL 工作台，补页面接线与手机响应式布局。

## 非目标

不改后端，不冒充 LIVE，不一次性接入全部礼部司局。

## 验收标准

路由可达、4 司可见、手机输入最小宽度可用，完整发布门 GREEN。

## 风险

动态部门路由别名与手机多列表单。

## 验证计划

礼部 nodetest、TypeScript、production build、桌面/手机浏览器、production release gate。
