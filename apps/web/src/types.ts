export interface Job {
  id: string;
  title: string;
  company: string;
  companyLogo: string;
  salary: string;
  location: string;
  category: string;
  description: string;
  requirements: string[];
  verified: boolean;
  bookmarked: boolean;
  applied: boolean;
  datePosted: string;
  applicationDeadline?: string;
  jobType?: string;
  posted_by?: string;
  is_active?: boolean;
  workers_needed?: number;
  filled_positions?: number;
  status?: 'active' | 'closed' | 'archived';
  closed_at?: string | null;
  archive_after?: string | null;
  created_at?: string;
  country?: string;
  country_code?: string;
  state?: string;
  state_code?: string;
  district?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  locationData?: any;
}

export interface Worker {
  id: string;
  name: string;
  photo: string;
  title: string;
  experience: number; // years
  rating: number;
  availability: "Available Now" | "Busy" | "On Vacation" | string;
  location: string;
  bio: string;
  skills: string[];
  completedWorks: number;
  hourlyRate: number;
  verified: boolean;
  bookmarked?: boolean;
}

export interface DbMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string | null;
  text: string;
  message_type?: 'text' | 'image' | 'video' | 'audio' | 'document' | string;
  unread: boolean;
  role: string;
  created_at: string;
  read_at: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  reply_to_message_id?: string | null;
}

export interface DbMessageReaction {
  id: string;
  message_id: string;
  conversation_id: string;
  user_id: string;
  emoji: '👍' | '❤️' | '😂' | '😮' | '😢' | '🙏' | string;
  created_at: string;
  updated_at: string;
}

export interface SharedMediaItem {
  media_id: string;
  message_id: string;
  conversation_id: string;
  sender_id: string;
  media_type: 'image' | 'video' | 'audio' | 'document' | string;
  mime_type: string;
  file_size_bytes: number;
  duration_ms?: number | null;
  width?: number | null;
  height?: number | null;
  original_filename?: string | null;
  status: string;
  created_at: string;
  message_deleted_at?: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  createdAt: string;
  unread: boolean;
  role: 'user' | 'assistant' | string;
}

export interface JobApplication {
  id: string;
  jobId: string;
  jobTitle: string;
  applicantId: string;
  applicantName: string;
  applicantPhoto: string;
  applicantTitle: string;
  applicantSkills: string[];
  applicantLocation: string;
  applicantRating: number;
  applicantExperience: number;
  applicantAvailability: string;
  ownerId: string;
  ownerName: string;
  applicationNote: string;
  status: 'Pending' | 'Shortlisted' | 'Approved' | 'Rejected' | 'Withdrawn';
  createdAt: string;
  updatedAt: string;
  bid?: string;
}

export interface ApplicationMessage {
  id: string;
  applicationId: string;
  senderId: string; // "user" (applicant) or "owner" (job owner)
  senderName: string;
  senderAvatar: string;
  message: string;
  attachmentUrl?: string;
  createdAt: string;
}

export interface DbConversation {
  id: string;
  job_id: string;
  application_id: string;
  creator_id: string;
  member_id: string;
  last_message_text: string | null;
  last_message_time: string | null;
  unread_count: number;
  created_at: string;
  conversation_type?: 'application' | 'worker_direct' | 'work_contract' | 'direct';
  work_contract_id?: string;
  archive_scheduled_at?: string | null;
  archived_at?: string | null;
  archive_reason?: string | null;
}

export interface ConversationViewModel {
  id: string;
  jobId: string;
  applicationId: string;
  creatorId: string;
  memberId: string;
  otherParticipantId: string;
  otherParticipantName: string;
  otherParticipantAvatar: string;
  otherParticipantTitle: string; // Job title
  lastMessageText: string;
  lastMessageTime: string;
  lastMessageAt: string;
  unreadCount: number;
  createdAt: string;
  conversationType?: 'application' | 'worker_direct' | 'work_contract' | 'direct';
  workContractId?: string;
  archiveScheduledAt?: string | null;
  archivedAt?: string | null;
  archiveReason?: string | null;
}

