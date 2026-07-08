# CourtOS Design Tools

This project uses three design helpers:

1. `impeccable`
2. `taste`
3. `frontend-app-builder`

They are intentionally used as design gates, not as user-facing product concepts.

## Installed State

### Impeccable

Attempted upstream install:

```bash
npx skills add pbakaus/impeccable --yes
```

The repository cloned, but the `skills` CLI reported:

```text
No valid skills found. Skills require a SKILL.md with name and description.
```

So the project uses a local adapter:

```text
.impeccable.md
.claude/skills/impeccable/SKILL.md
```

### Taste

No stable external `taste` CLI/package was found in npm search. The project uses a local CourtOS taste-review skill:

```text
.claude/skills/taste/SKILL.md
```

### Frontend App Builder

Codex already has the Frontend App Builder skill in the plugin cache:

```text
/home/ubuntu/.codex/plugins/cache/openai-curated/build-web-apps/43313cc9/skills/frontend-app-builder/SKILL.md
```

The project also includes a Claude Code wrapper:

```text
.claude/skills/frontend-app-builder/SKILL.md
```

## How Experts Use Them

### 1. Impeccable

Use before visual work to define:

- emotional positioning
- visual personality
- typography hierarchy
- spacing rhythm
- color purpose
- what to remove

For CourtOS, the answer should usually be:

```text
solemn + decisive + premium + operational
```

### 2. Taste

Use as a product judgment gate:

```text
Does this help the user decide, or is it just more UI?
```

Good CourtOS taste means:

- no page sprawl
- no exposed internal loop names
- no decorative agent theater
- no hidden conflicts
- no fake certainty
- one clear next action

### 3. Frontend App Builder

Use for major surfaces only:

- new dashboard
- major redesign
- large visual system change
- asset-led scene

Do not invoke full concept workflow for small changes inside existing CourtOS screens. For small changes, use the existing design system and run the taste/impeccable checklist.

## CourtOS Usage Pattern

For normal feature work:

```text
1. taste: should this exist, and where should it live?
2. impeccable: what is the right hierarchy, density, color, type, and restraint?
3. implement in the original screen
4. verify with tsc/test/build
```

For major redesign work:

```text
1. taste: define product intent and what not to expose
2. impeccable: define design language
3. frontend-app-builder: generate/accept concept
4. implement faithfully
5. browser + screenshot QA
```

## CourtOS Default Rule

New capability defaults to original-screen fusion:

```text
Shangshufang -> intent and summary
Junjichu -> process and reliability
Memorial scroll -> final decision
Shiguan -> archive and learning
Zhuangyuan -> swarm/secret dispatch
```

