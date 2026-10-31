from datetime import datetime, timezone

from pydantic import BaseModel, field_validator, model_validator


MAX_BID_CENTS = 999999999999


def integer_cents(value) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError('lance inválido')

    return value


class CardAttributes(BaseModel):
    set_name: str | None = None
    rarity: str | None = None
    number: str | None = None

    @field_validator('set_name', 'rarity', 'number', mode = 'before')
    @classmethod
    def as_text(cls, value):
        if value is None:
            return None

        if isinstance(value, str):
            text = value.strip()
            return text or None

        return str(value)


class LotCreate(BaseModel):
    card_id: str
    title: str
    image_url: str
    attributes: CardAttributes
    starts_at: datetime
    ends_at: datetime
    minimum_bid: int

    @field_validator('card_id', 'title', 'image_url')
    @classmethod
    def required_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError('campo obrigatório')
        return cleaned

    @field_validator('card_id')
    @classmethod
    def card_id_length(cls, value: str) -> str:
        if len(value) > 64:
            raise ValueError('card_id inválido')
        return value

    @field_validator('title')
    @classmethod
    def title_length(cls, value: str) -> str:
        if len(value) > 255:
            raise ValueError('título muito longo')
        return value

    @field_validator('image_url')
    @classmethod
    def image_url_length(cls, value: str) -> str:
        if len(value) > 2048:
            raise ValueError('imagem inválida')
        return value

    @field_validator('starts_at', 'ends_at')
    @classmethod
    def as_utc(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
            return value.replace(tzinfo = timezone.utc)
        return value

    @field_validator('minimum_bid', mode = 'before')
    @classmethod
    def positive_bid(cls, value) -> int:
        value = integer_cents(value)

        if value <= 0:
            raise ValueError('lance deve ser maior que zero')

        if value > MAX_BID_CENTS:
            raise ValueError('lance inválido')

        return value

    @model_validator(mode = 'after')
    def ends_after_start(self):
        if self.ends_at <= self.starts_at:
            raise ValueError('fim deve ser depois do início')
        return self


class LotResult(BaseModel):
    winner: int | None = None


class AuctioneerLot(BaseModel):
    id: int
    owner_id: int
    card_id: str
    title: str
    image_url: str
    attributes: CardAttributes
    starts_at: datetime
    ends_at: datetime
    minimum_bid: int
    cancelled_at: datetime | None
    status: str
    bid_count: int
    result: LotResult | None

    @field_validator('minimum_bid', mode = 'before')
    @classmethod
    def bid_cents(cls, value) -> int:
        return integer_cents(value)


class PublicLot(BaseModel):
    id: int
    title: str
    image_url: str
    minimum_bid: int
    current_bid: int | None = None
    starts_at: datetime
    ends_at: datetime
    status: str
    bid_count: int
    attributes: CardAttributes
    set_name: str | None = None
    rarity: str | None = None
    number: str | None = None
    result: LotResult | None = None

    @field_validator('minimum_bid', mode = 'before')
    @classmethod
    def bid_cents(cls, value) -> int:
        return integer_cents(value)

    @field_validator('current_bid', mode = 'before')
    @classmethod
    def current_cents(cls, value) -> int | None:
        if value is None:
            return None

        return integer_cents(value)
