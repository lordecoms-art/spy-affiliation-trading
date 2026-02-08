from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/spy_trading"
    TELEGRAM_API_ID: int = 32794038
    TELEGRAM_API_HASH: str = "a6e36c2271ead721fcbb6e6a1b2ead09"
    TELEGRAM_SESSION_NAME: str = "spy_session"
    TELEGRAM_SESSION_DATA: str = ""
    ANTHROPIC_API_KEY: str = ""
    SCRAPE_INTERVAL_MINUTES: int = 30
    MAX_MESSAGES_PER_SCRAPE: int = 100
    STATS_SNAPSHOT_HOUR: int = 23
    STATS_SNAPSHOT_MINUTE: int = 1
    FRONTEND_URL: str = "http://localhost:5173"

    class Config:
        env_file = ".env"


settings = Settings()
