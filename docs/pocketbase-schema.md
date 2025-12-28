# Pocketbase Schema

## Коллекция: agents

AI агенты системы.

| Field | Type | Required | Options |
|-------|------|----------|---------|
| name | Text | Yes | |
| type | Select | Yes | coordinator, specialist |
| system_prompt | Text | No | |
| config | JSON | No | |
| is_active | Bool | No | Default: true |

## Коллекция: conversations

Активные разговоры (не история сообщений).

| Field | Type | Required | Options |
|-------|------|----------|---------|
| agent | Relation | No | → agents, max 1 |
| status | Select | Yes | active, closed. Default: active |
| context | JSON | No | |
| last_activity | DateTime | No | |

## Начальные данные

### agents

| name | type | is_active |
|------|------|-----------|
| Coordinator | coordinator | true |

## API Rules

Для Stage 0-1 все коллекции доступны без авторизации:
- List: публичный
- View: публичный
- Create: публичный
- Update: публичный
- Delete: публичный

## Проверка API

```bash
# Получить список агентов
curl http://localhost:8090/api/collections/agents/records

# Получить список разговоров
curl http://localhost:8090/api/collections/conversations/records
```
