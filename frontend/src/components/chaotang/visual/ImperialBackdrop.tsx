import { assetUrl } from '@/lib/asset';

export function ImperialBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[#02050d]">
      <div
        className="absolute inset-0 scale-[1.02] bg-cover bg-center opacity-95 contrast-[1.08] saturate-[1.02]"
        style={{
          backgroundImage: `image-set(url(${assetUrl('/assets/dadian/hall-stage-tang-1280.avif')}) type("image/avif"), url(${assetUrl('/assets/dadian/hall-stage-tang.webp?v=2')}) type("image/webp"))`,
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,5,13,0.72)_0%,rgba(2,5,13,0.18)_30%,rgba(2,5,13,0.48)_68%,rgba(2,5,13,0.92)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(76%_58%_at_50%_42%,rgba(240,198,106,0.12),rgba(3,10,17,0.08)_40%,rgba(2,5,13,0.72)_100%)]" />
      <div className="absolute inset-0 opacity-[0.18] mix-blend-screen [background-image:linear-gradient(90deg,transparent_0,rgba(240,198,106,0.18)_50%,transparent_100%),repeating-linear-gradient(0deg,rgba(244,231,192,0.12)_0px,rgba(244,231,192,0.12)_1px,transparent_1px,transparent_18px)]" />
      <div className="absolute left-1/2 top-[26%] h-[46rem] w-[46rem] -translate-x-1/2 rounded-full bg-[#F0C66A]/10 blur-3xl motion-safe:animate-breathe" />
      <div className="absolute inset-y-0 left-0 w-56 bg-gradient-to-r from-[#02050d]/90 to-transparent" />
      <div className="absolute inset-y-0 right-0 w-56 bg-gradient-to-l from-[#02050d]/90 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#02050d] to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#02050d] to-transparent" />
    </div>
  );
}
