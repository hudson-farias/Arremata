from importlib import import_module
from inspect import isawaitable, signature
from typing import Annotated, get_args, get_origin

import pytest
from fastapi import HTTPException
from fastapi.params import Depends as DependsClass
from pydantic import ValidationError

from database.users import UsersORM
from models.lot import BidCreate
from models.user import Credentials, UserOut
from routers import session_owner
from routers.auth import me, register
from routers.auth import router as autenticacao
from routers.lots import place_lot_bid
from routers.wallet import deposit, read_wallet, wallet_of


leiloeiro_rotas = import_module('routers.auctioneer-lots')


def usuario(user_id = 7, role = 'bidder', email = 'ana@arremata.dev'):
    user = UsersORM()
    user.id = user_id
    user.email = email
    user.password = user.hash_password('leilao123')
    user.role = role
    return user


def instala(monkeypatch, pessoa):
    async def find_one(self, options = None, **kwargs):
        if pessoa is None:
            return None

        if 'id' in kwargs and int(kwargs['id']) != int(pessoa.id):
            return None

        if 'email' in kwargs and kwargs['email'] != pessoa.email:
            return None

        return pessoa

    monkeypatch.setattr(UsersORM, 'find_one', find_one)


def guardas():
    from routers import require_auctioneer, require_bidder

    return require_auctioneer, require_bidder


def eh_inteiro(anotacao) -> bool:
    if anotacao is int or anotacao == 'int':
        return True

    if get_origin(anotacao) is Annotated:
        return eh_inteiro(get_args(anotacao)[0])

    return False


def dependencia(funcao, nome):
    parametro = signature(funcao).parameters[nome]

    if isinstance(parametro.default, DependsClass):
        return parametro.default.dependency

    if get_origin(parametro.annotation) is Annotated:
        for item in get_args(parametro.annotation)[1:]:
            if isinstance(item, DependsClass):
                return item.dependency

    raise AssertionError(f'{funcao.__name__} não injeta {nome}')


async def resolve(funcao, user_id: int):
    parametro = next(iter(signature(funcao).parameters.values()))
    valor = user_id if eh_inteiro(parametro.annotation) else str(user_id)
    resultado = funcao(**{parametro.name: valor})

    if isawaitable(resultado):
        return await resultado

    return resultado


def papel_de(resposta):
    if resposta is None:
        raise AssertionError('resposta sem papel')

    if isinstance(resposta, str):
        return resposta

    if isinstance(resposta, dict):
        return resposta['role']

    return resposta.role


def rota_de(funcao):
    for rota in autenticacao.routes:
        if getattr(rota, 'endpoint', None) is funcao:
            return rota

    raise AssertionError(funcao.__name__)


# Unidade

async def test_leiloeiro_entra_e_licitante_recebe_403(monkeypatch):
    require_auctioneer, _require_bidder = guardas()
    instala(monkeypatch, usuario(2, 'auctioneer', 'leiloeiro@arremata.dev'))
    assert await resolve(require_auctioneer, 2) == 2

    instala(monkeypatch, usuario(4, 'bidder'))

    with pytest.raises(HTTPException) as caught:
        await resolve(require_auctioneer, 4)

    assert caught.value.status_code == 403


async def test_licitante_entra_e_leiloeiro_recebe_403(monkeypatch):
    _require_auctioneer, require_bidder = guardas()
    instala(monkeypatch, usuario(4, 'bidder'))
    assert await resolve(require_bidder, 4) == 4

    instala(monkeypatch, usuario(2, 'auctioneer', 'leiloeiro@arremata.dev'))

    with pytest.raises(HTTPException) as caught:
        await resolve(require_bidder, 2)

    assert caught.value.status_code == 403


async def test_usuario_ausente_recebe_401(monkeypatch):
    require_auctioneer, require_bidder = guardas()
    instala(monkeypatch, None)

    falhas = []

    for guarda in (require_auctioneer, require_bidder):
        with pytest.raises(HTTPException) as caught:
            await resolve(guarda, 7)

        if caught.value.status_code != 401:
            falhas.append(f'{guarda.__name__} devolveu {caught.value.status_code}')

    assert not falhas, falhas


