"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  fetchScenePack,
  fetchScenePrincipalMarker,
  parseS4RuleAnalysis,
  runScenePack,
  scenePrincipalUnchanged,
  sceneRequestFingerprint,
  s4CategoryText,
  s4FieldText,
  S4_PACK_SLUG,
  SceneRequestError,
} from "./client";
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

const PENDING_TTL_MS = 30 * 60 * 1000;

type PendingSceneRequest = {
  requestKey: string;
  clientRevisionFingerprint: string;
  principalMarker: string;
  packSlug: string;
  revision: number;
  expiresAt: number;
};

function pendingStorageKey(slug: string): string {
  return `chaotang.scene.pending.v1:${slug}`;
}

function readPending(slug: string): PendingSceneRequest | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(pendingStorageKey(slug)) ?? "null");
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const item = value as Record<string, unknown>;
    if (Object.keys(item).sort().join(",") !== "clientRevisionFingerprint,expiresAt,packSlug,principalMarker,requestKey,revision"
      || typeof item.requestKey !== "string"
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(item.requestKey)
      || typeof item.clientRevisionFingerprint !== "string"
      || !/^sha256:[0-9a-f]{64}$/.test(item.clientRevisionFingerprint)
      || typeof item.principalMarker !== "string" || item.principalMarker.length === 0 || item.principalMarker.length > 256
      || item.packSlug !== slug
      || !Number.isSafeInteger(item.revision) || Number(item.revision) < 0
      || !Number.isSafeInteger(item.expiresAt) || Number(item.expiresAt) <= 0) return null;
    return item as PendingSceneRequest;
  } catch {
    return null;
  }
}

