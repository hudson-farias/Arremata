from pydantic import BaseModel, field_validator

from database.users import MAX_BALANCE_CENTS


def integer_amount(value) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError('valor inválido')

    return value


class WalletOut(BaseModel):
    total: int
    committed: int
    available: int


class DepositIn(BaseModel):
    amount: int

    @field_validator('amount', mode = 'before')
    @classmethod
    def positive_amount(cls, value) -> int:
        value = integer_amount(value)

        if value <= 0:
            raise ValueError('valor deve ser maior que zero')

        if value > MAX_BALANCE_CENTS:
            raise ValueError('valor inválido')

        return value
