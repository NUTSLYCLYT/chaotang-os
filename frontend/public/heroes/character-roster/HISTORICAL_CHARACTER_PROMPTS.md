# Historical Character Prompt Pack

Purpose: regenerate Chaotang character hero images so each person is immediately recognizable, historically grounded, handsome, and visually distinct while still belonging to one CourtOS visual system.

Output standard for every prompt:

- `1672x941`, wide 16:9 department hero.
- No baked text, no calligraphy labels, no captions, no watermark.
- Leave a readable dark text zone for UI overlays.
- Handsome means charismatic and dignified, not modern idol styling.
- Use historically plausible robes, armor, hair, hats, props, and room context.
- Differentiate silhouette, posture, face shape, costume color, and signature object.

Shared negative prompt:

```text
Avoid any text, calligraphy labels, captions, watermark, logo, modern objects, modern eyeglasses, fantasy armor, sci-fi equipment, western clothing, idol-drama makeup, plastic skin, identical faces, excessive glow, extra people unless explicitly requested, cartoon style, low-detail hands, distorted historical props.
```

## Visual Director Rules

1. The person must be identifiable by silhouette and props before reading the UI label.
2. Keep one CourtOS family: dark museum-grade realism, candlelit bronze/gold atmosphere, restrained official dignity.
3. Give every person a different posture: fan, remonstrance brush, sword table, bamboo slips, medicine cabinet, astrolabe, scroll, seal, court throne, war map.
4. Do not make everyone the same age. Use heroic beauty appropriate to the person: youthful strategist, severe minister, weathered general, literary elegance, medical calm.
5. UI text must be rendered by React, not generated inside the image.

---

## 1. Zhuge Liang / 诸葛亮 / Command Center

Historical anchor: Shu Han chancellor, Longzhong Plan, Northern Expeditions, feather fan, calm strategic authority.

Visual identity:

- Tall and slender, refined sharp features, clear eyes, restrained smile.
- White or pale crane-feather fan as the unmistakable silhouette.
- Dark Han scholar robe with pale inner robe and subtle cloud trim.
- War-room map, bronze seals, bamboo dispatch slips, candlelit campaign table.

Image2 prompt:

```text
Use case: historical-scene
Asset type: Chaotang OS department hero portrait background, no baked text.
Primary request: Create Zhuge Liang for the Command Center / 军机处 as a handsome, refined Three Kingdoms strategist, immediately recognizable by his pale feather fan and calm command posture.
Format: 1672x941 wide 16:9 hero composition. Leave a deep dark negative-space zone on the left and lower-left for UI typography. Subject right-center, half-body seated portrait.
Historical design: Shu Han chancellor, Longzhong Plan and Northern Expeditions. Slender elegant face, high scholar hat, dark Han robes with pale inner collar, holding a white crane-feather fan. Campaign map, bronze command seals, bamboo dispatch slips, inkstone, and candlelit war table around him.
Mood: calm, precise, far-sighted, quietly handsome, no panic, no battle chaos.
Style: dark museum-quality historical Chinese oil-painting realism, warm bronze rim light, rich black shadows, shallow depth of field, premium court product hero image.
Avoid: shared negative prompt.
```

## 2. Wei Zheng / 魏徵 / Governance

Historical anchor: Tang remonstrance minister, direct criticism of Emperor Taizong, "using people as mirrors".

Visual identity:

- Severe handsome older face, square jaw, uncompromising eyes.
- Upright posture, red correction brush, memorial scroll, three seals.
- Early Tang official black gauze hat and austere deep crimson-black robes.
- Review chamber representing Zhongshu, Menxia, Shangshu.

Image2 prompt:

