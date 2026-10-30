from hashlib import pbkdf2_hmac, sha256
from hmac import compare_digest, new as hmac_new
from secrets import token_bytes
from time import time

from sqlalchemy import Column, Integer, String

from database import Base
from env import TOKEN_SECRET


ITERATIONS = 600000
ALGORITHM = 'pbkdf2_sha256'


class UsersORM(Base):
    __tablename__ = 'users'
    TOKEN_TTL = 60 * 60 * 24 * 30

    id = Column(Integer, primary_key = True, index = True)
    email = Column(String(255), nullable = False, unique = True)
    password = Column(String(255), nullable = False)

    def hash_password(self, password: str) -> str:
        salt = token_bytes(16)
        digest = pbkdf2_hmac('sha256', password.encode(), salt, ITERATIONS)
        return f'{ALGORITHM}${ITERATIONS}${salt.hex()}${digest.hex()}'

    def verify_password(self, password: str) -> bool:
        try:
            algorithm, iterations_text, salt_hex, digest_hex = self.password.split('$')
            iterations = int(iterations_text)
            salt = bytes.fromhex(salt_hex)
            expected = bytes.fromhex(digest_hex)
        except (AttributeError, TypeError, ValueError):
            return False

        if algorithm != ALGORITHM or iterations != ITERATIONS:
            return False

        digest = pbkdf2_hmac('sha256', password.encode(), salt, iterations)
        return compare_digest(digest, expected)

    def _signature(self, user_id: str, expires_at: str) -> str:
        if not TOKEN_SECRET:
            raise RuntimeError('Variáveis de ambiente ausentes: TOKEN_SECRET')

        message = f'{user_id}.{expires_at}'.encode()
        return hmac_new(TOKEN_SECRET.encode(), message, sha256).hexdigest()

    def issue_token(self) -> str:
        expires_at = str(int(time()) + self.TOKEN_TTL)
        subject = str(self.id)
        return f'{subject}.{expires_at}.{self._signature(subject, expires_at)}'

    def user_from_token(self, token: str) -> str | None:
        parts = token.split('.')

        if len(parts) != 3:
            return None

        user_id, expires_at, signature = parts

        if not user_id.isdigit() or not expires_at.isdigit():
            return None

        try:
            valid = compare_digest(signature, self._signature(user_id, expires_at))
        except (TypeError, ValueError):
            return None

        if not valid or int(expires_at) <= int(time()):
            return None

        return user_id
