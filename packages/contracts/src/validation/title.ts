export const TITLE_MIN_LENGTH = 1;
export const TITLE_MAX_LENGTH = 60;

export function validateTitle(title: string): { valid: boolean; error?: string } {
  const trimmed = title.trim();
  if (trimmed.length < TITLE_MIN_LENGTH) {
    return { valid: false, error: 'Title cannot be empty' };
  }
  if (trimmed.length > TITLE_MAX_LENGTH) {
    return { valid: false, error: `Title must be ${TITLE_MAX_LENGTH} characters or less` };
  }
  return { valid: true };
}
