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
  created_at?: string;
}

export interface Worker {
  id: string;
  name: string;
  photo: string;
  title: string;
  experience: number; // years
  rating: number;
  availability: "Available Now" | "Part-time" | "Full-time" | "Busy";
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
  unread: boolean;
  role: string;
  created_at: string;
  read_at: string | null;
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
  conversation_type?: 'application' | 'worker_direct';
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
  unreadCount: number;
  createdAt: string;
  conversationType?: 'application' | 'worker_direct';
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

