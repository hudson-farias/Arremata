from asyncio import CancelledError, Lock, create_task, sleep
from json import dumps, loads
from logging import getLogger

from fastapi import WebSocket

from models.lot import PublicLot
from utils.redis import get_client


log = getLogger(__name__)

CHANNEL_PREFIX = 'arremata:lot:'
PUBLISH_TIMEOUT = 1.0


def channel(lot_id: int) -> str:
    return f'{CHANNEL_PREFIX}{lot_id}'


def encode_lot(lot: dict) -> dict:
    return PublicLot.model_validate(lot).model_dump(mode = 'json')


async def publish_lot(lot_id: int, lot: dict, leader_id: int | None) -> None:
    client = get_client(socket_timeout = PUBLISH_TIMEOUT, socket_connect_timeout = PUBLISH_TIMEOUT)

    try:
        body = dumps({
            'lot': encode_lot(lot),
            'leader_id': leader_id,
        })
        await client.publish(channel(lot_id), body)
    except Exception:
        log.exception('falha ao publicar lance do lote %s', lot_id)
    finally:
        try:
            await client.aclose()
        except Exception:
            log.exception('falha ao fechar o redis depois do lance %s', lot_id)


class LotRooms:
    def __init__(self):
        self._rooms: dict[int, set[WebSocket]] = {}
        self._users: dict[WebSocket, int | None] = {}
        self._lock = Lock()
        self._task = None

    async def attach(self, websocket: WebSocket, lot_id: int, user_id: int | None) -> None:
        async with self._lock:
            self._rooms.setdefault(lot_id, set()).add(websocket)
            self._users[websocket] = user_id
            task = self._task

            if task is None or task.done():
                self._task = create_task(self._listen())

    async def detach(self, websocket: WebSocket, lot_id: int) -> None:
        async with self._lock:
            room = self._rooms.get(lot_id)

            if room is not None:
                room.discard(websocket)

                if not room:
                    self._rooms.pop(lot_id, None)

            self._users.pop(websocket, None)

    async def _listen(self) -> None:
        while True:
            try:
                await self._pump()
            except CancelledError:
                raise
            except Exception:
                log.exception('inscrição ao vivo do lote falhou')
                await sleep(1)

    async def _pump(self) -> None:
        client = get_client()
        pubsub = client.pubsub()

        try:
            await pubsub.psubscribe(f'{CHANNEL_PREFIX}*')

            while True:
                message = await pubsub.get_message(ignore_subscribe_messages = True, timeout = 1.0)

                if message:
                    await self._deliver(message)
        finally:
            await pubsub.aclose()
            await client.aclose()

    async def _deliver(self, message: dict) -> None:
        data = message.get('data')

        if not isinstance(data, str):
            return

        try:
            payload = loads(data)
            lot = payload['lot']
            lot_id = int(lot['id'])
            leader_raw = payload.get('leader_id')
            leader_id = None if leader_raw is None else int(leader_raw)
        except (KeyError, TypeError, ValueError):
            log.exception('mensagem ao vivo inválida')
            return

        async with self._lock:
            viewers = [
                (socket, self._users.get(socket))
                for socket in self._rooms.get(lot_id, ())
            ]

        stale = []

        for socket, user_id in viewers:
            leading = user_id is not None and leader_id is not None and user_id == leader_id

            try:
                await socket.send_json({
                    'type': 'lot',
                    'lot': lot,
                    'leading': leading,
                })
            except Exception:
                stale.append(socket)

        for socket in stale:
            await self.detach(socket, lot_id)


lot_rooms = LotRooms()
