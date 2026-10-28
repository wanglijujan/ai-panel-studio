import 'dotenv/config';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

// 数据库文件放在 server/data/panel.db
const dbFile = process.env.DB_FILE ?? path.resolve(__dirname, '../../data/panel.db');
fs.mkdirSync(path.dirname(dbFile), { recursive: true });

export const db = new Database(dbFile);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 启动时自动执行建表脚本（IF NOT EXISTS，重复执行无副作用）
const schemaPath = path.resolve(__dirname, 'schema.sql');
db.exec(fs.readFileSync(schemaPath, 'utf-8'));

console.log(`[db] 已连接：${dbFile}`);
