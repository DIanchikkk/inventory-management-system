# Фронтенд Inventory

React + TypeScript + Vite. URL API задаётся в `.env`: `VITE_API_URL` (см. `.env.example`).

Полный запуск проекта — в [корневом README](../README.md).

## Тестовый вход

Это **настоящие** учётные записи в PostgreSQL: сид создаёт их при первом старте API (пустая таблица `users`). Запрос логина идёт на бэкенд, JWT выдаётся как в проде.

| Логин | Пароль |
|-------|--------|
| `admin` | `admin123` |
| `user` | `user123` |

Если не пускает: API и БД запущены? В `frontend/.env` верный `VITE_API_URL`? Если база уже была с другими данными — во `backend/.env` временно добавь `INVENTORY_FORCE_SEED=1`, перезапусти API (пароли admin/user сбросятся на те, что в таблице выше), потом убери переменную.

**Длинное сообщение про «Сервер API недоступен» / Network Error** — у Axios нет тела ответа: либо TCP до бэкенда не открылся, либо браузер **отбросил ответ из‑за CORS** (тогда в консоли DevTools → Network запрос к `:8080` будет красным или «blocked»). Проверь: `curl http://localhost:8080/health`; `frontend/.env` с `VITE_API_URL=http://localhost:8080` и перезапуск `npm run dev`. Если в адресной строке не `localhost`, а IP телефона/другой машины — добавь этот origin в `CORS_ORIGINS` на бэкенде. Если Vite пишет, что порт `5173` занят и открылся на `5174` — в свежей версии бэкенда это уже учтено в дефолтном CORS; при своём `CORS_ORIGINS` перечисли и этот origin.

## Скрипты

- `npm run dev` — разработка  
- `npm run build` — сборка  
- `npm run lint` — ESLint  
