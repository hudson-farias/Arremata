from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, field_validator

from models.lot import integer_cents


class WonLot(BaseModel):
    id: int
    title: str
    image_url: str
    set_name: str | None = None
    rarity: str | None = None
    number: str | None = None
    amount: int
    settled_at: datetime
    winner: int

    @field_validator('amount', mode = 'before')
    @classmethod
    def amount_cents(cls, value) -> int:
        return integer_cents(value)

    @field_validator('winner', mode = 'before')
    @classmethod
    def winner_id(cls, value) -> int:
        if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
            raise ValueError('vencedor inválido')

        return value

    @field_validator('settled_at')
    @classmethod
    def utc(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
            return value.replace(tzinfo = timezone.utc)

        return value


class BidLot(BaseModel):
    id: int
    title: str
    image_url: str
    set_name: str | None = None
    rarity: str | None = None
    number: str | None = None
    status: Literal['live', 'scheduled', 'closed']
    position: Literal['winning', 'outbid', 'lost']
    current_bid: int | None = None
    user_bid: int
    ends_at: datetime
    bid_count: int

    @field_validator('current_bid', mode = 'before')
    @classmethod
    def current_cents(cls, value) -> int | None:
        if value is None:
            return None

        return integer_cents(value)

    @field_validator('user_bid', mode = 'before')
    @classmethod
    def user_cents(cls, value) -> int:
        return integer_cents(value)

    @field_validator('ends_at')
    @classmethod
    def utc(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
            return value.replace(tzinfo = timezone.utc)

        return value


class WinsOut(BaseModel):
    won: list[WonLot]
    bids: list[BidLot]
