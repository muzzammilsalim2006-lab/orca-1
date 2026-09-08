import os

os.environ.setdefault("ORCA_DEMO_MODE", "true")
os.environ.setdefault("ORCA_RESTRICT_TO_INDIA", "true")

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture(scope="session")
def client():
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client