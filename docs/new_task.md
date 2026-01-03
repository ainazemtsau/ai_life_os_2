ЭТАП 1.0: Инфраструктура (переделка с Temporal)
Цель этапа
Создать фундамент системы с Temporal как ядром для workflow, интегрировать PydanticAI агенты и Mem0. Заменить python-statemachine на production-ready решение.

Бизнес-контекст
Мы переделываем инфраструктуру потому что:

Temporal даёт durable execution — workflow выживает сбои
Signals и timers из коробки — не нужно писать свой event system
Proactive messages становятся естественной частью workflow
Long-running goals (месяцы) требуют надёжного хранения состояния
Один раз настроить правильно дешевле чем переделывать позже


Что сохраняем из текущей реализации
✓ PydanticAI агенты (Coordinator, Greeter, Discovery, Inbox Collector)
✓ Mem0 интеграция и конфигурация
✓ Pocketbase и структура таблиц (с адаптацией)
✓ FastAPI приложение
✓ WebSocket setup
✓ Redis
✓ Frontend база (React + assistant-ui)
✓ Docker compose структура
Что заменяем/удаляем
✗ python-statemachine — заменяем на Temporal
✗ WorkflowEngine класс — логика уходит в Temporal Workflows
✗ Текущая логика переходов между шагами
✗ Ручное управление состоянием workflow

Компонент 1: Temporal Server
1.1 Описание
Temporal Server — это отдельный сервис который управляет workflow. Он хранит состояние, обрабатывает таймеры, доставляет signals.
1.2 Требования к инфраструктуре
Docker setup:

Temporal Server (основной сервис)
Temporal UI (веб-интерфейс для отладки)
PostgreSQL для Temporal (отдельная БД, не Pocketbase)

Конфигурация:

Namespace для нашего приложения
Retention period для истории workflow (30 дней минимум)
Доступ из backend контейнера

Порты:

Temporal Server gRPC: 7233
Temporal UI: 8080 (или другой свободный)

1.3 Критерии готовности
□ Temporal Server запускается через docker-compose
□ Temporal UI доступен в браузере
□ Backend может подключиться к Temporal
□ Namespace создан и доступен

Компонент 2: Temporal Python SDK интеграция
2.1 Описание
Temporal Python SDK позволяет писать Workflows и Activities на Python. Workflow — это логика процесса, Activity — это выполнение конкретных действий.
2.2 Концепции которые используем
Workflow:

Определяет последовательность шагов
Может ждать Signals (внешние события)
Может спать (таймеры)
Детерминистичен — при replay даёт тот же результат
НЕ делает I/O напрямую (БД, API, LLM)

Activity:

Выполняет реальную работу (вызов LLM, запись в БД)
Может быть retry при ошибках
Не детерминистична — результат может отличаться

Signal:

Внешнее событие в workflow (например, user отправил сообщение)
Workflow может ждать signal
Можно передавать данные с signal

Query:

Получить текущее состояние workflow без изменения
Синхронный запрос

2.3 Архитектура интеграции
┌─────────────────────────────────────────────────────────────────┐
│                         ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐      ┌──────────────┐      ┌──────────────────┐  │
│  │ Frontend │ ───► │   FastAPI    │ ───► │ Temporal Client  │  │
│  │          │ ◄─── │  (Backend)   │ ◄─── │                  │  │
│  └──────────┘      └──────────────┘      └────────┬─────────┘  │
│       │                   │                        │            │
│       │                   │                        ▼            │
│       │                   │               ┌──────────────────┐  │
│       │                   │               │ Temporal Server  │  │
│       │                   │               └────────┬─────────┘  │
│       │                   │                        │            │
│       │                   │                        ▼            │
│       │                   │               ┌──────────────────┐  │
│       │                   │               │ Temporal Worker  │  │
│       │                   │               │                  │  │
│       │                   │               │  ┌────────────┐  │  │
│       │                   │               │  │ Workflows  │  │  │
│       │                   │               │  └────────────┘  │  │
│       │                   │               │  ┌────────────┐  │  │
│       │                   │               │  │ Activities │  │  │
│       │                   │               │  │            │  │  │
│       │                   │               │  │ • LLM Call │  │  │
│       │                   │               │  │ • DB Write │  │  │
│       │                   │               │  │ • Mem0     │  │  │
│       │                   │               │  └────────────┘  │  │
│       │                   │               └──────────────────┘  │
│       │                   │                                     │
│       │                   ▼                                     │
│       │            ┌──────────────┐                             │
│       │            │  Pocketbase  │                             │
│       │            │    (Data)    │                             │
│       │            └──────────────┘                             │
│       │                                                         │
│       └─────────────── WebSocket ───────────────────────────────│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
2.4 Требования к Worker
Worker Process:

