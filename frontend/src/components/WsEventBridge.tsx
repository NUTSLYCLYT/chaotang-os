'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { getSocket } from '@/lib/socket';
import { SOCKET_EVENTS } from '@/lib/contracts/events';
import type {
  SwarmStatusUpdateEvent,
  SwarmOutputUpdateEvent,
  CommandCallbackEvent,
  AgentStatusUpdateEvent,
} from '@/lib/contracts/events';

const SWARM_NAMES: Record<string, string> = {
  'swarm-hu-bu': '户部',
  'swarm-gong-bu': '工部',
  'swarm-li-bu': '吏部',
  'swarm-li-bu-rites': '礼部',
  'swarm-bing-bu': '兵部',
  'swarm-xing-bu': '刑部',
};

const STATUS_LABEL: Record<string, string> = {
  online: '在线', busy: '忙碌', blocked: '阻塞', warning: '警觉',
  done: '完成', offline: '离线',
};

function swarmName(id: string): string {
  return SWARM_NAMES[id] ?? id;
}

/**
 * Bridges A's NestJS WebSocket events to B's overlay components.
 *
 *   command:callback         → court:seal-stamp + toast (decision stamped)
 *   swarm:status-update      → toast
 *   swarm:overview-update    → silent (consumers refetch via SWR)
 *   swarm:output-update      → toast
 *   agent:status-update      → toast
 */
export function WsEventBridge() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!process.env.NEXT_PUBLIC_WS_URL && process.env.NEXT_PUBLIC_ENABLE_WS !== '1') return;
    // WS gateway has no auth (cors:* + no JWT guard); connect on mount.
    // If gateway later requires auth, add token to handshake here.
    const socket = getSocket();
    if (!socket.connected) socket.connect();

    function onSwarmStatus(e: SwarmStatusUpdateEvent) {
      const label = STATUS_LABEL[e.status] ?? e.status;
      toast(`${swarmName(e.swarmId)}：${label}`, { duration: 2500 });
    }

    function onSwarmOutput(e: SwarmOutputUpdateEvent) {
      toast(`${swarmName(e.swarmId)} 有新产出`, { duration: 2500 });
    }

    function onAgentStatus(e: AgentStatusUpdateEvent) {
      const label = STATUS_LABEL[e.status] ?? e.status;
      toast(`${swarmName(e.swarmId)} · agent ${e.agentId.slice(0, 8)}：${label}`, {
        duration: 2000,
      });
    }

    function onCommandCallback(e: CommandCallbackEvent) {
      const ok = isOk(e.result);
      // Trigger the imperial seal animation
      window.dispatchEvent(new CustomEvent('court:seal-stamp', {
        detail: { verdict: ok ? '准' : '驳', note: `指令 ${e.commandId.slice(0, 8)} 已批` },
      }));
      toast.success(`指令回写：${ok ? '准' : '驳'}`, { duration: 2500 });
    }

    socket.on(SOCKET_EVENTS.SWARM_STATUS_UPDATE, onSwarmStatus);
    socket.on(SOCKET_EVENTS.SWARM_OUTPUT_UPDATE, onSwarmOutput);
    socket.on(SOCKET_EVENTS.AGENT_STATUS_UPDATE, onAgentStatus);
    socket.on(SOCKET_EVENTS.COMMAND_CALLBACK, onCommandCallback);

    return () => {
      socket.off(SOCKET_EVENTS.SWARM_STATUS_UPDATE, onSwarmStatus);
      socket.off(SOCKET_EVENTS.SWARM_OUTPUT_UPDATE, onSwarmOutput);
      socket.off(SOCKET_EVENTS.AGENT_STATUS_UPDATE, onAgentStatus);
      socket.off(SOCKET_EVENTS.COMMAND_CALLBACK, onCommandCallback);
    };
  }, []);

  return null;
}

function isOk(result: unknown): boolean {
  if (result && typeof result === 'object' && 'success' in result) {
    return Boolean((result as { success?: unknown }).success);
  }
  return true;
}
