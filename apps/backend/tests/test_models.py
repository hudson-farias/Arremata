from datetime import datetime, timedelta, timezone

import pytest
from pydantic import ValidationError

from database.users import MAX_BALANCE_CENTS
from models.lot import MAX_BID_CENTS, LotCreate, LotUpdate, BidCreate
from models.user import Credentials
from models.wallet import DepositIn


INICIO = datetime(2026, 11, 1, 18, 0, tzinfo = timezone.utc)
FIM = INICIO + timedelta(hours = 1)


def corpo(**mudancas):
    dados = {
        'card_id': 'xy1-25',
        'title': 'Pikachu',
        'image_url': 'https://example.com/pikachu.png',
        'attributes': {'set_name': 'XY', 'rarity': 'Rare', 'number': '25'},
        'starts_at': INICIO,
        'ends_at': FIM,
        'minimum_bid': 1000,
    }
    dados.update(mudancas)
    return dados


def rejeita(modelo, mensagem, **dados):
    with pytest.raises(ValidationError) as caught:
        modelo(**dados)

    assert mensagem in str(caught.value)


def test_lote_aceita_e_normaliza():
    lote = LotCreate(**corpo(title = '  Pikachu  ', increment = None))
    assert lote.title == 'Pikachu'
    assert lote.increment == 10000
    assert lote.starts_at.tzinfo == timezone.utc

    ingênuo = LotCreate(**corpo(
        starts_at = datetime(2026, 11, 1, 18, 0),
        ends_at = datetime(2026, 11, 1, 19, 0),
    ))
    assert ingênuo.starts_at.tzinfo == timezone.utc


def test_lote_rejeita_janela_e_textos_vazios():
    rejeita(LotCreate, 'fim deve ser depois do início', **corpo(ends_at = INICIO))
    rejeita(LotCreate, 'campo obrigatório', **corpo(title = '   '))
    rejeita(LotCreate, 'card_id inválido', **corpo(card_id = 'x' * 65))
    rejeita(LotCreate, 'lance deve ser maior que zero', **corpo(minimum_bid = 0))
    rejeita(LotCreate, 'lance inválido', **corpo(minimum_bid = True))
    rejeita(LotCreate, 'lance inválido', **corpo(minimum_bid = MAX_BID_CENTS + 1))
    rejeita(LotCreate, 'incremento deve ser maior que zero', **corpo(increment = 0))


def test_atualizacao_de_lote_exige_incremento():
    rejeita(
        LotUpdate,
        'incremento deve ser maior que zero',
        title = 'Pikachu',
        starts_at = INICIO,
        ends_at = FIM,
        minimum_bid = 1000,
        increment = None,
    )


def test_lance_e_deposito_rejeitam_valor_invalido():
    assert BidCreate(amount = 100).amount == 100
    rejeita(BidCreate, 'lance deve ser maior que zero', amount = 0)
    rejeita(BidCreate, 'lance inválido', amount = True)
    rejeita(BidCreate, 'lance inválido', amount = 10.5)

    assert DepositIn(amount = MAX_BALANCE_CENTS).amount == MAX_BALANCE_CENTS
    rejeita(DepositIn, 'valor deve ser maior que zero', amount = -1)
    rejeita(DepositIn, 'valor inválido', amount = True)
    rejeita(DepositIn, 'valor inválido', amount = MAX_BALANCE_CENTS + 1)


def test_credenciais_exigem_texto():
    acesso = Credentials(email = '  ana@arremata.dev  ', password = 'leilao123')
    assert acesso.email == 'ana@arremata.dev'
    rejeita(Credentials, 'campo obrigatório', email = '   ', password = 'leilao123')
    rejeita(Credentials, 'campo obrigatório', email = 'ana@arremata.dev', password = '   ')
