"""Zero-network, non-interactive DeepSeek configuration check.

Run via ``python -m app.langgraph_runtime.deepseek_check --dotenv-path
<path>``. This intentionally does not reimplement any validation logic: it
calls the exact same production entry point (``build_deepseek_graph()``)
that the rest of the runtime uses, so a passing check cannot drift from what
actually happens when the graph is built for real use. It never calls
``.invoke()``, so it never performs a network request or consumes any real
DeepSeek API usage.

``--dotenv-path`` is a **required** argument. This is a deliberate,
hard-coded safety gate: an earlier revision of this CLI called
``build_deepseek_graph()`` with no arguments, which silently fell back to
reading the developer's private, git-ignored ``backend/.env.example`` file
whenever the process environment variable was unset (see
``docs/failures/2026-07-17-product-flow-read-private-dotenv.md`` and the
"第二轮修订" section of ``docs/decisions/0009-deepseek-local-dotenv-fallback.md``
for the incident this prevents). Argument parsing happens via the standard
library's ``argparse`` *before* anything in this module ever imports or
calls ``build_deepseek_graph()``, ``dotenv_values()``, or any other dotenv-
reading code path, so a missing ``--dotenv-path`` makes it physically
impossible for this CLI to read any dotenv file: argparse's own required-
argument validation exits the process (exit code ``2``) before a single
line of DeepSeek-specific code runs.

On success, only a generic, non-sensitive status line is printed to stdout.
On failure, a generic error description (never a secret value) is printed to
stderr and the process exits non-zero.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from app.langgraph_runtime.deepseek_client import DeepSeekModelNameError
from app.langgraph_runtime.deepseek_config import DeepSeekConfigError
from app.langgraph_runtime.deepseek_graph import build_deepseek_graph


def _build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m app.langgraph_runtime.deepseek_check",
        description=(
            "Zero-network DeepSeek configuration check. Requires an explicit "
            "--dotenv-path so this command can never silently fall back to "
            "reading any private dotenv file on its own."
        ),
    )
    parser.add_argument(
        "--dotenv-path",
        required=True,
        help=(
            "Path to a dotenv file to use as a fallback when the process "
            "environment variable DEEPSEEK_API_KEY is unset/empty. Pass a "
            "temporary path for automated/CI runs; local developers may "
            "pass their own private backend/.env.example path by choice."
        ),
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    """Validate DeepSeek provider config, API key resolution, model name
    normalization, and SDK client/graph construction, without ever calling
    the model or touching the network.

    Args:
        argv: Optional argument list (excluding the program name), primarily
            for test injection. Defaults to ``sys.argv[1:]`` when omitted.

    Returns:
        ``2`` if the required ``--dotenv-path`` argument is missing (argparse
        exits the process itself before any dotenv-reading code runs); ``0``
        if ``build_deepseek_graph()`` succeeds; ``1`` if it raises a
        :class:`DeepSeekConfigError` (or subclass, which includes API key
        resolution failures) or a :class:`DeepSeekModelNameError`.
    """
    parser = _build_arg_parser()
    args = parser.parse_args(argv)

    try:
        build_deepseek_graph(dotenv_path=Path(args.dotenv_path))
    except (DeepSeekConfigError, DeepSeekModelNameError) as exc:
        print(f"DeepSeek configuration check failed: {type(exc).__name__}", file=sys.stderr)
        return 1
    print(
        "DeepSeek configuration check passed: graph constructed successfully "
        "(no network call made)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
