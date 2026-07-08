# CourtOS Material Factory Workflow - 2026-06-23

Goal: make CourtOS asset generation feel like "say one sentence, get the right production asset", without losing source control, visual coherence, or product safety.

This is not a random image-generation workflow. It is an art-direction pipeline for a serious operating product with an imperial-court visual system.

## North Star

User says:

```text
给我一个上书房拟旨卡的背景，要有丞相、卷宗、印章，能放 source_label 和风险提示。
```

The factory returns:

1. Asset intent: `shangshufang / draft_edict / card_background`
2. Risk and source decision: `ORIGINAL_GENERATED`, no external image copying
3. Prompt: production-ready image2 prompt
4. Output candidates: 1-3 generated variants
5. Review result: passed / needs iteration / rejected
6. Saved file: `public/assets/shangshufang/chancellor-draft-v1.png`
7. Registry entry: source, prompt, license note, dimensions, usage
8. UI verification: screenshot with actual overlays

## Core Principle

Pretty is not enough.

An asset is only usable when it satisfies all five:

- Product role: it supports a real screen or state.
- Visual system: it belongs to the CourtOS palace operating-system language.
- Overlay safety: text, source_label, risk, gates, and actions remain readable.
- Provenance: origin, prompt, references, and license state are recorded.
- Recoverability: it can be replaced, versioned, and rolled back.

## One-Sentence Intake

The user only needs to say one sentence. The factory expands it.

Recommended user format:

```text
生成【页面/模块】的【素材类型】，用于【状态/功能】，感觉要【情绪/风格】，必须能放【UI 信息】。
```

Examples:

```text
生成军机处会审的大殿群臣背景，用于任务复核，庄严压迫，但中间要能放部门意见卡。
生成锦衣卫证据审计图，用于缺少证据状态，要黑金红线，但不能像现代犯罪板。
生成上书房拟旨卡人物图，用于用户确认前，要丞相在写卷宗，右侧留 source_label。
生成史馆归档空状态，用于没有历史案例时，要卷宗归档感，不要恐怖阴暗。
生成 human signoff 风险确认小图，用于合同/报价/付款高风险提醒，要有未盖下去的印章。
```

## Factory Stages

### Stage 0 - Intent Router

Classify the sentence into:

| Field | Examples |
| --- | --- |
| `surface` | 上书房, 军机处, 大殿, 锦衣卫, 史馆, 户部, 吏部, 礼部, 兵部, 刑部, 工部, 庄园 |
| `asset_type` | page_background, card_background, portrait, empty_state, loading_state, transition, icon_motif, texture |
| `state` | intake, draft_edict, review, evidence_gap, conflict, human_signoff, adopted, rejected, archived |
| `risk_level` | low, medium, high |
| `output_mode` | preview_only, project_asset |

Routing rules:

- If it will appear in product UI, use `project_asset`.
- If it is only mood exploration, use `preview_only`.
- If it includes evidence, signoff, source_label, contract, payment, pricing, legal, hiring, or irreversible action, mark `risk_level=high`.

### Stage 1 - Jinyiwei Provenance Gate

Every asset request receives a source label:

| Label | Meaning | Can Ship? |
| --- | --- | --- |
| `LOCAL_READY` | Already in repo and usable after visual QA | Yes |
| `LOCAL_REFERENCE` | Local reference / PRD / screenshot | Not directly, reference only |
| `PUBLIC_DOMAIN_REFERENCE` | Public-domain or open-access reference verified at object/page level | Yes, with recorded URL |
| `OFFICIAL_GUIDE` | Official design-system/product reference | Principle only |
| `ORIGINAL_GENERATED` | Generated from original prompt, no frame copying | Yes, after review |
| `NEEDS_REVIEW` | Rights/provenance unclear | No |
| `INSPIRATION_ONLY` | Bilibili / short-video / copyrighted media inspiration | No direct asset use |

Hard rules:

- Bilibili frames are never imported into `public/` unless explicit permission exists.
- Museum images require object-page rights, not just museum homepage reputation.
- Generated images must not recreate a specific video frame or unlicensed image composition.
- No baked Chinese / English text inside product backgrounds.