def test_credenciais_nao_escolhem_papel():
    assert 'role' not in Credentials.model_fields

    try:
        corpo = Credentials.model_validate({
            'email': 'ana@arremata.dev',
            'password': 'leilao123',
            'role': 'auctioneer',
        })
    except ValidationError:
        return

    assert set(corpo.model_dump()) == {'email', 'password'}


async def test_cadastro_grava_licitante(monkeypatch):
    gravado = {}

    async def find_one(self, options = None, **kwargs):
        if gravado and kwargs.get('email') == gravado['email']:
            return gravado['usuario']

        return None

    async def create(self, **kwargs):
        criado = usuario(
            15,
            kwargs.get('role'),
            kwargs['email'],
        )
        criado.password = kwargs['password']
        gravado['email'] = kwargs['email']
        gravado['kwargs'] = kwargs
        gravado['usuario'] = criado
        return criado

    monkeypatch.setattr(UsersORM, 'find_one', find_one)
    monkeypatch.setattr(UsersORM, 'create', create)

    corpo = Credentials(email = 'ana@arremata.dev', password = 'leilao123')
    resposta = await register(corpo)

    assert 'role' not in corpo.model_dump()
    assert gravado['kwargs']['email'] == 'ana@arremata.dev'
    assert gravado['kwargs'].get('role') == 'bidder'
    assert 'role' in UserOut.model_fields
    assert papel_de(resposta) == 'bidder'


async def test_eu_responde_o_papel(monkeypatch):
    instala(monkeypatch, usuario(2, 'auctioneer', 'leiloeiro@arremata.dev'))
    resposta = await resolve(me, 2)

    assert rota_de(me).status_code == 200
    assert papel_de(resposta) == 'auctioneer'


# Autorização

async def test_licitante_recebe_403_nas_rotas_de_leiloeiro(monkeypatch):
    require_auctioneer, _require_bidder = guardas()
    instala(monkeypatch, usuario(4, 'bidder'))
    rotas = (
        leiloeiro_rotas.create_lot,
        leiloeiro_rotas.list_own_lots,
        leiloeiro_rotas.cancel_lot,
        leiloeiro_rotas.update_lot,
    )

    for rota in rotas:
        guarda = dependencia(rota, 'owner_id')
        assert guarda is require_auctioneer

        with pytest.raises(HTTPException) as caught:
            await resolve(guarda, 4)

        assert caught.value.status_code == 403


async def test_leiloeiro_recebe_403_ao_dar_lance(monkeypatch):
    _require_auctioneer, require_bidder = guardas()
    instala(monkeypatch, usuario(2, 'auctioneer', 'leiloeiro@arremata.dev'))
    chamado = {'vezes': 0}

    async def place_bid(lot_id, bidder_id, amount):
        chamado['vezes'] += 1
        return {'amount': amount}

    monkeypatch.setattr('routers.lots.place_bid', place_bid)
    guarda = dependencia(place_lot_bid, 'bidder_id')
    assert guarda is require_bidder

    with pytest.raises(HTTPException) as caught:
        bidder_id = await resolve(guarda, 2)
        await place_lot_bid(BidCreate(amount = 1500), 9, bidder_id)

    assert caught.value.status_code == 403
    assert chamado['vezes'] == 0


# Carteira

def test_carteira_segue_no_dono_da_sessao():
    for rota in (read_wallet, deposit):
        guarda = dependencia(rota, 'user_id')
        assert guarda is session_owner
        assert guarda.__name__ == 'session_owner'


async def test_saldo_nao_muda_por_papel(monkeypatch):
    async def comprometido(user_id):
        assert user_id == 4
        return 2500

    monkeypatch.setattr('routers.wallet.committed_cents', comprometido)
    assert list(signature(wallet_of).parameters) == ['user_id', 'total']
    assert await wallet_of(4, 8000) == {
        'total': 8000,
        'committed': 2500,
        'available': 5500,
    }
