# Inventory Management System

Веб-система учёта объектов и проведения инвентаризации. MVP для выпускной квалификационной работы (направление «Программная инженерия»).

## Стек технологий

- **Frontend:** React + TypeScript + Vite
- **Backend:** Go + Gin
- **База данных:** PostgreSQL
- **ORM:** GORM
- **API:** REST + JWT, CORS для SPA

## Возможности

- Аутентификация (логин/пароль, JWT), роли **admin** / **user** с разграничением на API
- CRUD объектов учёта (изменение и CSV — только **admin**), поиск `?q=` — любой авторизованный пользователь
- Инвентаризационные сессии и сверка факт/учёт (REST API)
- **QR-код** на карточке объекта во фронтенде (ссылка на страницу объекта)
- Тёмная тема и адаптивная вёрстка (базово)
- **Health** с проверкой PostgreSQL (`GET /health`)
- Docker Compose (Postgres + API), CI (GitHub Actions, `go test`)

Материалы для пояснительной записки: [docs/FOR_THESIS.md](docs/FOR_THESIS.md).

## Запуск проекта

### Требования

- Go 1.23+
- Node.js 18+
- PostgreSQL 14+ (если не используете Docker)

### Вариант A: Docker Compose (всё в одном)

Из корня репозитория:

```bash
docker compose up --build
```

API: `http://localhost:8080`, проверка: `curl -s http://localhost:8080/health`.

Переменные в `compose.yaml` можно подправить (в т.ч. `JWT_SECRET` для реального стенда).

### Вариант B: локально

**1. База данных**

```bash
createdb inventory_db
```

**2. Backend** (из корня, где `go.mod`):

```bash
cd backend && cp .env.example .env
# Заполните DATABASE_URL, JWT_SECRET; при фронте на Vite задайте CORS_ORIGINS при необходимости
cd .. && go run ./backend
```

Тесты (только пакеты API; не использовать `./...` из корня — в `node_modules` фронта бывают сторонние `go.mod`):

```bash
go test ./backend/...
```

**3. Frontend**

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Откройте `http://localhost:5173`. API по умолчанию: `http://localhost:8080` (см. `frontend/.env`).

### Тестовые учётные записи (seed)

- **admin** / **admin123**
- **user** / **user123**
- При старте backend автоматически добавляются демо-данные для проверки интерфейса:
  5 объектов учёта + 3 инвентаризационные сессии с разными статусами и строками результатов.
- Для очистки старых данных перед автозаполнением используйте `INVENTORY_RESET_DATA=1`.

## CI

При push в `main` / `master` запускается [GitHub Actions](.github/workflows/ci.yml): `go test ./backend/...`.

## API (кратко)

Защищённые маршруты требуют `Authorization: Bearer <JWT>`.

### Роли

| Действие | admin | user |
|----------|-------|------|
| `GET /items`, `GET /items/:id` | да | да |
| `POST/PUT/DELETE /items`, `GET /items/export` | да | **403** |
| Инвентаризация (сессии, результаты, complete) | да; видит **все** сессии | да; только **свои** сессии |

| Раздел | Эндпоинты |
|--------|-----------|
| Auth | `POST /auth/login`, `GET /auth/me` |
| Items | `GET /items`, `GET /items/:id` (все с JWT); **`POST/PUT/DELETE /items`**, **`GET /items/export`** (только admin) |
| Inventory | `POST/GET /inventory/sessions`, `GET .../sessions/:id`, результаты, `complete` |
| Сервис | **`GET /health`** — `{ "status", "database" }` |

Полный список и примеры `curl` — ниже.

### Пример с токеном

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r .token)

curl -s http://localhost:8080/items -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:8080/auth/me -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:8080/health
```

## Структура репозитория

Monorepo: модуль Go в корне (`go.mod`), фронт отдельно, инфраструктура в корне. Папка **`.github/workflows/`** — стандарт GitHub для CI; переносить в `backend/` нельзя (Actions ищет только там). Подробно: [ARCHITECTURE.md](ARCHITECTURE.md).

```
inventory-system/
├── .github/workflows/   # CI (go test) — не код приложения
├── backend/             # Go API
├── frontend/            # React + Vite
├── docs/                # заметки для записки
├── compose.yaml
├── Dockerfile
├── go.mod
└── ARCHITECTURE.md      # схема и обоснование структуры
```

Инвентаризация на фронте можно расширить отдельными страницами; **REST для сессий уже есть** в backend.
