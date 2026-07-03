import { OutcomePredictor } from './outcome-predictor';
import { DomainEvent } from '../automation/events';

const event: DomainEvent = { name: 'lead.created', tenantId: 't1', payload: { lead: { id: 'l1', estimatedValue: 500 } } };

describe('Control Layer — OutcomePredictor', () => {
  const predictor = new OutcomePredictor();

  it('SMS expects a customer reply (engagement, deferred)', () => {
    const o = predictor.predict({ type: 'SEND_SMS', params: {} }, event);
    expect(o.immediate).toBe(false);
    expect(o.signal).toBe('message.inbound');
    expect(o.valueType).toBe('ENGAGEMENT');
  });

  it('dispatch agent expects a job assignment (booked revenue)', () => {
    const o = predictor.predict({ type: 'TRIGGER_AGENT', params: { agent: 'dispatch' } }, event);
    expect(o.immediate).toBe(false);
    expect(o.signal).toBe('job.assigned');
    expect(o.valueType).toBe('REVENUE_BOOKED');
    expect(o.expectedValue).toBe(500); // pulled from the lead
  });

  it('invoice document expects payment (collected revenue)', () => {
    const o = predictor.predict({ type: 'GENERATE_DOCUMENT', params: { template: 'invoice' } }, event);
    expect(o.signal).toBe('payment.succeeded');
    expect(o.valueType).toBe('REVENUE_COLLECTED');
  });

  it('structural actions resolve immediately', () => {
    expect(predictor.predict({ type: 'UPDATE_STAGE', params: {} }, event).immediate).toBe(true);
    expect(predictor.predict({ type: 'CREATE_TASK', params: {} }, event).immediate).toBe(true);
  });
});
