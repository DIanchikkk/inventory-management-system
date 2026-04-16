# Архитектура репозитория

Проект оформлен как **monorepo**: один Git-репозиторий, в нём **несколько частей** с разной ролью. Так удобно вести диплом: один clone, общий CI, один Docker Compose.

---

## Почему не «всё внутри `backend/`»

| Что | Где лежит | Причина |
|-----|-----------|---------|
| Модуль Go (`go.mod`) | **корень** | Стандарт Go: `import inventory-system/backend/...`; команда `go run ./backend` из корня. |
| Фронт | **`frontend/`** | Отдельный стек (Node, Vite), свои `package.json` и сборка. |
| Docker / Compose | **корень** | Один файл собирает API и поднимает Postgres рядом — не привязан только к папке `backend`. |
| **CI GitHub** | **`.github/workflows/`** | Требование платформы GitHub: workflow-файлы **должны** лежать именно в `.github/workflows/`. Перенести в `backend/` нельзя — Actions их не найдёт. |

Папка **`.github`** — не «лишняя», а **официальное место** для автоматизации GitHub (Actions, шаблоны PR, иногда CODEOWNERS). Это не дублирует код приложения.

---

## Схема верхнего уровня

```
inventory-system/          ← корень Git-репозитория
├── .github/
│   └── workflows/
│       └── ci.yml         ← CI: go test (только для GitHub)
├── backend/               ← Go API (Gin, GORM, JWT)
├── frontend/              ← React + Vite + TypeScript
├── docs/                  ← текст для пояснительной записки
├── Dockerfile             ← образ API
├── docker-compose.yml     ← Postgres + API
├── go.mod / go.sum        ← модуль Go (корень)
├── README.md
└── ARCHITECTURE.md        ← этот файл
```

---

## Backend (`backend/`)

| Путь | Назначение |
|------|------------|
| `main.go` | Точка входа: CORS, `/health` (в т.ч. ping БД), регистрация маршрутов. |
| `config/` | Загрузка `.env`, `DATABASE_URL`, JWT, CORS origins. |
| `database/` | `Connect(dsn)` — единая точка `gorm.Open`. |
| `models/` | Сущности GORM: User, Item, InventorySession, InventoryResult. |
| `handlers/` | HTTP: auth, items (CRUD + CSV export), inventory. |
| `middleware/` | JWT (`AuthRequired`), CORS, `RequireAdmin` (группа маршрутов для admin). |
| `seed/` | Начальные пользователи admin/user. |

Поток запроса: **HTTP → CORS → JWT → (для части маршрутов) RequireAdmin → handler → GORM → PostgreSQL.** Регистрация маршрутов в `backend/routes.go` (`setupRouter`).

---

## Frontend (`frontend/`)

| Путь | Назначение |
|------|------------|
| `src/api/` | Клиент к REST: auth, items (CRUD, CSV), инвентаризация. |
| `src/context/AuthContext.tsx` | Пользователь и роль (`admin` / `user`) после входа. |
| `src/components/layout/DashboardLayout.tsx` | Sidebar (Объекты, Инвентаризация) + контент. |
| `src/pages/` | Логин, список объектов (таблица / карточки), инвентаризация, карточка + QR. |
| `src/lib/errors.ts` | Тип `ApiError`, текст для UI. |

Сборка: `npm run dev` (разработка), `npm run build` (статика для nginx/хостинга).

---

## Инфраструктура и CI

- **Dockerfile** — многоэтапная сборка бинарника `./backend` в образ Alpine.
- **docker-compose.yml** — сервис `db` (Postgres) + `api` (образ из Dockerfile), healthcheck БД.
- **`.github/workflows/ci.yml`** — при push/PR: `go test ./backend/...` (без `./...`, чтобы не подхватывать пакеты из `frontend/node_modules`). Это **не часть приложения**, а проверка качества кода на серверах GitHub.

---

## Связь компонентов (логическая)

```
[Браузер] --HTTPS/JSON--> [Gin API] --SQL--> [PostgreSQL]
                ^                    ^
                |                    +-- seed (первый запуск)
[React SPA] ----CORS + JWT----------+
```

Фронт и бэк в разработке: разные порты (`5173` / `8080`); CORS в `middleware/cors.go` разрешает origin фронта.
