import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pageNames } from '../shared/links.mjs';
import { unlockBooks } from './bank-crypto.mjs';

const dataDir = fileURLToPath(new URL('./data/', import.meta.url));
const migrations = new URL('../drizzle/', import.meta.url);

export function loadEnvelopes() {
  const directory = new URL('./content/', import.meta.url);
  return Object.fromEntries(Object.keys(pageNames).map(slug => [
    slug, JSON.parse(readFileSync(new URL(slug + '.enc.json', directory), 'utf8'))
  ]));
}

export function loadBooks() {
  return unlockBooks(loadEnvelopes(), process.env.QUIZ_BANK_KEY);
}

export function openDatabase(filename = process.env.DATABASE_PATH || resolve(dataDir, 'quiz.sqlite')) {
  if (filename !== ':memory:') mkdirSync(dirname(resolve(filename)), { recursive: true });
  const sqlite = new DatabaseSync(filename);
  sqlite.exec('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  sqlite.exec('BEGIN IMMEDIATE');
  try {
    sqlite.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY)');
    for (const name of readdirSync(migrations).filter(name => /^\d+_.+\.sql$/.test(name)).sort()) {
      if (sqlite.prepare('SELECT name FROM schema_migrations WHERE name = ?').get(name)) continue;
      sqlite.exec(readFileSync(new URL(name, migrations), 'utf8'));
      sqlite.prepare('INSERT INTO schema_migrations VALUES (?)').run(name);
    }
    sqlite.exec('COMMIT');
  } catch (error) {
    sqlite.exec('ROLLBACK');
    sqlite.close();
    throw error;
  }
  return {
    first: (sql, ...params) => sqlite.prepare(sql).get(...params),
    run: (sql, ...params) => sqlite.prepare(sql).run(...params),
    close: () => sqlite.close()
  };
}
