from fastapi import APIRouter, Depends, HTTPException

from database.lots import LotsORM
from models.lot import AuctioneerLot, LotCreate
from routers import session_owner
from services.lots import auctioneer_lot, bid_count, now_utc, status_of


router = APIRouter(prefix = '/auctioneer', tags = ['auctioneer'])


@router.post('/lots', status_code = 201, response_model = AuctioneerLot)
async def create_lot(body: LotCreate, owner_id: int = Depends(session_owner)):
    created = await LotsORM().create(
        owner_id = owner_id,
        card_id = body.card_id,
        title = body.title,
        image_url = body.image_url,
        attributes = body.attributes.model_dump(),
        starts_at = body.starts_at,
        ends_at = body.ends_at,
        minimum_bid = body.minimum_bid,
    )

    return auctioneer_lot(created)


@router.get('/lots', response_model = list[AuctioneerLot])
async def list_own_lots(owner_id: int = Depends(session_owner)):
    moment = now_utc()
    rows = await LotsORM().find_many(owner_id = owner_id)
    return [auctioneer_lot(row, moment) for row in rows]


@router.delete('/lots/{id}', response_model = AuctioneerLot)
async def cancel_lot(id: int, owner_id: int = Depends(session_owner)):
    lots = LotsORM()
    lot = await lots.find_one(id = id)

    if not lot or lot.owner_id != owner_id:
        raise HTTPException(status_code = 404, detail = 'lote não encontrado')

    if lot.cancelled_at is not None:
        raise HTTPException(status_code = 409, detail = 'lote cancelado')

    if bid_count(lot) > 0:
        raise HTTPException(status_code = 409, detail = 'lote com lances')

    moment = now_utc()

    if status_of(lot, moment) == 'closed':
        raise HTTPException(status_code = 409, detail = 'lote encerrado')

    updated = await lots.update(id, cancelled_at = moment)

    if not updated:
        raise HTTPException(status_code = 404, detail = 'lote não encontrado')

    return auctioneer_lot(updated, moment)
