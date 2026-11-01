from time import time

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from database.users import UsersORM
from routers import has_authenticated, session_owner
from routers.lots import viewer_from_token


def usuario(user_id = 7):
    user = UsersORM()
    user.id = user_id
    user.password = user.hash_password('leilao123')
    return user


def test_senha_confere_e_rejeita_lixo():
    user = usuario()
    outra = user.hash_password('leilao123')

    assert user.password != outra
    assert user.verify_password('leilao123')
    assert not user.verify_password('outra-senha')
    user.password = 'sem-formato'
    assert not user.verify_password('leilao123')
    user.password = 'outro$600000$aabb$ccdd'
    assert not user.verify_password('leilao123')


def test_token_ida_e_volta():
    user = usuario()
    token = user.issue_token()
    assert user.user_from_token(token) == '7'
    assert has_authenticated(
        HTTPAuthorizationCredentials(scheme = 'Bearer', credentials = token),
        None,
    ) == '7'
    assert has_authenticated(None, token) == '7'
    assert viewer_from_token(None, 'lixo', token) == 7


def test_token_expirado_adulterado_ou_ausente():
    user = usuario()
    expires_at = str(int(time()) - 10)
    expirado = f'7.{expires_at}.{user._signature("7", expires_at)}'
    assert user.user_from_token(expirado) is None
    assert user.user_from_token(user.issue_token() + 'ab') is None
    assert user.user_from_token('nao-e-token') is None
    assert viewer_from_token(None, None) is None

    with pytest.raises(HTTPException) as caught:
        has_authenticated(None, None)

    assert caught.value.status_code == 401
    assert caught.value.detail == 'token inválido'


def test_segredo_do_token_ausente_falha(monkeypatch):
    monkeypatch.setattr('database.users.TOKEN_SECRET', '')
    user = usuario()

    with pytest.raises(RuntimeError) as caught:
        user.issue_token()

    assert 'TOKEN_SECRET' in str(caught.value)


async def test_dono_da_sessao_e_inteiro():
    assert await session_owner('7') == 7

    with pytest.raises(HTTPException) as caught:
        await session_owner('sete')

    assert caught.value.status_code == 401
