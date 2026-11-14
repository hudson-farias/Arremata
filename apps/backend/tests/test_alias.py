from pathlib import Path

import pytest
from sqlalchemy.exc import IntegrityError

from services.alias import (
    POKEMON,
    TRAINERS,
    allocate,
    draw_nickname,
    ensure_alias,
    stable_nickname,
)
from services.bids import BidError


def test_geracao_do_apelido():
    assert len(TRAINERS) >= 24
    assert len(POKEMON) >= 24
    assert len(set(TRAINERS)) == len(TRAINERS)
    assert len(set(POKEMON)) == len(POKEMON)
    assert 'ash' not in TRAINERS
    assert 'red' in TRAINERS
    assert 'cintia' in TRAINERS
    assert 'pikachu' in POKEMON
    assert 'garchomp' in POKEMON

    for name in (*TRAINERS, *POKEMON):
        assert name.isascii() and name.isalpha() and name == name.lower()

    seen = {draw_nickname() for _ in range(40)}
    assert len(seen) > 1

    for nickname in seen:
        trainer, pokemon = nickname.split('-')
        assert trainer in TRAINERS
        assert pokemon in POKEMON
        assert nickname.count('-') == 1
        assert '|' not in nickname


def test_apelido_estavel_nao_repete_no_lote():
    used = set()
    first = stable_nickname(7, 3, used)
    assert first == stable_nickname(7, 3, set())
    used.add(first)

    for user_id in range(4, 30):
        nickname = stable_nickname(7, user_id, used)
        assert nickname not in used
        assert nickname.count('-') == 1
        used.add(nickname)


class Livro:
    def __init__(self):
        self.by_user = {}
        self.by_name = {}

    async def claim(self, lot_id, user_id, draws):
        queue = list(draws)

        async def read():
            return self.by_user.get((lot_id, user_id))

        async def write(nickname):
            if (lot_id, user_id) in self.by_user or (lot_id, nickname) in self.by_name:
                raise IntegrityError('insert', {}, Exception('duplicado'))

            self.by_user[(lot_id, user_id)] = nickname
            self.by_name[(lot_id, nickname)] = user_id

        def draw():
            return queue.pop(0)

        return await allocate(read, write, draw)


async def test_reutiliza_o_apelido_no_mesmo_lote():
    livro = Livro()
    primeiro = await livro.claim(1, 3, ['red-pikachu'])
    segundo = await livro.claim(1, 3, ['cintia-garchomp'])
    assert primeiro == 'red-pikachu'
    assert segundo == 'red-pikachu'


async def test_outro_lote_recebe_outro_apelido():
    livro = Livro()
    neste = await livro.claim(1, 3, ['red-pikachu'])
    noutro = await livro.claim(2, 3, ['cintia-garchomp'])
    assert neste == 'red-pikachu'
    assert noutro == 'cintia-garchomp'
    assert neste != noutro


async def test_apelido_repetido_no_lote_tenta_de_novo():
    livro = Livro()
    await livro.claim(1, 4, ['red-pikachu'])
    outro = await livro.claim(1, 5, ['red-pikachu', 'cintia-garchomp'])
    assert outro == 'cintia-garchomp'


async def test_esgota_as_tentativas():
    async def read():
        return None

    async def write(_nickname):
        raise IntegrityError('insert', {}, Exception('duplicado'))

    with pytest.raises(BidError) as caught:
        await allocate(read, write, draw = lambda: 'red-pikachu')

    assert caught.value.status_code == 409
    assert caught.value.detail == 'não foi possível gerar o apelido'


class Resultado:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class Savepoint:
    def __init__(self, session):
        self.session = session

    async def __aenter__(self):
        self.session.savepoints += 1
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class Sessao:
    def __init__(self):
        self.rows = {}
        self.names = {}
        self.savepoints = 0

    def begin_nested(self):
        return Savepoint(self)

    async def execute(self, stmt):
        kind = stmt.__visit_name__
        params = stmt.compile().params

        if kind == 'select':
            key = (params['lot_id_1'], params['user_id_1'])
            return Resultado(self.rows.get(key))

        if kind == 'insert':
            lot_id = params['lot_id']
            user_id = params['user_id']
            nickname = params['nickname']

            if (lot_id, user_id) in self.rows or (lot_id, nickname) in self.names:
                raise IntegrityError('insert', params, Exception('duplicado'))

            self.rows[(lot_id, user_id)] = nickname
            self.names[(lot_id, nickname)] = user_id
            return Resultado(None)

        raise AssertionError(kind)


async def test_savepoint_preserva_o_lance_quando_o_apelido_colide(monkeypatch):
    fila = iter(['red-pikachu', 'cintia-garchomp'])
    monkeypatch.setattr('services.alias.draw_nickname', lambda: next(fila))
    sessao = Sessao()
    sessao.rows[(1, 9)] = 'red-pikachu'
    sessao.names[(1, 'red-pikachu')] = 9

    apelido = await ensure_alias(sessao, 1, 3)

    assert apelido == 'cintia-garchomp'
    assert sessao.savepoints == 2
    assert sessao.rows[(1, 9)] == 'red-pikachu'
    assert sessao.rows[(1, 3)] == 'cintia-garchomp'
    assert await ensure_alias(sessao, 1, 3) == 'cintia-garchomp'
    assert sessao.savepoints == 2


def test_migration_nao_reassina():
    raiz = Path(__file__).resolve().parents[1]
    texto = (raiz / 'alembic/versions/d1e8b4a07c52_lot_aliases.py').read_text()
    assert 'AUDIT_SECRET' not in texto
    assert 'prev_hash' not in texto
    assert 'chain_head' not in texto
    assert 'UPDATE bids SET hash' not in texto
    assert 'UPDATE settlements' not in texto
