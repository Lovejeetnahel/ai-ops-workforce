import { matches, evalCondition, interpolate, resolvePath } from './rule-engine';

describe('rule-engine (automation core)', () => {
  it('resolvePath reads nested dot-paths', () => {
    expect(resolvePath({ lead: { urgency: 'EMERGENCY' } }, 'lead.urgency')).toBe('EMERGENCY');
    expect(resolvePath({ a: 1 }, 'a.b.c')).toBeUndefined();
  });

  it('evalCondition supports operators', () => {
    expect(evalCondition({ path: 'x', op: 'eq', value: 1 }, { x: 1 })).toBe(true);
    expect(evalCondition({ path: 'x', op: 'neq', value: 1 }, { x: 2 })).toBe(true);
    expect(evalCondition({ path: 'x', op: 'gt', value: 0 }, { x: 5 })).toBe(true);
    expect(evalCondition({ path: 'x', op: 'in', value: ['a', 'b'] }, { x: 'b' })).toBe(true);
    expect(evalCondition({ path: 'x', op: 'exists' }, { x: 0 })).toBe(true);
    expect(evalCondition({ path: 'x', op: 'contains', value: 'oo' }, { x: 'food' })).toBe(true);
  });

  it('matches requires ALL conditions (AND), empty = always', () => {
    expect(matches([], {})).toBe(true);
    expect(matches([{ path: 'u', op: 'eq', value: 'EMERGENCY' }], { u: 'EMERGENCY' })).toBe(true);
    expect(matches([{ path: 'u', op: 'eq', value: 'EMERGENCY' }, { path: 'v', op: 'gt', value: 10 }], { u: 'EMERGENCY', v: 5 })).toBe(false);
  });

  it('interpolate fills {{tokens}} from payload', () => {
    expect(interpolate('Hi {{contact.name}}, your {{lead.serviceType}} is booked', { contact: { name: 'Sam' }, lead: { serviceType: 'HVAC' } })).toBe('Hi Sam, your HVAC is booked');
    expect(interpolate('Missing: {{nope}}', {})).toBe('Missing: ');
  });
});
