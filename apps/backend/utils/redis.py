from redis.asyncio import from_url

from env import REDIS_URL


def get_client(socket_timeout: float | None = None, socket_connect_timeout: float | None = None):
    options = {}

    if socket_timeout is not None:
        options['socket_timeout'] = socket_timeout

    if socket_connect_timeout is not None:
        options['socket_connect_timeout'] = socket_connect_timeout

    return from_url(REDIS_URL, decode_responses = True, **options)


async def cache_get(key: str):
    client = get_client()
    try:
        return await client.get(key)
    finally:
        await client.aclose()


async def cache_set(key: str, value: str, ex: int):
    client = get_client()
    try:
        await client.set(key, value, ex = ex)
    finally:
        await client.aclose()
