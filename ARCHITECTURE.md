# Архитектура

Monorepo. Модуль Go в корне (`inventory-system`), импорты вида `inventory-system/backend/...`.

```
inventory-system/
├── backend/           # HTTP API
│   ├── handlers/      # auth, items, inventory, categories, dashboard
│   ├── handlers/      # плоский пакет handlers (params.go — ParseUUIDParam)
├── frontend/          # SPA
├── docs/
├── frontend/src/assets/uploads/  # демо-фото объектов (в образе и/или volume)
├── Dockerfile
├── compose.yaml
├── go.mod
└── .github/workflows/ci.yml
```

## Backend

| Каталог | Содержание |
|---------|------------|
| `main.go` | Подключение БД, миграции, seed, `setupRouter` |
| `routes.go` | Маршруты Gin |
| `config/` | Переменные окружения |
| `database/` | `gorm.Open` |
| `models/` | User, Item, Category, InventorySession, InventoryResult, InventoryStockLedger, StockAdjustmentDocument, … |
| `handlers/auth`, `items`, `inventory`, … | REST по доменам |
| `handlers/params.go` | `ParseUUIDParam` — UUID из path Gin |
| `middleware/` | CORS, JWT (`AuthRequired`), `RequireAdmin`, rate limit |
| `seed/` | Пользователи, демо-данные |
| `docno/` | Нумерация документов (INV, СП, ОП) |

Цепочка запроса: CORS → JWT → (опционально) `RequireAdmin` → handler → GORM → PostgreSQL.

Группы маршрутов (`routes.go`):

- без токена — login, health, статика `/uploads`;
- `protected` — чтение и инвентаризация;
- `admin` — изменение справочников и объектов учёта.

Проведение инвентаризации (`CompleteSession`): остаток `Item.quantity` = факт; при расхождении — записи в `inventory_stock_ledgers` и документы `stock_adjustment_documents` (СП/ОП).

## Frontend

| Каталог | Содержание |
|---------|------------|
| `src/app/` | `App.tsx`, маршруты (`ProtectedRoute`) |
| `src/layouts/` | `DashboardLayout` — оболочка с навигацией |
| `src/features/` | По доменам: `auth`, `items`, `inventory`, `reports`, `settings` (страницы + локальные компоненты) |
| `src/shared/` | `api/`, `components/ui/`, `context/`, `hooks/`, `types/`, `utils/`, `styles/` |
| `src/assets/` | Статика и `uploads/item-images/` (демо-фото) |

Импорты: алиас `@/` → `src/` (см. `vite.config.ts`, `tsconfig.app.json`).

Маршруты без токена перенаправляются на `/login` (`ProtectedRoute`). Токен в `localStorage`, в запросах — `Authorization: Bearer`.

QR: этикетки и карточка объекта кодируют `/items/{id}`; учёт факта — в UI сессии инвентаризации. `/inventory/item/:id` — редирект для старых этикеток.

Сборка: `npm run dev`, `npm run build`.

## Развёртывание

- `Dockerfile` — бинарник `./backend`, демо-фото из `frontend/src/assets/uploads` → `/app/uploads`.
- `compose.yaml` — Postgres + API.
- `compose.override.yaml` — монтирование `frontend/src/assets/uploads` (локальная разработка, не обязателен).

## Связь компонентов

```
[Браузер] —HTTP/JSON—> [Gin :8080] —SQL—> [PostgreSQL]
              JWT              GORM
```

В разработке фронт на `:5174`, API на `:8080`; origin фронта задаётся в `CORS_ORIGINS`.
