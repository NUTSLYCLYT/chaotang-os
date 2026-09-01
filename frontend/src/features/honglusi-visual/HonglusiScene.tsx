"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import { ImmersiveCourtShell } from "../court-visuals/ImmersiveCourtShell";
import {
  HONGLUSI_CAPABILITIES,
  HONGLUSI_CATEGORIES,
  getHonglusiCapability,
  type HonglusiAdmissionStatus,
} from "./honglusiRegistry";
import styles from "./HonglusiScene.module.css";

type HonglusiView = "overview" | "capabilities" | "admission" | "routes";
type AssessmentState = "idle" | "reviewed";

const VIEW_TABS: readonly { id: HonglusiView; label: string; mark: string }[] = [
  { id: "overview", label: "国门总览", mark: "总" },
  { id: "capabilities", label: "外部能力", mark: "使" },
  { id: "admission", label: "准入审查", mark: "验" },
  { id: "routes", label: "联盟路由", mark: "驿" },
] as const;

const VIEW_COPY: Record<HonglusiView, { eyebrow: string; title: string; detail: string }> = {
  overview: {
    eyebrow: "今日国门态势",
    title: "先看风险，再谈能力",
    detail: "六份能力护照均为 DEMO；一个高风险能力保持阻断，真实事实源尚未接入。",
  },
  capabilities: {
    eyebrow: "外部来使名录",
    title: "能力必须先有护照",
    detail: "来源、数据、权限、风险和下一步缺一不可；没有护照的能力不进入朝堂。",
  },
  admission: {
    eyebrow: "准入闸门",
    title: "安装不等于可用",
    detail: "先审数据与权限，再进沙箱验证；只有真实任务改善被证明，才进入正式能力池。",
  },
  routes: {
    eyebrow: "联盟驿路",
    title: "外部能力不直达执行层",
    detail: "外部能力先过鸿胪寺，再由翰林院治理，最后由朝堂按任务动态调用。",
  },
};

const STATUS_COUNTS: Record<HonglusiAdmissionStatus, number> = {
  待审: HONGLUSI_CAPABILITIES.filter((item) => item.status === "待审").length,
  沙箱: HONGLUSI_CAPABILITIES.filter((item) => item.status === "沙箱").length,
  只读: HONGLUSI_CAPABILITIES.filter((item) => item.status === "只读").length,
  阻断: HONGLUSI_CAPABILITIES.filter((item) => item.status === "阻断").length,
};

