# UI Material Intel - 2026-06-23

Purpose: collect UI / art direction materials for the next CourtOS design pass.
Method: Jinyiwei-style vetting. Do not treat unsourced images as production assets.

## Vetting Labels

- LOCAL_READY: already in this repo; can be used after visual QA.
- LOCAL_REFERENCE: already in this repo; use as reference or compare before wiring.
- PUBLIC_DOMAIN_REFERENCE: external source says public domain / open access; still record credit and original URL.
- OFFICIAL_GUIDE: external first-party design system or guideline; use as design principle, not as copied UI.
- NEEDS_REVIEW: useful but license or provenance needs human check before use.

## Local Hero / Character Assets

| Use | Label | File | Notes |
| --- | --- | --- | --- |
| 军机处主视觉 | LOCAL_READY | `public/heroes/character-roster/v5-command-center-zhuge-liang.webp` | 1672x941, already wired. Good for command-center hero / council stage. |
| 上书房主视觉 | LOCAL_READY | `public/heroes/character-roster/study-wang-yangming.webp` | Already wired. Use React overlays for all text. |
| 锦衣卫 / 情报 | LOCAL_READY | `public/heroes/character-roster/v5-intel-qi-jiguang.webp` | Already wired. Useful for intelligence / evidence visual language. |
| 庄园 | LOCAL_READY | `public/heroes/character-roster/v5-manors-su-qin.webp` | Already wired. |
| 三省 / 治理 | LOCAL_READY | `public/heroes/character-roster/v5-governance-wei-zheng.webp` | Already wired, but audit notes still suggest a future Wei Zheng regeneration attempt if quality mismatch appears. |
| 史馆 | LOCAL_READY | `public/heroes/character-roster/archive-di-renjie.webp` | Already wired. |
| 健康 / 太医院 | LOCAL_READY | `public/heroes/character-roster/health-li-shizhen.webp` | Already wired. |
| 部门总览 | LOCAL_READY | `public/heroes/character-roster/scene-departments-ministers.webp` | Good for 六部 / 群臣 overview. |

Source note: see `public/heroes/character-roster/README.md` and
`public/heroes/character-roster/VISUAL_ASSET_AUDIT.md`.

## Local Department Backgrounds

| Page | Label | File | Best Use |
| --- | --- | --- | --- |
| 上书房 | LOCAL_READY | `public/study/study-v3-scene.webp` | First-screen atmospheric background; high resolution 3344x1882. |
| 军机处 | LOCAL_READY | `public/assets/junjichu/war-room-full.webp` | War-room stage; good for command-center expansion. |
| 户部 | LOCAL_READY | `public/assets/six-ministries/hubu-bg.png` | CFO / treasury office background, 1672x941. |
| 礼部 | LOCAL_READY | `public/assets/libu/rites-cinematic-bg.png` | CMO/CCO, brand and release review. |
| 工部 | LOCAL_READY | `public/assets/six-ministries/gongbu-bg.png` | Delivery / engineering / supply-chain office. |
| 兵部 | LOCAL_READY | `public/assets/six-ministries/bingbu-bg.png` | Sales / market attack room. |
| 刑部 | LOCAL_READY | `public/assets/six-ministries/xingbu-bg.png` | Legal / risk office. |
| 锦衣卫 | LOCAL_READY | `public/assets/jinyiwei/scene-full.png` | Intelligence deep page or evidence board. |
| 庄园 | LOCAL_READY | `public/assets/zhuangyuan/04-zhuangyuan-new.png` | Asset operating room. |

## Local PRD / Reference Screens

| Group | Label | Files | Use |
| --- | --- | --- | --- |
| PRD spaces | LOCAL_REFERENCE | `public/prd/01-shangshufang.webp` through `public/prd/09-taiyi.webp` | Good for page intent and scene reference; do not copy as final UI without checking current component fit. |
| Department v2 screenshots | LOCAL_REFERENCE | `dev/reference/screenshots/01-bingbu-v2.png`, `02-hubu-v2.png`, `03-gongbu-v2.png`, `04-libu-v2.png`, `05-xingbu-v2.png`, `06-personnel-v1.png` | Use as current art-direction baselines for department pages. |
| Three-axis harness screenshots | LOCAL_REFERENCE | `artifacts/three-axis-ui/*/*.png` | Use for visual regression and before/after design review. Generated artifacts; not product assets. |

## External Public-Domain / Open References

