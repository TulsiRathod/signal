"""Application configuration loaded from environment variables.

All settings have sensible defaults so the app runs out-of-the-box for the
assignment/demo. Override via environment variables or a .env file in
production (see .env.example).
"""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Auth ---
    secret_key: str = "dev-secret-change-me-in-production-please-0xCAFEBABE"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    # Mocked OTP: any phone "verifies" with this fixed code.
    mock_otp: str = "123456"

    # --- Database ---
    database_url: str = f"sqlite+aiosqlite:///{BASE_DIR / 'signal.db'}"

    # --- Uploads ---
    upload_dir: Path = BASE_DIR / "uploads"
    max_upload_mb: int = 10

    # --- CORS ---
    # Comma-separated list of allowed origins for the frontend.
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
settings.upload_dir.mkdir(parents=True, exist_ok=True)
