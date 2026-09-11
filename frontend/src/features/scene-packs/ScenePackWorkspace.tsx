"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { fetchScenePack, parseS4RuleAnalysis, runScenePack, s4CategoryText, s4FieldText, S4_PACK_SLUG, SceneRequestError } from "./client";
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
  budget: "预算或目标价",
  deadline: "交付节点",
  competitors: "竞争对手信息",
  customerRequirement: "客户需求",
  rfqFile: "询价资料（粘贴文本）",
};

export function ScenePackWorkspace({ slug }: { slug: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pack, setPack] = useState<ScenePack | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SceneRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authExpired, setAuthExpired] = useState(false);
  const [needsReview, setNeedsReview] = useState(false);
  const [running, setRunning] = useState(false);
  const submitting = useRef(false);
  const demo = params.get("demo") === "1";
  const taskPath = resultTaskPath(result, slug, demo, running);
  const s4Analysis = result ? parseS4RuleAnalysis(result) : null;
  const usesVerifiedS4Level = s4Analysis?.state === "available";

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
    if (submitting.current) return;
    submitting.current = true;
    setRunning(true);
    setError(null);
    setAuthExpired(false);
    setNeedsReview(false);
    setResult(null);
    try {
      const sceneRun = await runScenePack(slug, normalizeSceneInputs(values), demo);
      setResult(sceneRun);
    } catch (caught) {
      const status = caught instanceof SceneRequestError ? caught.status : 0;
      if (status === 401) {
        setAuthExpired(true);
        setError("会话已失效，旧结果已隐藏。请重新登录。");
      } else if (status === 422) {
        setError("输入未通过校验：请检查字段类型、格式或长度后修改并重新提交。");
      } else {
        setNeedsReview(true);
        setError("本次结果尚未确认。请到任务列表核对后再决定是否重新提交。");
      }
    } finally {
      submitting.current = false;
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
              {field.toLowerCase().includes("text") || field === "knownParameters" || field === "threeMonthMetrics" || field === "customerRequirement" || field === "rfqFile" ? (
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
              {inputHint(field) ? <small>{inputHint(field)}</small> : null}
            </label>
          ))}
          <div className={styles.materialBox}>
            材料文本最多 20000 字符；普通文本最多 2000 字符。询价资料为粘贴文本，不是文件上传或解析。服务端会校验长度和结构。
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
                <span>{result.packSlug === S4_PACK_SLUG ? "规则预分析" : "丞相裁决"}</span>
                <strong>{result.verdictText}</strong>
                <i className={styles.riskBadge} data-risk={result.riskGrade}>{result.packSlug === S4_PACK_SLUG ? usesVerifiedS4Level ? "规则提示级别" : "兼容提示级别" : "风险"}：{riskText(result.riskGrade)}</i>
              </div>
              <p>{result.summaryForUser}</p>
              {result.packSlug === S4_PACK_SLUG ? <S4RuleAnalysis result={result} /> : <ScoreLine label="置信度" value={`${result.confidence}%`} />}
              {typeof result.leadScore === "number" ? <ScoreLine label="线索评分" value={`${result.leadScore}`} /> : null}
              {result.recommendedReply ? (
                <div className={styles.evidence}>
                  <strong>推荐回复草稿</strong>
                  <p>{result.recommendedReply.body}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <p>提交后可查看诊断结论、缺失资料、下一步与证据来源。</p>
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
      {authExpired ? <button className={styles.sceneButton} type="button" onClick={() => router.push("/login?next=" + encodeURIComponent("/scene-pack/" + slug))}>重新登录</button> : null}
      {needsReview ? <button className={styles.sceneButton} type="button" onClick={() => router.push("/junjichu/scene-board?filter=all&panel=list")}>前往任务列表核对</button> : null}

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


function S4RuleAnalysis({ result }: { result: SceneRun }) {
  const analysis = parseS4RuleAnalysis(result);
  if (analysis.state === "available") return <div className={styles.evidence}>
    <strong>已校验规则依据 · {analysis.ruleVersion}</strong><p>这是词项提示，不含模型分析或校准概率。</p>
    {analysis.matchedCategories.length ? <ul className={styles.list}>{analysis.anchors.map(anchor => <li key={anchor.category + anchor.field}>{s4CategoryText(anchor.category)} · {s4FieldText(anchor.field)}：{anchor.excerpt}</li>)}</ul>
      : <p>当前词表未命中，不能排除风险。</p>}
  </div>;
  if (analysis.state === "legacy-stub") return <p className={styles.evidence}>历史占位：尚未运行规则预分析。</p>;
  return <p className={styles.evidence}>尚无可校验规则依据。</p>;
}


function inputHint(field: string) {
  if (field === "projectName" || field === "productName") return "名称最多 120 字符。";
  if (field === "threeMonthMetrics") return "填写 JSON 对象，至少包含 profitMargin（利润率）、conversionRate（成单率，0–100）和 cashflow（现金流）；数值需为有限数字。";
  if (field === "customerRequirement" || field === "rfqFile") return "材料文本最多 20000 字符。";
  return null;
}
