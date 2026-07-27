import { backendFetch, backendJson } from '@/lib/backend-api';
import type {
  ContractTaskReadModelV1,
  CreateDeliveryRequest,
  DecisionRequest,
  DeliveryCommandResponse,
  MissionConfirmRequest,
  TaskDecisionResponse,
} from '@/lib/contracts/backend-openapi-2026-07-21';

import { parseContractTaskReadModel } from './read-model';

export function contractTaskReadModelPath(taskId: string): string {
  return `/api/contracts/tasks/${encodeURIComponent(taskId)}/read-model`;
}

export async function getContractTaskReadModel(
  taskId: string,
): Promise<ContractTaskReadModelV1> {
  const value = await backendJson<unknown>(contractTaskReadModelPath(taskId));
  return parseContractTaskReadModel(value, taskId);
}

export async function confirmContractMission(
  taskId: string,
  body: MissionConfirmRequest,
): Promise<unknown> {
  return backendJson(
    `/api/contracts/mission/${encodeURIComponent(taskId)}/confirm`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

export async function createContractDelivery(
  body: CreateDeliveryRequest,
): Promise<DeliveryCommandResponse> {
  return backendJson<DeliveryCommandResponse>('/api/artifacts/deliveries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function approveContractTask(
  taskId: string,
  body: DecisionRequest,
): Promise<TaskDecisionResponse> {
  return backendJson<TaskDecisionResponse>(
    `/api/shangshufang/tasks/${encodeURIComponent(taskId)}/decision`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

export async function downloadContractArtifact(
  downloadUrl: string,
  filename: string,
): Promise<void> {
  const response = await backendFetch(downloadUrl);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const objectUrl = URL.createObjectURL(await response.blob());
  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.click();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
