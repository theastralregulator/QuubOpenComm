import { Job, Worker, Category, Activity, Notification, Message, Conversation, JobApplication, ApplicationMessage } from './types';

// Empty canonical fallback definitions (all real marketplace data loads from database)
export const INITIAL_CATEGORIES: Category[] = [];
export const INITIAL_JOBS: Job[] = [];
export const INITIAL_WORKERS: Worker[] = [];
export const INITIAL_NOTIFICATIONS: Notification[] = [];
export const INITIAL_MESSAGES: Message[] = [];
export const INITIAL_CONVERSATIONS: Conversation[] = [];
export const INITIAL_APPLICATIONS: JobApplication[] = [];
export const INITIAL_APP_MESSAGES: ApplicationMessage[] = [];
export const INITIAL_ACTIVITIES: Activity[] = [];
