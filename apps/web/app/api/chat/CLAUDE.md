# Chat API

API routes for chat messaging with streaming responses.

## Index

| File                          | Contents (WHAT)                                | Read When (WHEN)                          |
| ----------------------------- | ---------------------------------------------- | ----------------------------------------- |
| `route.ts`                    | New conversation + first message endpoint      | Creating conversations, initial messages  |
| `[conversationId]/route.ts`   | Send message to existing conversation endpoint | Adding messages to threads                |
| `branch/route.ts`             | Message editing, branch creation endpoint      | Implementing edit feature                 |
| `regenerate/route.ts`         | Assistant message regeneration endpoint        | Building regeneration UI                  |
