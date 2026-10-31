from datetime import datetime, timezone


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def aware(value: datetime) -> datetime:
    if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
        return value.replace(tzinfo = timezone.utc)

    return value


def status_of(lot, moment: datetime | None = None) -> str:
    if lot.cancelled_at is not None:
        return 'cancelled'

    moment = aware(moment or now_utc())
    starts_at = aware(lot.starts_at)
    ends_at = aware(lot.ends_at)

    if moment < starts_at:
        return 'scheduled'

    if moment < ends_at:
        return 'live'

    return 'closed'


def bid_count(_lot) -> int:
    return 0


def current_bid(_lot) -> int | None:
    return None


def result_of(status: str, bids: int):
    if status == 'closed' and bids == 0:
        return {'winner': None}

    return None


def attributes_of(lot) -> dict:
    raw = lot.attributes or {}

    if isinstance(raw, str):
        from json import loads
        raw = loads(raw)

    number = raw.get('number')

    return {
        'set_name': raw.get('set_name'),
        'rarity': raw.get('rarity'),
        'number': None if number is None else str(number),
    }


def auctioneer_lot(lot, moment: datetime | None = None) -> dict:
    moment = aware(moment or now_utc())
    status = status_of(lot, moment)
    bids = bid_count(lot)
    attributes = attributes_of(lot)

    return {
        'id': lot.id,
        'owner_id': lot.owner_id,
        'card_id': lot.card_id,
        'title': lot.title,
        'image_url': lot.image_url,
        'attributes': attributes,
        'starts_at': aware(lot.starts_at),
        'ends_at': aware(lot.ends_at),
        'minimum_bid': lot.minimum_bid,
        'cancelled_at': None if lot.cancelled_at is None else aware(lot.cancelled_at),
        'status': status,
        'bid_count': bids,
        'result': result_of(status, bids),
    }


def public_lot(lot, moment: datetime | None = None) -> dict:
    moment = aware(moment or now_utc())
    status = status_of(lot, moment)
    bids = bid_count(lot)
    attributes = attributes_of(lot)

    return {
        'id': lot.id,
        'title': lot.title,
        'image_url': lot.image_url,
        'minimum_bid': lot.minimum_bid,
        'current_bid': current_bid(lot),
        'starts_at': aware(lot.starts_at),
        'ends_at': aware(lot.ends_at),
        'status': status,
        'bid_count': bids,
        'attributes': attributes,
        'set_name': attributes.get('set_name'),
        'rarity': attributes.get('rarity'),
        'number': attributes.get('number'),
        'result': result_of(status, bids),
    }