export interface Conversation {
  id: string;
  jobId?: string;
  applicationId?: string;
  memberName: string;
  memberAvatar: string;
  memberTitle: string;
  memberId: string;
  lastMessageText: string;
  lastMessageTime: string;
  unreadCount: number;
}

export interface Work {
  id: string;
  title: string;
  counterparty: string;
  start: string;
  deadline: string;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';
  progress: number;
  rating: number;
}

export interface Notification {
  id: string;
  type: 'application' | 'message' | 'hire' | 'system';
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
}

export interface Activity {
  id: string;
  type: 'apply' | 'post' | 'message' | 'hire' | 'complete';
  title: string;
  status: string;
  statusType: 'success' | 'pending' | 'neutral';
  timestamp: string;
}

export interface Category {
  name: string;
  icon: string; // Lucide icon name
  count: number;
  color: string; // CSS custom color style
}

export type HiringRequestWorkflowStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'negotiating'
  | 'proposal_pending'
  | 'changes_requested'
  | 'confirmed'
  | 'cancelled'
  | 'expired'
  | 'completed';

export interface NegotiationRoom {
  id: string;
  hiring_request_id?: string | null;
  job_application_id?: string | null;
  client_id: string;
  worker_id: string;
  status: 'active' | 'locked' | 'cancelled' | 'completed';
  last_message_at: string;
  locked_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface NegotiationMessage {
  id: string;
  negotiation_room_id: string;
  sender_id: string;
  message_type: 'text' | 'system' | 'proposal_event' | 'status_event';
  text: string;
  metadata?: any;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
}

export type DealProposalResponse = 'pending' | 'accepted' | 'rejected' | 'changes_requested';

export interface DealProposal {
  id: string;
  hiring_request_id?: string | null;
  job_application_id?: string | null;
  negotiation_room_id: string;
  version_number: number;
  proposed_by: string;
  work_title: string;
  work_description: string;
  final_price: number;
  payment_type: 'hourly' | 'fixed' | 'monthly' | 'daily' | 'project';
  work_date?: string | null;
  start_time?: string | null;
  duration?: string | null;
  location?: string | null;
  additional_terms?: string | null;
  proposal_status: 'pending' | 'changes_requested' | 'rejected' | 'superseded' | 'accepted';
  client_response: DealProposalResponse;
  worker_response: DealProposalResponse;
  client_responded_at?: string | null;
  worker_responded_at?: string | null;
  superseded_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkContract {
  id: string;
  hiring_request_id?: string | null;
  job_application_id?: string | null;
  deal_proposal_id: string;
  client_id: string;
  worker_id: string;
  work_title: string;
  work_description: string;
  final_price: number;
  payment_type: string;
  work_date?: string | null;
  start_time?: string | null;
  duration?: string | null;
  location?: string | null;
  additional_terms?: string | null;
  status: 'active' | 'cancellation_requested' | 'cancelled' | 'completion_requested' | 'completed' | 'disputed';
  permanent_conversation_id?: string | null;
  confirmed_at: string;
  completed_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;

  // Mutual Cancellation fields
  cancellation_requested_by?: string | null;
  cancellation_reason?: string | null;
  cancellation_requested_at?: string | null;
  cancellation_client_response?: 'pending' | 'accepted' | 'rejected' | null;
  cancellation_worker_response?: 'pending' | 'accepted' | 'rejected' | null;
  cancellation_client_responded_at?: string | null;
  cancellation_worker_responded_at?: string | null;
  cancellation_rejection_reason?: string | null;

  // Mutual Completion fields
  completion_requested_by?: string | null;
  completion_note?: string | null;
  completion_requested_at?: string | null;
  completion_client_response?: 'pending' | 'accepted' | 'rejected' | null;
  completion_worker_response?: 'pending' | 'accepted' | 'rejected' | null;
  completion_client_responded_at?: string | null;
  completion_worker_responded_at?: string | null;
  completion_rejection_reason?: string | null;
}

export interface HireWorkflowDetails {
  hiring_request: any;
  negotiation_room: NegotiationRoom | null;
  active_proposal: DealProposal | null;
  work_contract: WorkContract | null;
  negotiation_messages: NegotiationMessage[];
  deal_proposals_history: DealProposal[];
}

export interface ApplicationWorkflowDetails {
  job_application: any;
  job: any;
  applicant_profile: any;
  employer_profile: any;
  negotiation_room: NegotiationRoom | null;
  active_proposal: DealProposal | null;
  work_contract: WorkContract | null;
  negotiation_messages: NegotiationMessage[];
  deal_proposals_history: DealProposal[];
}

export interface ContractReview {
  id: string;
  contract_id: string;
  work_title?: string;
  reviewer_id: string;
  reviewer_name?: string;
  reviewer_avatar_url?: string | null;
  reviewee_id: string;
  reviewer_role: 'client' | 'worker';
  rating: number;
  title?: string | null;
  comment?: string | null;
  communication_rating?: number | null;
  work_quality_rating?: number | null;
  professionalism_rating?: number | null;
  punctuality_rating?: number | null;
  would_recommend?: boolean;
  is_public: boolean;
  created_at: string;
  updated_at?: string;
}

export interface ProfileRatingSummary {
  profile_id: string;
  average_rating: number;
  total_reviews: number;
  completed_works: number;
  recommendation_percentage: number;
  communication_average: number;
  work_quality_average: number;
  professionalism_average: number;
  punctuality_average: number;
  badges: {
    is_new: boolean;
    has_5plus_works: boolean;
    is_highly_rated: boolean;
    is_top_recommended: boolean;
    top_communication: boolean;
  };
}

export interface ReviewEligibility {
  can_review: boolean;
  reason?: string;
  has_reviewed?: boolean;
  my_role?: 'client' | 'worker';
  other_party_id?: string;
  other_party_name?: string;
  work_title?: string;
  review?: ContractReview;
  can_edit?: boolean;
}

export interface SubmitReviewParams {
  contract_id: string;
  rating: number;
  title?: string;
  comment?: string;
  communication_rating?: number;
  work_quality_rating?: number;
  professionalism_rating?: number;
  punctuality_rating?: number;
  would_recommend?: boolean;
}

export interface AdminSecurityLog {
  id: string;
  event_type: string;
  user_id?: string | null;
  admin_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  details?: Record<string, any>;
  created_at: string;
}

export interface PlatformFeatureFlag {
  key: string;
  description: string;
  is_enabled: boolean;
  metadata?: Record<string, any>;
  updated_by?: string | null;
  updated_at?: string;
}

export interface DashboardAnalyticsPayload {
  total_users: number;
  basic_users: number;
  worker_users: number;
  company_users: number;
  active_users: number;
  suspended_users: number;
  new_users_last_7d: number;
  total_jobs: number;
  active_jobs: number;
  closed_jobs: number;
  total_applications: number;
  active_hire_requests: number;
  active_negotiations: number;
  total_contracts: number;
  active_contracts: number;
  completed_contracts: number;
  cancelled_contracts: number;
  total_reviews: number;
  platform_average_rating: number;
  pending_review_reports: number;
  unread_support_tickets: number;
  notifications_last_24h: number;
}

export interface UserSettings {
  userId: string;
  profileVisibility: string;
  messagePermissions: string;
  hireRequestPermissions: string;
  showOnlineStatus: boolean;
  showExactLocation: boolean;
  searchEngineIndexing: boolean;
  themePreference: string;
  languagePreference: string;
  timezone: string;
  dateFormat: string;
  showReviewsPublicly: boolean;
  showCompletedWorkCount: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserLoginActivity {
  id: string;
  user_id: string;
  logged_in_at: string;
  ip_address?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  device_type?: string | null;
  os?: string | null;
  browser?: string | null;
  user_agent?: string | null;
  auth_provider?: string | null;
  session_fingerprint?: string | null;
  is_current_hint?: boolean | null;
  created_at: string;
}

export interface DeactivationBlockers {
  active_contracts: number;
  pending_completion: number;
  pending_cancellation: number;
  disputed_contracts: number;
  active_hire_commitments: number;
  active_application_commitments: number;
}

export interface DeactivationStatusResponse {
  can_deactivate: boolean;
  blockers: DeactivationBlockers;
}
