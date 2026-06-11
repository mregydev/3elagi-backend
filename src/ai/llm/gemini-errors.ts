export function throwFriendlyGeminiError(err: unknown, modelName: string): never {
  const msg = err instanceof Error ? err.message : String(err);

  if (
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('RESOURCE_EXHAUSTED')
  ) {
    throw new Error(
      `Gemini quota exceeded for model "${modelName}". Try again later, switch GEMINI_CHAT_MODEL (e.g. gemini-flash-latest), or enable billing in Google AI Studio.`,
    );
  }

  if (msg.includes('404') || msg.includes('not found')) {
    throw new Error(
      `Gemini model "${modelName}" is not available (1.5 Flash was retired). Set GEMINI_CHAT_MODEL to gemini-flash-latest.`,
    );
  }

  if (
    msg.includes('API key') ||
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('API_KEY_INVALID')
  ) {
    throw new Error(
      'Invalid Gemini API key. Create one at https://aistudio.google.com/apikey',
    );
  }

  if (msg.includes('503') || msg.includes('high demand')) {
    throw new Error(
      'Gemini is temporarily overloaded. Please try again in a few seconds.',
    );
  }

  throw err instanceof Error ? err : new Error(msg);
}
