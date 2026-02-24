"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings backed by env vars and .env file."""

    database_url: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5432/candidates"
    )
    external_api_key: str = ""
    frontend_url: str = "http://localhost:3000"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
