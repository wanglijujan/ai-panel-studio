import { expect, test } from '@playwright/test';

const LIST = {
  ok: true,
  data: [
    {
      id: 'd1',
      topic: '远程办公是否会降低团队创新力',
      expertCount: 4,
      status: 'finished',
      createdAt: '2026-10-28T08:00:00.000Z',
      participantCount: 5,
    },
    {
      id: 'd2',
      topic: '大学是否应全面采用 AI 辅助教学',
      expertCount: 3,
      status: 'idle',
      createdAt: '2026-10-28T09:00:00.000Z',
      participantCount: 4,
    },
  ],
};

test('首页展示讨论列表与状态标签', async ({ page }) => {
  await page.route('**/api/discussions', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: LIST });
    }
    return route.continue();
  });

  await page.goto('/');

  await expect(page.getByText('AI Panel Studio')).toBeVisible();
  await expect(page.getByText('远程办公是否会降低团队创新力')).toBeVisible();
  await expect(page.getByText('大学是否应全面采用 AI 辅助教学')).toBeVisible();

  await expect(page.getByText('已结束')).toBeVisible();
  await expect(page.getByText('未开始')).toBeVisible();

  await expect(page.getByText('5 人参与', { exact: false })).toBeVisible();
});
