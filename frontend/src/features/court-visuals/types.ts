import type { ReactNode } from "react";

export type CourtCapability = "enabled" | "readonly" | "unavailable";
export type CourtDataState = "loading" | "empty" | "ready" | "error";

export interface ImmersiveCourtShellProps {
  children: ReactNode;
  currentLabel: string;
  currentPath: string;
  backgroundImage: string;
  scene: "study" | "dadian" | "junjichu" | "liubu" | "shiguan";
}

export function createCourtExplanationId(instanceId: string): string {
  return `court-action-${instanceId}-explanation`;
}

export function resolveCourtCapabilityButtonState(
  capability: CourtCapability,
  explanationId: string,
  disabled = false,
  describedBy?: string,
): {
  disabled: boolean;
  ariaDescribedBy: string;
} {
  const existingDescription = describedBy?.trim();

  return {
    disabled: disabled || capability !== "enabled",
    ariaDescribedBy: existingDescription
      ? `${existingDescription} ${explanationId}`
      : explanationId,
  };
}
