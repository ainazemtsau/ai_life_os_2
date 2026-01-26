# Chat Components

assistant-ui based chat interface with message rendering, editing, and branching.

## Files

| File | What | When to read |
|------|------|--------------|
| `README.md` | Component architecture, data flow | Understanding assistant-ui integration, message tree navigation |
| `chat-panel.tsx` | Main chat container with message list and input | Building chat UI, layout changes |
| `message-list.tsx` | Scrollable message display with auto-scroll | Modifying message rendering, scroll behavior |
| `message-input.tsx` | Text input with keyboard shortcuts | Changing input behavior, shortcuts |
| `message-bubble.tsx` | Individual message display (user/assistant styling) | Customizing message appearance |
| `message-actions.tsx` | Edit, copy, regenerate buttons | Adding message actions, button behavior |
| `markdown-renderer.tsx` | Markdown to HTML with syntax highlighting | Changing markdown rendering, code blocks |
| `code-block.tsx` | Code block with language header and copy | Customizing code block appearance |
| `unread-indicator.tsx` | Tab title notification on completion | Modifying background notifications |
