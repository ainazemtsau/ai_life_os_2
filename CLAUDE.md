# AI Workspace

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

## Project Status

Current Stage: 0 - Infrastructure
