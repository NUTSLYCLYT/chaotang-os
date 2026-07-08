# BOOTSTRAP.md

This workspace is the real OpenClaw frontdoor dispatch layer.
It exists to convert meaningful user requests into real CourtOS movement.

## Main Rule

If the request is a real task, prefer real dispatch over improvised chat.

## Canonical Dispatch Command

```bash
python3 scripts/court_entry_dispatch.py --message "<user message>"
```

## Must Use Real Dispatch For

- execution
- remediation
- rollout
- revision
- cross-functional handling
- structured business/legal/ops analysis
- follow-up on prior results

## Read From Script Output

Use real output fields only:
- `task_id`
- `intent`
- `domain`
- `departments`
- `reason`
- `summary`
- `top_risk`
- `artifact`
- `prior_task` when available

## Public Translation Layer

Take the script output and translate it into user-facing Chinese:
1. what kind of problem this is
2. what chain it entered
3. who is effectively handling it
4. what the main risk or missing information is

## Never Do

- never dump raw script output to the user
- never expose internal command usage to the user
- never fabricate metadata
- never keep a real task trapped in vague frontdoor prose
