# V5 写实宫廷策略游戏 Figma Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 将 V5 三张代表页面重构为基于既有朝堂场景图的写实宫廷策略游戏 UI。

**Architecture:** 保留现有 V5 页面和交互节点，先把两张 WebP 上传至 Figma，再创建共享暗色游戏外壳与奏章面板，最后逐页定点重构并截图验收。

**Tech Stack:** Figma Design、Figma Plugin API、Figma Image Fill、Noto Serif SC、Noto Sans SC。

## Global Constraints

- 不修改 V4 页面。
- V5/01、V5/02、V5/03 每个名称只能出现一次。
- 真实图片用作 Image Fill；不得用手绘矩形模拟图片。
- 正文对比度优先于装饰。
- 保留现有核心跳转。

---

### Task 1: 图像资产与游戏视觉基础

- [x] 检查两张 WebP 文件存在且尺寸适合 16:9 背景。
- [x] 上传两张图片到 V5 Figma 页面并记录 imageHash。
- [x] 创建暗木、青铜、暖金、奏章纸、朱红与遮罩变量。
- [x] 创建游戏导航、奏章面板和印玺按钮组件。
- [x] 截图验证图片、材质和文字对比。

### Task 2: 欢迎页重构

- [x] 为 V5/01 设置军机处全屏图片背景和深色遮罩。
- [x] 重构品牌标题、入口按钮和真实案卷奏章浮层。
- [x] 保留欢迎页到上书房的跳转。
- [x] 截图检查首屏焦点、可读性和游戏氛围。

### Task 3: 上书房重构

- [x] 为 V5/02 设置御前空间背景和深木导航。
- [x] 将一句话下旨区改为中央奏章面板。
- [x] 将最近三案改为奏折签，并重构当前案卷内容。
- [x] 保留上书房到司级页的跳转。
- [x] 截图检查信息层级和单一朱红焦点。

### Task 4: 六部司级页重构

- [x] 为 V5/03 设置暗化宫廷工作台背景。
- [x] 将案卷列表改为暗木卷宗架，详情改为奏章正文。
- [x] 将锦衣卫补证改为情报札记。
- [x] 重构主次按钮并保持案卷数据不变。
- [x] 截图检查高密度阅读和游戏化边界。

### Task 5: 验收与交付

- [x] 检查三张页面名称唯一。
- [x] 检查字体、文字越界和图片填充。
- [x] 检查欢迎页到上书房、上书房到司级页跳转。
- [x] 对照两张参考图完成最终视觉复核。
- [x] 更新计划 checkbox 并返回 V5 Figma 链接。
