"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { fetchScenePacks } from "./client";
import type { ScenePack } from "./types";
import styles from "./scenePacks.module.css";

const FALLBACK_PACKS: ScenePack[] = [
  {
    id: "scene_pack_single_product_export_diagnosis",
    slug: "single-product-export-diagnosis",
    name: "单品出海诊断",
    shortValue: "判断一个产品最该卖去哪、怎么卖、缺什么证据",
    targetUser: "外贸企业、制造业老板、销售负责人",
    defaultOwnerDept: "丞相 / 锦衣卫 / 工部 / 户部 / 礼部",
    sortOrder: 1,
    requiredInputs: [],
    optionalInputs: [],
    implementationStatus: "real_v1",
    entryRoute: "/scene-pack/single-product-export-diagnosis",
    demoAvailable: true,
    canExecute: true,
    exampleHint: "DEMO 入口，后端可用后读取正式注册表。",
  },
  {
    id: "scene_pack_b2b_inquiry_conversion",
    slug: "b2b-inquiry-conversion",
    name: "B2B询盘成交",
    shortValue: "判断客户真不真、值不值得追、下一句怎么回",
    targetUser: "外贸业务员、销售经理、工业品销售团队",
    defaultOwnerDept: "丞相 / 锦衣卫 / 工部 / 户部 / 礼部",
    sortOrder: 2,
    requiredInputs: [],
    optionalInputs: [],
    implementationStatus: "real_v1",
    entryRoute: "/scene-pack/b2b-inquiry-conversion",
    demoAvailable: true,
    canExecute: true,
    exampleHint: "DEMO 入口，后端可用后读取正式注册表。",
  },
  {
    id: "scene_pack_proposal_quotation_tender",
    slug: "proposal-quotation-tender",
    name: "方案/报价/投标建议",
    shortValue: "拆清客户要求、偏差、成本口径和投标风险",
    targetUser: "投标负责人、售前方案经理",
    defaultOwnerDept: "丞相 / 工部 / 户部 / 刑部",
    sortOrder: 3,
    requiredInputs: [],
    optionalInputs: [],
    implementationStatus: "stubbed",
    entryRoute: "/scene-pack/proposal-quotation-tender",
    demoAvailable: true,
    canExecute: true,
    exampleHint: "本轮占位。",
  },
  {
    id: "scene_pack_contract_cashflow_risk",
    slug: "contract-cashflow-risk",
    name: "合同与回款风控",
    shortValue: "先看能不能签、钱能不能安全回来、红线在哪",
    targetUser: "老板、财务负责人、销售负责人",
    defaultOwnerDept: "丞相 / 刑部 / 户部 / 锦衣卫 / 工部",
    sortOrder: 4,
    requiredInputs: [],
    optionalInputs: [],
    implementationStatus: "real_v1",
    entryRoute: "/scene-pack/contract-cashflow-risk",
    demoAvailable: true,
    canExecute: true,
    exampleHint: "DEMO 入口，后端可用后读取正式注册表。",
  },
  {
    id: "scene_pack_enterprise_growth_diagnosis",
    slug: "enterprise-growth-diagnosis",
    name: "企业增长诊断",
    shortValue: "15分钟形成30/90天经营增长路线，先稳现金再放大",
    targetUser: "中小企业老板、运营负责人、增长负责人",
    defaultOwnerDept: "丞相 / 内务府 / 户部 / 工部 / 锦衣卫",
    sortOrder: 5,
    requiredInputs: [],
    optionalInputs: [],
    implementationStatus: "real_v1",
    entryRoute: "/scene-pack/enterprise-growth-diagnosis",
    demoAvailable: true,
    canExecute: true,
    exampleHint: "DEMO 入口，后端可用后读取正式注册表。",
  },
];

export function SceneStrategyPanel() {
  const router = useRouter();
  const [packs, setPacks] = useState<ScenePack[]>(FALLBACK_PACKS);
  const [source, setSource] = useState<"LIVE" | "DEMO">("DEMO");

  useEffect(() => {
    let cancelled = false;
    void fetchScenePacks()
      .then((items) => {
        if (!cancelled && items.length >= 5) {
          setPacks(items);
          setSource("LIVE");
        }
      })
      .catch(() => {
        if (!cancelled) setSource("DEMO");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className={styles.strategyPanel} aria-label="结果案例入口">
      <div className={styles.strategyHeader}>
        <div>
          <p>RESULT CASES · V1</p>
          <h2>结果案例</h2>
          <small>每张案例都说明你将得到的结果，再决定是否开始办理。</small>
        </div>
        <span data-source={source}>{source}</span>
      </div>
      <div className={styles.sceneRail}>
        {packs.map((pack) => (
          <article key={pack.slug} className={styles.entryCard} data-risk={riskTone(pack)}>
            <div className={styles.cardTopline}>
              <span>{pack.implementationStatus === "real_v1" ? "真实链路" : "占位链路"}</span>
              <i>{riskLabel(pack)}</i>
            </div>
            <h3>{pack.name}</h3>
            <p><strong>你将得到：</strong>{pack.shortValue}</p>
            <small>适合：{pack.targetUser}</small>
            <div className={styles.cardActions}>
              <button type="button" onClick={() => router.push(`/scene-pack/${pack.slug}`)}>
                {pack.slug === "b2b-inquiry-conversion" ? "分析询盘" : "开始办理"}
              </button>
              <button
                type="button"
                className={styles.secondaryAction}
                onClick={() => router.push(`/scene-pack/${pack.slug}?demo=1`)}
              >
                查看案例输入
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function riskTone(pack: ScenePack): "green" | "amber" | "red" {
  if (pack.implementationStatus === "stubbed") return "amber";
  if (pack.slug === "contract-cashflow-risk") return "red";
  return "green";
}

function riskLabel(pack: ScenePack): string {
  if (pack.implementationStatus === "stubbed") return "待上线";
  if (pack.slug === "contract-cashflow-risk") return "红线优先";
  return "可演示";
}