### Stage 2 - Art Director Expansion

Turn the one sentence into a visual brief:

| Brief Part | Required Decision |
| --- | --- |
| Product job | What screen and workflow this asset serves |
| Composition | Where UI cards / text / buttons will sit |
| Focus | Scene, object, person, or motif |
| Tone | solemn, strategic, quiet, archival, vigilant, ceremonial |
| Palette | CourtOS dark base, bronze/gold, restrained accent |
| Negative space | left, right, lower third, center lane |
| Forbidden items | text, logos, modern objects, copied frame, over-fantasy glow |
| Save path | deterministic project path |

CourtOS global art direction:

```text
CourtOS is an imperial operating system, not a costume drama poster.
The visual language is dark museum-grade Chinese court realism, operational SaaS density, warm bronze practical light, deep blue-black shadows, restrained authority, evidence and decision readability first.
```

### Stage 3 - Prompt Builder

Use the imagegen prompt schema:

```text
Use case: <historical-scene | stylized-concept | background-extraction>
Asset type: <CourtOS screen/state asset>
Primary request: <expanded from user sentence>
Scene/backdrop: <environment>
Subject: <main subject>
Style/medium: <visual language>
Composition/framing: <aspect ratio, crop, negative space>
Lighting/mood: <emotion + light>
Color palette: <palette>
Materials/textures: <paper, bronze, lacquer, silk, wood, ink>
Constraints: <must-have + no text + no watermark + no modern objects>
Avoid: <negative prompt>
```

Default negative prompt:

```text
Avoid readable Chinese or English text, calligraphy labels, captions, logos, watermarks, modern UI screens, modern objects, copied Bilibili frame composition, anime, cartoon, game-fantasy oversaturation, neon cyberpunk, purple gradient glow, random symbols, decorative blobs, close-up faces unless explicitly requested, cluttered foreground, low-detail hands, distorted historical props.
```

### Stage 4 - Generation Mode

Default:

- Use built-in `image_gen`.
- Generate one asset per distinct prompt.
- For project-bound work, move/copy selected output from `$CODEX_HOME/generated_images/...` into `public/assets/...`.
- Never overwrite existing assets without explicit replacement instruction.

Transparent/cutout assets:

1. Generate with flat chroma-key background.
2. Remove background with:

```bash
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" \
  --input <source> \
  --out <final.png> \
  --auto-key border \
  --soft-matte \
  --transparent-threshold 12 \
  --opaque-threshold 220 \
  --despill
```

Only use CLI fallback after explicit confirmation when true/native transparency is required.

### Stage 5 - Review Gate

Each generated image must pass:

| Gate | Pass Condition |
| --- | --- |
| `no_text_artifacts` | No readable generated text or pseudo-calligraphy |
| `no_watermark_logo` | No marks, signatures, logos |
| `overlay_safe` | Important UI zones are dark/calm enough |
| `court_os_coherence` | Belongs to same world as existing assets |
| `not_generic_fantasy` | Not a game splash/poster unless requested |
| `source_recorded` | Prompt, date, source decision, and path recorded |
| `state_fit` | Clearly serves target screen/state |
| `rollback_ready` | Saved with version suffix, original not overwritten |

Reject immediately if:

- It contains readable nonsense text.
- It looks copied from a known Bilibili frame or copyrighted still.
- It hides source_label, risk, evidence, or action areas.
- It makes fallback/demo results look like live truth.

### Stage 6 - Asset Registry

Every accepted asset gets a JSONL row in `dev/materials/generated-assets.jsonl`.

Recommended schema:

```json
{
  "created_at": "2026-06-23",
  "asset_id": "grand-council-hall-v1",
  "surface": "grand_council",
  "asset_type": "page_background",
  "state": "review",
  "label": "ORIGINAL_GENERATED",
  "path": "public/assets/grand-council/hall-council-v1.png",
  "prompt_file": "dev/materials/courtos-image2-asset-briefs-2026-06-23.md",
  "source_notes": "Original generated prompt; Bilibili used as inspiration only, no frame copying.",
  "dimensions": "16:9",
  "review_status": "pending_overlay_qa",
  "allowed_use": "CourtOS product UI background"
}
```

