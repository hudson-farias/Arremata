from fastapi import APIRouter, HTTPException

from models.card import CardSummary
from services.cards import Cards


router = APIRouter(tags = ['cards'])


@router.get('/cards', response_model = list[CardSummary])
async def search_cards(q: str):
    query = q.strip()

    if not query:
        raise HTTPException(status_code = 400, detail = 'campo obrigatório')

    try:
        return await Cards().search_cards(query)
    except RuntimeError:
        raise HTTPException(status_code = 502, detail = 'falha ao consultar o catálogo')
