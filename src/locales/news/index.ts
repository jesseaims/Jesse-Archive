import { getLanguage } from '../../i18n';
import type { Lang } from '../../i18n';
import type { NewsEntry, NewsTranslations } from '../../news-changelog';
import de from './de';
import en from './en';
import es from './es';
import fr from './fr';
import ja from './ja';
import ko from './ko';
import pt from './pt';
import ru from './ru';
import zh from './zh';

const NEWS: Record<Exclude<Lang, 'it'>, NewsTranslations> = { en, es, fr, de, pt, ru, zh, ja, ko };

/** Title and description of a News entry in the current language (Italian fallback). */
export function localizedNews(entry: NewsEntry): { title: string; description: string } {
  const lang = getLanguage();
  const found = lang === 'it' ? undefined : NEWS[lang]?.[entry.id];
  return found
    ? { title: found[0], description: found[1] }
    : { title: entry.title, description: entry.description };
}
