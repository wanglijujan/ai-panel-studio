import { EventEmitter } from 'node:events';
import { db } from '../db';

const bus = new EventEmitter();
bus.setMaxListeners(0);

export type StoredEvent = { seq: number; type: string; payload: string };

/** 把 payload 和 type 拼成 SSE 的 data 内容 */
export function buildEnvelope(type: string, payloadJson: string): string {
  const obj = JSON.parse(payloadJson) as Record<string, unknown>;
  return JSON.stringify({ type, ...obj });
}

/** 写事件 + 广播给所有订阅该讨论的 SSE 连接 */
export function emitEvent(
  discussionId: string,
  type: string,
  payload: Record<string, unknown>
): number {
  const payloadJson = JSON.stringify(payload);
  const createdAt = new Date().toISOString();

  const info = db
    .prepare(
      `INSERT INTO events (discussion_id, type, payload, created_at) VALUES (?, ?, ?, ?)`
    )
    .run(discussionId, type, payloadJson, createdAt);

  const seq = Number(info.lastInsertRowid);
  bus.emit(discussionId, { seq, data: buildEnvelope(type, payloadJson) });
  return seq;
}

/** 订阅某个讨论的实时事件，返回取消订阅函数 */
export function onEvent(
  discussionId: string,
  cb: (e: { seq: number; data: string }) => void
): () => void {
  bus.on(discussionId, cb);
  return () => bus.off(discussionId, cb);
}

/** 断线重连补发：取 seq 之后的所有事件 */
export function eventsSince(discussionId: string, seq: number): StoredEvent[] {
  return db
    .prepare(
      `SELECT seq, type, payload FROM events
       WHERE discussion_id = ? AND seq > ? ORDER BY seq ASC`
    )
    .all(discussionId, seq) as StoredEvent[];
}
