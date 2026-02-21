import type { OgeTask } from '../../types/oge-task';

interface GradeResult {
  score: number;
  maxScore: number;
}

function gradeSelect(task: OgeTask, userAnswer: string): GradeResult {
  const correct = task.correct_answer;
  const ordered = task.select_config?.ordered ?? false;

  if (ordered) {
    return { score: userAnswer === correct ? 1 : 0, maxScore: 1 };
  }

  const sortedUser = userAnswer.split('').sort().join('');
  const sortedCorrect = correct.split('').sort().join('');
  return { score: sortedUser === sortedCorrect ? 1 : 0, maxScore: 1 };
}

function gradeSequence(_task: OgeTask, userAnswer: string): GradeResult {
  return { score: userAnswer === _task.correct_answer ? 1 : 0, maxScore: 1 };
}

function gradeMatching(task: OgeTask, userAnswer: string): GradeResult {
  const correct = task.correct_answer;
  const maxScore = task.max_score; // typically 2

  let wrongCount = 0;
  for (let i = 0; i < correct.length; i++) {
    if (userAnswer[i] !== correct[i]) wrongCount++;
  }

  if (wrongCount === 0) return { score: maxScore, maxScore };
  if (wrongCount === 1) return { score: 1, maxScore };
  return { score: 0, maxScore };
}

function gradeNumeric(task: OgeTask, userAnswer: string): GradeResult {
  const precision = task.numeric_config?.precision ?? 'integer';
  const correct = task.correct_answer;

  if (precision === 'integer') {
    const userInt = parseInt(userAnswer, 10);
    const correctInt = parseInt(correct, 10);
    return { score: userInt === correctInt ? 1 : 0, maxScore: 1 };
  }

  // 'tenths' — compare with tolerance 0.05
  const userFloat = parseFloat(userAnswer);
  const correctFloat = parseFloat(correct);
  if (isNaN(userFloat) || isNaN(correctFloat)) {
    return { score: 0, maxScore: 1 };
  }
  const match = Math.abs(userFloat - correctFloat) < 0.05;
  return { score: match ? 1 : 0, maxScore: 1 };
}

function gradeInputCells(task: OgeTask, userAnswer: string): GradeResult {
  const correct = task.correct_answer;
  // Pipe-separated format: compare per-cell values with tolerance for numeric cells
  if (correct.includes('|')) {
    const correctParts = correct.split('|');
    const userParts = userAnswer.split('|');
    const allMatch = correctParts.every((c, i) => {
      const u = (userParts[i] ?? '').trim();
      const ct = c.trim();
      // Try numeric comparison with tolerance
      const cn = parseFloat(ct);
      const un = parseFloat(u);
      if (!isNaN(cn) && !isNaN(un)) {
        return Math.abs(cn - un) < 0.01 * Math.max(1, Math.abs(cn));
      }
      return u === ct;
    });
    return { score: allMatch ? task.max_score : 0, maxScore: task.max_score };
  }
  // Legacy concatenated single-char format
  return { score: userAnswer === correct ? 1 : 0, maxScore: 1 };
}

export function gradeOgeTask(task: OgeTask, userAnswer: string): GradeResult {
  switch (task.answer_type) {
    case 'select':
      return gradeSelect(task, userAnswer);
    case 'sequence':
      return gradeSequence(task, userAnswer);
    case 'matching':
      return gradeMatching(task, userAnswer);
    case 'numeric':
      return gradeNumeric(task, userAnswer);
    case 'input_cells':
      return gradeInputCells(task, userAnswer);
    case 'free_text':
      return { score: 0, maxScore: task.max_score };
  }
}
