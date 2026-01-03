Этап 1.1: Workflow Engine — Спецификация
Цель этапа
Сделать workflow engine полностью функциональным: этапы переключаются по сигналам от агентов, обязательные этапы нельзя пропустить, UI отражает текущее состояние.

Контекст
В этапе 1.0 создан базовый WorkflowService с python-statemachine. Сейчас нужно:

Связать workflow с реальными агентами
Реализовать логику переходов между этапами
Добавить блокировку обязательных этапов
Обеспечить persistence состояния
Передавать состояние workflow на frontend


Требования
1. Структура Onboarding Workflow
ЭТАПЫ:
─────
1. greeting (обязательный)
   • Агент: greeter
   • Критерий завершения: агент явно сигналит step_completed
   • Следующий: discovery

2. discovery (обязательный)
   • Агент: discovery
   • Критерий завершения: агент сигналит step_completed 
     И в Mem0 есть минимум 3 факта о приоритетах
   • Следующий: brain_dump

3. brain_dump (обязательный)
   • Агент: inbox_collector
   • Критерий завершения: widget completed 
     И в inbox есть минимум 1 item
   • Следующий: completed

4. completed (финальный)
   • Агент: coordinator
   • Onboarding завершён
2. Механизм переходов
Сигнал от агента:
Агент возвращает в ответе:
{
  "workflow_signal": {
    "action": "complete_step" | "stay" | "need_input",
    "data": { ... }  // данные для сохранения в контексте
  }
}

- complete_step — попытка перейти к следующему этапу
- stay — остаться на текущем этапе (диалог продолжается)
- need_input — требуется ввод от пользователя (например, через widget)
Проверка критериев:
При получении complete_step:
1. WorkflowService проверяет completion_criteria текущего шага
2. Если критерии выполнены → переход
3. Если нет → остаёмся, возвращаем причину агенту
3. Completion Criteria
Типы критериев:
1. agent_signal
   Достаточно сигнала complete_step от агента.
   Используется: greeting

2. agent_signal + memory_check
   Сигнал + проверка что в Mem0 есть нужные данные.
   Используется: discovery
   Параметры: { min_facts: 3, category: "priorities" }

3. agent_signal + widget_completed
   Сигнал + виджет завершён с данными.
   Используется: brain_dump
   Параметры: { widget_type: "list_input", min_items: 1 }
Реализация проверок:
Каждый тип критерия — отдельный checker.
Checkers регистрируются в registry.
WorkflowService вызывает нужный checker по типу.
Легко добавить новые типы без изменения core кода.
4. Блокировка этапов
Правила:
- Если этап is_required=true — нельзя перейти дальше без выполнения критериев
- При попытке пользователя "перескочить" (например, написать что-то не по теме):
  1. Coordinator определяет что это не относится к текущему этапу
  2. Возвращает пользователя к текущему агенту
  3. Объясняет почему нужно завершить текущий этап
Обработка "перескока":
Пользователь на этапе discovery пишет: "Запиши в inbox: купить молоко"

Система должна:
1. Понять что это относится к brain_dump, не к discovery
2. Ответить: "Отличная мысль! Запишем это чуть позже. 
   Сейчас давай закончим с приоритетами — это поможет 
   мне лучше организовать твои задачи."
3. Продолжить discovery
5. Workflow Context
Что хранится:
{
  "workflow_id": "onboarding",
  "current_step": "discovery",
  "started_at": "...",
  "steps_completed": ["greeting"],
  "step_data": {
    "greeting": {
      "completed_at": "...",
      "user_name": "Alex"  // если агент узнал
    },
    "discovery": {
      "started_at": "...",
      "questions_asked": 5,
      "facts_collected": 2
    }
  },
  "shared": {
    // данные доступные всем шагам
  }
}
Обновление контекста:
- При переходе между шагами — автоматически
- Агент может добавить данные через workflow_signal.data
- Контекст передаётся следующему агенту при handoff
6. Persistence
Сохранение:
- workflow_instances таблица уже есть
- Сохранять после каждого изменения состояния
- Поля: user_id, workflow_id, current_step, status, context (JSON), timestamps
Восстановление:
- При новой сессии пользователя — загрузить активный workflow
- Продолжить с текущего шага
- Передать контекст агенту
7. WebSocket события
От backend к frontend:
workflow.started
  { workflow_id, initial_step }

workflow.step_changed  
  { workflow_id, previous_step, current_step, progress }

workflow.step_blocked
  { workflow_id, current_step, reason, missing_criteria }

workflow.completed
  { workflow_id, completed_at, summary }
Progress:
Вычисляется как: completed_steps / total_steps
Пример: greeting done, discovery active = 1/3 = 33%
8. API Endpoints
Существующие (проверить/дополнить):
GET /api/workflows/active
  → Активный workflow пользователя с текущим состоянием

GET /api/workflows/{instance_id}
  → Детали workflow instance включая context

GET /api/workflows/{instance_id}/progress
  → Прогресс: текущий шаг, completed steps, процент
Новые (если нужны):
POST /api/workflows/{instance_id}/signal
  → Ручной сигнал для workflow (для тестирования)
  Body: { action: "complete_step", data: {...} }

Интеграция с AgentService
Как агент получает workflow context:
При вызове агента передавать:
- current_step — на каком этапе
- step_context — данные текущего шага
- can_complete — может ли завершить (предварительная проверка)
Как агент сигналит о переходе:
Агент возвращает structured output через PydanticAI.
В output включён workflow_signal.
AgentService передаёт сигнал в WorkflowService.
WorkflowService обрабатывает переход.

Критерии завершения этапа 1.1
□ Onboarding workflow полностью сконфигурирован (3 этапа + completed)
□ Переходы работают по сигналам агентов
□ Completion criteria проверяются для каждого типа
□ Обязательные этапы нельзя пропустить
□ Контекст сохраняется и восстанавливается между сессиями
□ WebSocket события отправляются при изменениях
□ Frontend получает текущий шаг и прогресс
□ Тест: полный проход onboarding от greeting до completed
□ Тест: попытка пропустить этап — блокируется
□ Тест: перезагрузка страницы — workflow продолжается с того же места

Что НЕ входит в этот этап
- Реальная логика агентов (только workflow_signal)
- UI индикатор прогресса (только данные)
- Widgets (следующие этапы)
- Несколько параллельных workflows

Зависимости
Из этапа 1.0:
- WorkflowService с базовым state machine
- Таблица workflow_instances
- AgentService
- WebSocket соединение

Риски и решения
Риск: Агент не возвращает workflow_signal
Решение: Default поведение = stay (остаёмся на текущем шаге)

Риск: Criteria checker падает с ошибкой
Решение: Логировать, возвращать false (не пропускаем)

Риск: Пользователь застрял на этапе
Решение: Агент должен помогать, но это логика агента (этап 1.3-1.4)