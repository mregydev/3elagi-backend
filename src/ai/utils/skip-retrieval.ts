const SMALL_TALK =
  /^(hi|hello|hey|hiya|thanks|thank you|ok|okay|bye|good morning|good evening|good afternoon|how are you|salam|marhaba|مرحبا|اهلا|السلام عليكم)[!.?\s]*$/i;

const PLATFORM_QUERY =
  /doctor|doctors|physician|specialit|specialty|specialties|cardio|dermat|pediat|platform|how many|عدد|اطباء|أطباء|تخصص/i;

/** Skip slow embedding/vector search for greetings and very short non-medical chat. */
export function shouldSkipRetrieval(message: string): boolean {
  const text = message.trim();
  if (!text) return true;
  if (PLATFORM_QUERY.test(text)) return false;
  if (text.length <= 12 && SMALL_TALK.test(text)) return true;
  return false;
}