export function HonglusiScene() {
  const [view, setView] = useState<HonglusiView>("overview");
  const [selectedId, setSelectedId] = useState(HONGLUSI_CAPABILITIES[0].id);
  const [assessment, setAssessment] = useState<AssessmentState>("idle");
  const [draft, setDraft] = useState("");
  const [reply, setReply] = useState(
    "演示回复：可询问某项能力会影响什么、为什么需要审查，以及下一步应如何处理。",
  );
  const selected = getHonglusiCapability(selectedId) ?? HONGLUSI_CAPABILITIES[0];
  const viewCopy = VIEW_COPY[view];

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = draft.trim();
    if (!question) return;
    setReply(
      `演示回复：已将“${question}”归入${selected.category}的准入问询；当前没有调用模型，也没有执行外部操作。`,
    );
    setDraft("");
  };

  const handleAssessment = () => {
    setAssessment("reviewed");
    setReply(
      `演示回复：${selected.name}的本地演示检查已展开。正式结论仍需真实事实源、翰林院检查与锦衣卫风险证据。`,
    );
  };

  const composer = (
    <div className={styles.composer}>
      <span className={styles.composerReply} aria-live="polite">{reply}</span>
      <form className={styles.composerForm} onSubmit={handleSubmit}>
        <span className={styles.demoStamp}>DEMO</span>
        <label className={styles.srOnly} htmlFor="honglusi-question">
          向鸿胪寺询问外部能力
        </label>
        <input
          id="honglusi-question"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="问鸿胪寺：这项能力会影响什么？"
          autoComplete="off"
        />
        <button type="submit">呈问</button>
      </form>
    </div>
  );

  return (
    <ImmersiveCourtShell
      currentLabel="鸿胪寺"
      currentPath="/honglusi"
      backgroundImage="/assets/junjichu/junjichu.webp"
      quickDockCenter={composer}
      showQuickDockHandle={false}
      scene="honglusi"
      hideScrollbar
    >
      <section className={styles.page} aria-labelledby="honglusi-heading">
        <header className={styles.masthead}>
          <div className={styles.identity}>
            <span className={styles.seal} aria-hidden="true">鸿</span>
            <div>
              <p>外部能力国门 · EXTERNAL CAPABILITY GATEWAY</p>
              <h1 id="honglusi-heading">鸿胪寺</h1>
            </div>
          </div>
          <div className={styles.truthNotice}>
            <strong>DEMO</strong>
            <span>待接入真实事实源</span>
          </div>
          <nav className={styles.viewTabs} aria-label="鸿胪寺研判视角">
            {VIEW_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={view === tab.id}
                onClick={() => setView(tab.id)}
              >
                <i aria-hidden="true">{tab.mark}</i>
                {tab.label}
              </button>
            ))}
          </nav>
        </header>

        <section className={styles.truthTriptych} aria-label="鸿胪寺今日判断">
          <article>
            <span>发生什么</span>
            <strong>外部能力快速增加，准入证据仍不完整</strong>
          </article>
          <article>
            <span>需要朕决定什么</span>
            <strong>是否允许所选能力进入受限沙箱</strong>
          </article>
          <article>
            <span>朝堂下一步替你做什么</span>
            <strong>核对权限、证据与影响，再形成准入建议</strong>
          </article>
        </section>

        <div className={styles.gatewayGrid}>
          <aside className={styles.registryPanel} aria-labelledby="registry-heading">
            <div className={styles.panelHeading}>
              <div>
                <p>来使名录</p>
                <h2 id="registry-heading">外部能力</h2>
              </div>
              <span>{HONGLUSI_CAPABILITIES.length} 份护照</span>
            </div>
            <div className={styles.categoryLedger}>
              {HONGLUSI_CATEGORIES.map((category) => (
                <span key={category}>
                  {category}
                  <b>{HONGLUSI_CAPABILITIES.filter((item) => item.category === category).length}</b>
                </span>
              ))}
            </div>
            <div className={styles.capabilityList}>
              {HONGLUSI_CAPABILITIES.map((capability) => (
                <button
                  key={capability.id}
                  type="button"
                  aria-pressed={selected.id === capability.id}
                  data-status={capability.status}
                  onClick={() => {
                    setSelectedId(capability.id);
                    setAssessment("idle");
                    setReply(`演示回复：已切换至${capability.name}；可继续询问影响、风险与准入条件。`);
                  }}
                >
                  <span className={styles.capabilityMark} aria-hidden="true">
                    {capability.category.slice(0, 1)}
                  </span>
                  <span>
                    <strong>{capability.name}</strong>
                    <small>{capability.category} · {capability.status}</small>
                  </span>
                  <i aria-hidden="true" />
                </button>
              ))}
            </div>
          </aside>

          <section className={styles.gatewayStage} aria-labelledby="honglusi-stage-heading">
            <div className={styles.stageHeader}>
              <div>
                <p>{viewCopy.eyebrow}</p>
                <h2 id="honglusi-stage-heading">{viewCopy.title}</h2>
                <span>{viewCopy.detail}</span>
              </div>
              <span className={styles.stageIndex}>HLS · 01</span>
            </div>

            <div className={styles.gateVisual} aria-label="外部能力准入路径演示">
              <div className={styles.gateOrbit} aria-hidden="true">
                <span className={styles.orbitOuter} />
                <span className={styles.orbitMiddle} />
                <span className={styles.orbitInner} />
                <i className={styles.orbitNodeOne} />
                <i className={styles.orbitNodeTwo} />
                <i className={styles.orbitNodeThree} />
                <div className={styles.gateCore}>
                  <small>准入闸门</small>
                  <strong>鸿胪</strong>
                  <b>DEMO</b>
                </div>
              </div>
              <ol className={styles.routeSteps}>
                <li><span>01</span>外部来使</li>
                <li><span>02</span>鸿胪核验</li>
                <li><span>03</span>翰林治理</li>
                <li><span>04</span>朝堂调用</li>
              </ol>
            </div>

            <article className={styles.passport} aria-labelledby="passport-heading">
              <div className={styles.passportTitle}>
                <div>
                  <p>CAPABILITY PASSPORT · DEMO</p>
                  <h3 id="passport-heading">能力护照 · {selected.name}</h3>
                </div>
                <span data-risk={selected.risk.level}>风险 {selected.risk.level}</span>
              </div>
              <p className={styles.summary}>{selected.summary}</p>
              <dl>
                <div><dt>来源</dt><dd>{selected.source}</dd></div>
                <div><dt>数据等级</dt><dd>{selected.dataClass}</dd></div>
                <div><dt>准入状态</dt><dd>{selected.status}</dd></div>
                <div><dt>核验时间</dt><dd>{selected.lastVerifiedLabel}</dd></div>
              </dl>
              <div className={styles.passportColumns}>
                <div>
                  <h4>权限边界</h4>
                  {selected.permissions.map((permission) => <p key={permission}>— {permission}</p>)}
                </div>
                <div>
                  <h4>影响范围</h4>
                  {selected.impact.map((impact) => <p key={impact}>— {impact}</p>)}
                </div>
              </div>
            </article>
          </section>

          <aside className={styles.decisionPanel} aria-labelledby="decision-heading">
            <div className={styles.panelHeading}>
              <div>
                <p>国门警报</p>
                <h2 id="decision-heading">预警与待决</h2>
              </div>
              <span className={styles.alertCount}>{STATUS_COUNTS.阻断 + STATUS_COUNTS.待审}</span>
            </div>

            <article className={styles.warning}>
              <span data-risk={selected.risk.level}>{selected.risk.level}风险 · DEMO</span>
              <h3>{selected.risk.reason}</h3>
              <dl>
                <div><dt>影响什么</dt><dd>{selected.impact.join("、")}</dd></div>
                <div><dt>为什么</dt><dd>当前护照来自演示目录，仍待真实证据核对。</dd></div>
                <div><dt>下一步</dt><dd>{selected.nextAction}</dd></div>
              </dl>
            </article>

            <article className={styles.decisionCard}>
              <span>御前待决 · 1</span>
              <h3>是否允许进入受限沙箱？</h3>
              <p>建议先限制为脱敏、只读、可撤销的最小范围，再观察真实任务改善。</p>
              <div className={styles.assessmentState} aria-live="polite">
                {assessment === "reviewed"
                  ? "演示评估已展开：仍须真实事实源与独立审查。"
                  : "尚未展开演示评估。"}
              </div>
              <button
                type="button"
                className={styles.primaryAction}
                data-honglusi-primary-action
                onClick={handleAssessment}
              >
                发起准入评估（演示）
              </button>
            </article>

            <section className={styles.statusLedger} aria-label="准入状态统计">
              {(Object.entries(STATUS_COUNTS) as [HonglusiAdmissionStatus, number][]).map(([status, count]) => (
                <span key={status} data-status={status}><b>{count}</b>{status}</span>
              ))}
            </section>
          </aside>
        </div>
      </section>
    </ImmersiveCourtShell>
  );
}