Отдельный процесс (или часть backend)
Регистрирует Workflows и Activities
Подключается к Temporal Server
Обрабатывает задачи из очереди

Task Queue:

Одна очередь для всех workflow нашего приложения
Имя: "productivity-app-queue" (или подобное)

2.5 Критерии готовности
□ Temporal SDK установлен
□ Worker запускается и подключается к серверу
□ Тестовый workflow можно запустить и он выполняется
□ Signal доставляется в workflow
□ Query возвращает состояние

Компонент 3: PydanticAI агенты как Activities
3.1 Описание
Агенты (Coordinator, Greeter, Discovery, Inbox Collector) становятся Activities. Workflow вызывает нужного агента через Activity.
3.2 Почему агенты = Activities

Activity может делать I/O (вызов LLM)
Activity имеет retry logic
Activity изолирована — ошибка не ломает весь workflow
Workflow остаётся детерминистичным

3.3 Структура Agent Activity
Input:

agent_type: какого агента вызвать ("greeter", "discovery", etc.)
user_message: сообщение от пользователя (может быть null для proactive)
context: контекст для агента

user_id
workflow_context (данные собранные ранее)
conversation_history (последние N сообщений)
user_memory (из Mem0)
trigger_type: "user_message" | "proactive_initiation"



Output:

message: текст ответа для пользователя
workflow_signals: сигналы для workflow

step_completed: bool
completion_data: данные для сохранения
next_step_override: переход на конкретный шаг (опционально)


memory_updates: что добавить в Mem0
widget_request: запрос на показ виджета (опционально)

3.4 Адаптация существующих агентов
Текущие агенты на PydanticAI сохраняются, но:

Обёртка для вызова из Activity
Единый формат input/output
Обработка ошибок для retry

3.5 Критерии готовности
□ Все 4 агента доступны как Activities
□ Activity корректно вызывает PydanticAI агента
□ Ответ агента преобразуется в стандартный output
□ Ошибки LLM вызывают retry
□ Context правильно передаётся агенту

Компонент 4: Mem0 интеграция
4.1 Описание
Mem0 остаётся для хранения user memory. Интеграция адаптируется для работы с Temporal.
4.2 Где вызывается Mem0
Чтение памяти:

Перед вызовом агента — получить релевантные факты
Это часть Agent Activity

Запись памяти:

После ответа агента — сохранить новые факты
Отдельная Activity или часть Agent Activity

4.3 Структура Memory Activity
Get Memory Activity:

Input: user_id, query (текущий контекст)
Output: список релевантных фактов

Update Memory Activity:

Input: user_id, conversation (последние сообщения)
Output: список добавленных/обновлённых фактов

4.4 Критерии готовности
□ Mem0 client инициализируется корректно
□ Get Memory Activity возвращает релевантные факты
□ Update Memory Activity сохраняет новые факты
□ Интеграция работает из Temporal Worker

