export interface ConsultMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChancellorConsultState {
  messages: ConsultMessage[];
  pending: boolean;
  error: string | null;
}

export const EMPTY_CONSULT_STATE: ChancellorConsultState = { messages: [], pending: false, error: null };

export function beginConsult(state: ChancellorConsultState): ChancellorConsultState {
  return state.pending ? state : { ...state, pending: true, error: null };
}

export function finishConsult(
  state: ChancellorConsultState,
  userContent: string,
  reply: string,
): ChancellorConsultState {
  return {
    messages: [...state.messages, { role: "user", content: userContent }, { role: "assistant", content: reply }],
    pending: false,
    error: null,
  };
}

export function failConsult(state: ChancellorConsultState): ChancellorConsultState {
  return { ...state, pending: false, error: "丞相（咨询）暂时无法回应，请稍后再试" };
}

export type StudyDrawerSide = "left" | "right";

export function closeStudyDrawer(
  side: StudyDrawerSide,
  setOpen: (value: null) => void,
  trigger: { focus(): void } | null,
  schedule: (callback: () => void) => void,
): void {
  setOpen(null);
  schedule(() => trigger?.focus());
}