```text
Use case: historical-scene
Asset type: Chaotang OS department hero portrait background, no baked text.
Primary request: Create Wei Zheng for Governance / 三省议政 as a handsome but severe Tang remonstrance minister, instantly readable as the man who dares to correct the throne.
Format: 1672x941 wide 16:9 hero composition. Leave a dark UI text zone on the left and lower-left. Subject right-center, half-body seated portrait.
Historical design: Tang dynasty remonstrance minister, stern square face, upright posture, black official gauze hat, austere dark Tang robe with muted crimson lining. He holds a red correction brush above a memorial scroll. Three official seals sit in front of him, symbolizing Zhongshu, Menxia, and Shangshu review gates. Background: candlelit state review chamber, carved screens, legal tablets, restrained court architecture.
Mood: principled, incorruptible, exacting, handsome through moral force, not soft.
Style: dark museum-quality historical Chinese oil-painting realism, warm gold edge light, black and crimson palette, shallow depth of field.
Avoid: shared negative prompt.
```

## 3. Su Qin / 苏秦 / Manors

Historical anchor: Warring States strategist, vertical alliance, "佩六国相印".

Visual identity:

- Young-to-middle-aged handsome diplomat, fox-like intelligence, confident side glance.
- Six seals, envoy documents, interstate route map.
- Warring States layered robe, travel cloak, lacquered belt, not bureaucratic Tang/Song robes.
- Open diplomatic hall, curtains, maps, trade and alliance tokens.

Image2 prompt:

```text
Use case: historical-scene
Asset type: Chaotang OS department hero portrait background, no baked text.
Primary request: Create Su Qin for Manors / 庄园 as a handsome Warring States diplomat-strategist, clearly distinguished by six alliance seals and envoy elegance.
Format: 1672x941 wide 16:9 hero composition. Leave a dark UI text zone on the left and lower-left. Subject right-center, seated with a slight side turn.
Historical design: Warring States vertical-alliance strategist, confident intelligent eyes, lean handsome face, slightly sharper features than Zhuge Liang. He wears layered Warring States robes with a travel cloak, lacquer belt, and subtle bronze fittings. Six bronze ministerial seals are arranged near his hand. Interstate route map, alliance scrolls, envoy tokens, trade ledgers, and diplomatic curtains create the setting.
Mood: persuasive, ambitious, calculating, elegant, mobile, worldly.
Style: dark museum-quality historical Chinese oil-painting realism, bronze-gold candlelight, diplomatic hall atmosphere, restrained but seductive authority.
Avoid: shared negative prompt.
```

## 4. Qi Jiguang / 戚继光 / Intel

Historical anchor: Ming general, anti-pirate campaigns, Qi army discipline, coastal defense, Mandarin Duck Formation.

Visual identity:

- Weathered handsome military face, sharper cheekbones, alert eyes.
- Ming armor under official cloak, signal lantern, coastal defense map.
- Not a battlefield chaos image: intelligence night-watch commander.
- Watchtower shadow, sealed reports, patrol tokens.

Image2 prompt:

```text
Use case: historical-scene
Asset type: Chaotang OS department hero portrait background, no baked text.
Primary request: Create Qi Jiguang for Imperial Guard intelligence / 锦衣卫 as a handsome, disciplined Ming commander, recognizable through coastal defense, night patrol, and military order.
Format: 1672x941 wide 16:9 hero composition. Leave a dark UI text zone on the left and lower-left. Subject right-center, half-body portrait, slightly turned as if hearing a night report.
Historical design: Ming anti-pirate general and military reformer, weathered but handsome face, sharp cheekbones, disciplined gaze, trimmed beard. Dark lamellar armor beneath a black official cloak, Ming helmet or folded command cap nearby. Coastal defense map, signal lantern, sealed intelligence reports, patrol tokens, spear formation diagram, watchtower shadows in background.
Mood: vigilant, tactical, restrained, martial, high-alert.
Style: dark museum-quality historical Chinese oil-painting realism, night lantern rim light, black armor and bronze highlights, no battle chaos.
Avoid: shared negative prompt.
```

## 5. Ouyang Xiu / 欧阳修 / Reports

Historical anchor: Northern Song statesman, literary reformer, historian, official archives, refined prose.

Visual identity:

