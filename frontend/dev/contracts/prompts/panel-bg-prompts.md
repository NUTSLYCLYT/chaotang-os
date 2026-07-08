# Chaotang Panel Background Prompts · gpt-image-2

Status: fallback prompt pack only. This environment currently has no `OPENAI_API_KEY`, so no real images were generated.

## Execution Model

Use OpenAI Image API edits endpoint with `model="gpt-image-2"` and multiple reference images:

- `public/shangshufang/bg-shangshufang-full.webp`
- `public/assets/hubu/scene-full.png`
- `public/assets/bingbu/scene-full.png`
- `public/assets/jinyiwei/scene-full.png`
- `public/assets/junjichu/war-room-full.webp`
- `public/assets/dadian/hall-stage-tang.png`

Important size note: requested final asset is `1672x861`, but `gpt-image-2` image sizes must use edges divisible by 16. Generate at `1680x864` or a larger legal landscape size, then crop/resize to exactly `1672x861` PNG.

## STYLE_BLOCK

Use the attached reference images as the primary style anchor. Match their shared cinematic Chinese imperial palace visual language: realistic painterly matte-painting, deep near-black atmosphere, warm imperial gold practical lantern light, bronze and dark lacquer materials, carved timber architecture, Tang/Song court gravitas, layered depth, volumetric haze, subtle dust in light shafts, high craft texture, restrained luxury, not fantasy-game oversaturation. Palette is locked to imperial gold `#F0C66A`, muted gold `#D4A84B`, aged bronze `#8A6A2A`, near-black base `#04060E`, deep blue-black `#06111f`. Overall image must survive heavy UI darkening overlays: keep top, bottom, left and right edges darker and lower detail; preserve low-contrast negative space for panels; avoid busy highlights under likely UI zones. The central visual field should remain calm and readable after `object-cover`, a `#06111f/35` overlay, radial vignette, and top/bottom gradients. No text, no readable characters, no letters, no seals with characters, no logo, no watermark, no modern UI, no close-up faces, no large foreground person.

## Global Negative Prompt

Readable text, Chinese characters, English letters, logos, watermarks, modern interface screens, neon cyberpunk, sci-fi holograms, cartoon, anime, flat illustration, western medieval castle, European cathedral, bright daylight, overexposed sky, saturated purple-blue gradients, cluttered foreground, centered face portrait, close-up person, giant character, modern machinery, plastic materials, random symbols, decorative blobs, low-resolution texture, noisy artifacts, excessive sharpness at the edges.

## 1. gongbu · 工部营造施工

Layout conclusion: `src/app/(dashboard)/gongbu/dev-console/page.tsx` is a dense tool/workbench page. Main content uses top header and stacked cards across the full width. Background should be dark and quiet at all edges, with construction imagery biased to the mid-right/back depth so task cards can float over it.

Prompt:

```text
STYLE_BLOCK.

Create a full-width cinematic background for Gongbu, the Ministry of Works construction console. Scene: an imperial timber construction workshop inside a dark palace compound, half-built wooden pavilion and scaffold structures receding into the back-right, carpentry benches, inked architectural blueprints, wooden rulers, ink line tools, chisels, bronze lamps, stacked beams, sawdust and dust in warm lantern light. The feeling is disciplined state construction, not rustic village craft. Keep the center and left foreground dark, calm, low detail, suitable for dense tool panels. Put the strongest architectural silhouette slightly right of center and deeper in the scene. Heavy near-black vignette around all four edges, muted imperial gold highlights, deep blue-black shadows, realistic painterly matte painting, no people close-up.

Final crop target after generation: 1672x861 PNG. Generate legal size 1680x864 first, then crop to 1672x861.
```

Negative prompt: use Global Negative Prompt plus: sparks flying everywhere, modern cranes, steel factory, construction helmets, readable blueprint labels.

Output: `public/assets/gongbu/scene-full.png`

## 2. reports · 礼部战报库

Layout conclusion: `reports/page.tsx` uses a central max-width content column with header card, filters, two-column memorial cards, and a detail drawer/panel. Keep central and lower-middle calm and low contrast; place ritual hall and document shelves toward the sides/back.

Prompt:

```text
STYLE_BLOCK.

Create a cinematic palace archive and ceremonial report hall for Reports / Libu memorial library. Scene: an imperial rites hall with long dark lacquer writing tables, scroll racks, thousands of bound memorials and books along the side walls, jade seal objects and red cinnabar seal paste on a side table, bronze lamps, golden carved beams, suspended haze, dignified ritual order. The image must feel like official court writing, war reports, memorials, and archived decrees, but must contain no readable text or characters. Keep the center lane and lower half subdued and low-detail for report cards and filters; let shelves and ceremonial objects frame the left and right sides. Warm imperial gold light against near-black blue shadows.

Final crop target after generation: 1672x861 PNG. Generate legal size 1680x864 first, then crop to 1672x861.
```

