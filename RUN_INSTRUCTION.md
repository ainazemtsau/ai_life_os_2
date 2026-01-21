# AI Life OS - Запуск

## Требования

- Docker Desktop

## Запуск

```bash
# Одна команда — всё работает
pnpm start

# Или напрямую
docker compose up
```

**Готово!**
- Web App: http://localhost:3000
- Supabase Dashboard: http://localhost:54323

## Команды

| Команда | Описание |
|---------|----------|
| `pnpm start` | Запустить всё |
| `pnpm start:build` | Пересобрать и запустить |
| `pnpm stop` | Остановить |
| `pnpm logs` | Все логи |
| `pnpm logs:web` | Логи web app |

## OpenAI API Key

Создай `.env` файл:
```
OPENAI_API_KEY=sk-...
```

## Сброс

```bash
docker compose down -v   # удалит volumes
pnpm start
```
