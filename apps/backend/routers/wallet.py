from fastapi import APIRouter, Depends, HTTPException

from database.users import UsersORM
from models.wallet import DepositIn, WalletOut
from routers import session_owner
from services.bids import committed_cents
from services.settlement import settle_due


router = APIRouter(tags = ['wallet'])


async def wallet_of(user_id: int, total: int) -> dict:
    committed = await committed_cents(user_id)
    total = int(total)
    return {'total': total, 'committed': committed, 'available': total - committed}


@router.get('/wallet', response_model = WalletOut)
async def read_wallet(user_id: int = Depends(session_owner)):
    await settle_due()
    user = await UsersORM().find_one(id = user_id)

    if not user:
        raise HTTPException(status_code = 401, detail = 'token inválido')

    return await wallet_of(user_id, int(user.balance_cents))


@router.post('/wallet/deposits', response_model = WalletOut)
async def deposit(body: DepositIn, user_id: int = Depends(session_owner)):
    await settle_due()
    users = UsersORM()
    balance = await users.add_balance(user_id, body.amount)

    if balance is None:
        if not await users.find_one(id = user_id):
            raise HTTPException(status_code = 401, detail = 'token inválido')

        raise HTTPException(status_code = 400, detail = 'O depósito passa do teto da carteira.')

    return await wallet_of(user_id, balance)
