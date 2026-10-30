from json import dumps, loads

from httpx import AsyncClient

from env import POKEMON_TCG_API_URL
from utils.redis import cache_get, cache_set


class Cards:
    def __init__(self):
        self.url = POKEMON_TCG_API_URL.rstrip('/')
        self.timeout = 10
        self.ttl = 300
        self.page_size = 12

    def _key(self, mode: str, query: str) -> str:
        return f'cards:{mode}:{query.strip().lower()}'

    async def _load(self, mode: str, query: str, page_size: int, parse):
        key = self._key(mode, query)

        try:
            cached = await cache_get(key)
            if cached:
                return loads(cached)
        except Exception:
            pass

        try:
            async with AsyncClient(timeout = self.timeout) as client:
                response = await client.get(
                    f'{self.url}/cards',
                    params = {'q': f'name:{query.strip()}', 'pageSize': page_size},
                )
                response.raise_for_status()
                payload = response.json()
        except Exception as exc:
            raise RuntimeError('pokemon tcg api failed') from exc

        data = payload.get('data') or []
        if not isinstance(data, list):
            data = []

        result = parse(data)

        try:
            await cache_set(key, dumps(result), ex = self.ttl)
        except Exception:
            pass

        return result

    def _one(self, data: list):
        if not data:
            return None

        item = data[0]
        images = item.get('images') or {}
        card_set = item.get('set') or {}

        return {
            'id': item.get('id'),
            'name': item.get('name'),
            'set_name': card_set.get('name'),
            'rarity': item.get('rarity'),
            'image_small': images.get('small'),
            'image_large': images.get('large'),
        }

    def _many(self, data: list):
        cards = []

        for item in data[:self.page_size]:
            images = item.get('images') or {}
            card_set = item.get('set') or {}
            number = item.get('number')

            cards.append({
                'id': item.get('id'),
                'name': item.get('name'),
                'edition': card_set.get('name'),
                'rarity': item.get('rarity'),
                'number': None if number is None else str(number),
                'images': {
                    'small': images.get('small'),
                    'large': images.get('large'),
                },
            })

        return cards

    async def search_card(self, query: str):
        return await self._load('search_card', query, 1, self._one)

    async def search_cards(self, query: str):
        return await self._load('search_cards', query, self.page_size, self._many)
