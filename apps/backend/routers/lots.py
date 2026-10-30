from fastapi import APIRouter, HTTPException

from database.lots import LotsORM
from models.lot import PublicLot
from services.lots import now_utc, public_lot


router = APIRouter(tags = ['lots'])


@router.get('/lots', response_model = list[PublicLot])
async def list_open_lots(status: str = 'live'):
    if status != 'live':
        raise HTTPException(status_code = 400, detail = 'status inválido')

    moment = now_utc()
    opened = []

    for row in await LotsORM().find_many():
        item = public_lot(row, moment)

        if item['status'] == 'live':
            opened.append(item)

    opened.sort(key = lambda item: item['ends_at'])
    return opened
