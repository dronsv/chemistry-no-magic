import { cachedReadDataSrcSync, cachedReadJsonSync } from '../../lib/build-data-cache';
import { join } from 'node:path';
import type { Topic, TopicLocaleOverlay } from '../../types/topic';
import type { SupportedLocale } from '../../types/i18n';

export interface TopicDetailProps {
  topicId: string;
  locale: SupportedLocale;
}

function loadLocaleTopicOverlay(locale: SupportedLocale): TopicLocaleOverlay | null {
  if (locale === 'ru') return null;
  try {
    return cachedReadJsonSync<TopicLocaleOverlay>(
      join(process.cwd(), 'data-src', 'translations', locale, 'topics.json'),
    );
  } catch {
    return null;
  }
}

/** Factory for getStaticPaths — call once per route file, passing its section + locale. */
export function makeTopicPaths(section: string, locale: SupportedLocale) {
  const topics: Topic[] = cachedReadDataSrcSync('topics.json');
  const overlay = loadLocaleTopicOverlay(locale);
  return topics
    .filter(t => t.section === section)
    .map(topic => {
      const localeFields = overlay?.[topic.id];
      const slug = localeFields?.slug ?? topic.slug;
      return {
        params: { topicSlug: slug },
        props: { topicId: topic.id, locale } satisfies TopicDetailProps,
      };
    });
}
