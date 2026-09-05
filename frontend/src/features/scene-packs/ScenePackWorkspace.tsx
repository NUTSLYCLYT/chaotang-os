"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { fetchScenePack, runScenePack } from "./client";
import { demoInputsFor, normalizeSceneInputs } from "./demoInputs";
import { resultTaskPath } from "./sceneBoardController";
import type { ScenePack, SceneRun } from "./types";
import styles from "./scenePacks.module.css";

const FIELD_LABELS: Record<string, string> = {
  productName: "产品名称",
  productCategory: "产品类别",
  knownParameters: "已知参数",
  certifications: "已有认证",
  currentPriceOrCost: "当前报价或成本",
  monthlyCapacity: "月产能",
  deliveryCycle: "交付周期",
  targetMarket: "目标国家/地区",
  plannedChannel: "计划渠道",
  productMaterials: "产品资料说明",
  contractText: "合同文本或摘要",
  contractAmount: "合同金额",
  currency: "币种",
  paymentMilestones: "付款节点",
  acceptanceMethod: "验收方式",
  warrantyResponsibility: "质保责任",
  counterpartyName: "对方公司名称",
  targetRegion: "目标国家或地区",
  hasHistory: "是否已有历史合作",
  inquirySource: "询盘来源",
  customerName: "客户姓名",
  customerCompany: "客户公司",
  countryRegion: "国家或地区",
  contact: "联系方式",
  inquiryTime: "询盘时间",
  customerOriginalText: "客户原文",
  productDemand: "产品需求",
  quantity: "数量",
  applicationScenario: "应用场景",
  paymentMethod: "付款方式",
  requiresSample: "是否要求样品",
  industry: "行业",
  region: "地域",
  targetMarkets: "目标国家/地区",
  products: "主要产品/服务",
  stage: "当前阶段",
  threeMonthMetrics: "近3个月核心经营数据（JSON）",
  topProblems: "过去30天 Top3 问题",
  budgetLimit: "预算上限",
  availablePeople: "可用人力",
  targetCollectionCycle: "目标回款周期",
  projectName: "项目名称",
  customerRequirement: "客户需求",
};

