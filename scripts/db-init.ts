import {
  getSqliteDatabasePath,
  initializeSqliteDatabase
} from "../src/lib/repositories/sqlite-store";

const stats = initializeSqliteDatabase();

console.log(`SQLite database initialized at ${getSqliteDatabasePath()}`);
console.table(stats);
