from sqlalchemy import Column, Integer, String

from database import Base


class UsersORM(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key = True, index = True)
    email = Column(String(255), nullable = False, unique = True)
    password = Column(String(255), nullable = False)
