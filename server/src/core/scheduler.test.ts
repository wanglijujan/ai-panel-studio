import { describe, expect, it } from 'vitest';
import { validatePlan, type Expert, type PlanContext, type Speech } from './scheduler';

const experts: Expert[] = [
  { id: 'e1', name: '甲', title: '教授', stance: '支持' },
  { id: 'e2', name: '乙', title: '总监', stance: '反对' },
  { id: 'e3', name: '丙', title: '工程师', stance: '有条件支持' },
];

function makeCtx(over: Partial<PlanContext> = {}): PlanContext {
  return {
    topic: '测试议题',
    round: 2,
    question: '你怎么看？',
    experts,
    recentMessages: [],
    previousSpeakerIds: [],
    mustRebutt: false,
    ...over,
  };
}

const ok = (id: string, act: Speech['act'] = 'supplement'): Speech => ({
  participantId: id,
  act,
  content: '这是一段足够长的发言内容，用来通过长度校验。',
});

describe('validatePlan 硬性校验', () => {
  it('合法输出应返回空错误列表', () => {
    expect(validatePlan([ok('e1'), ok('e2', 'rebut')], makeCtx())).toEqual([]);
  });

  it('发言人数超过 2 人应报错', () => {
    const errors = validatePlan([ok('e1'), ok('e2'), ok('e3')], makeCtx());
    expect(errors.some((e) => e.includes('1~2'))).toBe(true);
  });

  it('participantId 不在候选名单应报错', () => {
    const errors = validatePlan([ok('e9')], makeCtx());
    expect(errors.some((e) => e.includes('不在候选名单'))).toBe(true);
  });

  it('与上一轮发言者完全相同应报错', () => {
    const errors = validatePlan([ok('e1')], makeCtx({ previousSpeakerIds: ['e1'] }));
    expect(errors.some((e) => e.includes('上一轮'))).toBe(true);
  });

  it('需要反驳但没人 rebut 应报错', () => {
    const errors = validatePlan([ok('e1'), ok('e2')], makeCtx({ mustRebutt: true }));
    expect(errors.some((e) => e.includes('refut') || e.includes('反驳'))).toBe(true);
  });

  it('发言过短应报错', () => {
    const short: Speech = { participantId: 'e1', act: 'supplement', content: '太短' };
    const errors = validatePlan([short], makeCtx());
    expect(errors.some((e) => e.includes('过短'))).toBe(true);
  });

  it('同一轮重复同一人应报错', () => {
    const errors = validatePlan([ok('e1'), ok('e1')], makeCtx());
    expect(errors.some((e) => e.includes('重复'))).toBe(true);
  });
});
