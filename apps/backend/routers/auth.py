from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.exc import IntegrityError

from database.users import UsersORM
from models.user import AuthResponse, Credentials, UserOut
from routers import has_authenticated


router = APIRouter()


@router.post('/register', status_code = 201, response_model = UserOut)
async def register(body: Credentials):
    users = UsersORM()

    if await users.find_one(email = body.email):
        raise HTTPException(status_code = 409, detail = 'email já existe')

    try:
        await users.create(email = body.email, password = users.hash_password(body.password))
    except IntegrityError:
        raise HTTPException(status_code = 409, detail = 'email já existe')

    created = await users.find_one(email = body.email)
    return {'id': created.id, 'email': created.email}


@router.post('/login', status_code = 201, response_model = AuthResponse)
async def login(body: Credentials, response: Response):
    user = await UsersORM().find_one(email = body.email)

    if not user or not user.verify_password(body.password):
        raise HTTPException(status_code = 401, detail = 'email ou senha inválidos')

    access_token = user.issue_token()
    response.set_cookie(
        key = 'TOKEN',
        value = access_token,
        max_age = user.TOKEN_TTL,
        path = '/',
        samesite = 'lax',
    )

    return {'access_token': access_token, 'token_type': 'bearer'}


@router.get('/me', status_code = 204)
async def me(_: str = Depends(has_authenticated)):
    return
