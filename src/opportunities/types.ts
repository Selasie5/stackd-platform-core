export type OpportunityType = 'UGC_ORDER' | 'CPM_DEAL' | 'CONTEST';

export type OpportunityStatus =
  | 'draft'
  | 'pending_approval'
  | 'live'
  | 'paused'
  | 'closed'
  | 'cancelled'
  | 'completed';

export type ReviewDecision = 'approved' | 'rejected';

export type LifecycleAction =
  | 'submit'
  | 'reject'
  | 'approve'
  | 'pause'
  | 'resume'
  | 'close'
  | 'cancel'
  | 'complete';

export interface ReferenceLinkInput {
  url: string;
  label?: string;
}

export interface ContestReferenceLinkInput extends ReferenceLinkInput {
  isInspiration?: boolean;
}

export interface ContestRewardInput {
  placement: number;
  label?: string;
  amount: string;
  currency: 'NGN' | 'GHS' | 'USD';
}

export interface WalletReference {
  referenceType: 'ugc_order' | 'cpm_deal' | 'contest' | 'wallet_topup' | 'withdrawal';
  referenceId: string;
  description: string;
}

export const OPPORTUNITY_REFERENCE_TYPE: Record<OpportunityType, WalletReference['referenceType']> = {
  UGC_ORDER: 'ugc_order',
  CPM_DEAL: 'cpm_deal',
  CONTEST: 'contest',
};

export const LAUNCH_NOTIFICATION_TYPE: Record<
  OpportunityType,
  'new_ugc_order_launched' | 'new_cpm_deal_launched' | 'new_contest_launched'
> = {
  UGC_ORDER: 'new_ugc_order_launched',
  CPM_DEAL: 'new_cpm_deal_launched',
  CONTEST: 'new_contest_launched',
};

export const TRANSITIONS: Record<LifecycleAction, Partial<Record<OpportunityStatus, OpportunityStatus[]>>> = {
  submit: { draft: ['pending_approval'] },
  reject: { pending_approval: ['draft'] },
  approve: { pending_approval: ['live'] },
  pause: { live: ['paused'] },
  resume: { paused: ['live'] },
  close: { live: ['closed'], paused: ['closed'] },
  complete: { live: ['completed'], paused: ['completed'], closed: ['completed'] },
  cancel: {
    draft: ['cancelled'],
    pending_approval: ['cancelled'],
    live: ['cancelled'],
    paused: ['cancelled'],
  },
};

export function assertValidTransition(
  action: LifecycleAction,
  from: OpportunityStatus,
  to: OpportunityStatus,
): void {
  const allowed = TRANSITIONS[action][from];
  if (!allowed?.includes(to)) {
    throw new Error(`Invalid transition: ${action} from ${from} to ${to}`);
  }
}

export function getTargetStatus(action: LifecycleAction, from: OpportunityStatus): OpportunityStatus {
  const allowed = TRANSITIONS[action][from];
  if (!allowed || allowed.length !== 1) {
    throw new Error(`Invalid transition action ${action} from status ${from}`);
  }
  return allowed[0]!;
}

export function isReservedStatus(status: OpportunityStatus): boolean {
  return ['live', 'paused', 'closed'].includes(status);
}
