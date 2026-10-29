from fastapi import APIRouter, HTTPException
from sqlalchemy.exc import IntegrityError

from database.users import UsersORM
from models.user import Credentials, UserOut
from utils.password import hash_password, verify_password


router = APIRouter()


@router.post('/register', status_code = 201, response_model = UserOut)
async def register(body: Credentials):
    users = UsersORM()

    if await users.find_one(email = body.email):
        raise HTTPException(status_code = 409, detail = 'email já existe')

    try:
        await users.create(email = body.email, password = hash_password(body.password))
    except IntegrityError:
        raise HTTPException(status_code = 409, detail = 'email já existe')

    created = await users.find_one(email = body.email)
    return {'id': created.id, 'email': created.email}


@router.post('/login', response_model = UserOut)
async def login(body: Credentials):
    user = await UsersORM().find_one(email = body.email)

    if not user or not verify_password(body.password, user.password):
        raise HTTPException(status_code = 401, detail = 'email ou senha inválidos')

    return {'id': user.id, 'email': user.email}
