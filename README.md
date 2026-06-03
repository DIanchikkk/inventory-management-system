# inventory-system

Учёт объектов и документы инвентаризации. Monorepo: Go API, React SPA, PostgreSQL.

Стек: Go 1.23, Gin, GORM; React, TypeScript, Vite; JWT; Docker Compose.

Материалы к записке: [docs/FOR_THESIS.md](docs/FOR_THESIS.md). Структура кода: [ARCHITECTURE.md](ARCHITECTURE.md).

## Требования

Go 1.23+, Node.js 18+, PostgreSQL 14+ (или только Docker).

## Запуск

**Docker** (из корня):

```bash
docker compose up --build
```

API: `http://127.0.0.1:8080`, проверка: `curl -s http://127.0.0.1:8080/health`.

Фото с хоста в контейнер: `compose.override.yaml` (образец — `compose.override.yaml.example`).

**Локально**

```bash
# БД
createdb inventory_db

# API (каталог backend, там же go.mod)
cp backend/.env.example backend/.env   # DATABASE_URL, JWT_SECRET
go -C backend run .
# или: cd backend && go run .

# UI
cd frontend && cp .env.example .env && npm install && npm run dev
```

Фронт: `http://127.0.0.1:5174`. В `frontend/.env`: `VITE_API_URL=http://127.0.0.1:8080`.

Тесты API:

```bash
go -C backend test ./...
# или: cd backend && go test ./...
```

## Учётные записи (seed)

| Логин | Пароль | Роль |
|-------|--------|------|
| admin | admin123 | admin |
| user | user123 | user |

Сброс демо-данных: `INVENTORY_RESET_DATA=1` в `backend/.env` перед стартом API.

## API

Защищённые маршруты: заголовок `Authorization: Bearer <token>`.

- Публично: `POST /auth/login`, `GET /health`, `GET /uploads/...`
- С JWT: объекты (чтение), категории, инвентаризация, отчёты
- Только admin: `POST/PUT/DELETE /items`, импорт/экспорт CSV, категории (создание)

Пользователь `user` видит только свои сессии инвентаризации; `admin` — все.

## QR-коды

На карточке объекта и в печати этикеток (`Отчёты → QR-этикетки`) один QR ведёт на страницу объекта: `/items/{id}`. Фактический пересчёт выполняется в документе инвентаризации (поле сканирования/вставки UUID строки сессии). Старые этикетки с `/inventory/item/{id}` перенаправляются на ту же карточку.

## CI

`.github/workflows/ci.yml` — `go test` в `backend/` на push в `main` / `master`.
