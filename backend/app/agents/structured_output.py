"""Shared strict-JSON parsing helper for the ``app.agents.*`` packages.

Every business agent package (``chancellor``, ``ministries``, and
``junjichu``) requires the underlying chat model to respond with
a single JSON object and nothing else. This module is the *one* place that
implements that parsing contract, so all agent packages apply exactly the
same leniency (or lack thereof) -- see
``docs/product/tasks/2026-07-17-decree-six-ministries-joint-review.md``.

Leniency is intentionally narrow: the only transformation ever applied to
the raw model output before calling :func:`json.loads` is stripping
leading/trailing whitespace and, if present, unwrapping a single enclosing
```json ... ``` or ``` ... ``` markdown code fence. Anything else -- leading/
trailing prose, multiple JSON values, truncated JSON, non-object JSON (e.g.
a bare list or string), etc. -- is treated as a parse failure.

Failures never include the raw model output or the underlying
``json.JSONDecodeError`` message in their own ``str()``, so callers can
surface a further-wrapped form of this exception (see
``app.agents.chancellor.graph.ChancellorGraphInvocationError``) without
risking an information leak from arbitrary model output.
"""

from __future__ import annotations

import json
import re

_CODE_FENCE_PATTERN = re.compile(r"\A```(?:json)?\s*\n?(?P<body>.*?)\n?```\Z", re.DOTALL)


class StructuredOutputError(Exception):
    """Raised when model output cannot be parsed as the required strict JSON.

    The original ``json.JSONDecodeError`` (when applicable) is preserved via
    ``raise ... from exc`` (available as ``__cause__``), but this exception's
    own message never echoes the raw model output or the decoder's message --
    arbitrary model output must never be assumed safe to surface verbatim to
    an end user. Callers (agent nodes) are expected to catch this exception
    and re-raise their own sanitized, package-specific exception type.
    """


def parse_strict_json_object(raw_text: str) -> dict:
    """Parse ``raw_text`` as a single strict JSON object.

    Args:
        raw_text: The raw chat model response text. Leading/trailing
            whitespace, and an optional single enclosing markdown code fence
            (```` ```json ... ``` ```` or ```` ``` ... ``` ````), are
            stripped before parsing; nothing else about the text is altered.

    Returns:
        The parsed JSON value, as a ``dict``.

    Raises:
        StructuredOutputError: ``raw_text`` is not a string, is not valid
            JSON after the narrow stripping described above, or parses to a
            JSON value that is not an object (e.g. a list, string, or
            number).
    """
    if not isinstance(raw_text, str):
        raise StructuredOutputError("Model output is not a string.")

    candidate = raw_text.strip()
    fence_match = _CODE_FENCE_PATTERN.match(candidate)
    if fence_match:
        candidate = fence_match.group("body").strip()

    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError as exc:
        raise StructuredOutputError("Model output is not valid JSON.") from exc

    if not isinstance(parsed, dict):
        raise StructuredOutputError("Model output JSON is not an object.")

    return parsed
