# Материалы для пояснительной записки

## 1. Как запустить систему

### Локально (разработка)

1. PostgreSQL, создать БД `inventory_db`.
2. `cd backend && cp .env.example .env` — заполнить `DATABASE_URL`, `JWT_SECRET`.
3. `go run ./backend` из корня репозитория (где `go.mod`) или `cd backend && go run .`
4. Фронт: `cd frontend && npm install && npm run dev`.

### Docker Compose (одна команда для проверяющего)

```bash
docker compose up --build
```

API: `http://localhost:8080`, health: `GET /health` (проверка БД: поле `database`).

## 2. Схема REST API (кратко)

| Метод | Путь | Назначение |
|--------|------|------------|
| POST | `/auth/login` | Вход, JWT |
| GET | `/auth/me` | Текущий пользователь (Bearer) |
| GET | `/items` | Список, `?q=` поиск |
| GET | `/items/export` | **CSV экспорт** учётных объектов |
| CRUD | `/items`, `/items/:id` | Объекты |
| — | `/inventory/sessions` … | Сессии инвентаризации и результаты |

Полный список — в корневом `README.md`.

## 3. Отличительные возможности (уровень выше «простого CRUD»)

- **JWT + роли** (admin / user): изменение учётных объектов и экспорт CSV только у **admin**; **user** читает справочник и ведёт свои сессии инвентаризации; **admin** видит все сессии.
- **CORS** для SPA (Vite) и переменная `CORS_ORIGINS`.
- **Health** с проверкой доступности PostgreSQL (`/health`).
- **Экспорт CSV** по учётным объектам (`GET /items/export`) — для отчётности.
- **Инвентаризация**: сессии, сверка факт/учёт, статусы match/mismatch/missing, batch в транзакции.
- **Фронт**: единый разбор ошибок API, **QR-код** на карточке объекта (быстрый доступ / демонстрация).
- **Docker Compose** + **CI** (`go test` в GitHub Actions).
- **Тесты** на конфиг, middleware, бизнес-правила статусов.

## 4. Скриншоты для записки

Вставьте в документ Word/LaTeX свои PNG (вход, список объектов, карточка с QR, при желании ответ `/health`). Подписи: «Рис. N — …».
