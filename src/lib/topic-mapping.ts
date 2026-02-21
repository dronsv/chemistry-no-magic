import type { UnifiedTopic, NormalizedDifficulty } from '../types/topic-mapping';
import type { OgeTask } from '../types/oge-task';

/** Normalize Cyrillic difficulty labels to English. */
export function normalizeDifficulty(raw: string): NormalizedDifficulty {
  switch (raw) {
    case 'Б': return 'basic';
    case 'П': return 'advanced';
    case 'В': return 'expert';
    default: return 'basic';
  }
}

/** Build a reverse index: competencyId → topicId[]. */
export function buildCompetencyToTopicIndex(
  topics: UnifiedTopic[],
): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const topic of topics) {
    for (const links of Object.values(topic.competency_map)) {
      for (const link of links) {
        const existing = index.get(link.id) ?? [];
        existing.push(topic.topic_id);
        index.set(link.id, existing);
      }
    }
  }
  return index;
}

/** Find which unified topics a task belongs to. */
export function findTaskTopics(
  task: OgeTask,
  compToTopicIndex: Map<string, string[]>,
): string[] {
  const topicSet = new Set<string>();
  for (const compId of task.competencies) {
    const topics = compToTopicIndex.get(compId);
    if (topics) {
      for (const t of topics) topicSet.add(t);
    }
  }
  return Array.from(topicSet);
}

/** Get tasks for a given topic from a specific exam system. */
export function getTasksForTopic(
  topicId: string,
  systemId: string,
  tasks: OgeTask[],
  topics: UnifiedTopic[],
): OgeTask[] {
  const topic = topics.find(t => t.topic_id === topicId);
  if (!topic) return [];

  const systemLinks = topic.competency_map[systemId];
  if (!systemLinks || systemLinks.length === 0) return [];

  const compIds = new Set(systemLinks.map(l => l.id));
  return tasks.filter(task =>
    task.competencies.some(c => compIds.has(c)),
  );
}

/** Filter out duplicate tasks by similarity_group, keeping first of each group. */
export function deduplicateTasks(tasks: OgeTask[]): OgeTask[] {
  const seen = new Set<string>();
  return tasks.filter(task => {
    if (!task.similarity_group) return true;
    if (seen.has(task.similarity_group)) return false;
    seen.add(task.similarity_group);
    return true;
  });
}

/** Get which exam system IDs have competencies for a given topic. */
export function getSystemsForTopic(
  topicId: string,
  topics: UnifiedTopic[],
): string[] {
  const topic = topics.find(t => t.topic_id === topicId);
  if (!topic) return [];
  return Object.entries(topic.competency_map)
    .filter(([, links]) => links.length > 0)
    .map(([systemId]) => systemId);
}
