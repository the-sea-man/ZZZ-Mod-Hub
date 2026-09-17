/**
 * translator.ts
 *
 * One-Click Cloud Language Pack Generator & System Language Detection
 * Powered by Google Translate's public endpoint via native Rust Tauri IPC.
 *
 * Running natively in Rust bypasses browser WebView CORS restrictions and URL length limits.
 * Shields i18next variables ({{name}}, {0}) before sending,
 * aligns batches via indexed delimiters, and saves directly to disk.
 */

import en from '../locales/en.json';
import { BUILTIN_LANGUAGES, saveCustomLanguagePack } from '../i18n';
import { tauriCommands } from './tauriCommands';

export interface WorldLanguage {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

export const WORLD_LANGUAGES: WorldLanguage[] = [
  // Top World Languages (with flags and native scripts)
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština', flag: '🇨🇿' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română', flag: '🇷🇴' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', flag: '🇬🇷' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', flag: '🇭🇺' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi', flag: '🇫🇮' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk', flag: '🇩🇰' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk', flag: '🇳🇴' },
  { code: 'tl', name: 'Filipino / Tagalog', nativeName: 'Tagalog', flag: '🇵🇭' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', flag: '🇲🇾' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی', flag: '🇮🇷' },
  { code: 'bg', name: 'Bulgarian', nativeName: 'Български', flag: '🇧🇬' },
  { code: 'hr', name: 'Croatian', nativeName: 'Hrvatski', flag: '🇭🇷' },
  { code: 'sk', name: 'Slovak', nativeName: 'Slovenčina', flag: '🇸🇰' },
  { code: 'sr', name: 'Serbian', nativeName: 'Српски', flag: '🇷🇸' },
  { code: 'lt', name: 'Lithuanian', nativeName: 'Lietuvių', flag: '🇱🇹' },
  { code: 'lv', name: 'Latvian', nativeName: 'Latviešu', flag: '🇱🇻' },
  { code: 'et', name: 'Estonian', nativeName: 'Eesti', flag: '🇪🇪' },
  { code: 'sl', name: 'Slovenian', nativeName: 'Slovenščina', flag: '🇸🇮' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇧🇩' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', flag: '🇵🇰' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', flag: '🇰🇪' },
  { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans', flag: '🇿🇦' },
  { code: 'ca', name: 'Catalan', nativeName: 'Català', flag: '🇪🇸' },
  { code: 'gl', name: 'Galician', nativeName: 'Galego', flag: '🇪🇸' },
  { code: 'eu', name: 'Basque', nativeName: 'Euskara', flag: '🇪🇸' },
  { code: 'is', name: 'Icelandic', nativeName: 'Íslenska', flag: '🇮🇸' },
  { code: 'ka', name: 'Georgian', nativeName: 'ქართული', flag: '🇬🇪' },
  { code: 'hy', name: 'Armenian', nativeName: 'Հայերեն', flag: '🇦🇲' },
  { code: 'az', name: 'Azerbaijani', nativeName: 'Azərbaycan', flag: '🇦🇿' },
  { code: 'kk', name: 'Kazakh', nativeName: 'Қазақша', flag: '🇰🇿' },
  { code: 'uz', name: 'Uzbek', nativeName: 'Oʻzbekcha', flag: '🇺🇿' },
  { code: 'mn', name: 'Mongolian', nativeName: 'Монгол', flag: '🇲🇳' },
  { code: 'my', name: 'Burmese', nativeName: 'မြန်မာဘာသာ', flag: '🇲🇲' },
  { code: 'km', name: 'Khmer', nativeName: 'ភាសាខ្មែរ', flag: '🇰🇭' },
  { code: 'lo', name: 'Lao', nativeName: 'ພາສາລາວ', flag: '🇱🇦' },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली', flag: '🇳🇵' },
  { code: 'si', name: 'Sinhala', nativeName: 'සිංහල', flag: '🇱🇰' },
];

export const POPULAR_COMMUNITY_LANGUAGES = WORLD_LANGUAGES;
export type CommunityLanguage = WorldLanguage;

/**
 * Welcoming native greeting dictionary for detected system languages.
 * Gives immediate familiarity to users before they even understand English menus.
 */
export const NATIVE_GREETINGS: Record<string, { greeting: string; action: string }> = {
  th: {
    greeting: 'สวัสดี! ตรวจพบภาษาไทยในระบบของคุณ',
    action: 'แปลแอปเป็นภาษาไทย (10 วินาที) ➔',
  },
  fr: {
    greeting: 'Bonjour ! Votre langue système détectée est le Français.',
    action: "Traduire l'application en Français (10s) ➔",
  },
  de: {
    greeting: 'Hallo! Ihre erkannte Systemsprache ist Deutsch.',
    action: 'App auf Deutsch übersetzen (10 Sek.) ➔',
  },
  pl: {
    greeting: 'Cześć! Twój wykryty język systemowy to Polski.',
    action: 'Przetłumacz aplikację na język polski (10s) ➔',
  },
  vi: {
    greeting: 'Xin chào! Ngôn ngữ hệ thống của bạn là Tiếng Việt.',
    action: 'Dịch ứng dụng sang Tiếng Việt (10s) ➔',
  },
  id: {
    greeting: 'Halo! Bahasa sistem Anda terdeteksi Bahasa Indonesia.',
    action: 'Terjemahkan aplikasi ke Bahasa Indonesia (10 detik) ➔',
  },
  it: {
    greeting: "Ciao! La tua lingua di sistema è l'Italiano.",
    action: "Traduci l'applicazione in Italiano (10s) ➔",
  },
  tr: {
    greeting: 'Merhaba! Sistem diliniz Türkçe olarak algılandı.',
    action: "Uygulamayı Türkçe'ye çevir (10 sn) ➔",
  },
  uk: {
    greeting: 'Привіт! Ваша системна мова — Українська.',
    action: 'Перекласти додаток українською (10 сек) ➔',
  },
  ar: {
    greeting: 'مرحباً! تم اكتشاف لغة النظام: العربية.',
    action: 'ترجمة التطبيق إلى العربية (10 ثوانٍ) ➔',
  },
  nl: {
    greeting: 'Hallo! Uw systeemtaal is Nederlands.',
    action: 'Vertaal de app naar het Nederlands (10s) ➔',
  },
  cs: {
    greeting: 'Ahoj! Váš zjištěný jazyk systému je Čeština.',
    action: 'Přeložit aplikaci do češtiny (10s) ➔',
  },
  ro: {
    greeting: 'Bună! Limba de sistem detectată este Română.',
    action: 'Tradu aplicația în Română (10s) ➔',
  },
  el: {
    greeting: 'Γεια σας! Η γλώσσα συστήματος είναι τα Ελληνικά.',
    action: 'Μετάφραση εφαρμογής στα Ελληνικά (10δ) ➔',
  },
  sv: {
    greeting: 'Hej! Ditt identifierade systemspråk är Svenska.',
    action: 'Översätt appen till svenska (10s) ➔',
  },
  hu: {
    greeting: 'Szia! A rendszer által felismert nyelv a Magyar.',
    action: 'Alkalmazás fordítása magyarra (10 mp) ➔',
  },
  fi: {
    greeting: 'Hei! Havaittu järjestelmäkielesi on Suomi.',
    action: 'Käännä sovellus suomeksi (10s) ➔',
  },
  da: {
    greeting: 'Hej! Dit registrerede systemsprog er Dansk.',
    action: 'Oversæt appen til dansk (10s) ➔',
  },
  no: {
    greeting: 'Hei! Ditt oppdagede systemspråk er Norsk.',
    action: 'Oversett appen til norsk (10s) ➔',
  },
  hi: {
    greeting: 'नमस्ते! आपकी सिस्टम भाषा हिन्दी पाई गई है।',
    action: 'ऐप का हिन्दी में अनुवाद करें (10 सेकंड) ➔',
  },
  tl: {
    greeting: 'Kumusta! Ang wika ng iyong system ay Filipino / Tagalog.',
    action: 'Isalin ang app sa Filipino (10s) ➔',
  },
  ms: {
    greeting: 'Hai! Bahasa sistem anda dikesan sebagai Bahasa Melayu.',
    action: 'Terjemah aplikasi ke Bahasa Melayu (10 saat) ➔',
  },
  he: {
    greeting: 'שלום! שפת המערכת שזוהתה היא עברית.',
    action: 'תרגם את האפליקציה לעברית (10 שניות) ➔',
  },
};

export interface DetectedLanguageInfo {
  rawCode: string;
  matchedCode: string;
  displayName: string;
  nativeName: string;
  flag: string;
  greeting?: { greeting: string; action: string };
  isBuiltin: boolean;
}

/**
 * Normalizes system language (e.g. pt-BR, fr-FR, zh-CN, th-TH) and checks
 * whether it matches a built-in language or a world language.
 */
export function detectSystemLanguage(): DetectedLanguageInfo {
  const navLang = (
    typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en'
  ).trim();
  const lower = navLang.toLowerCase();

  // Special dialect cases
  if (lower.startsWith('pt')) {
    return {
      rawCode: navLang,
      matchedCode: 'pt_BR',
      displayName: 'Português (Brasil)',
      nativeName: 'Português (Brasil)',
      flag: '🇧🇷',
      isBuiltin: true,
    };
  }
  if (lower === 'zh-tw' || lower === 'zh-hk' || lower === 'zh-mo') {
    return {
      rawCode: navLang,
      matchedCode: 'zh_TW',
      displayName: '繁體中文',
      nativeName: '繁體中文',
      flag: '🇹🇼',
      isBuiltin: true,
    };
  }
  if (lower.startsWith('zh')) {
    return {
      rawCode: navLang,
      matchedCode: 'zh',
      displayName: '简体中文',
      nativeName: '简体中文',
      flag: '🇨🇳',
      isBuiltin: true,
    };
  }

  // Check primary subtag (e.g. 'fr' from 'fr-FR', 'th' from 'th-TH')
  const primary = lower.split(/[-_]/)[0];

  // Match built-in
  const builtinMatch = BUILTIN_LANGUAGES.find(
    (b) => b.code.toLowerCase() === primary || b.code.toLowerCase() === lower
  );
  if (builtinMatch) {
    return {
      rawCode: navLang,
      matchedCode: builtinMatch.code,
      displayName: builtinMatch.name,
      nativeName: builtinMatch.name,
      flag: '🛡️',
      isBuiltin: true,
    };
  }

  // Match world catalog
  const worldMatch = WORLD_LANGUAGES.find(
    (c) => c.code.toLowerCase() === primary || c.code.toLowerCase() === lower
  );
  if (worldMatch) {
    const greeting = NATIVE_GREETINGS[primary];
    return {
      rawCode: navLang,
      matchedCode: worldMatch.code,
      displayName: worldMatch.nativeName,
      nativeName: worldMatch.nativeName,
      flag: worldMatch.flag,
      greeting,
      isBuiltin: false,
    };
  }

  // Generic fallback
  return {
    rawCode: navLang,
    matchedCode: primary,
    displayName: primary.toUpperCase(),
    nativeName: primary.toUpperCase(),
    flag: '🌐',
    isBuiltin: false,
  };
}

/**
 * Masks i18next interpolations ({{name}}, {count}) with placeholders like ___0___
 * to prevent Google Translate from altering variable names.
 */
export function maskVariables(texts: string[]): {
  maskedTexts: string[];
  varMaps: Array<Array<{ token: string; original: string }>>;
} {
  const varMaps: Array<Array<{ token: string; original: string }>> = [];

  const maskedTexts = texts.map((text) => {
    const mapForText: Array<{ token: string; original: string }> = [];
    let counter = 0;

    const masked = text.replace(/\{\{[^}]+\}\}|\{[a-zA-Z0-9_]+\}/g, (match) => {
      const token = `___${counter}___`;
      mapForText.push({ token, original: match });
      counter++;
      return token;
    });

    varMaps.push(mapForText);
    return masked;
  });

  return { maskedTexts, varMaps };
}

/**
 * Unmasks tokens back to their original {{var}} placeholders.
 * Resilient against both numeric tokens (___0___) and legacy/transliterated alphabetic tokens (___V0___ / ___В0___).
 */
export function unmaskVariables(
  text: string,
  varMap: Array<{ token: string; original: string }>
): string {
  let result = text;
  for (const { token, original } of varMap) {
    const numMatch = token.match(/\d+/);
    if (numMatch) {
      const num = numMatch[0];
      // Match ___0___, ___V0___, and Cyrillic transliteration ___В0___
      const tokenRegex = new RegExp(`___(?:V|В|в)?${num}___`, 'gi');
      result = result.replace(tokenRegex, original);
    } else {
      result = result.replace(new RegExp(token, 'gi'), original);
    }
  }
  return result;
}

/**
 * Parses Google Translate response containing indexed delimiter tokens.
 * Accepts modern language-neutral [[[n]]] delimiters, as well as legacy/Cyrillic <<<INDEX_n>>> / <<<ИНДЕКС_n>>>.
 */
export function parseIndexedResponse(
  fullText: string,
  expectedCount: number
): { results: string[]; matchedCount: number } {
  const results = new Array<string>(expectedCount).fill('');
  const regex =
    /(?:\[\[\[(\d+)\]\]\]|<<<(?:\s*INDEX|\s*ИНДЕКС)_(\d+)>>>)\s*([\s\S]*?)(?=(?:\[\[\[\d+\]\]\]|<<<(?:INDEX|ИНДЕКС)_\d+>>>|$))/gi;
  let match: RegExpExecArray | null;
  let matchedCount = 0;

  while ((match = regex.exec(fullText)) !== null) {
    const idxStr = match[1] || match[2];
    const idx = parseInt(idxStr, 10);
    const content = match[3].trim();
    if (idx >= 0 && idx < expectedCount) {
      results[idx] = content;
      matchedCount++;
    }
  }

  return { results, matchedCount };
}

/**
 * Translates a batch of texts to the target language via Google Translate.
 * Uses native Rust Tauri IPC to bypass WebView CORS and URL limits.
 */
export async function translateBatch(
  texts: string[],
  targetLang: string,
  signal?: AbortSignal
): Promise<string[]> {
  if (texts.length === 0) return [];

  // Protect variables
  const { maskedTexts, varMaps } = maskVariables(texts);

  // Prefix each item with its index using language-neutral brackets
  const indexed = maskedTexts.map((text, i) => `[[[${i}]]] ${text}`);
  const query = indexed.join('\n');

  let rawTranslated: string | null = null;

  // Use native Rust IPC if available (bypasses browser WebView CORS and URL limits)
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    try {
      const res = await tauriCommands.system.translateQuery(query, targetLang);
      if (typeof res === 'string' && res.trim().length > 0) {
        rawTranslated = res;
      }
    } catch (ipcErr) {
      console.warn('Rust translateQuery IPC error, falling back to fetch:', ipcErr);
    }
  }

  if (!rawTranslated) {
    // Multi-endpoint fallback matching Rust
    const encodedLang = encodeURIComponent(targetLang);
    const encodedQuery = encodeURIComponent(query);
    const endpoints = [
      `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=${encodedLang}&q=${encodedQuery}`,
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodedLang}&dt=t&q=${encodedQuery}`,
      `https://translate.google.com/translate_a/single?client=at&sl=en&tl=${encodedLang}&dt=t&q=${encodedQuery}`,
    ];

    let lastError: any = null;
    for (const url of endpoints) {
      if (signal?.aborted) throw new Error('Translation aborted');
      try {
        const response = await fetch(url, {
          method: 'GET',
          signal,
        });

        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && typeof data[0] === 'string') {
            rawTranslated = data[0];
            break;
          }
          if (Array.isArray(data) && Array.isArray(data[0])) {
            rawTranslated = (data[0] as Array<[string, string]>).map((chunk) => chunk[0]).join('');
            break;
          }
        } else {
          lastError = new Error(`Endpoint returned status ${response.status}`);
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (!rawTranslated) {
      throw lastError || new Error('All translation endpoints failed');
    }
  }

  const { results } = parseIndexedResponse(rawTranslated || '', texts.length);

  // Restore variables and fall back to original text if missing
  return results.map((res, i) => {
    const candidate = res && res.trim().length > 0 ? res.trim() : texts[i];
    return unmaskVariables(candidate, varMaps[i]);
  });
}

export type ProgressCallback = (
  percentage: number,
  currentDone: number,
  totalCount: number
) => void;

/**
 * Generates an entire custom language pack by translating all keys from en.json.
 * Automatically saves the pack to AppData/locales/<targetLang>.json.
 */
export async function generateLanguagePack(
  targetLang: string,
  langDisplayName: string,
  onProgress?: ProgressCallback,
  signal?: AbortSignal
): Promise<{ success: boolean; translatedCount: number; code: string }> {
  const masterRecord = en as Record<string, string>;
  const keys = Object.keys(masterRecord);
  const totalCount = keys.length;

  const cleanCode = targetLang
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '_');

