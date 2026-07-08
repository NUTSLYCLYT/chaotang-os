# Task Rule Experience Sync

This file is the cross-repo rule sync for VaM character work. It contains process rules only. It does not move VaM runtime logic into the frontend.

## Boundary

- VaM repo owns production: references, ledgers, morphs, screenshots, resource gates, plugins, campaigns.
- Frontend repo owns display: task cards, source labels, evidence review, human approval, archive.
- Cross-repo sync object: `CHAOTANG_TASK_CARD.json`.
- Rule sync only: frontend may display these rules and blockers, but must not reimplement VaM generation or scoring.

## Resource Allocation Rule

Do not randomly close heavy tools.

Allowed:

- observe GPU usage
- warn when a new heavy job would conflict
- queue work
- recommend priority
- ask user before stopping a process

Forbidden:

- kill VaM, DAZ, ComfyUI, or training jobs without explicit user approval
- start ComfyUI if Codex/local scripts can solve the task
- run multiple heavy visual jobs together without approval

Hermes should act as scheduler and judge. DeepSeek can provide low-cost structured review. Neither replaces visual evidence.

## Default Execution Order

1. Codex prompt/plan/board first.
2. Local scripts second.
3. ComfyUI fallback only.
4. VaM visible screenshots are the primary evidence.
5. Resource gate before likeness scoring.
6. One cluster per round.
7. Locks after every accepted round.
8. Review at rounds 5, 10, 15, 20.

## Current Hard Gate

The current candidate remains blocked until these exist:

- front visible capture
- three-quarter visible capture
- side/profile visible capture
- full-body visible capture
- resource gate
- rebuilt evidence passport
- rebuilt Chaotang task card

## Oral Detail Gate

Mouth, lips, teeth, and lip-sync are not decoration. They are identity details and can break likeness.

Required order:

1. Neutral mouth width.
2. Lip contour and material.
3. Teeth scale and alignment.
4. Small smile expression.
5. Low-mouth-motion lip-sync.

Reject if:

- mouth becomes a generic wide template mouth
- teeth are oversized, too white, too forward, or visible in neutral proof
- smile changes jaw/chin reading
- lip-sync creates wide mouth motion before identity passes
- lip material hides source lip contour

Required oral views before final:

- neutral front closed mouth
- small-smile front, teeth optional
- three-quarter mouth/lip depth
- profile lip/teeth/jaw plane

### Mouth Action Ladder

Do not enable all mouth actions at once. Use this ladder:

1. **Identity proof**
   - Allowed: closed neutral, micro smile.
   - Forbidden: open mouth, wide smile, laugh, lip bite, kiss, tongue.
   - Reason: expression morphs can fake a different jaw, chin, and mouth width.

2. **Beauty preview**
   - Allowed: small smile, soft breathing lips, subtle mouth-corner lift.
   - Forbidden: wide smile, open-mouth lip-sync, tongue.
   - Reason: beauty can show life, but identity must still survive closed-mouth proof.

3. **Interaction after identity pass**
   - Allowed: low-amplitude lip-sync, soft speech visemes, small-smile-to-neutral transition.
   - Forbidden: large viseme exaggeration, wide teeth smile before teeth gate.
   - Reason: interactive mouth motion is a final layer, not an identity shortcut.

## Hair Density Gate

Hair is identity framing. Sparse or flat hair can make the head and face read wrong even when morphs are good.

Required order:

1. Hairline and parting.
2. Volume and density.
3. Strand material and gloss.
4. Face landmark clearance.
5. Final style mood.

Reject if:

- hair reads sparse, flat, or wig-like
- hairline exposes the wrong forehead shape
- bangs hide eyes, jaw, or mouth during identity proof
- hair resource causes missing asset/load errors
- hair style makes head shape look wider/narrower than proof captures

Required hair views before final:

- front hairline/parting
- three-quarter hair volume
- side hair depth
- back or side-body hair length

Rule: use cleaner hair for identity proof, then denser glamour hair for final beauty after face/body locks pass.

## Genius Designs

1. **Mouth Rail**
   Maintain two mouth states: `neutral_proof` and `small_smile_preview`. All identity scoring uses neutral proof. Beauty previews can use small smile only after neutral proof passes.

2. **Teeth Shadow Gate**
   Teeth should not be judged by whiteness. Judge scale, depth, gum line visibility, and whether upper teeth sit behind lips naturally.

3. **Lip-Sync Quarantine**
   Voice/lip-sync is quarantined until face identity passes. Early lip-sync may force mouth-open morphs and poison face-shape review.

4. **Cluster Lock Trap**
   A mouth pass cannot touch jaw, chin, nose, or eyes. If a mouth correction improves lips but changes lower-face identity, rollback.

5. **Dual Smile Evidence**
   Keep one closed-mouth proof and one small-smile proof. Final beauty can use smile; final identity must survive closed-mouth proof.

6. **Two-Hair-State Review**
   Keep one `identity_clear_hair` state where landmarks are visible, and one `final_glam_hair` state with fuller volume. Final hair must not hide proof landmarks.

