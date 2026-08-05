export type NotificationCategory =
  | 'application'
  | 'hire'
  | 'contract'
  | 'message'
  | 'review'
  | 'system';

export const WORKFLOW_NOTIFICATION_TYPES = [
  'application_submitted',
  'application_received',
  'application_accepted',
  'application_rejected',
  'application_withdrawn',
  'application_shortlisted',
  'application_negotiation_started',
  'hire_request_received',
  'hire_request_sent',
  'hire_request_accepted',
  'hire_request_rejected',
  'hire_request_declined',
  'hire_proposal_submitted',
  'hire_proposal_responded',
  'negotiation_updated',
  'deal_confirmed',
  'contract_created',
  'contract_cancelled',
  'contract_cancellation',
  'work_started',
  'work_completed',
  'completion_confirmed',
  'contract_completion',
  'review_required',
  'review_available',
  'review_received',
] as const;

const WORKFLOW_NOTIFICATION_TYPE_SET = new Set<string>(WORKFLOW_NOTIFICATION_TYPES);

export function getNotificationCategory(type: string): NotificationCategory {
  if (type.startsWith('application_')) return 'application';
  if (type.startsWith('hire_') || type === 'negotiation_updated' || type === 'deal_confirmed') return 'hire';
  if (type.startsWith('contract_') || type === 'work_started' || type === 'work_completed' || type === 'completion_confirmed') return 'contract';
  if (type.startsWith('message_')) return 'message';
  if (type.startsWith('review_')) return 'review';
  return 'system';
}

export function isMessageNotificationType(type: string): boolean {
  return getNotificationCategory(type) === 'message';
}

export function isWorkflowNotificationType(type: string): boolean {
  if (isMessageNotificationType(type)) return false;
  if (WORKFLOW_NOTIFICATION_TYPE_SET.has(type)) return true;

  const category = getNotificationCategory(type);
  return category === 'application' || category === 'hire' || category === 'contract' || category === 'review';
}