  const translatedDictionary: Record<string, string> = {};
  const BATCH_SIZE = 25;
  let processedCount = 0;
  let failedBatches = 0;
  let totalBatches = 0;

  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    if (signal?.aborted) {
      throw new Error('Translation aborted by user');
    }

    totalBatches++;
    const chunkKeys = keys.slice(i, i + BATCH_SIZE);
    const chunkTexts = chunkKeys.map((k) => masterRecord[k]);

    let chunkResults: string[] | null = null;
    let lastError: any = null;

    // Retry loop (up to 3 attempts with exponential backoff)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        chunkResults = await translateBatch(chunkTexts, targetLang, signal);
        break;
      } catch (err) {
        lastError = err;
        if (signal?.aborted) throw err;
        await new Promise((resolve) => setTimeout(resolve, 500 * Math.pow(2, attempt)));
      }
    }

    if (!chunkResults) {
      failedBatches++;
      console.warn(`Batch failed at index ${i} after retries:`, lastError);
      chunkResults = chunkTexts;
    }

    for (let j = 0; j < chunkKeys.length; j++) {
      translatedDictionary[chunkKeys[j]] = chunkResults[j] || masterRecord[chunkKeys[j]];
    }

    processedCount += chunkKeys.length;
    const pct = Math.min(100, Math.round((processedCount / totalCount) * 100));
    onProgress?.(pct, processedCount, totalCount);

    if (i + BATCH_SIZE < keys.length) {
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
  }

  // Fail if more than 20% of batches failed
  if (failedBatches > 0 && failedBatches >= Math.max(1, Math.floor(totalBatches * 0.2))) {
    throw new Error('Translation failed. Please check your internet connection and try again.');
  }

  const saved = await saveCustomLanguagePack(
    cleanCode,
    langDisplayName.trim() || cleanCode.toUpperCase(),
    translatedDictionary
  );

  return {
    success: saved,
    translatedCount: processedCount,
    code: cleanCode,
  };
}

