"use client";

import { useId, type ButtonHTMLAttributes } from "react";

import {
  createCourtExplanationId,
  resolveCourtCapabilityButtonState,
  type CourtCapability,
} from "./types";
import styles from "./CourtCapabilityButton.module.css";

export function CourtCapabilityButton({
  capability,
  explanation,
  children,
  disabled,
  "aria-describedby": describedBy,
  ...buttonProps
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  capability: CourtCapability;
  explanation: string;
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
    <span className={styles.wrapper}>
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
