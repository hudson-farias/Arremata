from os import environ

environ['TOKEN_SECRET'] = 'test-token-secret'
environ['AUDIT_SECRET'] = 'dev-audit-secret-separado-do-token'
environ.setdefault('POSTGRES_HOST', '127.0.0.1')
environ.setdefault('POSTGRES_USER', 'postgres')
environ.setdefault('POSTGRES_PASSWORD', 'postgres')
environ.setdefault('POSTGRES_DB', 'arremata')
environ.setdefault('POSTGRES_PORT', '5432')
environ.setdefault('REDIS_URL', 'redis://127.0.0.1:6379/0')


import pytest

import env


@pytest.fixture(autouse = True)
def segredo_de_auditoria():
    anterior = env.AUDIT_SECRET
    env.AUDIT_SECRET = 'dev-audit-secret-separado-do-token'
    yield
    env.AUDIT_SECRET = anterior
