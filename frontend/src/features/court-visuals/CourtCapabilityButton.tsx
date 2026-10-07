"use client";

import { useId, type ButtonHTMLAttributes } from "react";

import {
  createCourtExplanationId,
  resolveCourtCapabilityButtonState,
  type CourtCapability,
} from "./types";
import styles from "./CourtCapabilityButton.module.css";

export type CourtCapabilityButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "accent";
export type CourtCapabilityButtonSize = "sm" | "md" | "lg";

export function CourtCapabilityButton({
  capability,
  explanation,
  children,
  disabled,
  variant = "secondary",
  size = "md",
  "aria-describedby": describedBy,
  ...buttonProps
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  capability: CourtCapability;
  explanation: string;
  /** 语义层级；默认 secondary 与升级前视觉一致。 */
  variant?: CourtCapabilityButtonVariant;
  /** 尺寸；默认 md（44px 触控目标）。 */
  size?: CourtCapabilityButtonSize;
}) {
  const instanceId = useId();
  const explanationId = createCourtExplanationId(instanceId);
  const state = resolveCourtCapabilityButtonState(
    capability,
    explanationId,
    disabled,
    describedBy,
  );

  return (
    <span className={styles.wrapper} data-variant={variant} data-size={size}>
      <button
        {...buttonProps}
        aria-describedby={state.ariaDescribedBy}
        disabled={state.disabled}
      >
        {children}
      </button>
      <small id={explanationId}>{explanation}</small>
    </span>
  );
}
