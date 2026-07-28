import type { ReactElement } from "react";

export type CourtQuickDockLayout = "without-center" | "with-center";

export function resolveCourtQuickDockLayout(
  centerSlot?: ReactElement | null,
): CourtQuickDockLayout {
  return centerSlot == null ? "without-center" : "with-center";
}
