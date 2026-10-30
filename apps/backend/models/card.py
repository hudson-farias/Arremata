from pydantic import BaseModel


class CardImages(BaseModel):
    small: str | None = None
    large: str | None = None


class CardSummary(BaseModel):
    id: str | None = None
    name: str | None = None
    edition: str | None = None
    rarity: str | None = None
    number: str | None = None
    images: CardImages
