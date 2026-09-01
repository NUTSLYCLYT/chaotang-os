import type { ReactElement, ReactNode } from "react";

export type CourtCapability = "enabled" | "readonly" | "unavailable";
export type CourtDataState = "loading" | "empty" | "ready" | "error";

export interface ImmersiveCourtShellProps {
  children: ReactNode;
  overlay?: ReactNode;
  currentLabel: string;
  currentPath: string;
  backgroundImage: string;
  quickDockCenter?: ReactElement | null;
  showQuickDockHandle?: boolean;
  showVeil?: boolean;
  fullBleedContent?: boolean;
  hideScrollbar?: boolean;
  scene: "study" | "dadian" | "junjichu" | "liubu" | "honglusi" | "shiguan";
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
