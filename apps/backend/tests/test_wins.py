from datetime import datetime, timezone
from types import SimpleNamespace

from services.wins import _is_winner, _position, _settled_at, _won_amount


QUANDO = datetime(2026, 11, 1, 19, 0, tzinfo = timezone.utc)


def liquidacao(**extras):
    dados = {
        'winner_id': 4,
        'amount_cents': 2500,
        'created_at': QUANDO,
    }
    dados.update(extras)
    return SimpleNamespace(**dados)


def test_posicao_do_licitante():
    assert _position('closed', True) == 'lost'
    assert _position('live', True) == 'winning'
    assert _position('scheduled', False) == 'outbid'


def test_vencedor_vem_da_liquidacao_e_cai_no_lider():
    assert _is_winner(4, liquidacao(), 3)
    assert not _is_winner(3, liquidacao(), 3)
    assert _is_winner(3, liquidacao(winner_id = None), 3)
    assert not _is_winner(4, None, 3)


def test_valor_e_horario_do_arremate():
    assert _won_amount(liquidacao(), 9999, 100) == 2500
    assert _won_amount(liquidacao(winner_id = None), 1800, 100) == 1800
    assert _won_amount(None, None, 100) == 100

    lote = SimpleNamespace(ends_at = datetime(2026, 11, 1, 18, 0))
    assert _settled_at(lote, liquidacao()) == QUANDO
    assert _settled_at(lote, None) == datetime(2026, 11, 1, 18, 0, tzinfo = timezone.utc)