- Mature literary handsome, gentle but authoritative, slightly smiling eyes.
- Song official robe, archive cabinet, seal, compiled reports, brush and wine cup optional.
- More elegant and warm than Wei Zheng; less playful than Su Shi.
- Ritual document table, jade seal, organized scroll shelves.

Image2 prompt:

```text
Use case: historical-scene
Asset type: Chaotang OS department hero portrait background, no baked text.
Primary request: Create Ouyang Xiu for Reports / 礼部战报库 as a handsome Northern Song literary statesman, clearly distinct from Su Shi by mature editorial authority and archival order.
Format: 1672x941 wide 16:9 hero composition. Leave a dark UI text zone on the left and lower-left. Subject right-center, half-body seated portrait.
Historical design: Northern Song scholar-official, mature handsome face, measured expression, gentle but authoritative eyes. Formal Song court robe with broad sleeves and official belt. He sits before sealed reports, archive scrolls, an official stamp, jade seal, inkstone, and orderly library shelves. A small wine cup may appear subtly as a literary reference, but the core identity is editor, historian, and minister.
Mood: archival, literary, elegant, measured, credible.
Style: dark museum-quality historical Chinese oil-painting realism, warm candlelit archive, black-bronze-gold palette, restrained Song refinement.
Avoid: shared negative prompt.
```

## 6. Zhang Heng / 张衡 / Forecast

Historical anchor: Eastern Han astronomer, mathematician, seismograph, armillary sphere.

Visual identity:

- Scholar-inventor, handsome, contemplative, slightly angular face.
- Armillary sphere, star chart, seismograph-inspired bronze vessel.
- Han robe, not Tang/Song hat; cosmic instruments.
- Calm observatory interior, blue-black star geometry in background.

Image2 prompt:

```text
Use case: historical-scene
Asset type: Chaotang OS department hero portrait background, no baked text.
Primary request: Create Zhang Heng for Forecast / 钦天监 as a handsome Eastern Han astronomer-inventor, instantly recognizable through armillary sphere, star chart, and seismograph vessel.
Format: 1672x941 wide 16:9 hero composition. Leave a dark UI text zone on the left and lower-left. Subject right-center, seated and writing.
Historical design: Eastern Han scholar-official, refined angular face, contemplative eyes, dark Han robe with subtle bronze trim. He sits beside a bronze armillary sphere, star maps, mathematical slips, and a seismograph-inspired bronze vessel with dragon motifs. Observatory interior with faint constellation geometry behind him.
Mood: precise, cosmic, observant, intelligent, restrained.
Style: dark museum-quality historical Chinese oil-painting realism, black-bronze palette with subtle celestial blue, warm candle rim light.
Avoid: shared negative prompt.
```

## 7. Sima Qian / 司马迁 / Scribe

Historical anchor: Grand Historian, Records of the Grand Historian, endurance under humiliation, historical truth.

Visual identity:

- Burdened handsome face, calm sorrow, deep eyes.
- Bamboo slips, annals, chronicle tablets, archive shelves.
- Western Han robe, historian cap, brush poised but heavy.
- More solemn than Ouyang Xiu; truth under pressure.

Image2 prompt:

```text
Use case: historical-scene
Asset type: Chaotang OS department hero portrait background, no baked text.
Primary request: Create Sima Qian for Scribe / 史馆 as a handsome but burdened Western Han Grand Historian, immediately recognizable as the author of the Records of the Grand Historian.
Format: 1672x941 wide 16:9 hero composition. Leave a dark UI text zone on the left and lower-left. Subject right-center, half-body seated portrait.
Historical design: Western Han Grand Historian, composed face with restrained sorrow, deep eyes, thin scholar beard, historian cap, Han robes. He writes on bamboo slips surrounded by annals, chronicle tablets, scroll shelves, inkstone, and archival wooden boxes. The brush feels heavy, as if truth has a cost.
Mood: solemn, enduring, truthful, tragic, dignified.
Style: dark museum-quality historical Chinese oil-painting realism, candlelit archive, black-brown-bronze palette, shallow depth of field.
Avoid: shared negative prompt.
```

