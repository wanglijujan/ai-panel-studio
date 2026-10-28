# API 契约

- Base URL：`http://localhost:3001`
- 除 SSE 端点外，均为 `application/json`
- 无鉴权（本地应用）

## 通用响应

```json
{ "ok": true, "data": {} }
```

```json
{ "ok": false, "error": { "code": "NOT_FOUND", "message": "讨论不存在" } }
```

| 状态码 | code | 含义 |
|---|---|---|
| 400 | `BAD_REQUEST` | 参数不合法 |
| 404 | `NOT_FOUND` | 讨论不存在 |
| 409 | `CONFLICT` | 状态不允许 |
| 502 | `LLM_FAILED` | 模型重试后仍失败 |

## 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/discussions` | 讨论列表（含状态、人数） |
| POST | `/api/discussions` | 创建讨论并生成阵容 `{ topic, expertCount }` |
| GET | `/api/discussions/:id` | 详情：嘉宾、状态、transcript、共识、总结 |
| POST | `/api/discussions/:id/start` | 开始直播，返回 202，后续走 SSE |
| GET | `/api/discussions/:id/stream` | **SSE 事件流**（支持 `Last-Event-ID`） |
| POST | `/api/discussions/:id/end` | 结束并返回 JSON 总结 |
| DELETE | `/api/discussions/:id` | 删除讨论（可选） |

## 创建讨论

请求：

```json
{ "topic": "远程办公是否会降低团队创新力", "expertCount": 4 }
```

响应 `201`：

```json
{
  "ok": true,
  "data": {
    "id": "d_8f3a",
    "status": "idle",
    "participants": [
      { "id": "p_1", "role": "host", "name": "林岚", "title": "资深主持人",
        "stance": "中立引导", "color": "#E11D48", "seatIndex": 0 }
    ]
  }
}
```

约束：`participants` 数量 = `expertCount + 1`；`color` 互不重复。

## SSE 事件类型

| type | 触发时机 | payload |
|---|---|---|
| `round_start` | 每轮开始 | `{ round, question }` |
| `speech` | 发言完成 | `{ message: { id, round, participantId, name, title, color, act, content } }` |
| `agent_status` | 专家状态变化 | `{ participantId, status, focusMemo }` |
| `consensus_update` | 提取到共识/分歧 | `{ items: [...] }` |
| `summary` | 讨论结束 | `{ summary: { conclusions, disagreements, nextSteps } }` |
| `error` | 非致命错误 | `{ round, message }` |
| `done` | 流程结束 | `{ status: "finished" }` |

示例：

```
id: 42
data: {"type":"speech","message":{"id":"m_7","round":2,"participantId":"p_3","name":"苏青","title":"分布式团队顾问","color":"#059669","act":"rebut","content":"我不同意…"}}
```

> 前端 transcript **只消费 `speech`**；`agent_status` 只喂右侧小窗；
> `act` 仅用于样式区分，不写进正文。

## 环境变量

| 变量 | 说明 |
|---|---|
| `DEEPSEEK_API_KEY` | 仅服务端读取，禁止下发前端 |
| `DEEPSEEK_BASE_URL` | 默认 `https://api.deepseek.com` |
| `PORT` | 默认 `3001` |
