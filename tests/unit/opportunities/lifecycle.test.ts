import { describe, it, expect } from 'vitest';
import { assertValidTransitionForTest } from '@/opportunities/lifecycle.helpers';
import { getTargetStatus, TRANSITIONS } from '@/opportunities/types';

describe('opportunity lifecycle transitions', () => {
  it('allows draft to pending_approval on submit', () => {
    expect(assertValidTransitionForTest('submit', 'draft')).toBe('pending_approval');
  });

  it('allows pending_approval to live on approve', () => {
    expect(assertValidTransitionForTest('approve', 'pending_approval')).toBe('live');
  });

  it('allows pending_approval to draft on reject', () => {
    expect(assertValidTransitionForTest('reject', 'pending_approval')).toBe('draft');
  });

  it('throws INVALID_STATUS for invalid submit from live', () => {
    expect(() => assertValidTransitionForTest('submit', 'live')).toThrowError(
      expect.objectContaining({ extensions: { code: 'INVALID_STATUS' } }),
    );
  });

  it('throws INVALID_STATUS for pause from draft', () => {
    expect(() => assertValidTransitionForTest('pause', 'draft')).toThrowError(
      expect.objectContaining({ extensions: { code: 'INVALID_STATUS' } }),
    );
  });

  it('defines complete transitions from live, paused, and closed', () => {
    expect(getTargetStatus('complete', 'live')).toBe('completed');
    expect(getTargetStatus('complete', 'paused')).toBe('completed');
    expect(getTargetStatus('complete', 'closed')).toBe('completed');
  });

  it('defines cancel transitions for draft through paused', () => {
    expect(TRANSITIONS.cancel.draft).toContain('cancelled');
    expect(TRANSITIONS.cancel.live).toContain('cancelled');
    expect(TRANSITIONS.cancel.paused).toContain('cancelled');
  });
});
