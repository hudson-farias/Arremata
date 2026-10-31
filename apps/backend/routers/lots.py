from fastapi import APIRouter, HTTPException, Path

from database.lots import LotsORM
from models.lot import PublicLot
from services.lots import now_utc, public_lot, status_of


router = APIRouter(tags = ['lots'])

PUBLIC_ORDER = {
    'live': ('ends_at', False),
    'scheduled': ('starts_at', False),
    'closed': ('ends_at', True),
}


@router.get('/lots', response_model = list[PublicLot])
async def list_lots(status: str = 'live'):
    order = PUBLIC_ORDER.get(status)

    if order is None:
        raise HTTPException(status_code = 400, detail = 'status inválido')

    field, newest_first = order
    moment = now_utc()
    items = []

    for row in await LotsORM().find_many():
        item = public_lot(row, moment)

        if item['status'] == status:
            items.append(item)

    items.sort(key = lambda item: item['id'])
    items.sort(key = lambda item: item[field], reverse = newest_first)
    return items


@router.get('/lots/{lot_id}', response_model = PublicLot)
async def read_public_lot(lot_id: int = Path(gt = 0)):
    lot = await LotsORM().find_one(id = lot_id)

    if not lot or status_of(lot) == 'cancelled':
        raise HTTPException(status_code = 404, detail = 'lote não encontrado')

    return public_lot(lot)
