# Chat Components

## Architecture

```
ChatPanel
    |
    +---> MessageList
    |         |
    |         +---> MessageBubble (for each message)
    |         |         |
    |         |         +---> MarkdownRenderer (assistant messages)
    |         |         |         |
    |         |         |         +---> CodeBlock (code blocks)
    |         |         |
    |         |         +---> MessageActions (Edit, Copy, Regenerate)
    |         |
    |         +---> BranchNavigator (when siblings exist)
    |         +---> Auto-scroll (during generation, unless user scrolled)
    |
    +---> MessageInput (keyboard shortcuts: Enter=send, Shift+Enter=newline)
    |
    +---> UnreadIndicator (tab title notification)
```

## Data Flow

### Send Message
1. User types in MessageInput, presses Enter
2. MessageInput calls onSend callback
3. Parent component POSTs to /api/chat/[conversationId]
4. API returns streaming response
5. MessageList receives chunks via assistant-ui runtime
6. MessageBubble renders new content incrementally
7. Auto-scroll keeps latest message visible (unless user scrolled up)
8. On completion: UnreadIndicator updates tab title if tab backgrounded

### Edit Message (Branch)
1. User hovers over user message, clicks Edit in MessageActions
2. MessageBubble toggles to edit mode showing MessageEditForm
3. User modifies content in textarea, clicks Save (or Cmd/Ctrl+Enter)
4. chat-runtime.ts editMessage() calls POST /api/messages/[id]/edit
5. API streams new assistant response via branchWorkflow
6. New assistant message created as sibling with same parent_id
7. BranchNavigator appears showing "< 1/2 >" if siblings exist
8. Runtime updates activeBranches[parentId] to new message ID
9. User can navigate between versions with arrow buttons

### Regenerate
1. User clicks Regenerate in MessageActions (last assistant message only)
2. Parent component POSTs to /api/chat/regenerate
3. New assistant message created as sibling
4. BranchNavigator shows variant count
5. User can switch between regenerated responses

### Copy
1. User clicks Copy in MessageActions
2. navigator.clipboard.writeText() copies message content
3. Button shows checkmark for 2s, then reverts to copy icon

## Invariants

1. **Branch isolation**: Only one sibling per parent_id visible at a time, determined by activeBranches map
2. **Sibling immutability**: Edit operations create new siblings, never mutate existing messages
3. **activeBranches reset**: Cleared on thread switch to prevent stale branch references
4. **Auto-scroll pause**: User scrolling up >100px disables auto-scroll during generation
5. **Keyboard shortcuts**: Enter sends (unless Shift held), Escape stops generation or cancels edit
6. **Role distinction**: User messages plain text (preserved newlines), assistant messages as markdown
7. **Edit restriction**: Only user messages have Edit button (assistant messages have Regenerate)
8. **Edit disabled during streaming**: Edit button disabled while isGenerating to prevent race conditions

## Tradeoffs

- **Local activeBranches vs database**: Active branch selection stored in runtime state, not database. Simpler implementation but state lost on page refresh. Can be restored via localStorage later.
- **Lazy siblings fetch vs eager**: Siblings loaded on first navigation click, not at message mount. Reduces initial API calls with acceptable first-click latency. siblingsCache eliminates latency for subsequent navigations.
- **Duplication over abstraction**: Runtime adapter duplicates some workflow logic for optimistic updates (simpler than shared abstraction layer)
- **Markdown for all assistant messages**: No plain text mode (trades flexibility for consistent rendering)
- **Manual QA only**: No automated tests for UI components (visual verification during development, test effort focused on workflows)

## Integration with assistant-ui

### Runtime Adapter
- assistant-ui provides Thread, ThreadMessages, Composer components
- Custom Supabase runtime adapter (packages/ui/src/runtime/supabase-runtime.ts) syncs to database
- Runtime handles optimistic updates, thread state, message tree navigation

### Message Tree Navigation
- parent_id-based tree structure in Supabase
- Runtime tracks active branch per parent via activeBranches map (parentId -> messageId)
- BranchNavigator queries siblings (same parent_id) via GET /api/messages/[id]/siblings
- Navigation switches by updating activeBranches[parentId], triggering message filtering
- Messages filtered: show only siblings where activeBranches matches message ID
- Default active branch: last created sibling (highest created_at timestamp)

### Streaming State
- Runtime receives chunks from API ReadableStream
- MessageBubble re-renders on each chunk (React state update)
- Status tracked in database: pending -> streaming -> complete|error|stopped

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Enter | Send message (unless Shift held) |
| Shift+Enter | Insert newline |
| Escape | Stop generation or cancel edit |
| Cmd/Ctrl+Enter | Save edited message (in edit mode) |
| Ctrl/Cmd+Shift+O | New conversation |
| Ctrl/Cmd+/ | Focus input |

## Markdown Rendering

Libraries: react-markdown + rehype-highlight

Supported syntax:
- Headers (h1-h6)
- Lists (ordered, unordered)
- Bold, italic, code
- Links
- Blockquotes
- Code blocks with syntax highlighting

Code blocks:
- Language detection from fence info string
- Language name displayed in header
- Separate copy button per code block
- Syntax highlighting via rehype-highlight