## 8. Zhang Liang / 张良 / Grand Council

Historical anchor: Han strategist, helped Liu Bang, Huangshi Gong legend, "mousheng".

Visual identity:

- Elegant handsome strategist, softer than Wei Zheng, colder than Su Qin.
- Jade-like scholar demeanor, strategy slip, map table, hidden council shadows.
- Early Han robe, simple refinement, no feather fan.
- Quiet council chamber; less theatrical than Zhuge.

Image2 prompt:

```text
Use case: historical-scene
Asset type: Chaotang OS department hero portrait background, no baked text.
Primary request: Create Zhang Liang for Grand Council / 群臣会议 as a handsome early Han strategist, recognizable through quiet council intelligence and a strategy slip, not a feather fan.
Format: 1672x941 wide 16:9 hero composition. Leave a dark UI text zone on the left and lower-left. Subject right-center, seated beside a map table.
Historical design: Early Han strategist and counselor, elegant handsome face, calm cold eyes, simple refined Han robes, understated hair crown. He holds a narrow strategy slip near a map table with seals, bamboo texts, and quiet council shadows. Add a subtle old yellow-stone book reference to Huangshi Gong, but keep it natural.
Mood: discreet, intelligent, controlled, refined, decisive.
Style: dark museum-quality historical Chinese oil-painting realism, candlelit council room, bronze shadows, shallow depth of field.
Avoid: shared negative prompt.
```

## 9. Wang Yangming / 王阳明 / Study

Historical anchor: Ming philosopher-general, "知行合一", suppressed rebellions, moral introspection plus action.

Visual identity:

- Handsome Ming scholar-general, penetrating eyes, calm but ready.
- Scholar robe with subtle military sword stand, dossiers, ink, lamp.
- One hand near brush, sword behind him: knowledge/action duality.
- More inward than Zhuge, less severe than Wei Zheng.

Image2 prompt:

```text
Use case: historical-scene
Asset type: Chaotang OS department hero portrait background, no baked text.
Primary request: Create Wang Yangming for Imperial Study / 上书房 as a handsome Ming philosopher-general, clearly representing unity of knowledge and action.
Format: 1672x941 wide 16:9 hero composition. Leave a dark UI text zone on the left and lower-left. Subject right-center, half-body seated portrait.
Historical design: Ming dynasty philosopher, official, and general. Handsome composed face, penetrating eyes, calm moral force. Ming scholar-official robes with restrained military details. Annotated dossiers, inkstone, small lamp, bamboo slips, and a sheathed sword on a stand behind him show both philosophy and campaign command.
Mood: reflective, decisive, disciplined, morally alert, inwardly bright.
Style: dark museum-quality historical Chinese oil-painting realism, warm candlelit study, black-bronze-blue shadows.
Avoid: shared negative prompt.
```

## 10. Su Shi / 苏轼 / Hanlin

Historical anchor: Northern Song poet, statesman, exile, calligraphy, humane breadth.

Visual identity:

- Handsome generous face, bright resilient eyes, warmer than Ouyang.
- Song robe, poetry drafts, calligraphy, moonlit window, wine cup.
- More relaxed posture, slight humane smile.
- Literary but alive; not bureaucratic.

Image2 prompt:

```text
Use case: historical-scene
Asset type: Chaotang OS department hero portrait background, no baked text.
Primary request: Create Su Shi for Hanlin Academy / 翰林院 as a handsome, generous Northern Song poet-statesman, instantly distinct from Ouyang Xiu through warmth, resilience, and calligraphy.
Format: 1672x941 wide 16:9 hero composition. Leave a dark UI text zone on the left and lower-left. Subject right-center, seated in a relaxed but dignified pose.
Historical design: Northern Song poet, calligrapher, essayist, and statesman. Handsome broad face, warm resilient eyes, subtle humane smile. Elegant Song scholar robe, poetry drafts, flowing calligraphy brushes, inkstone, moonlit window lattice, and a small wine cup. The room feels literary and alive rather than strictly bureaucratic.
Mood: brilliant, humane, resilient, generous, lightly playful but dignified.
Style: dark museum-quality historical Chinese oil-painting realism, warm candlelight with soft moonlit blue, refined Song atmosphere.
Avoid: shared negative prompt.
```

