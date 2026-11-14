from datetime import datetime, timezone
from importlib import import_module
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from models.lot import BidCreate
from routers.health import health_check
from routers.lots import list_lots, place_lot_bid
from routers.wallet import wallet_of
from services.bids import BidError
from services.lots import LotError


leiloeiro = import_module('routers.auctioneer-lots')


async def test_saude():
    assert await health_check() == {'status': 'ok'}


async def test_status_de_vitrine_invalido():
    with pytest.raises(HTTPException) as caught:
        await list_lots('arquivado')

    assert caught.value.status_code == 400
    assert caught.value.detail == 'status inválido'


async def test_vitrine_filtra_no_banco(monkeypatch):
    chamado = {}

    async def sem_liquidacao():
        return None

    class FakeLots:
        async def find_by_status(self, status, moment):
            chamado['status'] = status
            chamado['moment'] = moment
            return [SimpleNamespace(
                id = 3,
                title = 'Pikachu',
                image_url = 'https://example.com/p.png',
                minimum_bid = 1000,
                increment_cents = 100,
                starts_at = datetime(2026, 11, 1, 18, 0, tzinfo = timezone.utc),
                ends_at = datetime(2026, 11, 1, 19, 0, tzinfo = timezone.utc),
                attributes = {'set_name': 'XY', 'rarity': 'Rare', 'number': '25'},
                cancelled_at = None,
            )]

    async def stats(ids):
        assert ids == [3]
        return {3: (2, 1500)}

    async def publico(row, moment, *, summary = None, verify_chain = False, **_kwargs):
        chamado['verify_chain'] = verify_chain
        chamado['summary'] = summary
        return {
            'id': row.id,
            'title': row.title,
            'image_url': row.image_url,
            'minimum_bid': 1000,
            'increment': 100,
            'current_bid': 1500,
            'starts_at': row.starts_at,
            'ends_at': row.ends_at,
            'status': 'live',
            'bid_count': 2,
            'bids': [],
            'attributes': row.attributes,
            'set_name': 'XY',
            'rarity': 'Rare',
            'number': '25',
            'result': None,
            'chain_intact': None,
            'chain_head': None,
        }

    monkeypatch.setattr('routers.lots.settle_due', sem_liquidacao)
    monkeypatch.setattr('routers.lots.LotsORM', FakeLots)
    monkeypatch.setattr('routers.lots.summaries_for', stats)
    monkeypatch.setattr('routers.lots.public_lot', publico)
    monkeypatch.setattr('routers.lots.now_utc', lambda: datetime(2026, 11, 1, 18, 30, tzinfo = timezone.utc))

    items = await list_lots('live')

    assert chamado['status'] == 'live'
    assert chamado['verify_chain'] is False
    assert chamado['summary'] == (2, 1500)
    assert len(items) == 1
    assert items[0]['id'] == 3


async def test_erro_de_lance_vira_resposta(monkeypatch):
    async def recusa(lot_id, bidder_id, amount):
        raise BidError(409, 'saldo insuficiente')

    monkeypatch.setattr('routers.lots.place_bid', recusa)

    with pytest.raises(HTTPException) as caught:
        await place_lot_bid(BidCreate(amount = 1500), 7, 3)

    assert caught.value.status_code == 409
    assert caught.value.detail == 'saldo insuficiente'


async def test_erro_de_cancelamento_vira_resposta(monkeypatch):
    async def recusa(lot_id, owner_id):
        raise LotError(409, 'lote encerrado')

    monkeypatch.setattr(leiloeiro, 'cancel_owned_lot', recusa)

    with pytest.raises(HTTPException) as caught:
        await leiloeiro.cancel_lot(7, 2)

    assert caught.value.status_code == 409
    assert caught.value.detail == 'lote encerrado'


async def test_carteira_desconta_o_comprometido(monkeypatch):
    async def comprometido(user_id):
        assert user_id == 4
        return 2500

    monkeypatch.setattr('routers.wallet.committed_cents', comprometido)
    assert await wallet_of(4, 8000) == {
        'total': 8000,
        'committed': 2500,
        'available': 5500,
    }
