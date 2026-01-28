# Chat Components

assistant-ui based chat interface with message rendering, editing, and branching.

## Files

| File | What | When to read |
|------|------|--------------|
| `README.md` | Component architecture, branching design | Understanding message tree navigation, active branch tracking |
| `chat-panel.tsx` | Main chat container with message list and input | Building chat UI, layout changes |
| `message-list.tsx` | Message display with filtering, branch navigation | Modifying message rendering, implementing active branch filtering |
| `message-input.tsx` | Text input with keyboard shortcuts | Changing input behavior, shortcuts |
| `message-bubble.tsx` | Individual message with edit mode, branch navigator | Customizing message appearance, adding message features |
| `message-actions.tsx` | Edit, copy, regenerate buttons | Adding message actions, button behavior |
| `message-edit-form.tsx` | Textarea form for editing user messages | Modifying edit UI, keyboard shortcuts |
| `branch-navigator.tsx` | Arrow navigation between message siblings | Customizing branch navigation UI |
| `markdown-renderer.tsx` | Markdown to HTML with syntax highlighting | Changing markdown rendering, code blocks |
| `code-block.tsx` | Code block with language header and copy | Customizing code block appearance |
| `unread-indicator.tsx` | Tab title notification on completion | Modifying background notifications |
