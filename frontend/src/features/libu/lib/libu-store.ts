/**
 * 朝堂 OS · 御书房 · Client Store
 *
 * 轻量 Zustand + IndexedDB 持久化
 * 不依赖后端 · 陛下本地即全部资产（隐私杀手锏）
 */

'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Scroll, ScrollCategory, ScrollType } from './library-index';
import { chunkText } from './library-index';

interface IngestTextInput {
  title: string;
  body: string;
  category?: ScrollCategory;
  type?: ScrollType;
  source?: string;
  tags?: string[];
}

interface LibuState {
  scrolls: Scroll[];
  lastCitedAt: Record<string, string>;

  addScroll: (input: IngestTextInput) => Scroll;
  removeScroll: (id: string) => void;
  updateScroll: (id: string, patch: Partial<Scroll>) => void;
  addAnnotation: (scrollId: string, text: string, chunkId?: string) => void;
  markCited: (scrollId: string) => void;
  clear: () => void;
}

const STORAGE_KEY = 'courtos.libu.v1';

function genId(prefix = 'scroll'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useLibuStore = create<LibuState>()(
  persist(
    (set) => ({
      scrolls: [],
      lastCitedAt: {},

      addScroll: (input) => {
        const now = new Date().toISOString();
        const id = genId('scroll');
        const chunksText = chunkText(input.body);
        const scroll: Scroll = {
          id,
          title: input.title || '（无题）',
          type: input.type ?? 'text',
          category: input.category ?? '未分',
          source: input.source,
          body: input.body,
          chunks: chunksText.map((t, i) => ({
            id: `${id}_c${i}`,
            scrollId: id,
            index: i,
            text: t,
          })),
          annotations: [],
          createdAt: now,
          tags: input.tags ?? [],
          wordCount: input.body.length,
        };
        set((s) => ({ scrolls: [scroll, ...s.scrolls] }));
        return scroll;
      },

      removeScroll: (id) => {
        set((s) => ({
          scrolls: s.scrolls.filter((x) => x.id !== id),
          lastCitedAt: Object.fromEntries(
            Object.entries(s.lastCitedAt).filter(([k]) => k !== id),
          ),
        }));
      },

      updateScroll: (id, patch) => {
        set((s) => ({
          scrolls: s.scrolls.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        }));
      },

      addAnnotation: (scrollId, text, chunkId) => {
        const now = new Date().toISOString();
        set((s) => ({
          scrolls: s.scrolls.map((x) =>
            x.id === scrollId
              ? {
                  ...x,
                  annotations: [
                    ...x.annotations,
                    {
                      id: genId('ann'),
                      scrollId,
                      chunkId,
                      text,
                      createdAt: now,
                    },
                  ],
                }
              : x,
          ),
        }));
      },

      markCited: (scrollId) => {
        const now = new Date().toISOString();
        set((s) => ({
          lastCitedAt: { ...s.lastCitedAt, [scrollId]: now },
          scrolls: s.scrolls.map((x) =>
            x.id === scrollId ? { ...x, lastCitedAt: now } : x,
          ),
        }));
      },

      clear: () => set({ scrolls: [], lastCitedAt: {} }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
