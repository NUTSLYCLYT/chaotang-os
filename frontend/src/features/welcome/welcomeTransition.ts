export type WelcomePhase = "closed" | "opening";
export type WelcomeEvent = "attend";

export function nextWelcomePhase(current: WelcomePhase, event: WelcomeEvent): WelcomePhase {
  if (current === "closed" && event === "attend") return "opening";
  return current;
}
