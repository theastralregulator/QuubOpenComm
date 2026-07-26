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
  posted_by?: string;
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

export interface Message {
  id: string;
  conversationId?: string; // Optional linking to clean conversation threads
  senderName: string;
  senderAvatar: string;
  text: string;
  timestamp: string;
  unread: boolean;
  role: 'user' | 'assistant';
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

export interface Conversation {
  id: string;
  jobId?: string;
  applicationId?: string;
  memberName: string;
  memberAvatar: string;
  memberTitle: string;
  memberId: string; // ID of the other user in the chat
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