Компонент 5: Базовый Onboarding Workflow (заглушка)
5.1 Описание
Создаём структуру Onboarding Workflow без полной логики шагов. Это проверка что вся инфраструктура работает.
5.2 Workflow структура (упрощённая)
OnboardingWorkflow:
  
  State:
    - current_step: "greeting" | "discovery" | "brain_dump" | "completed"
    - context: {} (данные собранные по ходу)
    - messages: [] (история сообщений)
  
  Signals:
    - user_message(content: str) — user отправил сообщение
    - user_connected() — user открыл приложение
  
  Queries:
    - get_state() → текущее состояние для UI
    - get_progress() → прогресс по шагам
  
  Logic (упрощённая для 1.0):
    1. Ждать signal user_connected или user_message
    2. Вызвать Agent Activity (greeter для начала)
    3. Отправить ответ (через side effect или callback)
    4. Ждать следующий signal
    5. Повторять пока не completed
5.3 Что НЕ делаем в 1.0

Полная логика переходов между шагами (это 1.1)
Proactive messages (это 1.2)
Widgets (это 1.5)
Реальные промпты агентов (это 1.3-1.4)

5.4 Критерии готовности
□ Workflow запускается для нового user
□ Signal user_message доставляется в workflow
□ Workflow вызывает Agent Activity
□ Ответ агента можно получить
□ Query get_state возвращает текущее состояние
□ Workflow не падает при ошибках агента

Компонент 6: API адаптация
6.1 Описание
FastAPI endpoints адаптируются для работы с Temporal вместо прямого управления workflow.
6.2 Изменения в endpoints
POST /api/chat/message
Было: Напрямую вызывает агента и workflow engine
Стало: Отправляет Signal в Temporal Workflow
GET /api/workflow/progress
Было: Читает из БД
Стало: Query к Temporal Workflow
POST /api/workflow/start
Было: Создаёт workflow instance в БД
Стало: Запускает Temporal Workflow
WebSocket /ws
Изменения минимальны — продолжает отправлять события клиенту
Источник событий меняется (из Temporal callbacks)
6.3 Temporal Client в FastAPI

Temporal Client создаётся при старте приложения
Переиспользуется для всех запросов
Async client для FastAPI

6.4 Критерии готовности
□ Temporal Client инициализируется в FastAPI
□ POST /api/chat/message отправляет signal
□ GET /api/workflow/progress делает query
□ Ответы возвращаются клиенту
□ WebSocket получает события

Компонент 7: Доставка ответов клиенту
7.1 Проблема
Temporal Workflow выполняется асинхронно. Когда агент ответил — как доставить ответ клиенту?
7.2 Решение: Callback Activity + WebSocket
Поток:
1. User отправляет сообщение → API
2. API отправляет Signal в Workflow
3. Workflow вызывает Agent Activity
4. Agent Activity возвращает ответ в Workflow
5. Workflow вызывает Notify Activity
6. Notify Activity отправляет через WebSocket
7. Client получает ответ
Notify Activity:

Input: user_id, message, metadata
Action: отправить через WebSocket или сохранить для polling
Использует shared state (Redis pub/sub или аналог)

7.3 Альтернатива: Polling
Если WebSocket недоступен:

Сохранять ответы в БД
Client периодически запрашивает новые сообщения

7.4 Критерии готовности
□ Notify Activity реализована
□ WebSocket получает сообщения от Workflow
□ Клиент видит ответ агента
□ Fallback на polling работает

Компонент 8: Адаптация БД
8.1 Изменения в схеме
workflow_instances:
Добавить:
  - temporal_workflow_id: string (ID в Temporal)
  - temporal_run_id: string (Run ID в Temporal)
  
Удалить или deprecated:
  - current_step (теперь в Temporal state)
  - context (теперь в Temporal state)
  - status (получаем из Temporal)
messages:
Без изменений — продолжаем хранить для истории
Новая таблица temporal_events (опционально):
Для отладки — логирование событий Temporal
  - id
  - workflow_id
  - event_type
  - payload
  - timestamp
8.2 Синхронизация состояния

