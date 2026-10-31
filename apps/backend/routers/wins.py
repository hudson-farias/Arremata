from fastapi import APIRouter, Depends, HTTPException

from database.users import UsersORM
from models.wins import WinsOut
from routers import session_owner
from services.settlement import settle_due
from services.wins import wins_for


router = APIRouter(tags = ['wins'])


@router.get('/wins', response_model = WinsOut)
async def read_wins(user_id: int = Depends(session_owner)):
    user = await UsersORM().find_one(id = user_id)

    if not user:
        raise HTTPException(status_code = 401, detail = 'token inválido')

    await settle_due()
    return await wins_for(user_id)