| Theme | Label | Source | Use |
| --- | --- | --- | --- |
| Chinese handscroll composition | PUBLIC_DOMAIN_REFERENCE | The Met Open Access policy: https://www.metmuseum.org/about-the-met/policies-and-documents/open-access | Use as legal basis for public-domain/open-access reference checks. |
| Stag Hunt handscroll | PUBLIC_DOMAIN_REFERENCE | The Met object page: https://www.metmuseum.org/art/collection/search/40229 | Long horizontal scroll rhythm, edge texture, muted paper palette, image/text separation. |
| Imperial collection / palace objects | NEEDS_REVIEW | National Palace Museum collection / official site: https://www.npm.gov.tw/ | Great reference for court objects, seals, scrolls, jade, bronze, palace archive tone. Check image rights per object. |
| Forbidden City / palace museum language | NEEDS_REVIEW | Palace Museum official site: https://www.dpm.org.cn/ | Use for architectural vocabulary, palace spatial hierarchy, object naming. Check image rights per object. |
| Open-access museum images | PUBLIC_DOMAIN_REFERENCE | Cleveland Museum of Art Open Access program | Useful for CC0 / public-domain Chinese art and object references after object-page check. |
| Smithsonian Open Access | PUBLIC_DOMAIN_REFERENCE | Smithsonian Open Access: https://www.si.edu/openaccess | Useful for public-domain museum object references after object-page check. |
| Public-domain ancient artworks | NEEDS_REVIEW | Wikimedia Commons categories and individual file pages | Useful for mood boards only after checking each file license and author/source metadata. |

Jinyiwei rule: any external image must keep URL, license text, capture date, and decision.
If license is not explicit, label NEEDS_REVIEW and do not wire into `public/`.

## External Design-System References

| Area | Label | Source | Use |
| --- | --- | --- | --- |
| Accessibility, motion, components | OFFICIAL_GUIDE | Material Design 3: https://m3.material.io/ | Use for accessibility, layout, motion discipline. Do not copy visual brand. |
| Platform interaction principles | OFFICIAL_GUIDE | Apple Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines/ | Use for clarity, hierarchy, touch targets, motion restraint. |
| Enterprise SaaS density | OFFICIAL_GUIDE | Linear product UI: https://linear.app/ | Reference information density and command workflow; do not copy brand style. |
| Knowledge workspace clarity | OFFICIAL_GUIDE | Notion product UI: https://www.notion.so/product | Reference editor/task clarity and progressive disclosure. |

## Bilibili / Short-Video Inspiration Leads

Use only as style research. Do not download, mirror, trace, or wire Bilibili video frames into `public/` without explicit permission.

| Direction | Label | Search / Lead | What To Study |
| --- | --- | --- | --- |
| 仙宫 / 幻境 / 国风 AI 场景 | NEEDS_REVIEW | Bilibili search: https://search.bilibili.com/all?keyword=%E4%BB%99%E5%AE%AB%20%E5%B9%BB%E5%A2%83%20%E5%9B%BD%E9%A3%8E%20AI%20%E5%9C%BA%E6%99%AF | Camera movement, cloud sea, glowing halls, depth layers, warm/cool contrast. |
| 宫殿 / 大殿 / 群臣 / 国风动画 | NEEDS_REVIEW | Bilibili search: https://search.bilibili.com/all?keyword=%E5%AE%AB%E6%AE%BF%20%E5%A4%A7%E6%AE%BF%20%E7%BE%A4%E8%87%A3%20%E5%9B%BD%E9%A3%8E%20%E5%8A%A8%E7%94%BB%20%E5%9C%BA%E6%99%AF | Throne-room blocking, crowd silhouettes, ritual composition. |
| 古风建筑 / 仙境 / Blender / UE | NEEDS_REVIEW | Bilibili search: https://search.bilibili.com/all?keyword=%E5%8F%A4%E9%A3%8E%E5%BB%BA%E7%AD%91%20%E4%BB%99%E5%A2%83%20Blender%20UE%20%E5%9C%BA%E6%99%AF | 3D palace lighting, volumetric fog, corridor depth, camera rails. |
| 国创奇幻视觉 | NEEDS_REVIEW | Bilibili original programming / 国创 category references | Macro art direction only; no frame copying. |
| 文物拟人 / 国风奇幻 | NEEDS_REVIEW | `秘宝之国` related references | Cultural-object personification, museum-to-fantasy tone. |
| 玄幻校园 / 仙术特效 | NEEDS_REVIEW | `仙王的日常生活` related references | Magical effect timing and comedic contrast; not CourtOS core tone. |
| Bilibili hotness route | NEEDS_REVIEW | Bilibili ranking: https://www.bilibili.com/v/popular/rank/guochuang | Use to find current high-heat videos manually; record BV link and capture date before citing. |

Jinyiwei Bilibili intake rule:

1. Record BV / URL / title / uploader / capture date.
2. Mark `inspiration_only` unless permission is explicit.
3. Extract design notes as text: palette, motion, composition, transitions, density.
4. Never store copied frames as product assets unless license or permission is recorded.
5. If it influences a generated asset prompt, write the influence as generic style language, not a frame recreation.

