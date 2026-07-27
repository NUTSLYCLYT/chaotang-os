"""Password hashing helpers using versioned stdlib scrypt encodings."""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import secrets

_ALGORITHM = "scrypt"
_VERSION = "v1"
_N = 2**14
_R = 8
_P = 1
_DKLEN = 64


def hash_password(password: str) -> str:
    """Return a salted, versioned scrypt encoding for ``password``."""

    salt = secrets.token_bytes(16)
    derived_key = hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=_N, r=_R, p=_P, dklen=_DKLEN
    )
    return "$".join(
        (
            _VERSION,
            _ALGORITHM,
            str(_N),
            str(_R),
            str(_P),
            base64.urlsafe_b64encode(salt).decode("ascii"),
            base64.urlsafe_b64encode(derived_key).decode("ascii"),
        )
    )


def verify_password(password: str, encoded_hash: str) -> bool:
    """Return whether ``password`` matches a supported stored hash.

    Malformed or unsupported stored encodings are treated as a mismatch so
    authentication callers never need to surface parsing details.
    """

    try:
        version, algorithm, n, r, p, encoded_salt, encoded_key = encoded_hash.split("$")
        if version != _VERSION or algorithm != _ALGORITHM:
            return False
        salt = base64.urlsafe_b64decode(encoded_salt.encode("ascii"))
        expected_key = base64.urlsafe_b64decode(encoded_key.encode("ascii"))
        actual_key = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=int(n),
            r=int(r),
            p=int(p),
            dklen=len(expected_key),
        )
    except (AttributeError, TypeError, ValueError, binascii.Error):
        return False
    return hmac.compare_digest(actual_key, expected_key)
