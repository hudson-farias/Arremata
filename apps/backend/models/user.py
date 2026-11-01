from pydantic import BaseModel, field_validator


class Credentials(BaseModel):
    email: str
    password: str

    @field_validator('email')
    @classmethod
    def email_required(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError('campo obrigatório')
        return cleaned

    @field_validator('password')
    @classmethod
    def password_required(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError('campo obrigatório')
        return value


class UserOut(BaseModel):
    id: int
    email: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = 'bearer'


class PasswordChange(BaseModel):
    current_password: str
    password: str

    @field_validator('current_password', 'password')
    @classmethod
    def password_required(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError('campo obrigatório')
        return value
