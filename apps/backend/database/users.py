from hashlib import pbkdf2_hmac, sha256
from hmac import compare_digest, new as hmac_new
from secrets import token_bytes
from time import time

from sqlalchemy import BigInteger, Column, Integer, String, update

from database import Base, Session
from env import TOKEN_SECRET


ITERATIONS = 600000
ALGORITHM = 'pbkdf2_sha256'
MAX_BALANCE_CENTS = 999999999999


class UsersORM(Base):
    __tablename__ = 'users'
    TOKEN_TTL = 60 * 60 * 24 * 30

    id = Column(Integer, primary_key = True, index = True)
    email = Column(String(255), nullable = False, unique = True)
    password = Column(String(255), nullable = False)
    balance_cents = Column(BigInteger, nullable = False, default = 0, server_default = '0')

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

    async def add_balance(self, user_id: int, amount: int) -> int | None:
        async with Session() as db:
            balance = self.__class__.balance_cents
            stmt = (
                update(self.__class__)
                .where(self.__class__.id == user_id)
                .where(balance + amount <= MAX_BALANCE_CENTS)
                .values(balance_cents = balance + amount)
                .returning(balance)
                .execution_options(synchronize_session = False)
            )
            result = await db.execute(stmt)
            updated = result.scalar_one_or_none()

            if updated is None:
                return None

            await db.commit()
            return int(updated)
