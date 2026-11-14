from fastapi import Cookie, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from database.users import AUCTIONEER, BIDDER, UsersORM


_bearer = HTTPBearer(auto_error = False)


def has_authenticated(
    auth: HTTPAuthorizationCredentials | None = Depends(_bearer),
    token: str | None = Cookie(default = None, alias = 'TOKEN'),
):
    credentials = auth.credentials if auth and auth.credentials else token

    if not credentials:
        raise HTTPException(status_code = 401, detail = 'token inválido')

    user_id = UsersORM().user_from_token(credentials)

    if not user_id:
        raise HTTPException(status_code = 401, detail = 'token inválido')

    return user_id


async def session_owner(user_id: str = Depends(has_authenticated)) -> int:
    try:
        return int(user_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code = 401, detail = 'token inválido')


async def require_auctioneer(user_id: int = Depends(session_owner)) -> int:
    user = await UsersORM().find_one(id = user_id)

    if user is None:
        raise HTTPException(status_code = 401, detail = 'token inválido')

    if user.role != AUCTIONEER:
        raise HTTPException(status_code = 403, detail = 'acesso negado')

    return user_id


async def require_bidder(user_id: int = Depends(session_owner)) -> int:
    user = await UsersORM().find_one(id = user_id)

    if user is None:
        raise HTTPException(status_code = 401, detail = 'token inválido')

    if user.role != BIDDER:
        raise HTTPException(status_code = 403, detail = 'acesso negado')

    return user_id
