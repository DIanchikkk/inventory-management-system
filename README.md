# Inventory Management System

Веб-система учёта объектов и проведения инвентаризации. MVP для выпускной квалификационной работы (направление «Программная инженерия»).

## Стек технологий

- **Frontend:** React + TypeScript + Vite
- **Backend:** Go (Golang) + Gin
- **База данных:** PostgreSQL
- **ORM:** GORM
- **API:** REST + JWT

## Возможности

- Аутентификация (логин/пароль, JWT)
- CRUD объектов (название, описание, количество, дата покупки)
- Поиск и фильтрация объектов
- Инвентаризационные сессии (проверка фактического наличия)
- QR-коды для быстрого доступа к объектам
- Адаптивный интерфейс (desktop + mobile)

## Запуск проекта

### Требования

- Go 1.21+
- Node.js 18+
- PostgreSQL 14+

### 1. База данных

```bash
createdb inventory_db
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Отредактируйте .env (DATABASE_URL, JWT_SECRET, при необходимости JWT_EXPIRE_HOURS, GIN_MODE=release)
go run main.go
```

Тесты (из корня репозитория, где `go.mod`):

```bash
go test ./...
```

Backend запустится на `http://localhost:8080`. Для production задайте `GIN_MODE=release`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend запустится на `http://localhost:5173`.

### Тестовые учётные записи (seed)

После первого запуска backend создаёт:
- **admin** / **admin123** — администратор
- **user** / **user123** — обычный пользователь

## Структура проекта

```
inventory-system/
├── backend/          # Go API
│   ├── main.go
│   ├── config/
│   ├── models/
│   ├── handlers/
│   ├── middleware/
│   └── seed/
├── frontend/         # React SPA
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── api/
│   │   └── ...
│   └── ...
└── README.md
```

## API Endpoints

Защищённые маршруты (`/items`, `/inventory`, `/auth/me`) требуют заголовок:  
`Authorization: Bearer <JWT>` (токен из `POST /auth/login`).

### Auth
- `POST /auth/login` — вход, тело `{ "username", "password" }`, ответ `{ "token", "user" }`
- `GET /auth/me` — текущий пользователь по JWT

### Items
- `GET /items` — список (с поиском `?q=`)
- `GET /items/:id` — один объект
- `POST /items` — создать
- `PUT /items/:id` — обновить
- `DELETE /items/:id` — удалить

### Inventory
- `POST /inventory/sessions` — начать сессию
- `GET /inventory/sessions` — список сессий
- `GET /inventory/sessions/:id` — сессия + items + results
- `POST /inventory/sessions/:id/results` — записать один результат
- `POST /inventory/sessions/:id/results/batch` — записать пакет результатов
- `POST /inventory/sessions/:id/complete` — завершить сессию

### Пример с токеном

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r .token)

curl -s http://localhost:8080/items -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:8080/auth/me -H "Authorization: Bearer $TOKEN"
```
