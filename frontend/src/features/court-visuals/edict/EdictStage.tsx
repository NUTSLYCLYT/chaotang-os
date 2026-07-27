"use client";

import type { CSSProperties, ReactNode } from "react";

import styles from "./EdictStage.module.css";

export type EdictTheme = "imperial" | "secret";

export interface EdictSealView {
  glyph: string;
  first: string;
  second: string;
}

export interface EdictDocumentView {
  id: string;
  kicker?: string;
  title: string;
  issuer?: string;
  seal?: EdictSealView;
}

export interface EdictStageProps {
  document: EdictDocumentView;
  children: ReactNode;
  footer?: ReactNode;
  theme?: EdictTheme;
  className?: string;
  bodyLabel?: string;
}

const DEFAULT_SEALS: Record<EdictTheme, EdictSealView> = {
  imperial: { glyph: "御览", first: "御", second: "览" },
  secret: { glyph: "機密", first: "機", second: "密" },
};

function SideRoller({ side }: { side: "left" | "right" }) {
  return (
    <span
      aria-hidden="true"
      className={`${styles.sideRoller} ${
        side === "left" ? styles.sideRollerLeft : styles.sideRollerRight
      }`}
    >
      <span className={styles.rollerSilk} />
      <span className={styles.rollerHighlight} />
      <span className={styles.rollerShadeTop} />
      <span className={styles.rollerShadeBottom} />
      <span className={styles.rollerCollarTop} />
      <span className={styles.rollerCollarBottom} />
      <span className={styles.rollerJadeTop} />
      <span className={styles.rollerJadeBottom} />
    </span>
  );
}

function BrocadeBorder({ edge }: { edge: "top" | "bottom" }) {
  return (
    <span
      aria-hidden="true"
      className={`${styles.brocade} ${
        edge === "top" ? styles.brocadeTop : styles.brocadeBottom
      }`}
    />
  );
}

export function EdictStage({
  document,
  children,
  footer,
  theme = "imperial",
  className = "",
  bodyLabel = "圣旨正文",
}: EdictStageProps) {
  const seal = document.seal ?? DEFAULT_SEALS[theme];

  return (
    <div className={`${styles.stage} ${className}`} data-edict-theme={theme}>
      <div key={document.id} className={styles.keyedStage}>
        <SideRoller side="left" />
        <SideRoller side="right" />

        <section
          className={`${styles.paper} ${
            theme === "secret" ? styles.paperSecret : styles.paperImperial
          }`}
          data-three-axis-scroll
          aria-label="圣旨展示面板"
        >
          <span className={styles.sealRing} aria-hidden="true" />
          <span className={styles.seal} aria-hidden="true">
            {seal.glyph}
          </span>
          <span className={styles.paperRailLeft} aria-hidden="true" />
          <span className={styles.paperRailRight} aria-hidden="true" />
          <span className={styles.paperFibers} aria-hidden="true" />
          <span className={styles.paperSheen} aria-hidden="true" />
          <span className={styles.paperFrame} aria-hidden="true" />
          <span className={styles.paperVignette} aria-hidden="true" />
          <BrocadeBorder edge="top" />
          <BrocadeBorder edge="bottom" />
          {theme === "secret" ? (
            <span className={styles.secretWeave} aria-hidden="true" />
          ) : null}

          <div className={`${styles.paperContent} ${footer ? styles.hasFooter : ""}`}>
            <header className={styles.header}>
              <div className={styles.kicker}>
                <span aria-hidden="true" />
                {document.kicker ?? "奉天承运"}
                <span aria-hidden="true" />
              </div>
              <div className={styles.titleRow}>
                <h2>{document.title}</h2>
                <span
                  className={styles.cornerSeal}
                  aria-label={`${seal.first}${seal.second}之印`}
                >
                  <span>{seal.first}</span>
                  <span>{seal.second}</span>
                </span>
              </div>
              <div className={styles.issuer}>
                {document.issuer ?? (theme === "secret" ? "军机处 · 機密" : "皇帝诏曰")}
              </div>
              <div className={styles.headerDivider} aria-hidden="true">
                <span />
                <b>◆</b>
                <span />
              </div>
            </header>

            <div className={styles.body} aria-label={bodyLabel}>
              {children}
            </div>
          </div>

          {footer ? <footer className={styles.footer}>{footer}</footer> : null}
        </section>
      </div>
    </div>
  );
}

export interface CollapsedEdictScrollProps {
  title: string;
  status: string;
  source: string;
  countLabel: string;
  onOpen(): void;
  className?: string;
}

function CollapsedRoller({ side }: { side: "left" | "right" }) {
  return (
    <span
      aria-hidden="true"
      className={`${styles.collapsedRoller} ${
        side === "left" ? styles.collapsedRollerLeft : styles.collapsedRollerRight
      }`}
    >
      <span className={styles.collapsedBarrel} />
      <span className={styles.collapsedJade} />
    </span>
  );
}

export function CollapsedEdictScroll({
  title,
  status,
  source,
  countLabel,
  onOpen,
  className = "",
}: CollapsedEdictScrollProps) {
  const titleStyle = {
    "--collapsed-title-spacing": title.length <= 8 ? "0.08em" : "0",
  } as CSSProperties;

  return (
    <button
      type="button"
      onClick={onOpen}
      data-three-axis-scroll
      data-testid="collapsed-edict-scroll"
      className={`${styles.collapsedEdict} ${className}`}
      aria-label="展开圣旨"
    >
      <span className={styles.collapsedGlow} aria-hidden="true" />
      <span className={styles.collapsedGrid}>
        <CollapsedRoller side="left" />
        <span className={styles.collapsedPaper}>
          <span className={styles.collapsedRailLeft} aria-hidden="true" />
          <span className={styles.collapsedRailRight} aria-hidden="true" />
          <span className={styles.collapsedLight} aria-hidden="true" />
          <span className={styles.collapsedWatermark} aria-hidden="true">旨</span>
          <span className={styles.collapsedLineTop} aria-hidden="true" />
          <span className={styles.collapsedLineBottom} aria-hidden="true" />
          <span className={styles.collapsedContent}>
            <span className={styles.collapsedCopy}>
              <strong style={titleStyle}>{title}</strong>
              <small>
                <span>{status}</span>
                <i aria-hidden="true">·</i>
                <span className={styles.collapsedSource}>{source}</span>
                <i aria-hidden="true">·</i>
                <span>{countLabel}</span>
              </small>
            </span>
            <span className={styles.openPill}>
              展卷
              <span aria-hidden="true">↗</span>
            </span>
          </span>
          <span className={styles.collapsedCornerSeal} aria-hidden="true">封</span>
        </span>
        <CollapsedRoller side="right" />
      </span>
    </button>
  );
}
