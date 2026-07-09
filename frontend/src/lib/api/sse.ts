import { API_MODE } from './client';

export interface V1Event {
  id: string;
  taskId: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface SseSubscription {
  close: () => void;
}

export function subscribeToEventStream(
  onEvent: (event: V1Event) => void,
  options: { onError?: (err: Event) => void; onOpen?: () => void } = {},
): SseSubscription {
  void onEvent;
  void options;

  if (API_MODE === 'mock') {
    return { close: () => undefined };
  }

  return { close: () => undefined };
}