7. **Hair Silhouette Guard**
   Dense hair can fake face width and shoulder shape. Judge face/body using clear-hair proof first, then add dense hair only if the silhouette still matches.

## Realism Frontier Gates

Synced from `docs/REALISM_FRONTIER_GENIUS_DESIGNS.md`.

### Dual Render Modes

The character has two review modes:

- **神话模式 / Mythic Mode**: art-directed beauty, glamour, cinematic mood, idealized final presentation.
- **人间模式 / Human Mode**: real-world plausibility, reproducible evidence, stable materials, uncanny-valley control.

Rule:

- Human mode sets the truth floor.
- Mythic mode raises the beauty ceiling.
- Neither mode may destroy identity.
- Do not sacrifice beauty and art for realism.
- Do not use beauty lighting to hide evidence failures.
- Human mode is not plain mode: it must preserve the reference person's charm, beauty, skin tone, and face identity.
- Reject human-mode output if it is realistic but less beautiful, less charming, or no longer reads as the photo reference.
- If the reference photo has makeup, human mode must preserve and refine the makeup instead of removing it.
- Human mode must not be worse than the reference photo; art can refine life, but cannot erase identity details.

Human-mode fine-detail checks:

- brows, lashes, eyeliner, eye shadow, blush, lip color
- nose bridge highlight and nostril shadow
- cheek fullness and nasolabial softness
- lip contour, cupid bow, corner shape, and material
- chin/jaw transition under proof lighting
- skin pores, micro-normal, roughness, and non-plastic response
- hairline baby hairs, parting, strand density, and face clearance
- eye wetness, catchlight, sclera value, and iris depth

## Video Reference Rule

Uploaded real-person video can strengthen realism and make the character feel alive.

Use video for:

- blink timing and eye saccades
- mouth motion range and speaking habits
- smile onset and recovery
- head micro-motion
- posture and gesture habits
- hair motion and volume
- skin tone under multiple lights
- makeup consistency across movement

Do not use video to:

- replace the photo identity ledger
- treat blurry, filtered, or warped frames as final identity proof
- copy extreme expression as neutral face shape
- overdrive mouth/lip-sync morphs

Best video: 10-60 seconds, bright even lighting, front/three-quarter/profile hints, neutral face, small smile, short speech, slow head turn, minimal filters.

## Mocap And Timeline Rule

Video can be converted into motion capture and Timeline material, but only as layered editable motion.

Preferred pipeline:

1. Video reference intake.
2. Keyframe and dynamic profile extraction.
3. Markerless mocap to BVH/FBX.
4. Motion cleanup and smoothing.
5. VaM BVH Player bake.
6. Timeline mocap import.
7. Layered Timeline edit.
8. Three-second dynamic review.
9. Final dance or interaction packaging.

Ten motion gates:

1. Motion DNA first.
2. BVH is raw material; Timeline is the director.
3. Split root/hips, spine, head, arms, eyes, mouth, breath, and secondary motion.
4. Dance beat map required for dance.
5. Foot contact sentinel rejects sliding feet.
6. Hip weight transfer rail prevents fake floating dance.
7. Expression safe layer protects face identity.
8. Hands are cleaned as a separate pass.
9. Hair/cloth/soft-body secondary motion comes after body cleanup.
10. A/B dynamic review compares source video vs VaM preview.

Reject raw imported mocap if it causes foot sliding, identity-breaking mouth motion, dead eyes, wrong posture, or uneditable merged motion.

Ten realism gates are now part of the character-quality stack:

1. **Skin Truth Stack**: skin uses base color, SSS/translucency, micro-normal, pores, and imperfections; reject plastic skin.
2. **Eye Wetness And Saccade Gate**: eye geometry remains locked; wetness, limbus, blink, and saccade come after identity proof.
3. **Teeth/Gums/Tongue Naturalness Gate**: judge scale, depth, gum line, enamel value, tongue color, and inner-mouth shadow.
4. **Hairline First, Volume Second**: clear hairline proof before final dense glamour hair.
5. **Micro-Asymmetry Map**: add human-level asymmetry only after primary proportions pass.
6. **Breath Is A Body System**: breathing affects chest, shoulder, clavicle, neck, jaw rest, and lips subtly.
7. **Audio2Face Low-Amplitude Speech Rail**: speech is restrained and must include neutral recovery frames.
8. **Camera And Lighting Calibration Rig**: proof lighting and beauty lighting are separate.
9. **Realism Budget And FPS Broker**: Hermes manages SSS, hair physics, post FX, gaze, breathing, and lip-sync budgets.
10. **Uncanny Valley Sentinel**: reject layer mismatch such as real skin with dead eyes or perfect teeth with flat lips.

Activation order:

1. Multiview capture and resource gate.
2. Relative parameter comparison.
3. Face/body one-cluster edits.
4. Skin and eye material checks.
5. Hairline and clear-hair proof.
6. Oral material and small-smile proof.
7. Final glamour hair and makeup.
8. Breathing and idle motion.
9. Low-amplitude speech rail.
10. Uncanny-valley sentinel review.

## Next Action

Run stable multiview capture for the current candidate. Do not continue mouth/teeth edits until the neutral front and profile evidence are stable.
