import { HttpError } from './http.mjs';

const totalAnswered = row => Object.keys(JSON.parse(row.answers)).length;

export async function libraryEntry(db, passId) {
  const open = await db.first('SELECT id, answers FROM attempts WHERE pass_id = ? AND finished_at IS NULL', passId);
  const last = await db.first('SELECT id, result FROM attempts WHERE pass_id = ? AND finished_at IS NOT NULL ORDER BY finished_at DESC, rowid DESC LIMIT 1', passId);
  return {
    unlocked: true,
    open: open ? { id: open.id, answered: totalAnswered(open) } : null,
    last: last ? { id: last.id, name: JSON.parse(last.result).name } : null
  };
}

export async function startAttempt(db, passId) {
  return db.first(
    'INSERT INTO attempts (id, pass_id) VALUES (?, ?) ON CONFLICT(pass_id) WHERE finished_at IS NULL DO UPDATE SET pass_id = excluded.pass_id RETURNING id',
    crypto.randomUUID(), passId
  );
}

export async function ownedAttempt(db, passId, id) {
  const row = await db.first('SELECT id, answers, revision, result, finished_at FROM attempts WHERE id = ? AND pass_id = ?', id, passId);
  if (!row) throw new HttpError(404, '在当前兑换码下找不到这份答卷。');
  return row;
}

export function readAttempt(row, book) {
  if (row.finished_at) return { id: row.id, finished: true };
  const questions = book.questions.map(({ id, prompt, options }) => ({
    id, prompt, options: options.map(({ id, text }) => ({ id, text }))
  }));
  return { id: row.id, finished: false, revision: row.revision, answers: JSON.parse(row.answers), questions };
}

export async function saveAnswer(db, row, book, body) {
  if (row.finished_at) throw new HttpError(409, '答卷已经完成。');
  const question = book.questions.find(q => q.id === body.questionId);
  if (!question?.options.some(option => option.id === body.optionId)) throw new HttpError(400, '请选择当前题目的一个选项。');
  const answers = JSON.parse(row.answers);
  const next = book.questions.find(q => !Object.hasOwn(answers, q.id));
  if (!Object.hasOwn(answers, question.id) && next?.id !== question.id) throw new HttpError(400, '请先完成前面的题目。');
  if (answers[question.id] === body.optionId && body.revision === row.revision - 1) return { revision: row.revision, answers };
  if (!Number.isInteger(body.revision) || body.revision !== row.revision) throw new HttpError(409, '进度已经更新，请重新载入答卷。');
  answers[question.id] = body.optionId;
  const saved = await db.first(
    'UPDATE attempts SET answers = ?, revision = revision + 1 WHERE id = ? AND revision = ? AND finished_at IS NULL RETURNING revision',
    JSON.stringify(answers), row.id, row.revision
  );
  if (!saved) throw new HttpError(409, '进度已经更新，请重新载入答卷。');
  return { revision: saved.revision, answers };
}

export function score(book, answers) {
  const choices = book.questions.map(q => q.options.find(option => option.id === answers[q.id])?.profile);
  if (choices.some(key => !key)) throw new HttpError(409, '完成全部题目后即可查看结果。');
  const counts = Object.fromEntries(Object.keys(book.profiles).map(key => [key, 0]));
  for (const choice of choices) counts[choice]++;
  const highest = Math.max(...Object.values(counts));
  // A tie follows the earliest question that distinguishes the tied profiles.
  const winner = choices.find(key => counts[key] === highest);
  return {
    ...book.profiles[winner],
    count: choices.length,
    distribution: Object.entries(counts).map(([key, count]) => ({ name: book.profiles[key].name, count, selected: key === winner }))
  };
}

export async function finishAttempt(db, row, book, revision) {
  if (row.finished_at) return { id: row.id, finished: true };
  if (revision !== row.revision) throw new HttpError(409, '进度已经更新，请重新载入答卷。');
  const result = score(book, JSON.parse(row.answers));
  const saved = await db.first(
    'UPDATE attempts SET result = ?, finished_at = ?, revision = revision + 1 WHERE id = ? AND revision = ? AND finished_at IS NULL RETURNING id',
    JSON.stringify(result), new Date().toISOString(), row.id, row.revision
  );
  if (!saved) {
    const current = await db.first('SELECT finished_at FROM attempts WHERE id = ?', row.id);
    if (!current?.finished_at) throw new HttpError(409, '进度已经更新，请重新载入答卷。');
  }
  return { id: row.id, finished: true };
}
