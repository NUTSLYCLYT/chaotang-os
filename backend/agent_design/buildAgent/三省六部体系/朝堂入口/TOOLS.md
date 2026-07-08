# TOOLS.md

This workspace is an intake-and-dispatch layer, not a heavy execution workspace.

## Priority Order

1. Understand the user's real intent
2. Decide whether direct answer is sufficient
3. If not, run the canonical dispatch path
4. Translate results back into clean public language

## Canonical Tooling Path

```bash
python3 scripts/court_entry_dispatch.py --message "<user message>"
```

This path connects:
- Zhongshu routing
- Shangshu dispatch
- manor / ministry execution

## Use Real Dispatch When

- the user asks for action
- the user asks for revision
- the user asks for structured analysis with consequences
- the request crosses departments or domains
- the request needs tracking, routing, or artifact production

## Do Not Use Real Dispatch When

- the user is just greeting you
- the user is asking a tiny identity question
- the answer is a trivial conversational reply

## Internal-to-Public Translation Rule

All tool output must be translated into natural Chinese.
Never expose raw internal structures directly.
