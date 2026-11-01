from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from services.lots import (
    TWO_MINUTES,
    attributes_of,
    extend_ends_at,
    published_bid,
    result_of,
    status_of,
)


INICIO = datetime(2026, 11, 1, 18, 0, tzinfo = timezone.utc)
FIM = datetime(2026, 11, 1, 19, 0, tzinfo = timezone.utc)


def lote(**extras):
    dados = {
        'cancelled_at': None,
        'starts_at': INICIO,
        'ends_at': FIM,
        'attributes': {'set_name': 'XY', 'rarity': 'Rare', 'number': 25},
    }
    dados.update(extras)
    return SimpleNamespace(**dados)


def test_status_acompanha_a_janela():
    assert status_of(lote(), INICIO - timedelta(seconds = 1)) == 'scheduled'
    assert status_of(lote(), INICIO) == 'live'
    assert status_of(lote(), FIM - timedelta(microseconds = 1)) == 'live'
    assert status_of(lote(), FIM) == 'closed'


def test_cancelado_ignora_o_horario():
    item = lote(cancelled_at = INICIO)
    assert status_of(item, INICIO + timedelta(minutes = 5)) == 'cancelled'


def test_horario_ingenuo_entra_como_utc():
    item = lote(
        starts_at = datetime(2026, 11, 1, 18, 0),
        ends_at = datetime(2026, 11, 1, 19, 0),
    )
    assert status_of(item, INICIO) == 'live'


def test_fuso_local_compara_com_utc():
    local = datetime(2026, 11, 1, 15, 0, tzinfo = timezone(timedelta(hours = -3)))
    item = lote(starts_at = local)
    assert status_of(item, INICIO - timedelta(seconds = 1)) == 'scheduled'
    assert status_of(item, INICIO) == 'live'


def test_anti_sniping_so_nos_ultimos_dois_minutos():
    no_limite = lote()
    assert extend_ends_at(no_limite, FIM - TWO_MINUTES) is True
    assert no_limite.ends_at == FIM + TWO_MINUTES

    antes = lote()
    assert extend_ends_at(antes, FIM - TWO_MINUTES - timedelta(microseconds = 1)) is False
    assert antes.ends_at == FIM

    no_fim = lote()
    assert extend_ends_at(no_fim, FIM - timedelta(seconds = 30)) is True
    assert no_fim.ends_at == FIM + TWO_MINUTES


def test_resultado_sem_lances():
    assert result_of('closed', 0) == {'winner': None, 'amount': None}
    assert result_of('closed', 2) is None
    assert result_of('live', 0) is None


def test_atributos_normalizam_numero_e_json():
    assert attributes_of(lote()) == {
        'set_name': 'XY',
        'rarity': 'Rare',
        'number': '25',
    }
    item = lote(attributes = '{"set_name": "Base", "rarity": null, "number": null}')
    assert attributes_of(item) == {
        'set_name': 'Base',
        'rarity': None,
        'number': None,
    }
    assert attributes_of(lote(attributes = {}))['set_name'] is None


def test_lance_publicado_esconde_o_id_interno():
    linha = published_bid({
        'amount_cents': 1500,
        'created_at': datetime(2026, 11, 1, 18, 2),
        'bidder_id': 3,
        'position': 1,
        'hash': 'ab',
        'prev_hash': 'cd',
    })

    assert linha == {
        'amount': 1500,
        'created_at': datetime(2026, 11, 1, 18, 2, tzinfo = timezone.utc),
        'bidder': 3,
        'position': 1,
        'hash': 'ab',
        'prev_hash': 'cd',
    }