export function ScenePackWorkspace({ slug }: { slug: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pack, setPack] = useState<ScenePack | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SceneRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const demo = params.get("demo") === "1";
  const taskPath = resultTaskPath(result, slug, demo, running);

  useEffect(() => {
    let cancelled = false;
    void fetchScenePack(slug)
      .then((item) => {
        if (cancelled) return;
        setPack(item);
        if (demo) setValues(demoInputsFor(slug));
      })
      .catch(() => setError("场景定义暂时不可读，请稍后重试。"));
    return () => {
      cancelled = true;
    };
  }, [demo, slug]);

  const fields = useMemo(() => {
    if (pack === null) return [];
    return [...pack.requiredInputs, ...pack.optionalInputs].filter(
      (field, index, all) => all.indexOf(field) === index && field !== "attachments",
    );
  }, [pack]);

  const missingLocal = pack?.requiredInputs.filter((field) => !values[field]?.trim()) ?? [];

  async function submit() {
    setRunning(true);
    setError(null);
    try {
      const sceneRun = await runScenePack(slug, normalizeSceneInputs(values), demo);
      setResult(sceneRun);
    } catch {
      setError("诊断未完成：请确认已登录且后端服务可用。");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className={styles.workspace}>
      <header className={styles.workspaceHeader}>
        <div>
          <p>SCENE PACK V1 · {pack?.implementationStatus ?? "loading"}</p>
          <h1>{pack?.name ?? "场景执行页"}</h1>
        </div>
        <button className={styles.sceneButton} type="button" onClick={() => router.push("/dadian")}>
          返回大殿
        </button>
      </header>

      <section className={styles.workspaceGrid}>
        <aside className={styles.panel} data-evidence-list>
          <h2>一眼填什么</h2>
          <p>{pack?.shortValue ?? "正在读取场景定义…"}</p>
          {fields.map((field) => (
            <label className={styles.field} key={field}>
              <span>
                {FIELD_LABELS[field] ?? field}
                {pack?.requiredInputs.includes(field) ? " *" : ""}
              </span>
              {field.toLowerCase().includes("text") || field === "knownParameters" || field === "threeMonthMetrics" ? (
                <textarea
                  value={values[field] ?? ""}
                  onChange={(event) => setValues((current) => ({ ...current, [field]: event.target.value }))}
                />
              ) : (
                <input
                  value={values[field] ?? ""}
                  onChange={(event) => setValues((current) => ({ ...current, [field]: event.target.value }))}
                />
              )}
            </label>
          ))}
          <div className={styles.materialBox}>
            材料上传占位：本轮先接入资料说明与附件引用字段，不读取受保护文件、不自动外联。
          </div>
        </aside>

        <section className={styles.panel}>
          <h2>客户/资料完整度</h2>
          {missingLocal.length ? (
            <>
              <p>当前还差这些关键项，提交后也会被标为阻断：</p>
              <ul className={styles.list}>
                {missingLocal.map((item) => <li key={item}>{FIELD_LABELS[item] ?? item}</li>)}
              </ul>
            </>
          ) : (
            <p>关键字段已具备，可以提交形成结构化诊断；外部信息仍会标注为待核。</p>
          )}
          {result ? (
            <div className={styles.resultCard}>
              <div className={styles.verdict}>
                <span>丞相裁决</span>
                <strong>{result.verdictText}</strong>
                <i className={styles.riskBadge} data-risk={result.riskGrade}>风险：{riskText(result.riskGrade)}</i>
              </div>
              <p>{result.summaryForUser}</p>
              <ScoreLine label="置信度" value={`${result.confidence}%`} />
              {typeof result.leadScore === "number" ? <ScoreLine label="线索评分" value={`${result.leadScore}`} /> : null}
              {result.recommendedReply ? (
                <div className={styles.evidence}>
                  <strong>推荐回复草稿</strong>
                  <p>{result.recommendedReply.body}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <p>提交后这里会出现 verdict、riskGrade、missingItems、nextActions 与证据来源。</p>
          )}
        </section>

        <aside className={styles.panel}>
          <h2>下一步与证据</h2>
          {result ? (
            <>
              <h3>缺失项</h3>
              <ul className={styles.list}>
                {(result.missingItems.length ? result.missingItems : ["暂无阻断缺失项"]).map((item) => <li key={item}>{item}</li>)}
              </ul>
              <h3>下一步行动</h3>
              <ul className={styles.list}>
                {result.nextActions.map((action) => (
                  <li key={`${action.ownerDept}-${action.title}`}>
                    {action.priority} · {action.ownerDept} · {action.title}（{action.dueHint}）
                  </li>
                ))}
              </ul>
              <h3>证据来源</h3>
              {result.evidenceRefs.map((ref) => (
                <div className={styles.evidence} key={`${ref.claim}-${ref.sourceLabel}`}>
                  {ref.claim}<br />
                  来源：{ref.sourceLabel} · {ref.sourceType} · {ref.reliability}
                </div>
              ))}
            </>
          ) : (
            <p>还没有结果。先填左侧关键字段，再点底部“提交诊断”。</p>
          )}
        </aside>
      </section>

      {error ? <p className={styles.evidence} role="alert">{error}</p> : null}

      <footer className={styles.fixedBar}>
        <button className={styles.sceneButton} type="button" onClick={submit} disabled={running}>
          {slug === "b2b-inquiry-conversion" ? "生成成交作战卡" : running ? "诊断中…" : "提交诊断"}
        </button>
        <button className={styles.sceneButton} type="button" disabled={!taskPath} onClick={() => { if (taskPath) router.push(taskPath); }}>
          查看这份结果的任务
        </button>
        <button className={styles.sceneButton} type="button" onClick={() => document.querySelector("[data-evidence-list]")?.scrollIntoView()}>
          查看证据
        </button>
        <button className={styles.sceneButton} type="button" onClick={() => setValues(demoInputsFor(slug))}>
          查看样例
        </button>
      </footer>
    </main>
  );
}

function ScoreLine({ label, value }: { label: string; value: string }) {
  return <p className={styles.score}><span>{label}</span><strong>{value}</strong></p>;
}

function riskText(risk: string): string {
  return risk === "low" ? "低" : risk === "medium" ? "中" : "高";
}
