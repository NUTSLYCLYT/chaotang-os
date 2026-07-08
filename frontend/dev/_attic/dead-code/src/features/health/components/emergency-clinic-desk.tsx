'use client';

/**
 * 太医院 · 急救·就医台（2026-06-24 · 需求#2）。
 *
 * 只显示信息、不自动操作(用户红线):
 *   - 急救:标准步骤一键展开 + 拨120(tel,用户点击拨号,非自动) —— 恐慌时一眼可达。
 *   - 就医挂号:跳转真挂号渠道(最后一下用户点,AI 绝不替你下单);真号源未接诚实「待接」。
 * 不诊断、不假成交。配色随太医院青碧医道。
 */

import { useState } from 'react';
import { Siren, Phone, Stethoscope, Pill, ExternalLink, MapPin } from 'lucide-react';
import { FIRST_AID } from '@/features/health/lib/first-aid';

const ACCENT = '#34D399';
const ALERT = '#FF6B6B';
const INK = '#E8FFF5';

// 真挂号/购药渠道(跳转,不代下单)。可后续按地域配置。
const CHANNELS = [
  { label: '去挂号', sub: '114 预约挂号官方平台', icon: Stethoscope, href: 'https://www.114yygh.com/' },
  { label: '查药房', sub: '附近药房/购药(跳转真服务)', icon: Pill, href: 'https://map.baidu.com/search/药房' },
];

export function EmergencyClinicDesk() {
  const [aidKey, setAidKey] = useState<string>(FIRST_AID[0]?.key ?? '');
  const active = FIRST_AID.find((a) => a.key === aidKey) ?? FIRST_AID[0];

  return (
    <div
      className="rounded-2xl border p-5"
      style={{ borderColor: `${ACCENT}30`, background: `linear-gradient(180deg, ${ACCENT}0d, ${ACCENT}04)` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em]" style={{ color: ACCENT }}>
          <Siren size={15} /> 急救 · 就医台
        </div>
        {/* 拨120:最危急动作,醒目常驻;tel 链接=用户点击拨号,非自动 */}
        <a
          href="tel:120"
          className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-all hover:brightness-110"
          style={{ background: `${ALERT}22`, border: `1px solid ${ALERT}66`, color: '#FFB3B3' }}
        >
          <Phone size={13} /> 拨 120
        </a>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {/* 急救信息(显示·一键展开) */}
        <div>
          <div className="flex flex-wrap gap-1.5">
            {FIRST_AID.map((a) => {
              const on = a.key === aidKey;
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => setAidKey(a.key)}
                  className="rounded-full border px-2.5 py-1 text-[11px] transition-all"
                  style={on ? { borderColor: `${ACCENT}66`, color: ACCENT, background: `${ACCENT}12` } : { borderColor: 'rgba(232,255,245,0.14)', color: '#9FC4B4' }}
                >
                  {a.name}
                </button>
              );
            })}
          </div>
          <ol className="mt-3 space-y-1.5">
            {active?.steps.map((s, i) => (
              <li key={i} className="flex gap-2 text-[12.5px] leading-5" style={{ color: INK }}>
                <span className="mt-0.5 shrink-0 text-[11px] font-bold" style={{ color: ACCENT }}>{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[10px] text-[#5C7A6E]">标准公开急救常识·仅供参考;危急一律拨 120,以专业救援为准。</p>
        </div>

        {/* 就医挂号(显示信息 + 跳转真渠道·不代下单) */}
        <div className="md:border-l md:pl-4" style={{ borderColor: 'rgba(232,255,245,0.08)' }}>
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-[#7FA896]">
            <MapPin size={13} /> 就医 · 挂号
          </div>
          <div className="mt-2 space-y-2">
            {CHANNELS.map(({ label, sub, icon: Icon, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-all hover:brightness-110"
                style={{ borderColor: `${ACCENT}22`, background: 'rgba(232,255,245,0.03)' }}
              >
                <Icon size={15} style={{ color: ACCENT }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-semibold" style={{ color: INK }}>{label}</span>
                  <span className="block text-[10.5px] text-[#7FA896]">{sub}</span>
                </span>
                <ExternalLink size={12} className="text-[#5C7A6E]" />
              </a>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[10.5px] text-[#BDAA7C]">
            <span className="rounded border px-1.5 py-0.5 font-mono" style={{ borderColor: 'rgba(240,198,106,0.34)' }}>待接</span>
            就近号源/定位提醒需接真实服务后开启 · 跳转后由您本人确认挂号,AI 不代下单。
          </div>
        </div>
      </div>
    </div>
  );
}
