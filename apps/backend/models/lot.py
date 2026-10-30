from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from pydantic import BaseModel, field_validator, model_validator


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
    minimum_bid: Decimal

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

    @field_validator('minimum_bid')
    @classmethod
    def positive_bid(cls, value: Decimal) -> Decimal:
        if value <= 0:
            raise ValueError('lance deve ser maior que zero')

        quantized = value.quantize(Decimal('0.01'), rounding = ROUND_HALF_UP)
        if quantized > Decimal('9999999999.99'):
            raise ValueError('lance inválido')

        return quantized

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
    minimum_bid: Decimal
    cancelled_at: datetime | None
    status: str
    bid_count: int
    result: LotResult | None


class PublicLot(BaseModel):
    id: int
    title: str
    image_url: str
    minimum_bid: Decimal
    current_bid: Decimal | None = None
    starts_at: datetime
    ends_at: datetime
    status: str
    bid_count: int
    attributes: CardAttributes
    set_name: str | None = None
    rarity: str | None = None
    number: str | None = None
    result: LotResult | None = None