Negative prompt: use Global Negative Prompt plus: visible written characters on scrolls, oversized red seal characters, modern library, paper labels, bright white pages dominating the image.

Output: `public/assets/reports/scene-full.png`

## 3. hanlin · 翰林院

Layout conclusion: `hanlin/page.tsx` has top evidence/next-action panels, then a large department shell with candidate and experiment content. Background should be scholarly and quiet, with most detail pushed to side walls and back shelves.

Prompt:

```text
STYLE_BLOCK.

Create a serene Hanlin Academy background: a quiet imperial scholarly studio at night, long writing table with brushes, inkstone, paper weights, subtle candlelight, walls of books and scroll cases, moonlight filtering through carved lattice windows, faint incense haze, refined literati atmosphere. It should feel intellectual, calm, and prestigious rather than busy. Keep the upper center and main central field dark and low-detail for UI panels; place richer bookshelves and brush objects along the side edges and rear depth. Use deep near-black and blue-black shadows with restrained imperial gold candle highlights. No readable writing on paper, no calligraphy characters, no human close-up.

Final crop target after generation: 1672x861 PNG. Generate legal size 1680x864 first, then crop to 1672x861.
```

Negative prompt: use Global Negative Prompt plus: bright classroom, modern desk lamp, readable calligraphy, scholar portrait, colorful fantasy library.

Output: `public/assets/hanlin/scene-full.png`

## 4. governance · 三省审议台

Layout conclusion: `governance/page.tsx` begins with BillsBoard and DeliberationConsole, then status strip and hero panels. The page is workflow-heavy. Background should show a three-stage government corridor but leave broad central dark space for stacked panels.

Prompt:

```text
STYLE_BLOCK.

Create a cinematic background for the Three Chancelleries governance tribunal. Scene: three connected imperial office halls or corridors receding in depth, symbolizing Zhongshu drafting, Menxia review, and Shangshu dispatch. Use layered doorways, official desks, document trays, bronze lamps, red-lacquer pillars, shadowed courtyards between halls, and subtle paper bundles moving visually from left to center to right without any readable text. The composition should imply formal review, veto, and dispatch. Keep the lower center and upper center dark, calm, and low-detail for workflow boards. Put the strongest architectural rhythm along the sides and back depth, with a clear central negative-space lane. Palette locked to imperial gold and deep blue-black.

Final crop target after generation: 1672x861 PNG. Generate legal size 1680x864 first, then crop to 1672x861.
```

Negative prompt: use Global Negative Prompt plus: courtroom judge close-up, modern law office, readable official documents, bright red decorations dominating the image.

Output: `public/assets/governance/scene-full.png`

## 5. grand-council · 大朝会

Layout conclusion: `grand-council/page.tsx` has a large top intro panel, a status rail, then a three-column layout: left conflict/wait chain, center discussion stream, right next actions, and bottom event cards. Background should be dramatic but pushed behind center negative space.

Prompt:

```text
STYLE_BLOCK.

Create a grand imperial court council hall at dawn. Scene: golden throne steps in the far background, carved dragon pillars, broad palace floor, morning haze and warm imperial light, rows of officials suggested only as small distant silhouettes or empty ordered ranks, no face close-ups. The mood is formal high-stakes deliberation, ministers gathering before a decision. Keep the center foreground and mid-lower field dark and low-detail so discussion streams can sit above it. Place the strongest throne and pillar silhouettes slightly high and back in depth, not centered as a bright object. Use deep near-black edges, bronze-gold highlights, cinematic realistic painterly style matching the reference images.

Final crop target after generation: 1672x861 PNG. Generate legal size 1680x864 first, then crop to 1672x861.
```

Negative prompt: use Global Negative Prompt plus: crowded detailed faces, emperor close-up, readable banners, fantasy armor, battle scene, bright festival decorations.

Output: `public/assets/grand-council/scene-full.png`

## Recommended Pipeline

1. Generate only Gongbu first using all reference images.
2. Produce a contact sheet with Gongbu plus the six references, including a grayscale row. Check:
   - gold hue and shadow temperature match
   - edges are dark and low-detail
   - no text artifacts
   - central UI space remains calm
3. If Gongbu passes, generate the other four with the same `STYLE_BLOCK` and same reference image set.
4. Save final PNGs:
   - `public/assets/gongbu/scene-full.png`
   - `public/assets/reports/scene-full.png`
   - `public/assets/hanlin/scene-full.png`
   - `public/assets/governance/scene-full.png`
   - `public/assets/grand-council/scene-full.png`
5. Create contact sheets:
   - `public/assets/_contact-sheet-review.png`
   - `public/assets/_contact-sheet-review-gray.png`
