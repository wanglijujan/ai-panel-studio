import { expect, test } from '@playwright/test';

const DETAIL = {
  ok: true,
  data: {
    id: 'd1',
    topic: '远程办公是否会降低团队创新力',
    status: 'finished',
    createdAt: '2026-10-28T08:00:00.000Z',
    participants: [
      {
        id: 'p1',
        role: 'host',
        name: '林岚',
        title: '资深圆桌主持人',
        stance: '中立引导，负责收束分歧',
        color: '#E11D48',
        seatIndex: 0,
      },
      {
        id: 'p2',
        role: 'expert',
        name: '陈默',
        title: '组织行为学教授',
        stance: '远程削弱非正式交流',
        color: '#2563EB',
        seatIndex: 1,
      },
    ],
    agentStates: [
      { participantId: 'p1', status: 'waiting', focusMemo: '' },
      { participantId: 'p2', status: 'waiting', focusMemo: '' },
    ],
    messages: [
      {
        id: 'm1',
        round: 1,
        participantId: 'p1',
        act: 'question',
        content: '先说现状，各位团队远程办公后创新产出有变化吗？',
        name: '林岚',
        title: '资深圆桌主持人',
        color: '#E11D48',
        createdAt: '2026-10-28T08:00:10.000Z',
      },
      {
        id: 'm2',
        round: 1,
        participantId: 'p2',
        act: 'rebut',
        content: '我不同意这个判断，远程削弱了非正式碰撞，创新必然下降。',
        name: '陈默',
        title: '组织行为学教授',
        color: '#2563EB',
        createdAt: '2026-10-28T08:00:20.000Z',
      },
    ],
    consensus: [
      { id: 'c1', round: 2, type: 'consensus', content: '双方都承认沟通成本是关键变量' },
      { id: 'c2', round: 2, type: 'disagreement', content: '非正式交流能否被线上替代' },
    ],
    summary: {
      conclusions: ['远程办公的影响取决于任务类型'],
      disagreements: ['非正式交流是否不可替代'],
      nextSteps: ['按任务类型区分线上与线下场景'],
    },
  },
};

test('直播页三栏、发言、共识与总结均正确渲染', async ({ page }) => {
  await page.route('**/api/discussions/d1', (route) =>
    route.fulfill({ json: DETAIL })
  );

  await page.goto('/r/d1');

  // 三栏标题
  await expect(page.getByText('现场记录')).toBeVisible();
  await expect(page.getByText('实时共识', { exact: true })).toBeVisible();
  await expect(page.getByText('观点分歧')).toBeVisible();

  // 嘉宾小窗
  await expect(page.getByText('陈默').first()).toBeVisible();
  await expect(page.getByText('组织行为学教授').first()).toBeVisible();
  await expect(page.getByText('等待').first()).toBeVisible();

  // transcript + 动作标签
  await expect(page.getByText('我不同意这个判断')).toBeVisible();
  await expect(page.getByText('反驳', { exact: true })).toBeVisible();

  // 共识 / 分歧
  await expect(page.getByText('双方都承认沟通成本是关键变量')).toBeVisible();
  await expect(page.getByText('非正式交流能否被线上替代')).toBeVisible();

  // 总结区块
  await expect(page.getByText('讨论总结')).toBeVisible();
  await expect(page.getByText('远程办公的影响取决于任务类型')).toBeVisible();
  await expect(page.getByText('按任务类型区分线上与线下场景')).toBeVisible();

  // 状态标签
  await expect(page.getByText('已结束')).toBeVisible();
});
