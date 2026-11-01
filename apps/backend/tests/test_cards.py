import pytest
from fastapi import HTTPException

from routers.cards import search_cards
from services.cards import Cards, name_query


CARTA = {
    'id': 'xy1-25',
    'name': 'Pikachu',
    'rarity': 'Rare',
    'number': 25,
    'set': {'name': 'XY'},
    'images': {'small': 'https://exemplo/s.png', 'large': 'https://exemplo/l.png'},
}


class Resposta:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


class Cliente:
    def __init__(self, payload, falha = None):
        self.payload = payload
        self.falha = falha
        self.chamadas = []

    def __call__(self, timeout):
        self.timeout = timeout
        return self

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def get(self, url, params):
        if self.falha is not None:
            raise self.falha

        self.chamadas.append((url, params))
        return Resposta(self.payload)


def test_consulta_limpa_curinga_e_vazio():
    assert name_query('  Pikachu* ') == 'name:*pikachu*'
    assert name_query('***') == ''
    assert name_query('   ') == ''


def test_parse_de_uma_e_de_varias():
    cartas = Cards()
    assert cartas._one([]) is None
    assert cartas._one([CARTA]) == {
        'id': 'xy1-25',
        'name': 'Pikachu',
        'set_name': 'XY',
        'rarity': 'Rare',
        'image_small': 'https://exemplo/s.png',
        'image_large': 'https://exemplo/l.png',
    }

    varias = [dict(CARTA, number = indice) for indice in range(13)]
    pagina = cartas._many(varias)
    assert len(pagina) == 12
    assert pagina[0]['number'] == '0'
    assert pagina[0]['edition'] == 'XY'
    assert cartas._many([{'id': 'x', 'number': None}])[0]['number'] is None


async def test_cache_responde_sem_chamar_a_api(monkeypatch):
    cliente = Cliente({'data': [CARTA]})

    async def cache_get(key):
        return '{"id": "xy1-25", "name": "Pikachu"}'

    async def cache_set(*args, **kwargs):
        raise AssertionError('não deveria gravar')

    monkeypatch.setattr('services.cards.cache_get', cache_get)
    monkeypatch.setattr('services.cards.cache_set', cache_set)
    monkeypatch.setattr('services.cards.AsyncClient', cliente)

    achada = await Cards().search_card('Pikachu')
    assert achada == {'id': 'xy1-25', 'name': 'Pikachu'}
    assert cliente.chamadas == []


async def test_falha_de_cache_ainda_consulta_e_grava(monkeypatch):
    cliente = Cliente({'data': [CARTA]})
    gravados = []

    async def cache_get(key):
        raise ConnectionError('redis')

    async def cache_set(key, value, ex):
        gravados.append((key, ex))

    monkeypatch.setattr('services.cards.cache_get', cache_get)
    monkeypatch.setattr('services.cards.cache_set', cache_set)
    monkeypatch.setattr('services.cards.AsyncClient', cliente)

    achada = await Cards().search_card('Pikachu')
    assert achada['id'] == 'xy1-25'
    assert cliente.chamadas[0][1]['q'] == 'name:*pikachu*'
    assert gravados == [('cards:search_card:name:*pikachu*', 300)]


async def test_api_fora_vira_erro(monkeypatch):
    async def cache_get(key):
        return None

    monkeypatch.setattr('services.cards.cache_get', cache_get)
    monkeypatch.setattr('services.cards.AsyncClient', Cliente(None, falha = TimeoutError('timeout')))

    with pytest.raises(RuntimeError, match = 'pokemon tcg api failed'):
        await Cards().search_card('Pikachu')


async def test_consulta_vazia_nao_sai_da_api(monkeypatch):
    cliente = Cliente({'data': []})
    monkeypatch.setattr('services.cards.AsyncClient', cliente)

    assert await Cards().search_cards('***') == []
    assert cliente.chamadas == []


async def test_rota_rejeita_vazio_e_catalogo_fora(monkeypatch):
    with pytest.raises(HTTPException) as vazio:
        await search_cards('  *  ')

    assert vazio.value.status_code == 400
    assert vazio.value.detail == 'campo obrigatório'

    async def quebra(self, query):
        raise RuntimeError('pokemon tcg api failed')

    monkeypatch.setattr('routers.cards.Cards.search_cards', quebra)

    with pytest.raises(HTTPException) as fora:
        await search_cards('pikachu')

    assert fora.value.status_code == 502
    assert fora.value.detail == 'falha ao consultar o catálogo'
