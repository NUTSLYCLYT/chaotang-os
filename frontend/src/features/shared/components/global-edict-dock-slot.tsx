'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

interface GlobalEdictDockSlotStateContextValue {
  slot: ReactNode;
  sidePanels: GlobalEdictDockSidePanels;
}

interface GlobalEdictDockSlotActionsContextValue {
  setSlot: Dispatch<SetStateAction<ReactNode>>;
  setSidePanels: Dispatch<SetStateAction<GlobalEdictDockSidePanels>>;
}

export interface GlobalEdictDockSidePanels {
  chancellor?: ReactNode;
  qintian?: ReactNode;
  onOpenChancellor?: () => void;
  onOpenQintian?: () => void;
}

const GlobalEdictDockSlotStateContext = createContext<GlobalEdictDockSlotStateContextValue | null>(null);
const GlobalEdictDockSlotActionsContext = createContext<GlobalEdictDockSlotActionsContextValue | null>(null);
const EMPTY_SIDE_PANELS: GlobalEdictDockSidePanels = {};

function sameSidePanels(a: GlobalEdictDockSidePanels, b: GlobalEdictDockSidePanels) {
  return (
    a.chancellor === b.chancellor &&
    a.qintian === b.qintian &&
    a.onOpenChancellor === b.onOpenChancellor &&
    a.onOpenQintian === b.onOpenQintian
  );
}

export function GlobalEdictDockSlotProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<ReactNode>(null);
  const [sidePanels, setSidePanels] = useState<GlobalEdictDockSidePanels>({});
  const stateValue = useMemo(() => ({ slot, sidePanels }), [slot, sidePanels]);
  const actionsValue = useMemo(() => ({ setSlot, setSidePanels }), [setSlot, setSidePanels]);

  return (
    <GlobalEdictDockSlotActionsContext.Provider value={actionsValue}>
      <GlobalEdictDockSlotStateContext.Provider value={stateValue}>
        {children}
      </GlobalEdictDockSlotStateContext.Provider>
    </GlobalEdictDockSlotActionsContext.Provider>
  );
}

export function useGlobalEdictDockSlot() {
  return useContext(GlobalEdictDockSlotStateContext)?.slot ?? null;
}

export function useGlobalEdictDockSidePanels() {
  return useContext(GlobalEdictDockSlotStateContext)?.sidePanels ?? EMPTY_SIDE_PANELS;
}

export function useRegisterGlobalEdictDockSlot(slot: ReactNode) {
  const context = useContext(GlobalEdictDockSlotActionsContext);
  const setSlot = context?.setSlot;

  useEffect(() => {
    if (!setSlot) return;
    setSlot(slot);
    return () => setSlot(null);
  }, [setSlot, slot]);
}

export function useRegisterGlobalEdictDockSidePanels(sidePanels: GlobalEdictDockSidePanels) {
  const context = useContext(GlobalEdictDockSlotActionsContext);
  const setSidePanels = context?.setSidePanels;
  const latestSidePanelsRef = useRef(sidePanels);

  useEffect(() => {
    if (!setSidePanels) return;
    latestSidePanelsRef.current = sidePanels;
    setSidePanels((current) => (sameSidePanels(current, sidePanels) ? current : sidePanels));
  }, [setSidePanels, sidePanels]);

  useEffect(() => {
    if (!setSidePanels) return;
    return () => {
      setSidePanels((current) => (
        sameSidePanels(current, latestSidePanelsRef.current) ? EMPTY_SIDE_PANELS : current
      ));
    };
  }, [setSidePanels]);
}
