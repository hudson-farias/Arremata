from fastapi import APIRouter, Cookie, Depends, HTTPException, Path, Query, WebSocket, WebSocketDisconnect

from database.lots import LotsORM
from database.users import UsersORM
from models.lot import BidCreate, PlacedBid, PublicLot
from routers import session_owner
from services.bids import BidError, place_bid
from services.live import encode_lot, lot_rooms
from services.lots import leading_bidder, now_utc, public_lot, status_of, summaries_for


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
    rows = await LotsORM().find_many()
    stats = await summaries_for([row.id for row in rows])
    items = []

    for row in rows:
        item = await public_lot(row, moment, summary = stats[row.id])

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

    return await public_lot(lot, include_bids = True)


def viewer_from_token(*tokens: str | None) -> int | None:
    for token in tokens:
        if not token:
            continue

        user_id = UsersORM().user_from_token(token)

        if not user_id:
            continue

        try:
            return int(user_id)
        except (TypeError, ValueError):
            continue

    return None


@router.websocket('/lots/{lot_id}/live')
async def live_lot(
    websocket: WebSocket,
    lot_id: int = Path(gt = 0),
    token: str | None = Query(default = None),
    cookie_token: str | None = Cookie(default = None, alias = 'TOKEN'),
):
    lot = await LotsORM().find_one(id = lot_id)
    missing = lot is None or status_of(lot) == 'cancelled'
    await websocket.accept()

    if missing:
        await websocket.close(code = 1008)
        return

    user_id = viewer_from_token(
        token,
        websocket.query_params.get('token'),
        cookie_token,
        websocket.cookies.get('TOKEN'),
    )
    await lot_rooms.attach(websocket, lot.id, user_id)

    try:
        public = encode_lot(await public_lot(lot, include_bids = True))
        leader_id = await leading_bidder(lot.id)
        await websocket.send_json({
            'type': 'lot',
            'lot': public,
            'leading': user_id is not None and leader_id == user_id,
        })

        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await lot_rooms.detach(websocket, lot.id)


@router.post('/lots/{lot_id}/bids', response_model = PlacedBid)
async def place_lot_bid(
    body: BidCreate,
    lot_id: int = Path(gt = 0),
    bidder_id: int = Depends(session_owner),
):
    try:
        return await place_bid(lot_id, bidder_id, body.amount)
    except BidError as error:
        raise HTTPException(status_code = error.status_code, detail = error.detail)
