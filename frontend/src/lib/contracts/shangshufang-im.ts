export type ShangshufangImRole = 'user' | 'assistant';
export type ShangshufangImMode = 'ask' | 'order' | 'secret';

export interface ShangshufangImMessage {
  id: string;
  role: ShangshufangImRole;
  label: string;
  text: string;
  time: string;
  createdAt?: string;
  mode?: ShangshufangImMode | null;
}

export interface ShangshufangImListData {
  messages: ShangshufangImMessage[];
}

export interface ShangshufangImPersistData {
  message: ShangshufangImMessage;
}

