from json import dumps, loads
from httpx import AsyncClient

from env import POKEMON_TCG_API_URL
from utils.redis import cache_get, cache_set

TTL = 300

async def search_cards(query: str):
    key = f"cards:{query.strip().lower()}"
    try:
        cached = await cache_get(key)
        if cached: return loads(cached)
    except Exception: pass

    url = f"{POKEMON_TCG_API_URL.rstrip('/')}/cards"

    try:
        async with AsyncClient(timeout = 10) as client:
            response = await client.get(url, params = {"q": f"name:{query}", "pageSize": 1})
            response.raise_for_status()
            payload = response.json()
    except Exception as exc: raise RuntimeError("pokemon tcg api failed") from exc

    data = payload.get("data") or []
    if not data: return None

    item = data[0]
    images = item.get("images") or {}
    card_set = item.get("set") or {}
    card = {"id": item.get("id"), "name": item.get("name"), "set_name": card_set.get("name"), "rarity": item.get("rarity"), "image_small": images.get("small"), "image_large": images.get("large")}

    try: await cache_set(key, dumps(card), ex = TTL)
    except Exception: pass

    return card
