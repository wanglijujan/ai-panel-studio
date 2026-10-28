import { useEffect, useRef } from 'react';

type StreamEvent = { type: string; [k: string]: any };

export function useDiscussionStream(
  id: string | undefined,
  onEvent: (e: StreamEvent) => void
) {
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (!id) return;

    const es = new EventSource(`/api/discussions/${id}/stream`);

    es.onmessage = (ev) => {
      try {
        handler.current(JSON.parse(ev.data));
      } catch {
        /* 心跳等非 JSON 消息，忽略 */
      }
    };

    return () => es.close();
  }, [id]);
}