/**
 * Auto-fills missing or empty strings for an existing language in the Language Hub.
 */
export async function autoFillMissingKeys(
  targetLang: string,
  currentStrings: Record<string, string>,
  onProgress?: ProgressCallback,
  signal?: AbortSignal
): Promise<Record<string, string>> {
  const masterRecord = en as Record<string, string>;
  const keys = Object.keys(masterRecord);

  // Identify keys needing translation
  const missingKeys = keys.filter((key) => {
    const current = currentStrings[key];
    return !current || current.trim() === '' || current === masterRecord[key];
  });

  if (missingKeys.length === 0) {
    return { ...currentStrings };
  }

  const totalCount = missingKeys.length;
  let processedCount = 0;
  const updatedStrings = { ...currentStrings };
  const BATCH_SIZE = 25;

  for (let i = 0; i < missingKeys.length; i += BATCH_SIZE) {
    if (signal?.aborted) {
      throw new Error('Translation aborted by user');
    }

    const chunkKeys = missingKeys.slice(i, i + BATCH_SIZE);
    const chunkTexts = chunkKeys.map((k) => masterRecord[k]);

    let chunkResults: string[];
    try {
      chunkResults = await translateBatch(chunkTexts, targetLang, signal);
    } catch (err) {
      if (signal?.aborted) throw err;
      console.warn(`Batch auto-fill failed at index ${i}:`, err);
      chunkResults = chunkTexts;
    }

    for (let j = 0; j < chunkKeys.length; j++) {
      updatedStrings[chunkKeys[j]] = chunkResults[j] || masterRecord[chunkKeys[j]];
    }

    processedCount += chunkKeys.length;
    const pct = Math.min(100, Math.round((processedCount / totalCount) * 100));
    onProgress?.(pct, processedCount, totalCount);

    if (i + BATCH_SIZE < missingKeys.length) {
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
  }

  return updatedStrings;
}
