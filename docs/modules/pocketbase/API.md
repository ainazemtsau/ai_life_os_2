# Module: pocketbase — API

## Overview

External service for data storage. Provides REST API automatically for all collections.

## Public Interface

### Admin UI
- URL: http://localhost:8090/_/
- First run: setup admin account

### REST API (auto-generated)

Base URL: `http://localhost:8090/api`

#### Collections
- `GET /collections` — list all collections
- `POST /collections` — create collection
- `GET /collections/{name}` — get collection schema
- `PATCH /collections/{name}` — update collection
- `DELETE /collections/{name}` — delete collection

#### Records
- `GET /collections/{name}/records` — list records
- `POST /collections/{name}/records` — create record
- `GET /collections/{name}/records/{id}` — get record
- `PATCH /collections/{name}/records/{id}` — update record
- `DELETE /collections/{name}/records/{id}` — delete record

## Events / Messages

N/A — Pocketbase is accessed via HTTP only.

---
Update this file when public interface changes.
