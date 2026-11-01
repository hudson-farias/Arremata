from datetime import datetime, timedelta, timezone

import pytest

import env
from services.chain import assess_chain, bid_message, genesis_message, sign


STARTS = datetime(2026, 11, 1, 18, 1, tzinfo = timezone.utc)
CREATED = datetime(2026, 11, 1, 18, 2, 3, 4, tzinfo = timezone.utc)
SECOND_AT = datetime(2026, 11, 1, 18, 3, tzinfo = timezone.utc)


def campos(**extras):
    base = {
        'lot_id': 7,
        'minimum_bid_cents': 1000,
        'increment_cents': 100,
        'starts_at': STARTS,
        'settlement': None,
    }
    base.update(extras)
    return base


def elo(position, bidder_id, amount, created, prev):
    digest = sign(bid_message(7, position, bidder_id, amount, created, prev))
    return {
        'id': position,
        'position': position,
        'bidder_id': bidder_id,
        'amount_cents': amount,
        'created_at': created,
        'prev_hash': prev,
        'hash': digest,
    }, digest


def livro():
    genesis = sign(genesis_message(7, 1000, 100, STARTS))
    primeiro, primeiro_hash = elo(1, 3, 1500, CREATED, genesis)
    segundo, segundo_hash = elo(2, 4, 2500, SECOND_AT, primeiro_hash)
    return [primeiro, segundo], segundo_hash


def test_mensagem_canonica_e_adulteracao():
    naive = datetime(2026, 11, 1, 18, 1)
    local = datetime(2026, 11, 1, 15, 1, tzinfo = timezone(timedelta(hours = -3)))
    genesis = 'lot|7|1000|100|2026-11-01T18:01:00.000000+00:00'

    assert genesis_message(7, 1000, 100, STARTS) == genesis
    assert genesis_message(7, 1000, 100, naive) == genesis
    assert genesis_message(7, 1000, 100, local) == genesis

    lances, ponta = livro()
    assert lances[0]['prev_hash'] == sign(genesis)
    assert len(lances[0]['hash']) == 64
    assert lances[0]['hash'] == lances[0]['hash'].lower()
    assert all(char in '0123456789abcdef' for char in lances[0]['hash'])

    intact, head = assess_chain(bids = lances, **campos())
    assert intact
    assert head == ponta

    lances[0]['amount_cents'] = 1501
    intact, head = assess_chain(bids = lances, **campos())
    assert not intact
    assert head == ponta


def test_valor_igual_nao_e_vencedor_alternativo():
    genesis = sign(genesis_message(7, 1000, 100, STARTS))
    primeiro, primeiro_hash = elo(1, 3, 1500, CREATED, genesis)
    segundo, segundo_hash = elo(2, 4, 1500, SECOND_AT, primeiro_hash)
    lances = [primeiro, segundo]
    base = campos(settlement = {
        'chain_head': segundo_hash,
        'winner_id': 3,
        'amount_cents': 1500,
    })

    intact, head = assess_chain(bids = lances, **base)
    assert not intact
    assert head == segundo_hash

    base['settlement'] = {
        'chain_head': segundo_hash,
        'winner_id': 4,
        'amount_cents': 1500,
    }
    intact, head = assess_chain(bids = lances, **base)
    assert intact
    assert head == segundo_hash


def test_segredo_ausente_falha():
    env.AUDIT_SECRET = ''

    with pytest.raises(RuntimeError) as caught:
        sign('lot|1|1|1|2026-11-01T18:01:00.000000+00:00')

    assert 'AUDIT_SECRET' in str(caught.value)


def test_livro_vazio_fecha_na_genese():
    head_esperado = sign(genesis_message(7, 1000, 100, STARTS))
    intact, head = assess_chain(bids = [], **campos())
    assert intact
    assert head == head_esperado

    intact, head = assess_chain(bids = [], **campos(settlement = {
        'chain_head': head_esperado,
        'winner_id': None,
        'amount_cents': 0,
    }))
    assert intact
    assert head == head_esperado

    intact, head = assess_chain(bids = [], **campos(settlement = {
        'chain_head': head_esperado,
        'winner_id': 3,
        'amount_cents': 0,
    }))
    assert not intact
    assert head == head_esperado


def test_posicao_fora_da_sequencia_quebra():
    lances, ponta = livro()
    lances[1]['position'] = 3
    lances[1]['hash'] = sign(bid_message(
        7, 3, 4, 2500, SECOND_AT, lances[1]['prev_hash'],
    ))

    intact, head = assess_chain(bids = lances, **campos())
    assert not intact
    assert head == lances[1]['hash']
    assert head != ponta


def test_ordem_da_lista_nao_muda_o_livro():
    lances, ponta = livro()
    intact, head = assess_chain(bids = list(reversed(lances)), **campos())
    assert intact
    assert head == ponta


def test_recalcular_um_elo_nao_salva_o_seguinte():
    lances, ponta = livro()
    lances[0]['amount_cents'] = 1501
    lances[0]['hash'] = sign(bid_message(
        7, 1, 3, 1501, CREATED, lances[0]['prev_hash'],
    ))

    intact, head = assess_chain(bids = lances, **campos())
    assert not intact
    assert head == ponta


def test_mudar_o_lance_minimo_quebra_a_genese():
    lances, ponta = livro()
    intact, head = assess_chain(bids = lances, **campos(minimum_bid_cents = 1001))
    assert not intact
    assert head == ponta


def test_prev_hash_invalido_quebra():
    lances, ponta = livro()
    lances[0]['prev_hash'] = None
    intact, head = assess_chain(bids = lances, **campos())
    assert not intact
    assert head == ponta
