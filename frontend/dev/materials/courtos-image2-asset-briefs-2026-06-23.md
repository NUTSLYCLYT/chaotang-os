# CourtOS Image2 Asset Briefs - 2026-06-23

Purpose: define the next original image-generation batch for CourtOS UI polish.
Rule: use local assets and public references as style anchors, but do not recreate Bilibili frames or unlicensed museum images.

## Current Material Judgment

The project already has enough material for a working product pass:

- 上书房: `public/study/study-v3-scene.webp`, `public/shangshufang/*`
- 军机处: `public/assets/junjichu/war-room-full.webp`
- 大殿: `public/assets/dadian/hall-stage.webp`, `public/assets/dadian/hall-stage-tang.png`
- 六部: `public/assets/six-ministries/*.png`, `public/assets/*/scene-full.png`
- 锦衣卫: `public/assets/jinyiwei/scene-full.png`
- 人物: `public/heroes/character-roster/*`, `public/heroes/role-avatars-v1/*`
- PRD / reference: `public/prd/*.png`, `dev/reference/screenshots/*.png`

The weak point is not quantity. The weak point is product-system coherence:

1. Some images are scene backgrounds, some are character portraits, some are PRD mockups; they are not yet one consistent asset family.
2. We lack layered assets for interaction states: empty state, awaiting evidence, human signoff, decision complete, archived.
3. We lack a consistent palace / hall / crowd grammar for the top-level CourtOS shell.
4. Bilibili fantasy references are good for motion and mood, but unsafe as direct product assets.
5. UI overlays need dark, quiet negative space; many attractive images may still fail as product backgrounds.

## Need More External Collection?

Collect more only in these categories:

| Category | Need | Why |
| --- | --- | --- |
| Palace architecture references | Medium | Needed for believable roofline, hall axis, pillars, courtyards. Use museum / official / public-domain references. |
| Court official silhouettes | High | Current assets need more group/crowd grammar for 群臣, 审议, signoff. |
| Object props | High | Seals, scrolls, ledgers, abacus, evidence tags, legal slips, map pins support department identity without extra text. |
| Motion references | Medium | Bilibili / 国创 / Blender / UE only as animation inspiration: haze, camera push, parallax, transitions. |
| Texture references | Medium | Paper, lacquer, bronze, silk, carved wood. Useful for CSS and generated assets. |
| UI examples | Low | We already know the UI direction: operational SaaS with court-world visual skin. Do not over-collect. |

Stop collecting when every planned screen has:

- one main background
- one role or department identity asset
- one empty/loading/skeleton visual
- one risk / signoff / evidence visual motif
- one archive / history visual motif

## Should We Use Codex Image2?

Yes, but only for original, product-bound gaps. Use image2 for:

- original palace / hall / council scenes
- department-consistent backgrounds
- role portraits where local roster is missing or inconsistent
- transition and empty-state illustrations

Do not use image2 for:

- copying Bilibili video frames
- generating UI text inside images
- generating logos, Chinese labels, or readable calligraphy in backgrounds
- replacing a working local asset before visual QA proves it is weak

Recommended workflow:

1. Build a contact sheet of all current local assets.
2. Pick the lowest-quality or missing screen states.
3. Generate one pilot image first: `grand-council-hall-v1`.
4. Review against UI overlay readability and style coherence.
5. If it passes, generate the remaining batch.

## Shared Style Block

Use this for every prompt unless a specific screen needs a deliberate exception:

```text
Style anchor: original CourtOS palace operating-system visual language. Cinematic Chinese imperial court realism, dark museum-grade matte painting, warm bronze and imperial gold practical light, deep blue-black shadows, restrained official dignity, carved timber architecture, paper scrolls, seals, lacquer, bronze, dust in light shafts, layered depth, product background suitable for dense UI overlays.

Composition rule: wide 16:9 product hero image with quiet negative space for UI panels. Keep edges darker and lower detail. Avoid bright highlights under likely text/card zones. No baked Chinese or English text, no readable calligraphy, no logo, no watermark.

Avoid: copied video-frame look, anime, cartoon, game-fantasy oversaturation, purple sci-fi glow, modern screens, modern objects, readable labels, random symbols, decorative blobs, giant close-up faces unless the asset is explicitly a portrait.
```

## Priority Batch A - Generate First

### 1. 大殿群臣 / Grand Council Hall

Use case: historical-scene
Asset type: CourtOS wide product background for 军机处 / 大朝会 / final decision states

```text
Use case: historical-scene
Asset type: CourtOS wide product background
Primary request: Create an original grand imperial court council hall for CourtOS, showing a formal decision chamber with ordered rows of court officials as small disciplined silhouettes.
Scene/backdrop: A vast Chinese imperial audience hall, long central aisle, throne steps far in the background, carved pillars, bronze lamps, warm candle side-light, morning haze, deep architectural depth.
Subject: The hall itself and the disciplined court formation; officials are distant silhouettes, not detailed faces.
Style/medium: cinematic Chinese imperial court realism, dark museum-grade matte painting, premium product hero background.
Composition/framing: 16:9 wide. Keep lower center and left side dark and calm for UI panels. Strong perspective aisle. Throne is distant, not a bright centered object.
Lighting/mood: high-stakes deliberation, solemn, warm gold rim light against blue-black shadows.
Constraints: no readable text, no calligraphy, no logo, no watermark, no modern objects, no close-up emperor, no copied video-frame composition.
```

Recommended output path after review: `public/assets/grand-council/hall-council-v1.png`

### 2. 皇宫远景 / Palace Establishing Scene

Use case: historical-scene
Asset type: CourtOS shell / transition background

