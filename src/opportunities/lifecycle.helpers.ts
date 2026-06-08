import {
  getTargetStatus,
  type LifecycleAction,
  type OpportunityStatus,
} from '@/opportunities/types';
import { opportunityError } from '@/opportunities/errors';

export function assertValidTransitionForTest(
  action: LifecycleAction,
  from: OpportunityStatus,
): OpportunityStatus {
  try {
    return getTargetStatus(action, from);
  } catch {
    throw opportunityError('INVALID_STATUS', `Cannot ${action} opportunity in status ${from}`);
  }
}
