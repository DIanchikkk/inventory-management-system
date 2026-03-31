# Архитектура проекта

## Структура backend

```
backend/
├── config/          # config.go — загрузка .env, Config struct
├── models/          # User, Item, InventorySession, InventoryResult
├── handlers/        # auth, items, inventory
├── middleware/      # JWT
├── seed/            # начальные пользователи
├── database/        # database.Connect(dsn) — PostgreSQL через GORM
├── main.go
└── .env.example
```

## Порядок реализации (backend)

1. **config** — Load(), Config, getEnv
2. **models** — User (с bcrypt), Item, InventorySession, InventoryResult
3. **database** — миграции в main.go
4. **seed** — admin, user
5. **middleware** — JWT AuthRequired
6. **handlers/auth** — POST /auth/login, GET /auth/me
7. **handlers/items** — CRUD
8. **handlers/inventory** — sessions + results
9. **main.go** — роуты, подключение всего

## Frontend (позже)

```
frontend/
├── src/
│   ├── pages/       # Login, Dashboard, Inventory, ItemDetails
│   ├── components/
│   ├── api/         # HTTP клиент, interceptors для JWT
│   └── ...
```