```text
Use case: historical-scene
Asset type: CourtOS palace shell background
Primary request: Create an original wide establishing scene of a Chinese imperial palace complex at dawn for CourtOS.
Scene/backdrop: Layered palace roofs, courtyards, red-lacquer pillars, gold roofline accents, distant mountains or cloud haze, atmospheric depth.
Subject: The palace complex as a governance operating system, not a tourist postcard.
Style/medium: cinematic realistic matte painting, restrained luxury, dark court product visual language.
Composition/framing: 16:9 wide, broad dark negative space in the lower third and left side for navigation and dashboard overlays.
Lighting/mood: quiet morning authority, mist, warm gold edge light, disciplined not fantasy.
Constraints: no readable signs, no calligraphy, no logo, no watermark, no modern city, no overbright fantasy clouds.
```

Recommended output path after review: `public/assets/palace/palace-establishing-v1.png`

### 3. 丞相拟旨 / Chancellor Drafting Edict

Use case: historical-scene
Asset type: 上书房 draft-edict card / modal visual

```text
Use case: historical-scene
Asset type: CourtOS chancellor drafting visual
Primary request: Create an original image of a senior chancellor drafting an edict in a quiet imperial study, for the CourtOS 上书房 decision intake flow.
Scene/backdrop: Dark study desk, brush, inkstone, blank scrolls without readable text, seal box, candlelight, carved screen, quiet shelves.
Subject: Calm strategist seen in three-quarter view, hands near brush and scroll, face dignified but not over-detailed.
Style/medium: dark museum-quality Chinese historical realism, product illustration with restrained cinematic lighting.
Composition/framing: 16:9 wide or 4:3 crop-safe. Leave dark negative space on one side for DraftEdictV1 fields.
Lighting/mood: careful, thoughtful, accountable, ready for emperor confirmation.
Constraints: no readable text on scrolls, no labels, no watermark, no modern office items, no fantasy glow.
```

Recommended output path after review: `public/assets/shangshufang/chancellor-draft-v1.png`

### 4. 锦衣卫证据审计 / Evidence Audit Board

Use case: historical-scene
Asset type: evidence / source_label / missing evidence visual

```text
Use case: historical-scene
Asset type: CourtOS evidence audit background
Primary request: Create an original intelligence evidence board for CourtOS 锦衣卫 evidence audit.
Scene/backdrop: Dark imperial intelligence room, wall map, red thread lines, sealed dossiers, source tags as blank plaques with no text, bronze lamps, patrol tokens, shadowed shelves.
Subject: Evidence system and source reliability, not a detective cliché.
Style/medium: cinematic Chinese imperial intelligence realism, dark lacquer, bronze, restrained red accents.
Composition/framing: 16:9 wide. Keep center-left calm for evidence cards, put map and thread detail toward back/right depth.
Lighting/mood: vigilant, analytical, high-trust, source-aware.
Constraints: no readable labels, no text, no logos, no modern cork board, no modern screens, no crime-scene gore.
```

Recommended output path after review: `public/assets/jinyiwei/evidence-audit-v1.png`

### 5. Source Label / Human Signoff Motif

Use case: stylized-concept
Asset type: small illustration or empty-state background

```text
Use case: stylized-concept
Asset type: CourtOS risk and human-signoff motif
Primary request: Create an original visual motif for human confirmation and source-label gating in CourtOS.
Scene/backdrop: A dark official desk with a sealed memorial, bronze seal, blank source plaques, one red warning cord, and a hand hovering near a stamp without stamping yet.
Subject: The moment before irreversible approval; clear sense of caution and accountability.
Style/medium: cinematic product illustration, Chinese imperial court realism, close still-life composition.
Composition/framing: 16:9 or 1:1 crop-safe. Leave clean dark margins.
Lighting/mood: restrained, serious, high-risk, human-in-the-loop.
Constraints: no readable text, no actual stamped characters, no watermark, no modern warning icons, no UI screenshots.
```

Recommended output path after review: `public/assets/quality-gates/human-signoff-v1.png`

### 6. 仙宫幻境过场 / Celestial Transition

Use case: stylized-concept
Asset type: decorative transition only

```text
Use case: stylized-concept
Asset type: CourtOS transition background
Primary request: Create an original restrained celestial palace transition scene inspired by Chinese mythic atmosphere, for non-decision decorative transitions in CourtOS.
Scene/backdrop: Distant palace silhouette above cloud sea, layered mist, faint bridge or roofline, warm gold and muted cyan atmospheric light.
Subject: Ethereal transition environment, not a decision screen and not a game poster.
Style/medium: cinematic matte painting, refined Chinese fantasy restraint, elegant and quiet.
Composition/framing: 16:9 wide. Very clean negative space for fade transitions and loading states.
Lighting/mood: contemplative, otherworldly, calm, not flashy.
Constraints: no readable text, no characters, no logo, no watermark, no copied Bilibili composition, no oversaturated neon, no anime look.
```

Recommended output path after review: `public/assets/transitions/celestial-palace-v1.png`

## Priority Batch B - Generate After UI QA

1. 吏部 / CHRO-CAO office background with personnel dossiers, evaluation slips, appointment seals.
2. 礼部 / brand-comms ceremony office with release proofs, seal paste, silk, publishing desk.
3. 刑部 / legal-risk chamber with legal folios, warning slips, red cord, no gore.
4. 工部 / delivery-engineering operations room with blueprints and supply chain props.
5. 史馆 / archive decision dossier close-up for adopted/rejected/rechecked outcomes.

## Review Checklist For Each Generated Image

- No readable Chinese / English text inside image.
- No watermark, logo, or copied frame composition.
- Works after dark overlay and object-cover crop.
- Has a clear role in product UI, not just pretty art.
- Source label / risk / evidence UI can sit above it without visual conflict.
- Feels like CourtOS, not generic fantasy or game splash art.
- File is saved under `public/assets/...` only after review.

