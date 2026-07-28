"use client";

import { useEffect, useState, type ChangeEvent } from "react";

import type { DecreeUiState } from "../../app/study/decreeStatus";
import {
  CollapsedEdictScroll,
  EdictStage,
} from "../court-visuals/edict/EdictStage";
import { ImmersiveCourtShell } from "../court-visuals/ImmersiveCourtShell";
import styles from "./DevStudyWorkspace.module.css";
import { getStudyDepartmentCountLabel } from "./studyWorkspaceState";

const ONBOARDED_KEY = "courtos.onboarded";
const RULER_STYLE_KEY = "courtos.ruler.style";
const FIRST_DECREE =
  "制定 2027 年旗舰产品发布战略 · 财务预算 · 竞品扫描 · 营销节奏 · 全球合规 · 上市时机";

type RulerStyle = "strict" | "benevolent" | "diligent";

const RULER_STYLES: Array<{
  id: RulerStyle;
  glyph: string;
  label: string;
  sub: string;
  bullets: string[];
  tone: string;
}> = [
  {
    id: "strict",
    glyph: "◇",
    label: "严政陛下",
    sub: "STRICT SOVEREIGN",
    bullets: ["丞相说话直切要害", "风险必驳 · 不求人情", "急事必先 · 慢事必砍"],
    tone: "臣丞相为您备“直言进谏”模式。",
  },
  {
    id: "benevolent",
    glyph: "♔",
    label: "仁政陛下",
    sub: "BENEVOLENT SOVEREIGN",
    bullets: ["丞相说话温和缜密", "利害权衡 · 照顾全局", "慢事留周旋 · 急事速裁"],
    tone: "臣丞相为您备“圆融议政”模式。",
  },
  {
    id: "diligent",
    glyph: "♨",
    label: "勤政陛下",
    sub: "DILIGENT SOVEREIGN",
    bullets: ["丞相每日主动呈报", "多线并发 · 不等陛下", "执行回写 · 全链透明"],
    tone: "臣丞相为您备“日日勤问”模式。",
  },
];

export interface DevStudyWorkspaceProps {
  decreeText: string;
  uiState: DecreeUiState;
  canEdit: boolean;
  canSubmit: boolean;
  onDecreeTextChange(value: string): void;
  onSubmit(): void;
}