## 11. Sun Wu / 孙武 / Bingbu

Historical anchor: Art of War, Spring and Autumn strategist, discipline, deception, battlefield abstraction.

Visual identity:

- Severe handsome commander, lean face, hawk-like eyes.
- Map table, bamboo military text, bronze tally, sheathed sword, plain armor.
- Spring and Autumn robe/armor, not Ming/Tang.
- No battlefield; quiet dangerous war council.

Image2 prompt:

```text
Use case: historical-scene
Asset type: Chaotang OS department hero portrait background, no baked text.
Primary request: Create Sun Wu for Military Department / 兵部 as a handsome and austere Spring and Autumn military strategist, immediately recognizable through Art of War bamboo slips, map table, and severe command discipline.
Format: 1672x941 wide 16:9 hero composition. Leave a dark UI text zone on the left and lower-left. Subject right-center, half-body seated portrait.
Historical design: Ancient Chinese military strategist, lean handsome face, hawk-like eyes, controlled expression. Spring and Autumn period dark robes with light bronze lamellar details, not later dynasty official costume. Map table, bamboo slips of military doctrine, bronze tally tokens, flags in shadow, and a sheathed sword placed horizontally. No chaotic battle scene.
Mood: disciplined, dangerous, strategic, silent, exact.
Style: dark museum-quality historical Chinese oil-painting realism, command tent candlelight, bronze and black palette, sharp shadows.
Avoid: shared negative prompt.
```

## 12. Di Renjie / 狄仁杰 / Archive

Historical anchor: Tang judge-minister, cases, investigation, political wisdom.

Visual identity:

- Handsome older investigator, keen eyes, composed authority.
- Official tablet, case scrolls, evidence box, dim court archive.
- Tang official robe; detective but not fantasy detective.
- Lantern-lit evidence table.

Image2 prompt:

```text
Use case: historical-scene
Asset type: Chaotang OS department hero portrait background, no baked text.
Primary request: Create Di Renjie for Archive / 御巡台 as a handsome Tang judge-minister, instantly recognizable through investigation, case scrolls, and calm judicial authority.
Format: 1672x941 wide 16:9 hero composition. Leave a dark UI text zone on the left and lower-left. Subject right-center, half-body portrait leaning slightly over an evidence table.
Historical design: Tang dynasty judge and statesman, handsome older face, keen observant eyes, short beard, composed expression. Tang official robe and black court hat. Evidence box, case scrolls, official tablet, seal, and lantern-lit archive desk. Background: dim court archive, wooden shelves, subtle legal instruments.
Mood: investigative, patient, wise, exact, quietly formidable.
Style: dark museum-quality historical Chinese oil-painting realism, lantern-lit archive, blue-black and bronze palette.
Avoid: shared negative prompt.
```

## 13. Li Shizhen / 李时珍 / Health

Historical anchor: Ming physician, Compendium of Materia Medica, field collection and medical diagnosis.

Visual identity:

- Handsome gentle elder physician, clear compassionate eyes.
- Medicine cabinet, herbs, mortar, pulse pillow, medical scroll.
- Ming scholar-physician robe; warmer green/wood notes.
- Calm clinic-study, not mystical alchemy.

Image2 prompt:

```text
Use case: historical-scene
Asset type: Chaotang OS department hero portrait background, no baked text.
Primary request: Create Li Shizhen for Imperial Infirmary / 太医院 as a handsome, compassionate Ming physician-scholar, recognizable through herbs, medicine cabinet, and pulse diagnosis.
Format: 1672x941 wide 16:9 hero composition. Leave a dark UI text zone on the left and lower-left. Subject right-center, seated at a medical desk.
Historical design: Ming physician and author of Compendium of Materia Medica, handsome gentle elder face, clear compassionate eyes, short neat beard. Scholar-physician robe with subtle herbal green and dark brown tones. Medicine cabinet, dried herbs, mortar and pestle, pulse pillow, medical scrolls, porcelain jars, and field collection basket.
Mood: calm, precise, humane, diagnostic, healing.
Style: dark museum-quality historical Chinese oil-painting realism, warm clinic-study candlelight, bronze and herbal green accents.
Avoid: shared negative prompt.
```

