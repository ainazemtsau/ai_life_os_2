# Chat Runtime Architecture

External store runtime adapter bridging assistant-ui with Supabase backend.

## Architecture

```
User Input
      |
      v
+-------------------+     +-------------------+
|  ChatPanel (UI)   |---->| useExternalStore  |
|  Thread, Composer |     |    Runtime        |
+-------------------+     +-------------------+
      |                          |
      v                          v
+-------------------+     +-------------------+
|  Supabase Client  |<----|  API Routes       |
|  (queries)        |     |  /api/chat/*      |
+-------------------+     +-------------------+
      |                          |
      v                          v
+-------------------+     +-------------------+
|  PostgreSQL       |     |  Mastra Workflows |
|  (message tree)   |     |  (streaming)      |
+-------------------+     +-------------------+
```

## Data Flow

### Send Message

```
Composer Submit --> Runtime.append() --> API POST /api/chat/[id]
  --> chatWorkflow (async generator)
  --> DB: createMessage(status=pending)
  --> OpenAI stream
  --> chunks via ReadableStream
  --> Runtime updates thread state
  --> DB: updateMessage(status=complete)
  --> UI re-renders via runtime subscription
```

### Load Thread

```
Route /chat/[id] --> Runtime.switchToThread(id)
  --> API GET /api/threads/[id]/messages
  --> getConversationMessages(id)
  --> Runtime sets messages
  --> UI renders message list
```

### Sidebar Navigation

```
Click thread --> router.push(/chat/[id])
  --> Runtime.switchToThread(id)
  --> Load thread flow
```

## Why This Structure

**External Runtime in packages/ui/**: Tightly coupled to assistant-ui's state model. Runtime adapter lives with UI components, imports from packages/supabase for persistence.

**Singleton store pattern**: useSyncExternalStore requires stable store reference. Singleton ensures single source of truth across components. Context would add unnecessary Provider wrapper.

**Stream consumption via ReadableStream**: Backend yields text chunks as ReadableStream. Frontend consumes via reader.read() loop. Updates state chunk-by-chunk for real-time UI responsiveness without debouncing. Re-render cost acceptable for modern React with efficient diffing.

**Optimistic UI updates**: User message added immediately before API call for perceived performance. On error, message marked with error status rather than removed. Tradeoff: brief inconsistency on failure vs perceived responsiveness.

## Invariants

1. **Thread state consistency**: Runtime thread state must match database; switchToThread always fetches fresh
2. **Message tree integrity**: Every message has valid parent_id or null for root
3. **Status lifecycle**: pending -> streaming -> complete | error | stopped
4. **Single active thread**: Runtime can only have one active thread at a time

## Tradeoffs

**More abstraction for better architecture**: External runtime adds complexity but enables sidebar, branching, persistence properly.

**Fresh data on thread switch**: Always fetch from DB on switch instead of caching; ensures consistency at cost of latency.

**Duplicate state possible**: Runtime holds thread state, SWR holds thread list; acceptable as they serve different purposes.

**Chunk-by-chunk UI updates without debouncing**: Real-time responsiveness for chat streaming. Users expect character-by-character display. Debouncing would add perceived latency.
