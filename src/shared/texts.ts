export const AI_STREAMING_ERROR_MESSAGE_PREFIX =
  "Sorry, there was an error from the AI: ";

export const CONTEXT_OVERFLOW_FRIENDLY_MESSAGE =
  "Your conversation and project files are too large for this model's context window. " +
  "Try one of the following:\n\n" +
  "1. Click **\"Summarize to new chat\"** to compress your conversation history\n" +
  "2. Click **\"Start new chat\"** to begin a fresh conversation\n" +
  "3. Switch to a model with a larger context window";

/**
 * Detects if an AI error message indicates a context window overflow.
 * Returns a user-friendly message if detected, otherwise returns null.
 */
export function getContextOverflowMessage(
  errorMessage: string | undefined | null,
): string | null {
  if (!errorMessage) return null;
  const lower = errorMessage.toLowerCase();
  if (
    lower.includes("context length") ||
    lower.includes("maximum context") ||
    lower.includes("token limit") ||
    lower.includes("context_length_exceeded") ||
    lower.includes("context window") ||
    lower.includes("too many tokens")
  ) {
    return CONTEXT_OVERFLOW_FRIENDLY_MESSAGE;
  }
  return null;
}
