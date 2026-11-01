from datetime import datetime, timezone
from hashlib import sha256
from hmac import compare_digest, new as hmac_new

import env


def chain_timestamp(value: datetime) -> str:
    if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
        value = value.replace(tzinfo = timezone.utc)
    else:
        value = value.astimezone(timezone.utc)

    return value.isoformat(timespec = 'microseconds')


def genesis_message(
    lot_id: int,
    minimum_bid_cents: int,
    increment_cents: int,
    starts_at: datetime,
) -> str:
    return (
        f'lot|{int(lot_id)}|{int(minimum_bid_cents)}|{int(increment_cents)}|'
        f'{chain_timestamp(starts_at)}'
    )


def bid_message(
    lot_id: int,
    position: int,
    bidder_id: int,
    amount_cents: int,
    created_at: datetime,
    prev_hash: str,
) -> str:
    return (
        f'{int(lot_id)}|{int(position)}|{int(bidder_id)}|{int(amount_cents)}|'
        f'{chain_timestamp(created_at)}|{prev_hash}'
    )


def sign(message: str) -> str:
    secret = env.AUDIT_SECRET

    if not secret:
        raise RuntimeError('Variáveis de ambiente ausentes: AUDIT_SECRET')

    return hmac_new(secret.encode('utf-8'), message.encode('utf-8'), sha256).hexdigest()


def same_digest(left, right) -> bool:
    if not isinstance(left, str) or not isinstance(right, str) or len(left) != len(right):
        return False

    return compare_digest(left, right)


def _winner(value) -> int | None:
    if value is None:
        return None

    return int(value)


def _settlement_agrees(settlement, head: str, winner_id: int | None, amount_cents: int) -> bool:
    if settlement is None:
        return True

    stored_winner = _winner(settlement.get('winner_id'))

    return (
        same_digest(settlement.get('chain_head'), head)
        and stored_winner == winner_id
        and int(settlement['amount_cents']) == int(amount_cents)
    )


def assess_chain(
    *,
    lot_id: int,
    minimum_bid_cents: int,
    increment_cents: int,
    starts_at: datetime,
    bids: list[dict],
    settlement: dict | None,
) -> tuple[bool, str]:
    genesis = sign(genesis_message(lot_id, minimum_bid_cents, increment_cents, starts_at))

    if not bids:
        return _settlement_agrees(settlement, genesis, None, 0), genesis

    ordered = sorted(bids, key = lambda bid: (int(bid['position']), int(bid['id'])))
    intact = [int(bid['position']) for bid in ordered] == list(range(1, len(ordered) + 1))
    previous = genesis

    for bid in ordered:
        stored_prev = bid['prev_hash'] if isinstance(bid['prev_hash'], str) else ''
        stored_hash = bid['hash'] if isinstance(bid['hash'], str) else ''

        if not same_digest(stored_prev, previous):
            intact = False

        expected = sign(bid_message(
            lot_id,
            int(bid['position']),
            int(bid['bidder_id']),
            int(bid['amount_cents']),
            bid['created_at'],
            stored_prev,
        ))

        if not same_digest(stored_hash, expected):
            intact = False

        previous = stored_hash

    last = ordered[-1]
    head = last['hash'] if isinstance(last['hash'], str) else ''

    if not _settlement_agrees(settlement, head, _winner(last['bidder_id']), int(last['amount_cents'])):
        intact = False

    return intact, head
