export const GEMINI_PAUSED_UNTIL = Date.parse('2026-11-02T00:00:00+02:00');

export function isGeminiPaused(): boolean {
  return Date.now() < GEMINI_PAUSED_UNTIL;
}

export const GEMINI_PAUSED_MSG = 'Gemini paused until 2026-11-02 (no credits)';