## 14. Sovereign Throne / 陛下登朝 / Overview

Historical anchor: not a single historical person; this is the authority point of the product.

Visual identity:

- Prefer empty throne or partially seen sovereign silhouette to avoid fake emperor identity.
- Dragon throne, morning court light, imperial seal, official path to the throne.
- Should feel like decision authority, not decorative palace tourism.

Image2 prompt:

```text
Use case: historical-scene
Asset type: Chaotang OS overview hero background, no baked text.
Primary request: Create the Sovereign Throne for the Great Hall / 大殿 as the central authority signal of CourtOS, not a portrait of a named emperor.
Format: 1672x941 wide 16:9 hero composition. Leave a dark UI text zone on the left and lower-left. The dragon throne sits right-center or center-right, glowing but restrained.
Historical design: Chinese imperial throne hall, carved dragon throne, imperial seal table, court pathway, hanging lamps, morning light entering from high windows, optional partial silhouette of the sovereign from behind but no clear face.
Mood: sovereign, quiet, heavy, decisive, ceremonial.
Style: dark museum-quality historical Chinese oil-painting realism, warm gold and black, restrained palace architecture.
Avoid: shared negative prompt, avoid tourist-palace brightness, avoid identifiable modern actor face.
```

## 15. Ministers Scene / 群臣同殿 / Departments

Historical anchor: multi-agent council, not one dynasty; should show diversity without becoming noisy.

Visual identity:

- Eleven silhouettes or semi-portraits, each different posture/hat/robe, but central path clear.
- Court assembly, table with seals, departments implied by objects.
- Avoid unreadable crowd chaos.

Image2 prompt:

```text
Use case: historical-scene
Asset type: Chaotang OS ministers overview hero background, no baked text.
Primary request: Create a CourtOS Ministers Assembly / 群臣同殿 scene where multiple historical-minister archetypes can be distinguished by silhouette, posture, and department objects without requiring text.
Format: 1672x941 wide 16:9 hero composition. Leave a dark UI text zone on the left and lower-left. Main council group on right-center, clear central aisle and table.
Historical design: Cross-dynasty inspired but coherent Chinese court assembly. Eleven minister silhouettes or semi-portraits with varied robes, hats, and props: strategist fan, remonstrance brush, medicine chest, archive scroll, war map, seal box, envoy tokens. Use a shared dark bronze court hall so it feels like one product world, not a costume collage.
Mood: collective intelligence, disciplined council, diverse expertise, official order.
Style: dark museum-quality historical Chinese oil-painting realism, candlelit palace hall, restrained detail, readable silhouettes.
Avoid: shared negative prompt, avoid crowd chaos, avoid every face looking identical.
```

## Batch Generation Order

1. Regenerate P1 distinct-person set first: Zhuge Liang, Wei Zheng, Su Qin, Qi Jiguang, Ouyang Xiu.
2. Regenerate P0 missing-distinct set if current versions still look too similar: Zhang Heng, Wang Yangming, Su Shi, Sun Wu.
3. Regenerate P2 legacy set: Di Renjie, Li Shizhen, Sovereign Throne, Ministers Assembly.
4. Keep Sima Qian and Zhang Liang if their current v4 images remain distinctive after side-by-side preview.

## Review Checklist

For every generated image, mark pass/fail:

- Recognizable without reading the name.
- Handsome and dignified, not idol-drama.
- Historically plausible dynasty costume.
- Unique posture and prop.
- No baked text or fake calligraphy labels.
- Left/lower-left UI text zone remains readable.
- Works in both `DeptHeroBanner` split and preview-card crop.

