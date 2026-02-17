import type { OgeTask } from '../../../types/oge-task';
import SelectAnswer from './SelectAnswer';
import MatchingAnswer from './MatchingAnswer';
import SequenceAnswer from './SequenceAnswer';
import InputCellsAnswer from './InputCellsAnswer';
import NumericAnswer from './NumericAnswer';

interface Props {
  task: OgeTask;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  showCorrect?: boolean;
}

export default function OgeAnswerRouter({
  task, value, onChange, disabled, showCorrect,
}: Props) {
  const correctAnswer = (disabled && showCorrect) ? task.correct_answer : undefined;

  switch (task.answer_type) {
    case 'select':
      return (
        <SelectAnswer
          options={task.options ?? []}
          count={task.select_config?.count ?? 2}
          ordered={task.select_config?.ordered ?? false}
          value={value}
          onChange={onChange}
          disabled={disabled}
          correct_answer={correctAnswer}
        />
      );

    case 'matching':
      return (
        <MatchingAnswer
          leftItems={task.left_items ?? []}
          options={task.options ?? []}
          value={value}
          onChange={onChange}
          disabled={disabled}
          correct_answer={correctAnswer}
        />
      );

    case 'sequence':
      return (
        <SequenceAnswer
          items={task.items ?? []}
          value={value}
          onChange={onChange}
          disabled={disabled}
          correct_answer={correctAnswer}
        />
      );

    case 'input_cells':
      return (
        <InputCellsAnswer
          labels={task.input_labels ?? []}
          value={value}
          onChange={onChange}
          disabled={disabled}
          correct_answer={correctAnswer}
        />
      );

    case 'numeric':
      return (
        <NumericAnswer
          precision={task.numeric_config?.precision ?? 'integer'}
          value={value}
          onChange={onChange}
          disabled={disabled}
          correct_answer={correctAnswer}
        />
      );

    case 'free_text':
      return (
        <div className="oge-freetext">
          <textarea
            className="oge-freetext__input"
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            rows={6}
            placeholder="Запишите развёрнутый ответ..."
          />
          {disabled && (
            <div className="oge-freetext__note">
              Задания с развёрнутым ответом проверяются вручную.
            </div>
          )}
        </div>
      );
  }
}
