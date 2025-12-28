# AI Workspace

## ЗАПРЕЩЕНО

**МОДЕЛЬ LLM: gpt-5-mini. НИКОГДА НЕ МЕНЯТЬ. НЕ ПРЕДЛАГАТЬ ДРУГИЕ МОДЕЛИ.**

## Mandatory Rules

### Before working on any module:
1. Read docs/ARCHITECTURE.md
2. Read docs/MODULES.md to understand module boundaries
3. Read docs/modules/<module>/API.md for the module you will modify
4. Read docs/modules/<module>/DEPENDENCIES.md to understand what APIs you can use
5. If working inside module, read docs/modules/<module>/INTERNAL.md

### After making changes:
1. Update docs/modules/<module>/INTERNAL.md if you changed internal structure
2. Update docs/modules/<module>/API.md if you changed public interface
3. Update docs/modules/<module>/DEPENDENCIES.md if you added new dependency

### Module boundaries:
- Only use APIs documented in other modules' API.md
- Never import/access internals of other modules directly
- If you need functionality not in API.md, document the need

## Quick Reference

### Start services
```bash
docker-compose up
```

### Rebuild service
```bash
docker-compose build <service>
```

### View logs
```bash
docker-compose logs -f <service>
```

### Check services
- Pocketbase admin: http://localhost:8090/_/
- Backend health: http://localhost:8000/health
- Frontend: http://localhost:3000
- AI chat test: POST http://localhost:8000/test/ai/chat

### Setup Pocketbase Admin (required for AI)
1. Open http://localhost:8090/_/
2. Create admin account with email/password
3. Add credentials to .env:
   - POCKETBASE_ADMIN_EMAIL=your-email
   - POCKETBASE_ADMIN_PASSWORD=your-password
4. Restart backend: `docker-compose restart backend`

## Project Status

Current Stage: 4 - AI Agent
