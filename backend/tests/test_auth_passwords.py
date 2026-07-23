"""Tests for the authentication password helpers."""

from app.auth.passwords import hash_password, verify_password


def test_password_hash_is_salted_and_verifiable():
    first = hash_password("correct horse battery staple")
    second = hash_password("correct horse battery staple")

    assert first != second
    assert verify_password("correct horse battery staple", first) is True
    assert verify_password("wrong", first) is False


def test_password_verification_rejects_malformed_encoding():
    assert verify_password("correct horse battery staple", "not-a-password-hash") is False
    assert verify_password("correct horse battery staple", "v1$scrypt$bad$8$1$salt$key") is False
