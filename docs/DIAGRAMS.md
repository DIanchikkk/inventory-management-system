# Диаграммы для ВКР

Ниже собраны диаграммы в формате Mermaid для вставки в пояснительную записку.

## Архитектурная диаграмма (клиент-сервер)

```mermaid
flowchart TB

%% Стили
classDef frontend fill:#F5F0C9,stroke:#999,stroke-width:2px;
classDef backend fill:#F5F0C9,stroke:#333,stroke-width:2px;
classDef db fill:#DCD6F7,stroke:#333,stroke-width:2px;
classDef inner fill:#E6E6FA,stroke:#8A79AF,stroke-width:2px;

%% FRONTEND
subgraph FE["Frontend"]
    FE_APP["Frontend: React + TypeScript + Vite"]
    class FE_APP inner
end
class FE frontend

%% BACKEND
subgraph BE["Backend"]
    BE_APP["Backend: Go + Gin"]
    class BE_APP inner
end
class BE backend

%% DATABASE
subgraph DB["Database"]
    DB_APP["Database: PostgreSQL"]
    class DB_APP inner
end
class DB db

%% Связи
FE_APP -->|HTTP| BE_APP
FE_APP -->|JWT| BE_APP
FE_APP -->|REST API Endpoints| BE_APP

BE_APP -->|SQL Queries через ORM GORM| DB_APP
```

## Диаграмма вариантов использования (для п. 1.1)

```mermaid
flowchart LR
    Admin([Администратор])
    User([Инвентаризатор])

    Login((Войти в систему))
    ViewItems((Просматривать каталог))
    Search((Искать/фильтровать объекты))
    CreateItem((Создавать объект учета))
    EditItem((Редактировать объект учета))
    DeleteItem((Удалять объект учета))
    ExportCsv((Экспортировать каталог в CSV))
    StartSession((Создать инвентаризационную сессию))
    EnterFacts((Внести фактические значения))
    BatchSave((Пакетно сохранить результаты))
    CompleteSession((Завершить сессию))
    ViewReports((Просмотреть отчеты по сессиям))
    QrAccess((Открыть объект по QR))

    Admin --> Login
    Admin --> ViewItems
    Admin --> Search
    Admin --> CreateItem
    Admin --> EditItem
    Admin --> DeleteItem
    Admin --> ExportCsv
    Admin --> StartSession
    Admin --> EnterFacts
    Admin --> BatchSave
    Admin --> CompleteSession
    Admin --> ViewReports
    Admin --> QrAccess

    User --> Login
    User --> ViewItems
    User --> Search
    User --> StartSession
    User --> EnterFacts
    User --> BatchSave
    User --> CompleteSession
    User --> ViewReports
    User --> QrAccess
```

## Примечание

- Этот файл можно расширять: добавлять ER-диаграмму, диаграмму компонентов и другие схемы.
- Следующую диаграмму пришли в таком же формате, и я сразу добавлю ее сюда отдельным разделом.