### Stage 7 - Frontend QA

Before wiring into a page:

1. Add the asset behind actual UI, not a blank preview.
2. Test desktop and mobile crops.
3. Confirm source labels, risk flags, buttons, and quality gates remain readable.
4. Capture screenshots into `artifacts/...` or `dev/screenshots/...`.
5. Compare with the existing page visual direction.

Minimum checks:

```bash
pnpm exec playwright test <target visual smoke>
./node_modules/.bin/tsc --noEmit
```

If no page-specific visual smoke exists, create a small harness route or contact sheet before using the asset in production UI.

## Directory System

Use deterministic paths:

```text
dev/materials/
  courtos-material-factory-workflow-2026-06-23.md
  courtos-image2-asset-briefs-2026-06-23.md
  external-sources.jsonl
  generated-assets.jsonl

public/assets/
  palace/
  grand-council/
  shangshufang/
  junjichu/
  jinyiwei/
  shiguan/
  quality-gates/
  transitions/
```

Naming:

```text
<surface>-<purpose>-v<number>.<ext>
```

Examples:

```text
palace-establishing-v1.png
hall-council-v1.png
chancellor-draft-v1.png
evidence-audit-v1.png
human-signoff-v1.png
celestial-palace-v1.png
```

## "Say One Sentence" Operating Procedure

When the user asks for an asset:

1. Parse the sentence into surface / asset_type / state / UI constraints.
2. Check local existing assets first.
3. If existing asset fits, propose reuse and do not generate.
4. If gap exists, write or select a prompt from `courtos-image2-asset-briefs`.
5. Generate one pilot variant.
6. Inspect the output.
7. Save to versioned project path only if it passes.
8. Append registry JSONL row.
9. Test with UI overlay/contact sheet.
10. Report path, prompt, review result, and next iteration.

## First Ten Production Requests

Use these as the initial asset backlog:

1. `grand-council-hall-v1` - 大殿群臣会审背景.
2. `palace-establishing-v1` - CourtOS 皇宫远景总壳.
3. `chancellor-draft-v1` - 上书房丞相拟旨卡.
4. `evidence-audit-v1` - 锦衣卫证据审计板.
5. `human-signoff-v1` - 高风险人工确认意象.
6. `celestial-palace-v1` - 仙宫幻境转场.
7. `archive-dossier-v1` - 史馆归档卷宗.
8. `evidence-gap-empty-v1` - 待补证空状态.
9. `department-council-silhouettes-v1` - 群臣/部门参与剪影.
10. `office-props-texture-pack-v1` - 印章、卷宗、漆木、铜器纹理组.

## Prompt Template For Immediate Use

Copy this and replace bracketed values:

```text
Use case: historical-scene
Asset type: CourtOS [surface] [asset_type] for [state]
Primary request: Create an original [subject] for CourtOS, used in [screen/workflow].
Scene/backdrop: [environment and props].
Subject: [main subject, person/object/scene].
Style/medium: cinematic Chinese imperial court realism, dark museum-grade matte painting, operational product background, restrained official dignity.
Composition/framing: 16:9 wide. Keep [UI zone] dark and calm for [specific UI elements]. Avoid bright highlights under text/card zones.
Lighting/mood: [mood], warm bronze/gold practical light, deep blue-black shadows.
Color palette: near-black, deep blue-black, aged bronze, muted imperial gold, one restrained accent only if needed.
Materials/textures: paper scrolls, ink, bronze, lacquered wood, carved screens, silk, dust in light shafts.
Constraints: no readable Chinese or English text, no calligraphy labels, no logo, no watermark, no modern objects, no copied video frame, no over-fantasy glow.
Avoid: anime, cartoon, neon cyberpunk, saturated purple gradients, modern screens, random symbols, decorative blobs, cluttered foreground.
```

## Final Rule

The factory optimizes for decision clarity, not decoration.

If a beautiful asset makes CourtOS less trustworthy, less readable, or less honest about source_label / evidence / human signoff, it fails.