function writePending(slug: string, pending: PendingSceneRequest | null): void {
  if (pending === null) sessionStorage.removeItem(pendingStorageKey(slug));
  else sessionStorage.setItem(pendingStorageKey(slug), JSON.stringify(pending));
}

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
  const [hasPending, setHasPending] = useState(false);
  const [inputRevision, setInputRevision] = useState(0);
  const [successfulRevision, setSuccessfulRevision] = useState<number | null>(null);
  const submitting = useRef(false);
  const revisionRef = useRef(0);
  const successfulRevisionRef = useRef<number | null>(null);
  const pendingRef = useRef<PendingSceneRequest | null>(null);
  const principalRef = useRef<string | null>(null);
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

  useEffect(() => {
    let cancelled = false;
    let generation = 0;
    const syncPrincipal = () => {
      const currentGeneration = ++generation;
      void fetchScenePrincipalMarker()
      .then((principalMarker) => {
        if (cancelled || currentGeneration !== generation) return;
        principalRef.current = principalMarker;
        const stored = readPending(slug);
        if (stored === null) writePending(slug, null);
        if (stored !== null && stored.principalMarker !== principalMarker) {
          writePending(slug, null);
          pendingRef.current = null;
          setHasPending(false);
          return;
        }
        pendingRef.current = stored;
        if (stored !== null) {
          setHasPending(true);
          setNeedsReview(true);
          setError(stored.expiresAt <= Date.now()
            ? "上次提交记录已过期，不能自动创建新任务。请先到任务列表核对。"
            : "本次结果尚未确认。请到任务列表核对后再决定是否重新提交。");
        }
      })
      .catch((caught) => {
        if (cancelled || currentGeneration !== generation) return;
        principalRef.current = null;
        if (caught instanceof SceneRequestError && caught.status === 401) {
          writePending(slug, null);
          pendingRef.current = null;
          setHasPending(false);
        }
      });
    };
    const syncWhenVisible = () => {
      if (document.visibilityState === "visible") syncPrincipal();
    };
    syncPrincipal();
    window.addEventListener("focus", syncPrincipal);
    document.addEventListener("visibilitychange", syncWhenVisible);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", syncPrincipal);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, [slug]);

  const fields = useMemo(() => {
    if (pack === null) return [];
    return [...pack.requiredInputs, ...pack.optionalInputs].filter(
      (field, index, all) => all.indexOf(field) === index && field !== "attachments",
    );
  }, [pack]);

  const missingLocal = pack?.requiredInputs.filter((field) => !values[field]?.trim()) ?? [];

  function updateValue(field: string, value: string) {
    revisionRef.current += 1;
    setInputRevision(revisionRef.current);
    setValues((current) => ({ ...current, [field]: value }));
    setResult(null);
    if (pendingRef.current !== null) {
      setNeedsReview(true);
      setError("输入已变化，不能重放；请先核对或明确放弃旧提交。");
    }
  }

  function replaceValues(next: Record<string, string>) {
    revisionRef.current += 1;
    setInputRevision(revisionRef.current);
    setValues(next);
    setResult(null);
    if (pendingRef.current !== null) {
      setNeedsReview(true);
      setError("输入已变化，不能重放；请先核对或明确放弃旧提交。");
    }
  }

  function discardPending() {
    writePending(slug, null);
    pendingRef.current = null;
    setHasPending(false);
    setNeedsReview(false);
    setError(null);
  }

  async function submit() {
    if (submitting.current) return;
    submitting.current = true;
    setRunning(true);
    setError(null);
    setAuthExpired(false);
    setNeedsReview(false);
    setResult(null);
    try {
      const normalizedInputs = normalizeSceneInputs(values);
      const responseRevision = revisionRef.current;
      const clientRevisionFingerprint = await sceneRequestFingerprint(slug, normalizedInputs, demo);
      const principalMarker = await fetchScenePrincipalMarker();
      if (principalRef.current !== null && principalRef.current !== principalMarker) {
        writePending(slug, null);
        pendingRef.current = null;
        setHasPending(false);
      }
      principalRef.current = principalMarker;

      const prior = pendingRef.current;
      if (prior !== null && (
        prior.principalMarker !== principalMarker
        || prior.packSlug !== slug
        || prior.expiresAt <= Date.now()
        || prior.clientRevisionFingerprint !== clientRevisionFingerprint
      )) {
        setNeedsReview(true);
        setError("输入已变化，不能重放；请先核对或明确放弃旧提交。");
        return;
      }
      if (successfulRevisionRef.current === responseRevision && prior === null) {
        setError("当前输入版本已经成功提交；如需重新诊断，请先修改输入。");
        return;
      }

      const requestKey = prior?.requestKey ?? crypto.randomUUID();
      const pending: PendingSceneRequest = {
        requestKey,
        clientRevisionFingerprint,
        principalMarker,
        packSlug: slug,
        revision: responseRevision,
        expiresAt: Date.now() + PENDING_TTL_MS,
      };
      pendingRef.current = pending;
      setHasPending(true);
      writePending(slug, pending);
      const sceneRun = await runScenePack(slug, normalizedInputs, demo, requestKey);
      const responsePrincipalMarker = await fetchScenePrincipalMarker();
      if (!scenePrincipalUnchanged(principalMarker, principalRef.current, responsePrincipalMarker)) {
        writePending(slug, null);
        pendingRef.current = null;
        setHasPending(false);
        setResult(null);
        setNeedsReview(true);
        setError("身份已变化，旧响应已隐藏。请使用当前身份到任务列表核对。");
        return;
      }
      writePending(slug, null);
      pendingRef.current = null;
      setHasPending(false);
      successfulRevisionRef.current = responseRevision;
      setSuccessfulRevision(responseRevision);
      if (responseRevision !== revisionRef.current) {
        setNeedsReview(true);
        setError("输入已变化，旧响应已隐藏；请到任务列表核对后再重新诊断。");
        return;
      }
      setResult(sceneRun);
    } catch (caught) {
      const status = caught instanceof SceneRequestError ? caught.status : 0;
      if (status === 401) {
        writePending(slug, null);
        pendingRef.current = null;
        setHasPending(false);
        principalRef.current = null;
        setAuthExpired(true);
        setError("会话已失效，旧结果已隐藏。请重新登录。");
      } else if (status === 409) {
        setNeedsReview(true);
        setError("提交身份与现有任务冲突。请到任务列表核对，不能自动重放或更换请求身份。");
      } else if (status === 422) {
        writePending(slug, null);
        pendingRef.current = null;
        setHasPending(false);
        setError("输入未通过校验：请检查字段类型、格式或长度后修改并重新提交。");
      } else if (status >= 500) {
        setNeedsReview(true);
        setError("服务端未完成本次请求。已保留安全重试身份，请核对后明确重试。");
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
                  onChange={(event) => updateValue(field, event.target.value)}
                />
              ) : (
                <input
                  value={values[field] ?? ""}
                  onChange={(event) => updateValue(field, event.target.value)}
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
              {result.packSlug === S4_PACK_SLUG
                ? <S4RuleAnalysis result={result} />
                : <ScoreLine label="置信度" value={formatConfidence(result.confidence)} />}
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
      {needsReview && hasPending ? <button className={styles.sceneButton} type="button" onClick={discardPending}>明确放弃未确认提交</button> : null}

      <footer className={styles.fixedBar}>
        <button className={styles.sceneButton} type="button" onClick={submit} disabled={running || successfulRevision === inputRevision}>
          {slug === "b2b-inquiry-conversion" ? "生成成交作战卡" : running ? "诊断中…" : "提交诊断"}
        </button>
        <button className={styles.sceneButton} type="button" disabled={!taskPath} onClick={() => { if (taskPath) router.push(taskPath); }}>
          查看这份结果的任务
        </button>
        <button className={styles.sceneButton} type="button" onClick={() => document.querySelector("[data-evidence-list]")?.scrollIntoView()}>
          查看证据
        </button>
        <button className={styles.sceneButton} type="button" onClick={() => replaceValues(demoInputsFor(slug))}>
          查看样例
        </button>
      </footer>
    </main>
  );
}

function ScoreLine({ label, value }: { label: string; value: string }) {
  return <p className={styles.score}><span>{label}</span><strong>{value}</strong></p>;
}

function formatConfidence(value: number | null): string {
  return value === null ? "未评分" : `${value}%`;
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
