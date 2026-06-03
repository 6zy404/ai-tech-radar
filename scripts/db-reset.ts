import {
  getSqliteDatabasePath,
  resetSqliteDatabase
} from "../src/lib/repositories/sqlite-store";

if (process.env.ALLOW_DB_RESET !== "true") {
  console.log(
    "Refusing to reset SQLite data. Set ALLOW_DB_RESET=true for local development reset."
  );
  process.exit(0);
}

resetSqliteDatabase();

console.log(`SQLite database reset at ${getSqliteDatabasePath()}`);
