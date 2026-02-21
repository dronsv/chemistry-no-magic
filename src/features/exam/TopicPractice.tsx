import { useState, useCallback, useMemo } from 'react';
import type { OgeTask } from '../../types/oge-task';
import type { OgeSolutionAlgorithm } from '../../types/oge-solution';
import type { UnifiedTopic } from '../../types/topic-mapping';
import type { ExamSystem } from '../../types/exam-system';
import type { SupportedLocale } from '../../types/i18n';
import { getExamSystemName } from '../../types/exam-system';
import { getTasksForTopic, getSystemsForTopic, deduplicateTasks, normalizeDifficulty } from '../../lib/topic-mapping';
import { saveCrossExamAttempt } from '../../lib/storage';
import { gradeOgeTask } from './oge-scoring';
import OgeAnswerRouter from './answers/OgeAnswerRouter';
import ChemText from '../../components/ChemText';
import * as m from '../../paraglide/messages.js';

type NormalizedDifficulty = 'basic' | 'advanced' | 'expert';

interface Props {
  topics: UnifiedTopic[];
  examSystems: ExamSystem[];
  /** Load tasks for a specific exam system (on demand). */
  loadSystemTasks: (systemId: string) => Promise<{ tasks: OgeTask[]; algorithms: OgeSolutionAlgorithm[] }>;
  locale: SupportedLocale;
  onBack: () => void;
}

type Phase = 'grid' | 'detail' | 'solve' | 'review';

