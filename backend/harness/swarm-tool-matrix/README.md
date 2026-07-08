# Swarm Tool Matrix Harness

Date: 2026-06-07

Purpose: choose the first external/open-source tools for testing and extending
the Oracle & Mentor swarm system.

This matrix is intentionally not a popularity contest. GitHub stars are only one
signal. A tool wins when it can improve one of these product loops:

- synthetic user / market feedback for product decisions;
- Jinyiwei external intelligence collection with source evidence;
- browser-agent testing of real user journeys;
- swarm red-team / regression evaluation;
- observability and learning archive for repeated improvement.

## Gate

A candidate can enter the first integration wave only if:

- it has a clear role in the Oracle & Mentor product loop;
- it can produce auditable artifacts: input, output, source, timestamp, score;
- its license is compatible with the way we plan to use it;
- failure can be detected without trusting the model's own prose;
- it reduces user effort rather than adding another dashboard for the user.

## Output

Run:

```bash
python harness/swarm-tool-matrix/scripts/run_matrix.py
```

Artifacts:

- `harness/swarm-tool-matrix/artifacts/tool_matrix_results.json`
- `harness/swarm-tool-matrix/artifacts/tool_matrix_report.md`