function FirstCourtRitual({
  onClose,
  onUseDraft,
}: {
  onClose(): void;
  onUseDraft(value: string): void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rulerStyle, setRulerStyle] = useState<RulerStyle | null>(null);
  const [draft, setDraft] = useState(FIRST_DECREE);

  function finish() {
    try {
      window.localStorage.setItem(ONBOARDED_KEY, "1");
      if (rulerStyle) window.localStorage.setItem(RULER_STYLE_KEY, rulerStyle);
    } catch {
      // Storage is optional; the ritual remains usable in privacy-restricted browsers.
    }
    onClose();
  }

  function keepDraft() {
    onUseDraft(draft);
    setStep(3);
  }

  return (
    <div className={styles.onboardingBackdrop} role="dialog" aria-modal="true" aria-labelledby="ritual-title">
      <section className={styles.ritual}>
        <header className={styles.ritualHeader}>
          <span>♨</span>
          <strong>陛下御极 · 开朝仪轨</strong>
          <span className={styles.steps} aria-label={`第 ${step} 步，共 3 步`}>
            <i data-active={step === 1} />
            <i data-active={step === 2} />
            <i data-active={step === 3} />
          </span>
        </header>

        {step === 1 && (
          <div className={styles.ritualBody}>
            <p className={styles.eyebrow}>STEP 1 · 朝政之风</p>
            <h2 id="ritual-title">陛下欲以何种风范临朝？</h2>
            <p className={styles.ritualLead}>风格不同，丞相与百官奏对的语气、决策路径、审议严度皆异。日后可随时再改。</p>
            <div className={styles.styleGrid}>
              {RULER_STYLES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={styles.styleCard}
                  data-tone={option.id}
                  data-selected={rulerStyle === option.id}
                  onClick={() => setRulerStyle(option.id)}
                >
                  <span className={styles.styleGlyph}>{option.glyph}</span>
                  <strong>{option.label}</strong>
                  <small>{option.sub}</small>
                  <ul>
                    {option.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                  </ul>
                  <em>{option.tone}</em>
                </button>
              ))}
            </div>
            <div className={styles.ritualActions}>
              <button type="button" className={styles.skip} onClick={finish}>跳过 · 直接进朝堂</button>
              <button type="button" className={styles.primary} disabled={!rulerStyle} onClick={() => setStep(2)}>
                下一步 · 亲下第一道旨　→
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className={styles.ritualBody}>
            <p className={styles.eyebrow}>STEP 2 · 第一道旨</p>
            <h2 id="ritual-title">请陛下亲拟开朝第一道旨</h2>
            <p className={styles.ritualLead}>此处只在本地拟旨，不会自动调用模型或提交业务请求。</p>
            <textarea className={styles.firstDraft} value={draft} onChange={(event) => setDraft(event.target.value)} rows={5} />
            <div className={styles.draftMeta}><span>字数 {draft.length}</span><span>带入御前输入栏后仍可修改</span></div>
            <div className={styles.ritualActions}>
              <button type="button" className={styles.skip} onClick={() => setStep(1)}>← 返回上一步</button>
              <button type="button" className={styles.primary} disabled={!draft.trim()} onClick={keepDraft}>
                带入御前输入　→
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className={styles.ritualBody}>
            <p className={styles.eyebrow}>STEP 3 · 朝堂动线</p>
            <h2 id="ritual-title">圣意已置于御前</h2>
            <p className={styles.ritualLead}>请核对旨意内容。只有您亲自点击“下旨”，系统才会进入真实办理流程。</p>
            <div className={styles.hintGrid}>
              <article><strong>今日圣旨</strong><span>收卷看殿，展卷读回奏</span></article>
              <article><strong>御前输入</strong><span>拟好旨意后，即可交由百官会审</span></article>
              <article><strong>真实办理</strong><span>亲自下旨后才调用当前接口</span></article>
            </div>
            <div className={styles.ritualActions}>
              <button type="button" className={styles.skip} onClick={() => setStep(2)}>← 返回改旨</button>
              <button type="button" className={styles.primary} onClick={finish}>进入朝堂　›</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export function DevStudyWorkspace(props: DevStudyWorkspaceProps) {
  const [expanded, setExpanded] = useState(false);
  const [polished, setPolished] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [showRitual, setShowRitual] = useState(false);
  const showScroll = expanded || props.uiState.phase !== "idle";
  const hasRealReply = props.uiState.phase === "success";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const forceForQa = new URLSearchParams(window.location.search).get("ritual") === "1";
        setShowRitual(forceForQa || window.localStorage.getItem(ONBOARDED_KEY) !== "1");
      } catch {
        setShowRitual(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    setAttachments(Array.from(event.target.files ?? []).map((file) => file.name).slice(0, 3));
    event.currentTarget.value = "";
  }

  const composer = (
    <section className={styles.composer} aria-label="御前下旨">
      {(polished || attachments.length > 0) && (
        <p className={styles.localNotice}>
          {polished ? "润色预览已开启 · 未调用模型" : ""}
          {polished && attachments.length ? "　·　" : ""}
          {attachments.length ? `本地待附 ${attachments.length} 份 · 提交接口暂不上传附件` : ""}
        </p>
      )}
      <div className={styles.composerRow}>
        <button type="button" className={styles.polish} data-testid="decree-polish-inline" data-active={polished} onClick={() => setPolished((value) => !value)} disabled={!props.canEdit}>✦ 润色</button>
        <label className={styles.attach} data-testid="decree-evidence-upload" title="选择本地补证附件（当前不会上传）">上传附件<input type="file" multiple onChange={handleFiles} disabled={!props.canEdit} /></label>
        <textarea id="decree-text" data-testid="decree-textarea" value={props.decreeText} onChange={(event) => props.onDecreeTextChange(event.target.value)} rows={1} maxLength={2000} disabled={!props.canEdit} placeholder="请写下要交由丞相与六部会审的旨意……" />
        <button type="button" className={styles.submit} data-testid="submit-decree-button" disabled={!props.canSubmit} onClick={props.onSubmit}>{props.uiState.phase === "submitting" ? "办理中" : "下旨"}</button>
      </div>
    </section>
  );

  return (
    <ImmersiveCourtShell
      currentLabel="上书房"
      currentPath="/study"
      backgroundImage="/shangshufang/bg-shangshufang-scene.webp"
      quickDockCenter={composer}
      scene="study"
    >
      <div className={styles.stage}>
        <div className={styles.warning} role="status">
          <span aria-hidden="true">△</span>
          真实任务库暂不可读 · 当前为本地兜底骨架，请勿当作最终裁决依据。
        </div>

        <button className={styles.scrollToggle} type="button" onClick={() => setExpanded((value) => !value)}>
          <span aria-hidden="true">{showScroll ? "↙" : "↗"}</span>
          {showScroll ? "收卷看殿" : "展卷"}
        </button>

        <section
          className={`${styles.edictSlot} ${
            showScroll
              ? hasRealReply
                ? styles.expandedSlot
                : styles.emptyExpanded
              : styles.collapsedSlot
          }`}
        >
          {!showScroll ? (
            <CollapsedEdictScroll
              title="今日圣旨"
              status="待裁决"
              source={polished ? "已润色" : "未润色"}
              countLabel={getStudyDepartmentCountLabel(props.uiState)}
              onOpen={() => setExpanded(true)}
            />
          ) : props.uiState.phase === "success" ? (
            <EdictStage
              document={{
                id: `study-${props.uiState.routeType}`,
                kicker: "奉天承运 · 上书房",
                title: "圣旨",
                issuer: "旨意下达 · 丞相回奏 · 史馆留痕",
              }}
              theme="imperial"
              bodyLabel="丞相与百官回奏"
            >
              <section
                className={styles.response}
                data-testid="decree-status"
                data-phase={props.uiState.phase}
                data-decree-ok="true"
                aria-live="polite"
              >
                <div className={styles.returnContent}>
                  <p data-testid="decree-rationale"><strong>{props.uiState.chancellor}判断</strong>{props.uiState.rationale}</p>
                  <p className={styles.path} data-testid="decree-processing-path"><strong>流转路径</strong>{props.uiState.processingPath.join(" → ")}</p>
                  <h2>分层部门意见</h2>
                  <ul data-testid="decree-ministry-opinions">
                    {props.uiState.ministryOpinions.map((opinion) => (
                      <li key={opinion.department}>
                        <h3>{opinion.department}</h3>
                        <ol data-testid={`decree-bureau-opinions-${opinion.department}`}>
                          {opinion.bureauOpinions.map((bureauOpinion) => (
                            <li key={bureauOpinion.bureau}><strong>{bureauOpinion.bureau}</strong>：{bureauOpinion.opinion}</li>
                          ))}
                        </ol>
                        <p><strong>部议：</strong>{opinion.opinion}</p>
                      </li>
                    ))}
                  </ul>
                  {props.uiState.routeType === "multi" && (
                    <p data-testid="decree-council-verdict"><strong>军机处会审：</strong>{props.uiState.councilVerdict}</p>
                  )}
                  <p data-testid="decree-final-verdict"><strong>丞相总结：</strong>{props.uiState.finalVerdict}</p>
                  <h2>丞相三项建议</h2>
                  <ol data-testid="decree-recommendations">
                    {props.uiState.recommendations.map((recommendation) => <li key={recommendation}>{recommendation}</li>)}
                  </ol>
                </div>
              </section>
            </EdictStage>
          ) : (
            <section
              className={styles.emptyStage}
              data-testid="decree-status"
              data-phase={props.uiState.phase}
              data-decree-ok={props.uiState.phase === "error" ? "false" : undefined}
              aria-live="polite"
            >
              {props.uiState.phase === "idle" && <p>暂无奏折，陛下可下达新旨。</p>}
              {props.uiState.phase === "submitting" && <p>圣旨已递，正在等候丞相与百官回奏……</p>}
              {props.uiState.phase === "error" && <p className={styles.emptyError}>下旨失败：{props.uiState.message}</p>}
            </section>
          )}
        </section>

      </div>
      {showRitual && (
        <FirstCourtRitual
          onClose={() => setShowRitual(false)}
          onUseDraft={(value) => props.onDecreeTextChange(value)}
        />
      )}
    </ImmersiveCourtShell>
  );
}
