from importlib import import_module

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