function getTopicName(topic: UnifiedTopic, locale: SupportedLocale): string {
  const key = `name_${locale}` as keyof UnifiedTopic;
  return (topic[key] as string) ?? topic.name_en;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const DIFF_LABELS: Record<NormalizedDifficulty | 'all', () => string> = {
  all: m.exam_topic_filter_all,
  basic: m.exam_topic_filter_basic,
  advanced: m.exam_topic_filter_advanced,
  expert: m.exam_topic_filter_expert,
};

export default function TopicPractice({ topics, examSystems, loadSystemTasks, locale, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>('grid');
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedSystemId, setSelectedSystemId] = useState<string>('');
  const [diffFilter, setDiffFilter] = useState<NormalizedDifficulty | 'all'>('all');

  // Cached per-system data
  const [systemTasks, setSystemTasks] = useState<Record<string, OgeTask[]>>({});
  const [systemAlgos, setSystemAlgos] = useState<Record<string, OgeSolutionAlgorithm[]>>({});
  const [loading, setLoading] = useState(false);

  // Solve state
  const [currentTask, setCurrentTask] = useState<OgeTask | null>(null);
  const [answer, setAnswer] = useState('');
  const [gradeResult, setGradeResult] = useState<{ score: number; maxScore: number } | null>(null);
  const [showAlgorithm, setShowAlgorithm] = useState(false);

  const systemMap = useMemo(() => {
    const m = new Map<string, ExamSystem>();
    for (const s of examSystems) m.set(s.id, s);
    return m;
  }, [examSystems]);

  const selectedTopic = topics.find(t => t.topic_id === selectedTopicId) ?? null;

  // Systems that have competencies for the selected topic
  const topicSystems = useMemo(() => {
    if (!selectedTopicId) return [];
    return getSystemsForTopic(selectedTopicId, topics);
  }, [selectedTopicId, topics]);

  // Tasks for the currently selected topic + system, filtered by difficulty
  const filteredTasks = useMemo(() => {
    if (!selectedTopicId || !selectedSystemId) return [];
    const tasks = systemTasks[selectedSystemId] ?? [];
    const topicTasks = getTasksForTopic(selectedTopicId, selectedSystemId, tasks, topics);
    const deduped = deduplicateTasks(topicTasks);
    if (diffFilter === 'all') return deduped;
    return deduped.filter(t => normalizeDifficulty(t.difficulty) === diffFilter);
  }, [selectedTopicId, selectedSystemId, systemTasks, topics, diffFilter]);

  const ensureSystemLoaded = useCallback(async (systemId: string) => {
    if (systemTasks[systemId]) return;
    setLoading(true);
    try {
      const { tasks, algorithms } = await loadSystemTasks(systemId);
      setSystemTasks(prev => ({ ...prev, [systemId]: tasks }));
      setSystemAlgos(prev => ({ ...prev, [systemId]: algorithms }));
    } finally {
      setLoading(false);
    }
  }, [systemTasks, loadSystemTasks]);

  const handleTopicClick = useCallback(async (topicId: string) => {
    setSelectedTopicId(topicId);
    const systems = getSystemsForTopic(topicId, topics);
    const firstSystem = systems[0] ?? '';
    setSelectedSystemId(firstSystem);
    setDiffFilter('all');
    setPhase('detail');
    if (firstSystem) {
      await ensureSystemLoaded(firstSystem);
    }
  }, [topics, ensureSystemLoaded]);

  const handleSystemTab = useCallback(async (systemId: string) => {
    setSelectedSystemId(systemId);
    setDiffFilter('all');
    await ensureSystemLoaded(systemId);
  }, [ensureSystemLoaded]);

  const handleSolveTask = useCallback((task: OgeTask) => {
    setCurrentTask(task);
    setAnswer('');
    setGradeResult(null);
    setShowAlgorithm(false);
    setPhase('solve');
  }, []);

  const handleSolveRandom = useCallback(() => {
    if (filteredTasks.length === 0) return;
    handleSolveTask(pick(filteredTasks));
  }, [filteredTasks, handleSolveTask]);

  const handleCheck = useCallback(() => {
    if (!currentTask || !answer) return;
    const result = gradeOgeTask(currentTask, answer);
    setGradeResult(result);
    setPhase('review');
    // Save cross-exam attempt
    if (selectedTopicId && selectedSystemId) {
      saveCrossExamAttempt(selectedSystemId, selectedTopicId, result.score === result.maxScore);
    }
  }, [currentTask, answer, selectedTopicId, selectedSystemId]);

  const handleNextTask = useCallback(() => {
    if (filteredTasks.length === 0) return;
    handleSolveTask(pick(filteredTasks));
  }, [filteredTasks, handleSolveTask]);

  const handleBackToDetail = useCallback(() => {
    setCurrentTask(null);
    setAnswer('');
    setGradeResult(null);
    setShowAlgorithm(false);
    setPhase('detail');
  }, []);

  const handleBackToGrid = useCallback(() => {
    setSelectedTopicId(null);
    setSelectedSystemId('');
    setPhase('grid');
  }, []);

  // ---- Phase: Grid ----
  if (phase === 'grid') {
    return (
      <div className="oge-practice">
        <div className="oge-practice__header">
          <button type="button" className="btn" onClick={onBack}>
            {m.back()}
          </button>
          <h2 className="oge-practice__title">{m.exam_topic_title()}</h2>
        </div>
        <p className="oge-practice__intro">{m.exam_topic_desc()}</p>

        <div className="topic-grid">
          {topics.map(topic => {
            const systems = getSystemsForTopic(topic.topic_id, topics);
            return (
              <button
                key={topic.topic_id}
                type="button"
                className="topic-card"
                style={{ borderLeftColor: topic.color }}
                onClick={() => handleTopicClick(topic.topic_id)}
              >
                <span className="topic-card__name">{getTopicName(topic, locale)}</span>
                <span className="topic-card__desc">{topic.description_ru}</span>
                <span className="topic-card__systems">
                  {examSystems.map(sys => (
                    <span
                      key={sys.id}
                      className={`topic-card__flag ${systems.includes(sys.id) ? 'topic-card__flag--active' : ''}`}
                      title={getExamSystemName(sys, locale)}
                    >
                      {sys.flag}
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ---- Phase: Detail ----
  if (phase === 'detail' && selectedTopic) {
    const currentAlgo = currentTask
      ? (systemAlgos[selectedSystemId] ?? []).find(a => a.task_number === currentTask.task_number)
      : null;

    return (
      <div className="topic-detail">
        <div className="topic-detail__header">
          <button type="button" className="btn" onClick={handleBackToGrid}>
            {m.exam_topic_back_to_topics()}
          </button>
          <h2 className="topic-detail__title" style={{ color: selectedTopic.color }}>
            {getTopicName(selectedTopic, locale)}
          </h2>
        </div>
        <p className="topic-detail__desc">{selectedTopic.description_ru}</p>

        {/* System tabs */}
        <div className="topic-detail__tabs">
          {topicSystems.map(sysId => {
            const sys = systemMap.get(sysId);
            if (!sys) return null;
            const taskCount = systemTasks[sysId]
              ? getTasksForTopic(selectedTopicId!, sysId, systemTasks[sysId], topics).length
              : 0;
            return (
              <button
                key={sysId}
                type="button"
                className={`topic-detail__tab ${selectedSystemId === sysId ? 'topic-detail__tab--active' : ''}`}
                onClick={() => handleSystemTab(sysId)}
              >
                <span className="topic-detail__tab-flag">{sys.flag}</span>
                <span>{getExamSystemName(sys, locale)}</span>
                {systemTasks[sysId] && (
                  <span className="topic-detail__tab-count">({taskCount})</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Difficulty filter */}
        <div className="topic-detail__filters">
          {(['all', 'basic', 'advanced', 'expert'] as const).map(level => (
            <button
              key={level}
              type="button"
              className={`topic-detail__filter ${diffFilter === level ? 'topic-detail__filter--active' : ''}`}
              onClick={() => setDiffFilter(level)}
            >
              {DIFF_LABELS[level]()}
            </button>
          ))}
        </div>

        {loading && <p>{m.loading()}</p>}

        {!loading && filteredTasks.length === 0 && (
          <div className="topic-detail__empty">{m.exam_topic_no_tasks()}</div>
        )}

        {!loading && filteredTasks.length > 0 && (
          <>
            <button type="button" className="btn btn-primary" onClick={handleSolveRandom}>
              {m.exam_topic_solve_random()}
            </button>

            <div className="topic-detail__task-list">
              {filteredTasks.map(task => (
                <button
                  key={task.task_id}
                  type="button"
                  className="topic-detail__task-item"
                  onClick={() => handleSolveTask(task)}
                >
                  <span className="topic-detail__task-num">#{task.task_number}</span>
                  <span className="topic-detail__task-text">
                    <ChemText text={task.question_ru.slice(0, 80) + (task.question_ru.length > 80 ? '...' : '')} />
                  </span>
                  <span className={`oge-practice__diff oge-practice__diff--${task.difficulty}`}>
                    {task.difficulty}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // ---- Phase: Solve / Review ----
  if ((phase === 'solve' || phase === 'review') && currentTask) {
    const algo = (systemAlgos[selectedSystemId] ?? []).find(a => a.task_number === currentTask.task_number);
    const otherSystems = topicSystems.filter(s => s !== selectedSystemId);

    return (
      <div className="oge-practice">
        <div className="oge-practice__header">
          <button type="button" className="btn" onClick={handleBackToDetail}>
            {m.exam_topic_back_to_topics()}
          </button>
          <span className="oge-practice__task-info">
            {systemMap.get(selectedSystemId)?.flag} #{currentTask.task_number}
          </span>
        </div>

        <div className="oge-task">
          {currentTask.context_ru && (
            <div className="oge-task__context"><ChemText text={currentTask.context_ru} /></div>
          )}
          <div className="oge-task__question">
            <span className="oge-task__number">
              {m.exam_task_number({ number: String(currentTask.task_number) })}
            </span>
            <p className="oge-task__text"><ChemText text={currentTask.question_ru} /></p>
          </div>

          <div className="oge-task__answer">
            <OgeAnswerRouter
              task={currentTask}
              value={answer}
              onChange={setAnswer}
              disabled={phase === 'review'}
              showCorrect={phase === 'review'}
            />
          </div>

          {phase === 'solve' && (
            <div className="oge-task__actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCheck}
                disabled={!answer}
              >
                {m.oge_check()}
              </button>
              {algo && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowAlgorithm(v => !v)}
                >
                  {showAlgorithm ? m.oge_hide_hint() : m.oge_hint()}
                </button>
              )}
            </div>
          )}

          {phase === 'solve' && showAlgorithm && algo && (
            <div className="oge-task__algorithm">
              <h4 className="oge-task__algorithm-title">{m.oge_algorithm_title()}</h4>
              <ol className="oge-task__algorithm-steps">
                {algo.algorithm_ru.map((step, i) => (
                  <li key={i}><ChemText text={step} /></li>
                ))}
              </ol>
            </div>
          )}

          {phase === 'review' && gradeResult && (
            <div className="oge-task__result">
              <div className={`oge-task__score oge-task__score--${gradeResult.score === gradeResult.maxScore ? 'full' : gradeResult.score > 0 ? 'partial' : 'zero'}`}>
                {gradeResult.score} / {gradeResult.maxScore} {gradeResult.maxScore === 1 ? m.oge_score_unit_1() : m.oge_score_unit_2()}
              </div>
              <div className="oge-task__explanation">
                <ChemText text={currentTask.explanation_ru} />
              </div>

              {algo && (
                <details className="oge-task__algo-details">
                  <summary>{m.oge_algorithm_summary({ number: String(currentTask.task_number) })}</summary>
                  <div className="oge-task__algo-content">
                    <h4>{algo.title_ru}</h4>
                    <ol className="oge-task__algorithm-steps">
                      {algo.algorithm_ru.map((step, i) => (
                        <li key={i}><ChemText text={step} /></li>
                      ))}
                    </ol>
                    <h4>{m.oge_key_facts()}</h4>
                    <ul>
                      {algo.key_facts_ru.map((fact, i) => (
                        <li key={i}><ChemText text={fact} /></li>
                      ))}
                    </ul>
                    <h4>{m.oge_common_traps()}</h4>
                    <ul className="oge-task__traps">
                      {algo.common_traps_ru.map((trap, i) => (
                        <li key={i}><ChemText text={trap} /></li>
                      ))}
                    </ul>
                  </div>
                </details>
              )}

              {/* Cross-exam hint */}
              {otherSystems.length > 0 && (
                <div className="topic-detail__also">
                  {m.exam_topic_also_tested()}
                  <span className="topic-detail__also-flags">
                    {otherSystems.map(sysId => {
                      const sys = systemMap.get(sysId);
                      return sys ? (
                        <span key={sysId} title={getExamSystemName(sys, locale)}>{sys.flag}</span>
                      ) : null;
                    })}
                  </span>
                </div>
              )}

              <div className="oge-task__actions">
                <button type="button" className="btn btn-primary" onClick={handleNextTask}>
                  {m.oge_next_variant()}
                </button>
                <button type="button" className="btn" onClick={handleBackToDetail}>
                  {m.exam_topic_back_to_topics()}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
