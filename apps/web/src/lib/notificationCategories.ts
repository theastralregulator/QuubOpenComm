export type NotificationCategory =
  | 'application'
  | 'hire'
  | 'contract'
  | 'message'
  | 'review'
  | 'system';

export const WORKFLOW_NOTIFICATION_TYPES = [
  'application_received',
  'application_shortlisted',
  'application_negotiation_started',
  'hire_request_sent',
  'hire_request_accepted',
  'hire_request_declined',
  'hire_proposal_submitted',
  'hire_proposal_responded',
  'contract_created',
  'contract_cancellation',
  'contract_completion',
  'review_available',
  'review_received',
] as const;

const WORKFLOW_NOTIFICATION_TYPE_SET = new Set<string>(WORKFLOW_NOTIFICATION_TYPES);

export function getNotificationCategory(type: string): NotificationCategory {
  if (type.startsWith('application_')) return 'application';
  if (type.startsWith('hire_')) return 'hire';
  if (type.startsWith('contract_')) return 'contract';
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

export const WORKFLOW_NOTIFICATION_COUNT_FILTER =
  'type.like.application_%,type.like.hire_%,type.like.contract_%,type.like.review_%';
