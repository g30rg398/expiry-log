// Translations. Screens call t('key', { params }) instead of writing text directly.
// A value can be a plain string or a plural object { one, few, many, other }
// chosen with Intl.PluralRules (Russian/Ukrainian need one/few/many).

import en from './en.js';
import uk from './uk.js';
import ru from './ru.js';

const DICTS = { en, uk, ru };
const LOCALES = { en: 'en-US', uk: 'uk-UA', ru: 'ru-RU' };

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'uk', name: 'Українська' },
  { code: 'ru', name: 'Русский' },
];

let lang = 'en';

// First match among the phone's preferred languages, else English.
export function detectLang() {
  for (const l of navigator.languages || [navigator.language]) {
    const code = (l || '').slice(0, 2).toLowerCase();
    if (DICTS[code]) return code;
  }
  return 'en';
}

export function setLang(code) {
  lang = DICTS[code] ? code : 'en';
  document.documentElement.lang = lang;
  document.title = t('app.title');
}

export const getLang = () => lang;
export const locale = () => LOCALES[lang];

export function t(key, params = {}) {
  let v = DICTS[lang][key] ?? en[key] ?? key;
  if (typeof v === 'object') {
    const cat = new Intl.PluralRules(locale()).select(params.n ?? 0);
    v = v[cat] ?? v.other;
  }
  return v.replace(/\{(\w+)\}/g, (m, k) => (params[k] ?? m));
}
