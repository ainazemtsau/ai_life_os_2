# API Routes

Next.js API route handlers for chat, threads, and assistants.

## Files

| File | What | When to read |
|------|------|--------------|
| `chat/route.ts` | POST: Create conversation + send first message | Creating new chat sessions |
| `chat/[conversationId]/route.ts` | POST: Send message to existing conversation | Adding messages to threads |
| `chat/branch/route.ts` | POST: Edit message (create branch) | Implementing message editing |
| `chat/regenerate/route.ts` | POST: Regenerate assistant response | Implementing regeneration |
| `threads/route.ts` | GET: List conversations, POST: Create conversation | Sidebar thread list |
| `threads/[id]/route.ts` | DELETE: Delete conversation | Thread deletion |
| `threads/[id]/messages/route.ts` | GET: Load all messages for a conversation | Loading thread messages on switch |
| `assistants/route.ts` | GET: List assistants, POST: Create assistant | Admin panel assistant list |
| `assistants/[id]/route.ts` | GET/PUT/DELETE: Assistant CRUD | Admin panel assistant management |

## Subdirectories

| Directory | What | When to read |
|-----------|------|--------------|
| `chat/` | Chat message endpoints | Implementing chat functionality |
| `threads/` | Conversation management | Implementing sidebar, thread list |
| `assistants/` | Assistant CRUD | Implementing admin panel |
