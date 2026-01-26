export function generateTitle(content: string): string {
  if (!content || content.trim().length === 0) {
    return 'Untitled Conversation';
  }

  if (content.length <= 50) {
    return content;
  }

  const truncated = content.slice(0, 50);
  const lastSpace = truncated.lastIndexOf(' ');

  const title = lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
  return `${title}...`;
}
