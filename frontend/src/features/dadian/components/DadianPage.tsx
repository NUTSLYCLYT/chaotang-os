'use client';

// 顶导由 (dashboard)/layout.tsx 的 ChaotangTopNav 统一接管, 不再渲染自带 TopNav
import PalaceHero from "./PalaceHero";
import BottomBar from "./BottomBar";
import MinisterHotspot from "./MinisterHotspot";
import { ChancellorTodayCard } from "./ChancellorTodayCard";
import { MINISTER_HOTSPOTS } from "@/features/dadian/lib/dadian";
import { assetUrl } from "@/lib/asset";

export default function DadianPage() {
  return (
    <main className="isolate relative h-full min-h-[820px] w-full overflow-hidden bg-[#02050d] text-parchment-50 max-md:h-auto max-md:min-h-[1180px] max-md:overflow-y-auto">
      {/* 全屏连续宫殿底图 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={assetUrl("/assets/dadian/hall-stage-tang.webp?v=2")}
        alt=""
        aria-hidden
        className="absolute inset-0 -z-30 h-full w-full scale-[1.012] object-cover object-center saturate-[1.08] contrast-[1.06]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-20"
        style={{
          background:
            "linear-gradient(180deg, rgba(2,5,13,0.82) 0%, rgba(2,5,13,0.22) 24%, rgba(2,5,13,0.2) 54%, rgba(2,5,13,0.9) 100%), radial-gradient(105% 84% at 50% 42%, rgba(240,198,106,0.05) 0%, rgba(240,198,106,0.02) 28%, rgba(3,8,16,0.36) 64%, rgba(1,3,8,0.82) 100%), radial-gradient(44% 38% at 50% 22%, rgba(242,199,114,0.18), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.18] mix-blend-screen"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(244,231,192,0.14) 0px, rgba(244,231,192,0.14) 1px, transparent 1px, transparent 22px), repeating-linear-gradient(90deg, rgba(240,198,106,0.08) 0px, rgba(240,198,106,0.08) 1px, transparent 1px, transparent 28px)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-[#02050d]/95 via-[#02050d]/52 to-transparent"
      />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-44 bg-gradient-to-t from-[#02050d]/95 via-[#02050d]/55 to-transparent" />
      <div aria-hidden className="absolute left-1/2 top-[118px] -z-10 h-[62vh] w-[min(42vw,620px)] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(240,198,106,0.18)_0%,rgba(240,198,106,0.055)_34%,transparent_72%)] blur-2xl max-md:top-[184px] max-md:w-[84vw]" />
      <div aria-hidden className="absolute left-1/2 top-[132px] -z-10 h-[calc(100%-244px)] w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-[#F0C66A]/28 to-transparent max-md:hidden" />
      <div aria-hidden className="absolute left-8 right-8 top-[128px] bottom-[92px] z-0 rounded-[8px] border border-[#F0C66A]/12 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.025),0_0_80px_rgba(0,0,0,0.32)] max-md:hidden" />
      <div aria-hidden className="absolute left-12 right-12 top-[140px] z-0 h-px bg-gradient-to-r from-transparent via-[#F0C66A]/48 to-transparent max-md:hidden" />
      <div aria-hidden className="absolute left-12 right-12 bottom-[108px] z-0 h-px bg-gradient-to-r from-transparent via-[#F0C66A]/28 to-transparent max-md:hidden" />

      {/* 中央百官点击热区 */}
      {MINISTER_HOTSPOTS.map((h) => (
        <MinisterHotspot key={h.id} h={h} />
      ))}

      {/* —— 悬浮玻璃态 UI —— */}
      {/* 丞相今日要务(御前决策压缩器):左上御前位悬浮,真丞相 LLM 建议,不挤中央御座 */}
      <div className="absolute left-6 top-[152px] z-10 w-[330px] max-xl:w-[300px] max-md:static max-md:mt-4 max-md:w-auto max-md:px-4">
        <ChancellorTodayCard />
      </div>
      <PalaceHero />
      <BottomBar />
    </main>
  );
}