Temporal — source of truth для workflow state
Pocketbase — хранение данных приложения (users, inbox, messages)
При необходимости — sync из Temporal в Pocketbase для отчётов

8.3 Критерии готовности
□ Схема БД обновлена
□ Workflow ID сохраняется при создании
□ Можно найти workflow по user_id
□ Messages сохраняются корректно

Docker Compose обновление
Новые сервисы
services:
  
  temporal:
    # Temporal Server
    
  temporal-ui:
    # Web UI для отладки
    
  temporal-postgresql:
    # БД для Temporal (отдельная от приложения)
    
  # Существующие сервисы остаются:
  # - backend
  # - pocketbase
  # - redis
Worker
Worker может быть:

Отдельный сервис (рекомендуется для production)
Часть backend процесса (проще для разработки)

Для MVP — часть backend (запускается вместе с FastAPI).

Порядок реализации
1. Docker setup для Temporal
   → Temporal Server работает, UI доступен

2. Temporal SDK в backend
   → Worker запускается, подключается к серверу

3. Базовые Activities
   → Agent Activity (заглушка)
   → Notify Activity
   → Memory Activities

4. Базовый Workflow
   → OnboardingWorkflow структура
   → Обработка signals
   → Вызов activities

5. API адаптация
   → Endpoints используют Temporal Client
   → WebSocket получает ответы

6. Интеграция PydanticAI
   → Реальные агенты в Agent Activity

7. Интеграция Mem0
   → Memory Activities работают

8. Тестирование полного цикла
   → User → Message → Agent → Response

Критерии завершения этапа 1.0
ИНФРАСТРУКТУРА:
□ Temporal Server работает в Docker
□ Temporal UI доступен для отладки
□ Worker запускается и обрабатывает задачи
□ Подключение стабильно при перезапусках

ACTIVITIES:
□ Agent Activity вызывает PydanticAI агента
□ Memory Activity читает/пишет в Mem0
□ Notify Activity отправляет через WebSocket
□ Retry работает при ошибках

WORKFLOW:
□ OnboardingWorkflow запускается для user
□ Signal user_message обрабатывается
□ Query get_state возвращает состояние
□ Workflow не падает при ошибках

API:
□ POST /api/chat/message работает через Temporal
□ GET /api/workflow/progress возвращает данные
□ WebSocket доставляет ответы

ИНТЕГРАЦИЯ:
□ Полный цикл: сообщение → агент → ответ работает
□ Mem0 сохраняет факты из диалога
□ История сообщений сохраняется в БД

ТЕСТЫ:
□ Можно отправить сообщение и получить ответ
□ Можно перезапустить backend — workflow продолжает работать
□ Temporal UI показывает workflow и его состояние

Что НЕ входит в этот этап
- Полная логика переходов между шагами (1.1)
- Proactive messages (1.2)
- Реальные промпты агентов (1.3-1.4)
- Widget система (1.5)
- UI прогресса (1.2)
- Обработка inbox (следующие этапы)

Риски и митигация
РИСК: Temporal сложнее чем ожидалось
МИТИГАЦИЯ: Начать с minimal setup, использовать temporal.io examples

РИСК: Проблемы с доставкой ответов через WebSocket
МИТИГАЦИЯ: Реализовать polling как fallback сразу

РИСК: Worker падает и workflow зависают
МИТИГАЦИЯ: Health checks, автоматический restart в Docker

РИСК: Сложность отладки распределённой системы
МИТИГАЦИЯ: Активно использовать Temporal UI, добавить логирование

Зависимости
Требуется:
- Docker и Docker Compose
- Python 3.11+
- temporalio Python SDK
- Существующий код (PydanticAI агенты, Mem0 config, FastAPI app)

Документация:
- https://docs.temporal.io/
- https://github.com/temporalio/samples-python
- https://docs.temporal.io/develop/python

Готов к реализации? Или есть вопросы по спецификации?