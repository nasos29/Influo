/**
 * Language persistence utility
 * Stores and retrieves language preference from localStorage
 */

const LANGUAGE_STORAGE_KEY = 'influo_language';

export type Language = 'el' | 'en';

export function getStoredLanguage(): Language {
  if (typeof window === 'undefined') {
    return 'el'; // Default to Greek for SSR
  }
  
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === 'el' || stored === 'en') {
      return stored;
    }
  } catch (error) {
    console.error('Error reading language from localStorage:', error);
  }
  
  return 'el'; // Default to Greek
}

export function setStoredLanguage(lang: Language): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch (error) {
    console.error('Error saving language to localStorage:', error);
  }
}