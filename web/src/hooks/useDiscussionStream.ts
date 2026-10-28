import { useEffect, useRef } from 'react';

type StreamEvent = { type: string; [k: string]: any };

// 直连后端，绕过 Vite 代理（代理会缓冲 SSE 长连接）
const SSE_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3001';

export function useDiscussionStream(
  id: string | undefined,
  onEvent: (e: StreamEvent) => void
) {
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (!id) return;

    const url = `${SSE_BASE}/api/discussions/${id}/stream`;
    console.log('[sse] 连接', url);

    const es = new EventSource(url);

    es.onopen = () => console.log('[sse] 已连接');
    es.onerror = () => console.warn('[sse] 出错，readyState =', es.readyState);

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'round_start') {
          console.log('[sse] round_start =', data.round);
        }
        handler.current(data);
      } catch {
        /* 心跳等非 JSON 消息 */
      }
    };

    return () => {
      console.log('[sse] 关闭连接');
      es.close();
    };
  }, [id]);
}
