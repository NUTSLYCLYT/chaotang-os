# Adaptive Skill Routing Design

## Status

Approved — 2026-08-13. The user confirmed automatic Codex routing, bounded
clarification, progressive escalation, stable quality gates, and repository
verification requirements.

## Problem

The repository currently maps several task categories directly to specific
Superpowers skills. Those mappings preserve discipline, but they can make a
small, well-understood task pay the cost of a full workflow even when the model
already has enough context and the change is local, reversible, and easy to
verify.

The desired behavior is to clarify the task first, then let Codex choose the
smallest workflow that still satisfies repository quality and safety gates.
The choice must be explained, must be able to escalate as evidence changes,
and must not weaken the immutable business-flow baseline or external-action
authorization requirements.

## Goals

- Clarify only facts that can materially change scope, acceptance, risk, or
  authorization.
- Let Codex choose direct execution, Matt Skills, or Superpowers automatically.
- Explain the selected route, its quality gates, and its escalation triggers.
- Preserve root-cause, test, verification, safety, and authorization outcomes
  independently of the selected skill brand.
- Escalate progressively when scope, uncertainty, or risk increases.
- Avoid silent third-party skill installation and silent workflow downgrades.

## Non-Goals

- Changing or bypassing ADR 0028.
- Replacing repository rules with third-party skill instructions.
- Granting commit, push, deploy, delete, payment, production-write, secret, or
  private-data authority.
- Requiring Matt Skills or Superpowers to be installed for CI to pass.
- Building a numeric scoring bureaucracy for every task.

## Task Lifecycle

### 1. Mandatory preflight

Codex reads the applicable repository instructions, safety boundaries, and
immutable business baseline before task work. `using-superpowers` remains a
meta-level routing preflight; invoking it does not by itself select the full
Superpowers delivery workflow.

### 2. Bounded clarification

Codex inspects available code, documentation, commands, and current evidence
before asking the user to restate discoverable facts. It asks only questions
whose answers can materially change the objective, scope, acceptance criteria,
risk, or required authorization.

There is no fixed question limit. Clarification stops as soon as the task can
be routed safely. If a material ambiguity cannot be resolved without a user or
external decision, the task becomes `Blocked` rather than being guessed.

### 3. Automatic routing

Codex builds a task profile from:

- requirement clarity;
- affected scope and module count;
- reversibility;
- failure impact;
- root-cause or implementation-path certainty; and
- verification difficulty.

Codex then chooses the smallest sufficient route and explains the choice.

### 4. Execution and progressive escalation

Execution begins with the selected route. New evidence can escalate the task
from direct execution to Matt Skills and then to Superpowers. Material scope
changes trigger a fresh clarification and routing decision.

### 5. Verification and delivery

Verification depth is proportional to task risk, while repository hard gates
remain mandatory. External and destructive actions continue to require their
own explicit authorization.

## Routing Rules

| Route | Typical conditions | Expected behavior |
| --- | --- | --- |
| Direct execution | Clear, local, reversible, low-risk work that does not change business behavior and is easy to verify | Perform the smallest relevant check and report evidence |
| Matt Skills | Local feature or defect work with bounded uncertainty that benefits from targeted clarification, implementation, or review | Load only the directly useful Matt skills and retain repository quality gates |
| Superpowers | Cross-module, architectural, contract-changing, hard-to-reverse, high-risk, unknown-root-cause, or long-verification work | Use the applicable disciplined planning, debugging, TDD, review, and verification workflow |

Security, authorization, payment, privacy, data migration, production
configuration, irreversible operations, architectural boundary changes, and
repeated verification failures are hard escalation triggers for Superpowers or
`Blocked`, depending on whether execution authority exists.

## Quality Gates Are Brand-Independent

The router chooses an execution tool, not a lower standard. Required outcomes
remain stable:

- defects require reproducible evidence and a supported root cause;
- behavior changes require test protection where feasible;
- completion claims require fresh verification after the final change;
- repository and scoped `AGENTS.md` rules override third-party skills;
- external actions and destructive operations require explicit authority; and
- ADR 0028 remains immutable without current user authorization.

Matt Skills may be selected only when they can satisfy the applicable outcome
gates. If they cannot, Codex uses equivalent native steps or escalates to the
relevant Superpowers workflow.

## Routing Explanation Contract

After clarification, Codex emits a compact explanation before implementation:

```text
Task profile: local behavior change, reversible, medium uncertainty
Selected route: Matt Skills
Reason: targeted clarification, implementation, and verification are sufficient
Quality gates: test protection and fresh verification
Escalation: affected scope expands, root cause becomes uncertain, or verification repeatedly fails
```

The explanation must be specific to current evidence. It must not become a
long plan for a trivial task.

## Escalation and Failure Handling

- Workflow escalation is allowed whenever evidence raises scope, uncertainty,
  verification cost, or risk.
- Codex must not silently downgrade quality gates to save time.
- A material scope change restarts clarification and routing.
- Missing Matt Skills do not trigger automatic installation. Codex uses
  equivalent native steps or escalates.
- A skill failure is classified as a tool, task, environment, or authorization
  failure before selecting a fallback.
- Unresolved business ambiguity, missing authority, or irreversible risk
  produces `Blocked` with the minimum decision needed from the user.
- Escalation reuses still-valid evidence and work; it does not mechanically
  repeat completed steps.
- A user may request a heavier workflow, but cannot use routing preferences to
  bypass safety, business, authorization, or verification gates.

## Repository Changes

Implementation should update only workflow governance:

- `AGENTS.md`: replace deterministic skill-brand routing with bounded
  clarification, automatic routing, and brand-independent quality gates;
- `docs/codex-engineering-workflow.md`: document the task profile, three routes,
  escalation triggers, explanation contract, and fallbacks;
- `.agents/skills/codex-engineering-workflow/SKILL.md`: execute the routing logic
  consistently on each substantive engineering task; and
- harness self-tests: prevent silent removal of routing and safety guarantees.

ADR 0028 and its integrity baseline are explicitly out of scope.

## Verification Design

The implementation must prove at least these cases:

1. Explanation-only work or a tiny documentation correction selects direct
   execution.
2. A local, reversible feature or defect selects Matt Skills when available
   and sufficient.
3. Unknown-root-cause, cross-module, architectural, or contract work selects
   Superpowers.
4. Security-sensitive, production-write, or irreversible work stops for
   authority when required.
5. Missing Matt Skills do not install silently and instead use native steps or
   escalate.
6. Expanded scope or repeated verification failure escalates with an explicit
   reason.
7. Root-cause, testing, and fresh-verification gates remain present on every
   applicable route.
8. ADR 0028 remains byte-for-byte unchanged.

The final implementation version must run the repository's complete acceptance
flow successfully for ten consecutive rounds. A failure or a material change
to code, configuration, or the acceptance flow resets the count to round one.
Each round records the commands, PASS/FAIL result, and evidence.

## Acceptance Criteria

- Codex clarifies first and stops asking when routing information is sufficient.
- Codex selects and explains the smallest sufficient route automatically.
- Direct execution, Matt Skills, and Superpowers have explicit, observable
  selection criteria.
- Execution can escalate without silently weakening or duplicating valid work.
- Missing optional skills do not block CI or trigger silent installation.
- Repository safety, authorization, verification, and ADR 0028 protections are
  unchanged.
- Harness tests cover the routing and escalation guarantees.
