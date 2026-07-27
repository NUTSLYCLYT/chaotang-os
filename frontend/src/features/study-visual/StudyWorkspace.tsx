import Image from "next/image";

import type { DecreeUiState } from "../../app/study/decreeStatus";
import { ImmersiveCourtShell } from "../court-visuals/ImmersiveCourtShell";
import styles from "./StudyWorkspace.module.css";

export interface StudyWorkspaceProps {
  decreeText: string;
  uiState: DecreeUiState;
  canEdit: boolean;
  canSubmit: boolean;
  onDecreeTextChange(value: string): void;
  onSubmit(): void;
}

export function StudyWorkspace(props: StudyWorkspaceProps) {
  const isSubmitting = props.uiState.phase === "submitting";

  return (
    <ImmersiveCourtShell
      currentLabel="上书房"
      currentPath="/study"
      backgroundImage="/shangshufang/bg-shangshufang-full.webp"
      scene="study"
    >
      <div className={styles.workspace}>
        <aside className={`${styles.rail} ${styles.leftRail}`} aria-labelledby="imperial-order-title">
          <div className={styles.portrait}>
            <Image
              src="/shangshufang/portrait-wang.webp"
              alt=""
              width={160}
              height={180}
              priority
            />
          </div>
          <p className={styles.railKicker}>御前传旨</p>
          <h2 id="imperial-order-title">王命</h2>
          <p>旨意由上书房下达，经丞相判断后分流至对应六部；跨部门事务由军机处依次会审。</p>
          <div className={styles.flowNote}>
            <span>真实流程</span>
            <ol>
              <li>丞相判定单部或多部</li>
              <li>各部先形成司议，再形成部议</li>
              <li>丞相汇总结论与三项建议</li>
            </ol>
          </div>
        </aside>

        <section className={styles.scroll} aria-labelledby="study-title">
          <header className={styles.scrollHeading}>
            <p>奉天承运 · 上书房</p>
            <h1 id="study-title">圣旨</h1>
            <span>内廷拟旨 · 丞相回奏</span>
          </header>

          <p className={styles.lead}>请写明要办之事、目标与边界。只有主动点击“下旨”才会发起真实办理。</p>
          <p className={styles.feeNotice} data-testid="decree-fee-notice">
            <strong>
              费用提示：一次下旨会依次触发司级咨询、部级补充、军机处会审（仅多部门）与丞相汇总；
              最坏可能产生 54 次同步 DeepSeek API 调用并等待较久，请确认内容后再提交。
            </strong>
          </p>

          <section
            className={styles.response}
            data-testid="decree-status"
            data-phase={props.uiState.phase}
            data-decree-ok={
              props.uiState.phase === "success"
                ? "true"
                : props.uiState.phase === "error"
                  ? "false"
                  : undefined
            }
            aria-labelledby="response-title"
            aria-live="polite"
          >
            <div className={styles.responseTitle}>
              <span aria-hidden="true">◆</span>
              <h2 id="response-title">丞相回奏</h2>
              <span aria-hidden="true">◆</span>
            </div>

            {props.uiState.phase === "idle" && (
              <p className={styles.emptyState}>尚未提交旨意。拟旨期间不会调用任何模型或后端办理流程。</p>
            )}
            {props.uiState.phase === "submitting" && (
              <div className={styles.processing}>
                <span className={styles.processingSeal} aria-hidden="true">候</span>
                <p>正在依次完成司级意见、部级补充及最终回奏，最多可能有 54 次同步调用，请耐心等候……</p>
              </div>
            )}
            {props.uiState.phase === "error" && (
              <p className={styles.errorState}>下旨失败：{props.uiState.message}</p>
            )}
            {props.uiState.phase === "success" && (
              <div className={styles.returnContent}>
                <p data-testid="decree-rationale">
                  <strong>{props.uiState.chancellor}判断</strong>
                  {props.uiState.rationale}
                </p>
                <p className={styles.processingPath} data-testid="decree-processing-path">
                  <span>流转路径</span>
                  {props.uiState.processingPath.join(" → ")}
                </p>

                <h3>分层部门意见</h3>
                <ul className={styles.ministryList} data-testid="decree-ministry-opinions">
                  {props.uiState.ministryOpinions.map((opinion) => (
                    <li key={opinion.department}>
                      <h4>{opinion.department}</h4>
                      <p className={styles.opinionLabel}>司级意见</p>
                      <ol data-testid={`decree-bureau-opinions-${opinion.department}`}>
                        {opinion.bureauOpinions.map((bureauOpinion) => (
                          <li key={bureauOpinion.bureau}>
                            <strong>{bureauOpinion.bureau}</strong>：{bureauOpinion.opinion}
                          </li>
                        ))}
                      </ol>
                      <p><strong>部级补充：</strong>{opinion.opinion}</p>
                    </li>
                  ))}
                </ul>

                {props.uiState.routeType === "multi" && (
                  <p className={styles.councilVerdict} data-testid="decree-council-verdict">
                    <strong>军机处会审结论：</strong>{props.uiState.councilVerdict}
                  </p>
                )}
                <p className={styles.finalVerdict} data-testid="decree-final-verdict">
                  <strong>丞相总结：</strong>{props.uiState.finalVerdict}
                </p>
                <h3>丞相三项建议</h3>
                <ol className={styles.recommendations} data-testid="decree-recommendations">
                  {props.uiState.recommendations.map((recommendation) => (
                    <li key={recommendation}>{recommendation}</li>
                  ))}
                </ol>
              </div>
            )}
          </section>

          <div className={styles.composer}>
            <label htmlFor="decree-text">旨意</label>
            <div className={styles.composerRow}>
              <textarea
                id="decree-text"
                data-testid="decree-textarea"
                value={props.decreeText}
                onChange={(event) => props.onDecreeTextChange(event.target.value)}
                rows={2}
                maxLength={2000}
                disabled={!props.canEdit}
                placeholder="直接说您的裁决：准、驳回、补证或让谁先办。"
              />
              <button
                type="button"
                data-testid="submit-decree-button"
                disabled={!props.canSubmit}
                onClick={props.onSubmit}
              >
                <span aria-hidden="true">{isSubmitting ? "候" : "旨"}</span>
                {isSubmitting ? "办理中" : "下旨"}
              </button>
            </div>
            <p>{props.decreeText.length} / 2000 字 · 留空或办理中时不可下旨</p>
          </div>
        </section>

        <aside className={`${styles.rail} ${styles.rightRail}`} aria-labelledby="chancellor-title">
          <div className={styles.portrait}>
            <Image
              src="/shangshufang/portrait-chancellor.webp"
              alt=""
              width={160}
              height={180}
              priority
            />
          </div>
          <p className={styles.railKicker}>百官之首</p>
          <h2 id="chancellor-title">丞相</h2>
          <p className={styles.chancellorStatus}>
            {props.uiState.phase === "success" ? props.uiState.finalVerdict : "候旨办理"}
          </p>
          <div className={styles.flowNote}>
            <span>实际流转</span>
            <p>上书房 → 丞相 → 六部 / 军机处 → 丞相回奏</p>
          </div>
          <div className={styles.capability}>
            <span>当前能力</span>
            <p>展示真实处理路径、司部意见、会审结论与三项建议；不生成模拟结果。</p>
          </div>
        </aside>
      </div>
    </ImmersiveCourtShell>
  );
}
