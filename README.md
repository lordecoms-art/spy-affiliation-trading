# Spy Affiliation Trading

Automated Telegram channel monitoring and affiliation trading intelligence platform. Scrapes affiliate marketing channels, analyzes messages with AI, and presents actionable insights through a real-time dashboard.

## Tech Stack

**Backend**
- Python 3.11, FastAPI, Uvicorn
- PostgreSQL 15, SQLAlchemy, Alembic
- Telethon (Telegram scraping)
- Anthropic Claude (AI analysis)
- APScheduler (scheduled tasks)

**Frontend**
- React 19, Vite 7
- Tailwind CSS 4
- Zustand (state management)
- Recharts (data visualization)
- React Router 7

**Infrastructure**
- Docker & Docker Compose
- Nginx (reverse proxy)
- Railway (cloud deployment)

## Quick Start

### Using Docker Compose (recommended)

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd spy-affiliation-trading
   ```

2. Copy environment variables:
   ```bash
   cp backend/.env.example backend/.env
   ```

3. Edit `backend/.env` and fill in your API keys.

4. Start all services:
   ```bash
   docker-compose up --build
   ```

5. Access the application:
   - Frontend: http://localhost
   - Backend API: http://localhost:8000
   - API docs: http://localhost:8000/docs

### Manual Setup

#### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your configuration
uvicorn app.main:app --reload --port 8000
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server runs at http://localhost:5173 and proxies API requests to the backend.

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/spy_trading` |
| `TELEGRAM_API_ID` | Telegram API application ID | - |
| `TELEGRAM_API_HASH` | Telegram API application hash | - |
| `TELEGRAM_SESSION_NAME` | Telethon session file name | `spy_session` |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | - |
| `SCRAPE_INTERVAL_MINUTES` | Minutes between scraping runs | `30` |
| `MAX_MESSAGES_PER_SCRAPE` | Max messages to fetch per channel per run | `100` |
| `STATS_SNAPSHOT_HOUR` | Hour (UTC) to take daily stats snapshot | `3` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:5173` |

## Project Structure

```
spy-affiliation-trading/
├── backend/
│   ├── app/
│   │   ├── models/          # SQLAlchemy models
│   │   ├── routers/         # FastAPI route handlers
│   │   ├── services/        # Business logic (Telegram, AI analyzer)
│   │   ├── utils/           # Shared utilities
│   │   ├── config.py        # Application configuration
│   │   └── database.py      # Database connection setup
│   ├── Dockerfile
│   ├── railway.json
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Page-level components
│   │   ├── stores/          # Zustand state stores
│   │   └── utils/           # Frontend utilities
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── railway.json
│   └── package.json
├── docker-compose.yml
├── railway.json
├── .gitignore
└── README.md
```

## Deployment

The project is configured for deployment on Railway with separate services for backend and frontend. Each service has its own `railway.json` configuration with Dockerfile-based builds.

To deploy:
1. Push the repository to GitHub.
2. Create a new project on Railway.
3. Add the repository and configure the required environment variables.
4. Railway will automatically detect and deploy the services using the provided Dockerfiles.
