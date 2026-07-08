import type { ReactNode } from "react";

export { MarkLibu, MarkBingbu, MarkGongbu, MarkHubu, MarkLibu2, MarkXingbu } from "./Glyphs";
import {
  MarkLibu,
  MarkBingbu,
  MarkGongbu,
  MarkHubu,
  MarkLibu2,
  MarkXingbu,
} from "./Glyphs";

export interface Ministry {
  key: string;
  title: string;
  color: string;
  mark: ReactNode;
  /** 详情面板用的一句话职能描述 */
  desc: string;
  metrics: { label: string; value: string; delta?: boolean }[];
  href: string;
  /** 浮空卡片在 1672×941 画布中的位置：精确对齐底图中各部对应的原始模块（不重排） */
  box: { left: number; top: number; width: number; height: number };
}

export const MINISTRIES: Ministry[] = [
  // 左列：吏 → 户 → 礼（自上而下）
  {
    key: "libu",
    title: "吏部 · 组织人才域",
    color: "#a99cf0",
    mark: <MarkLibu />,
    desc: "统辖庄园人事与组织架构，掌核心岗位编制、人才梯队与考绩升黜。",
    href: "/liubu/libu",
    box: { left: 320, top: 125, width: 240, height: 110 },
    metrics: [
      { label: "核心岗位", value: "186 个" },
      { label: "在岗人才", value: "2,480 人" },
      { label: "较昨日", value: "+12", delta: true },
    ],
  },
  {
    key: "hubu",
    title: "户部 · 财税资荟",
    color: "#ebcb7b",
    mark: <MarkHubu />,
    desc: "总揽庄园财税与资金调度，统筹预算、库银与收支盈亏。",
    href: "/liubu/hubu",
    box: { left: 735, top: 85, width: 230, height: 110 },
    metrics: [
      { label: "可用资金", value: "12.8 亿" },
      { label: "预算项目", value: "96 个" },
      { label: "较昨日", value: "+0.6%", delta: true },
    ],
  },
  {
    key: "libu2",
    title: "礼部 · 品牌客户域",
    color: "#6fd0d8",
    mark: <MarkLibu2 />,
    desc: "经营庄园声誉与客户关系，掌品牌、礼宾与客户签约。",
    href: "/liubu",
    box: { left: 1075, top: 200, width: 230, height: 110 },
    metrics: [
      { label: "客户总数", value: "3,682 家" },
      { label: "签约客户", value: "268 家" },
      { label: "较昨日", value: "+28", delta: true },
    ],
  },
  // 右列：兵 → 刑 → 工（自上而下）
  {
    key: "bingbu",
    title: "兵部 · 任务作战台",
    color: "#e0705a",
    mark: <MarkBingbu />,
    desc: "调度庄园重大任务与项目攻坚，统辖战线编成与资源投放。",
    href: "/liubu/bingbu",
    box: { left: 405, top: 320, width: 220, height: 110 },
    metrics: [
      { label: "在办任务", value: "128 个" },
      { label: "重点战役", value: "23 场" },
      { label: "较昨日", value: "+3", delta: true },
    ],
  },
  {
    key: "xingbu",
    title: "刑部 · 风控法务司",
    color: "#6fa0ff",
    mark: <MarkXingbu />,
    desc: "执掌庄园风控、合规与法务，审理案件、预警风险、护航经营。",
    href: "/liubu/xingbu",
    box: { left: 1015, top: 385, width: 250, height: 110 },
    metrics: [
      { label: "审理案件", value: "42 起" },
      { label: "预警风险", value: "3 条" },
      { label: "较昨日", value: "+1", delta: true },
    ],
  },
  {
    key: "gongbu",
    title: "工部 · 研发供应链",
    color: "#7fc9a8",
    mark: <MarkGongbu />,
    desc: "主理庄园研发与供给链路，统筹项目研发、产能与供应覆盖。",
    href: "/liubu/gongbu",
    box: { left: 420, top: 465, width: 240, height: 110 },
    metrics: [
      { label: "研发项目", value: "36 个" },
      { label: "供给覆盖", value: "8,952 项" },
      { label: "较昨日", value: "+186", delta: true },
    ],
  },
];

export const MINISTRY_MARKS: Record<string, ReactNode> = {
  libu: <MarkLibu />,
  hubu: <MarkHubu />,
  libu2: <MarkLibu2 />,
  bingbu: <MarkBingbu />,
  xingbu: <MarkXingbu />,
  gongbu: <MarkGongbu />,
};
