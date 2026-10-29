from hashlib import pbkdf2_hmac
from hmac import compare_digest
from secrets import token_bytes


ITERATIONS = 600000
ALGORITHM = "pbkdf2_sha256"


def hash_password(password: str) -> str:
    salt = token_bytes(16)
    digest = pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS)
    return f"{ALGORITHM}${ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, iterations_text, salt_hex, digest_hex = stored.split("$")
        iterations = int(iterations_text)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(digest_hex)
    except (AttributeError, TypeError, ValueError):
        return False

    if algorithm != ALGORITHM or iterations != ITERATIONS:
        return False

    digest = pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return compare_digest(digest, expected)