## Palace / Court / Official Motif Checklist

Collect or generate around these motifs, not random fantasy decoration:

- 皇宫: hall depth, throne axis, red pillars, gold roofline, hanging curtains, carved screens.
- 大殿: central dais, court rank lines, long perspective aisle, warm candle / side-light.
- 群臣: silhouette rows, rank separation, fan / tablet / scroll props, subdued robe colors.
- 军机处: war-room table, map wall, candlelit dossiers, blue-black strategy tone.
- 上书房: desk, seal, scroll, quiet study light, single-question focus.
- 史馆: archival shelves, bound dossiers, handscroll paper, annotation strips.
- 锦衣卫: evidence board, source plaques, dark red / black intel map, trace lines.
- 户部: ledgers, abacus, treasury seals, cashflow graph embedded into ancient ledger style.
- 礼部: silk, stamps, publishing proofs, ceremonial color restraint.
- 工部: blueprint scrolls, rulers, tools, delivery checklists.
- 兵部: sand table, route map, arrows, campaign ledger.
- 刑部: red string, seal strips, legal folios, warning plaques.

## Immediate Material Picks For Next UI Pass

1. 上书房第一屏:
   - Background: `public/study/study-v3-scene.webp`
   - Character: `public/heroes/character-roster/study-wang-yangming.webp`
   - Reference: `artifacts/three-axis-ui/*/study.png`
   - UI goal: one primary question, one decree input, visible source label.

2. 军机处会审桌:
   - Background: `public/assets/junjichu/war-room-full.webp`
   - Character: `public/heroes/character-roster/v5-command-center-zhuge-liang.webp`
   - Reference: `public/prd/05-junjichu.webp`
   - UI goal: show who participates, opinions, conflicts, quality gate, next action.

3. 户部 / CFO:
   - Background: `public/assets/six-ministries/hubu-bg.png`
   - Reference: `dev/reference/screenshots/02-hubu-v2.png`
   - UI goal: numbers, cash risk, missing evidence, source label.

4. 锦衣卫 evidence board:
   - Background: `public/assets/jinyiwei/scene-full.png`
   - Character: `public/heroes/character-roster/v5-intel-qi-jiguang.webp`
   - Reference: The Met handscroll layout for long evidence strips.
   - UI goal: source, reliability, contradiction, change alert.

5. 史馆 archive:
   - Character: `public/heroes/character-roster/archive-di-renjie.webp`
   - Reference: The Met handscroll paper rhythm and current `public/prd/04-shiguan.webp`
   - UI goal: decision dossier, source label, reusable lessons, next similar case.

## New Asset Briefs To Generate Later

Use these as original prompts / art briefs. Do not recreate any Bilibili frame.

1. 皇宫远景:
   - Full palace complex at dawn, visible roofline hierarchy, misty but readable depth.
   - Use for product-wide CourtOS shell / transition scene.

2. 大殿会审:
   - Long central aisle, throne axis, court officials in two disciplined rows, warm candle side-light.
   - Use for 军机处 / 三省会审 / final decision moments.

3. 群臣剪影:
   - Semi-abstract officials as readable silhouettes, separated by rank and distance.
   - Use as background layer only; no individual face detail needed.

4. 丞相拟旨人物:
   - Calm senior strategist at writing desk, brush / seal / scroll props, no baked text.
   - Use for 上书房 draft-edict card.

5. 锦衣卫证据人物:
   - Intelligence officer in restrained dark robe, source tags and evidence board behind.
   - Use for evidence audit and missing-capability disclosure.

6. 仙宫幻境过场:
   - Ethereal palace above cloud sea, restrained gold/cyan light, ceremonial rather than game-fantasy.
   - Use only as non-decision decorative transition, never under risk / source_label UI.

## Do Not Do

- Do not bake Chinese text into generated images.
- Do not import random web images into `public/` without license proof.
- Do not let decorative assets hide source_label, missing evidence, risk, or human signoff.
- Do not make every department a different layout; keep the three-axis office harness.

## Next Collection Tasks

1. Build a contact-sheet page for local assets:
   `public/heroes/character-roster/preview.html` plus department backgrounds.
2. Generate a fresh `dev/screenshots/ui-material-contact-sheet-2026-06-23.png`.
3. Run `pnpm harness:three-axis-ui` after each visual change.
4. For external materials, create `dev/materials/external-sources.jsonl` before downloading anything.
5. Use `dev/materials/courtos-image2-asset-briefs-2026-06-23.md` for the first original image2 generation batch.
6. Use `dev/materials/courtos-material-factory-workflow-2026-06-23.md` as the one-sentence-to-production-asset workflow.
