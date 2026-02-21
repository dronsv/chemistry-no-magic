import { useState, useEffect } from 'react';
import type { ExamSystem, ExamSystemMeta } from '../../types/exam-system';
import { getExamSystemName } from '../../types/exam-system';
import type { SupportedLocale } from '../../types/i18n';
import { localizeUrl } from '../../lib/i18n';
import { loadExamSystems, loadExamSystemMeta } from '../../lib/data-loader';
import * as m from '../../paraglide/messages.js';
import './exam.css';

interface Props {
  locale?: SupportedLocale;
}

export default function ExamComparison({ locale = 'ru' }: Props) {
  const [systems, setSystems] = useState<ExamSystem[] | null>(null);
  const [metas, setMetas] = useState<Record<string, ExamSystemMeta>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadExamSystems()
      .then(async (sysList) => {
        setSystems(sysList);
        const metaMap: Record<string, ExamSystemMeta> = {};
        const promises = sysList.map(async (sys) => {
          try {
            metaMap[sys.id] = await loadExamSystemMeta(sys.id);
          } catch { /* meta not available */ }
        });
        await Promise.all(promises);
        setMetas(metaMap);
      })
      .catch(err => setError(err instanceof Error ? err.message : m.error_loading_short()));
  }, []);

  if (error) {
    return <div className="exam-compare"><p className="exam-compare__error">{error}</p></div>;
  }

  if (!systems) {
    return <div className="exam-compare"><p>{m.loading()}</p></div>;
  }

  return (
    <div className="exam-compare">
      <a
        href={localizeUrl('/exam/', locale)}
        className="exam-compare__back"
      >
        {m.exam_back_to_exam()}
      </a>

      <h1 className="exam-compare__title">{m.exam_compare_title()}</h1>
      <p className="exam-compare__intro">{m.exam_compare_intro()}</p>

      <div className="exam-compare__table-wrap">
        <table className="exam-compare__table">
          <thead>
            <tr>
              <th></th>
              {systems.map(sys => (
                <th key={sys.id}>
                  <span className="exam-compare__flag">{sys.flag}</span>
                  <br />
                  {getExamSystemName(sys, locale)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="exam-compare__label">{m.exam_compare_country()}</td>
              {systems.map(sys => (
                <td key={sys.id}>{sys.country}</td>
              ))}
            </tr>
            <tr>
              <td className="exam-compare__label">{m.exam_compare_grade()}</td>
              {systems.map(sys => (
                <td key={sys.id}>{sys.grade}</td>
              ))}
            </tr>
            <tr>
              <td className="exam-compare__label">{m.exam_compare_duration()}</td>
              {systems.map(sys => (
                <td key={sys.id}>{m.exam_compare_minutes({ min: String(sys.duration_min) })}</td>
              ))}
            </tr>
            <tr>
              <td className="exam-compare__label">{m.exam_compare_max_score()}</td>
              {systems.map(sys => (
                <td key={sys.id}>{sys.max_score}</td>
              ))}
            </tr>
            <tr>
              <td className="exam-compare__label">{m.exam_compare_tasks()}</td>
              {systems.map(sys => (
                <td key={sys.id}>{sys.task_count}</td>
              ))}
            </tr>
            <tr>
              <td className="exam-compare__label">{m.exam_compare_sections()}</td>
              {systems.map(sys => (
                <td key={sys.id}>{sys.sections.join(', ')}</td>
              ))}
            </tr>
            <tr>
              <td className="exam-compare__label">{m.exam_compare_topics()}</td>
              {systems.map(sys => {
                const meta = metas[sys.id];
                return (
                  <td key={sys.id}>
                    {meta?.topics ? (
                      <ul className="exam-compare__topics">
                        {meta.topics.map((t, i) => <li key={i}>{t}</li>)}
                      </ul>
                    ) : '—'}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
