import { Job, Worker, Category, Activity, Notification, Message, Conversation, JobApplication, ApplicationMessage } from './types';

export const INITIAL_CATEGORIES: Category[] = [
  { name: 'Developer', icon: 'Code', count: 142, color: 'from-blue-500/10 to-indigo-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  { name: 'Designer', icon: 'Palette', count: 98, color: 'from-purple-500/10 to-pink-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
  { name: 'Electrician', icon: 'Zap', count: 34, color: 'from-amber-500/10 to-yellow-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  { name: 'Carpenter', icon: 'Hammer', count: 27, color: 'from-orange-500/10 to-amber-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' },
  { name: 'Driver', icon: 'Car', count: 56, color: 'from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  { name: 'Chef', icon: 'Utensils', count: 41, color: 'from-rose-500/10 to-red-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
  { name: 'Teacher', icon: 'GraduationCap', count: 73, color: 'from-sky-500/10 to-cyan-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' },
  { name: 'Photographer', icon: 'Camera', count: 48, color: 'from-violet-500/10 to-fuchsia-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20' },
  { name: 'Mechanic', icon: 'Wrench', count: 19, color: 'from-zinc-500/10 to-slate-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20' },
  { name: 'Cleaner', icon: 'Sparkles', count: 62, color: 'from-teal-500/10 to-cyan-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20' }
];

export const INITIAL_JOBS: Job[] = [
  {
    id: 'user-job-1',
    title: 'React Developer for Escrow Module Integration',
    company: 'OpenComm Labs',
    companyLogo: 'https://api.dicebear.com/7.x/notionists/svg?seed=mock10793',
    salary: '₹80,000 - ₹1,20,000',
    location: 'Remote',
    category: 'Developer',
    description: 'We are seeking a React Developer to integrate a secure multi-party escrow module into the OpenComm ecosystem. You will design responsive components and coordinate with our payment APIs.',
    requirements: ['React 18+', 'TypeScript', 'Tailwind CSS', 'Stripe Escrow APIs'],
    verified: true,
    bookmarked: false,
    applied: false,
    datePosted: '2 days ago',
    applicationDeadline: '2026-08-30'
  },
  {
    id: 'user-job-2',
    title: 'Figma Designer for Landing Pages',
    company: 'OpenComm Labs',
    companyLogo: 'https://api.dicebear.com/7.x/notionists/svg?seed=mock10793',
    salary: '₹15,000 - ₹25,000',
    location: 'Remote',
    category: 'Designer',
    description: 'We need an expert UI/UX Designer to design several highly animated, high-converting product landing pages in Figma.',
    requirements: ['Figma Expert', 'Responsive Design', 'Landing Page Optimization'],
    verified: true,
    bookmarked: false,
    applied: false,
    datePosted: '2 weeks ago',
    applicationDeadline: '2026-07-23'
  },
  {
    id: 'job-1',
    title: 'React Developer',
    company: 'Tata Consultancy',
    companyLogo: 'https://api.dicebear.com/7.x/notionists/svg?seed=mock10793',
    salary: '₹40,000 - ₹60,000',
    location: 'Kochi, Kerala',
    category: 'Developer',
    description: 'Looking for a skilled React developer who is proficient in TypeScript and responsive UI rendering to build production-grade interfaces.',
    requirements: ['React', 'TypeScript', 'Remote'],
    verified: true,
    bookmarked: false,
    applied: false,
    datePosted: '2 hours ago',
    applicationDeadline: '2026-08-15'
  },
  {
    id: 'job-2',
    title: 'Site Supervisor',
    company: 'Larsen & Toubro',
    companyLogo: 'https://api.dicebear.com/7.x/notionists/svg?seed=mock11334',
    salary: '₹25,000 - ₹35,000',
    location: 'Kottayam, Kerala',
    category: 'Carpenter',
    description: 'We need an experienced Site Supervisor to coordinate construction milestones on-site, manage workforce delivery, and handle quality assurance.',
    requirements: ['Construction', 'On-site'],
    verified: true,
    bookmarked: true,
    applied: false,
    datePosted: '5 hours ago',
    applicationDeadline: '2026-07-21'
  },
  {
    id: 'job-3',
    title: 'Poster Designer',
    company: 'Freelance Project',
    companyLogo: 'https://api.dicebear.com/7.x/notionists/svg?seed=mock19113',
    salary: '₹5,000 - ₹15,000',
    location: 'Remote',
    category: 'Designer',
    description: 'Create eye-catching digital and print posters. Must have expert speed and a modern aesthetic inside leading vector tools.',
    requirements: ['Photoshop', 'Illustrator', 'Freelance'],
    verified: true,
    bookmarked: false,
    applied: false,
    datePosted: '1 day ago',
    applicationDeadline: '2026-07-20'
  },
  {
    id: 'job-4',
    title: 'Electrician Needed',
    company: 'Local Business',
    companyLogo: 'https://api.dicebear.com/7.x/notionists/svg?seed=mock88659',
    salary: '₹800 - ₹1,200 / day',
    location: 'Kaduthuruthy, Kerala',
    category: 'Electrician',
    description: 'Urgent requirement for an electrician to diagnose electrical system errors, replace breakers, and handle new circuit setups.',
    requirements: ['Electrical', 'On-site'],
    verified: true,
    bookmarked: false,
    applied: false,
    datePosted: '3 days ago',
    applicationDeadline: '2026-07-15'
  }
];

export const INITIAL_WORKERS: Worker[] = [
  {
    id: 'worker-1',
    name: 'Sarah Jenkins',
    photo: 'https://api.dicebear.com/7.x/notionists/svg?seed=mock61946',
    title: 'Lead Product & Interaction Designer',
    experience: 8,
    rating: 4.9,
    availability: 'Available Now',
    location: 'San Francisco, CA',
    bio: 'Ex-Airbnb & Linear. I specialize in designing lightning-fast, highly animated, ultra-accessible SaaS products and gorgeous mobile consumer applications. I build usable design systems from scratch.',
    skills: ['Figma', 'Framer Motion', 'React', 'Brand Strategy', 'Mobile UX', 'Tailwind CSS'],
    completedWorks: 124,
    hourlyRate: 1200,
    verified: true
  },
  {
    id: 'worker-2',
    name: 'David Chen',
    photo: 'https://api.dicebear.com/7.x/notionists/svg?seed=mock18406',
    title: 'Senior Frontend Engineer',
    experience: 6,
    rating: 4.8,
    availability: 'Part-time',
    location: 'New York, NY',
    bio: 'Passionate about type safety, performance, and pixel-perfect transitions. I specialize in building complex dashboards, interactive WebGL charts, and Next.js / React 19 apps.',
    skills: ['TypeScript', 'Next.js', 'React 19', 'Tailwind', 'Node.js', 'GraphQL'],
    completedWorks: 89,
    hourlyRate: 950,
    verified: true
  },
  {
    id: 'worker-3',
    name: 'Marcus Thorne',
    photo: 'https://api.dicebear.com/7.x/notionists/svg?seed=mock87415',
    title: 'Licensed Master Electrician',
    experience: 12,
    rating: 5.0,
    availability: 'Available Now',
    location: 'Chicago, IL',
    bio: 'Residential & commercial electrical contractor. Fully insured, certified, and dedicated to safe, efficient power systems. Specializing in smart home retrofits, panel upgrades, and electric vehicle chargers.',
    skills: ['EV Charger Wiring', 'Panel Upgrades', 'Smart Home Integration', 'Industrial Codes', 'Emergency Diagnostics'],
    completedWorks: 312,
    hourlyRate: 850,
    verified: true
  },
  {
    id: 'worker-4',
    name: 'Elena Rostova',
    photo: 'https://api.dicebear.com/7.x/notionists/svg?seed=mock69680',
    title: 'Professional Product & Event Photographer',
    experience: 5,
    rating: 4.9,
    availability: 'Available Now',
    location: 'Miami, FL',
    bio: 'Aesthetic-driven commercial photographer. Creating crisp visual stories for high-end fashion, architectural design, culinary menus, and vibrant corporate events.',
    skills: ['Commercial Studio', 'Lightroom Pro', 'Architectural Styling', 'Portraiture', 'Drone Cinematography'],
    completedWorks: 78,
    hourlyRate: 750,
    verified: true
  },
  {
    id: 'worker-5',
    name: 'Carlos Mendez',
    photo: 'https://api.dicebear.com/7.x/notionists/svg?seed=mock14376',
    title: 'Artisanal Hardwood Furniture Maker',
    experience: 9,
    rating: 4.7,
    availability: 'Full-time',
    location: 'Austin, TX',
    bio: 'Transforming sustainable raw timber into bespoke heirloom furniture. Crafting custom floating shelves, dining tables, live-edge desks, and mid-century modern credenzas.',
    skills: ['Joinery & Inlays', 'Varnish Finishes', 'Live Edge Milling', 'Figma Blueprint Drafting', 'Restoration Work'],
    completedWorks: 94,
    hourlyRate: 650,
    verified: false
  }
];

export const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: 'notif-1',
    type: 'message',
    title: 'New Message from Sarah Jenkins',
    description: '"I reviewed your project brief and I would love to assist with the UI designs!"',
    timestamp: '10 mins ago',
    read: false
  },
  {
    id: 'notif-2',
    type: 'application',
    title: 'Application viewed',
    description: 'Linear App reviewed your application for Lead UI/UX Brand Designer.',
    timestamp: '2 hours ago',
    read: false
  },
  {
    id: 'notif-3',
    type: 'hire',
    title: 'Offer received!',
    description: 'Sunspeed Energy sent a consultation request regarding Sunspeed solar contracts.',
    timestamp: '1 day ago',
    read: true
  }
];

export const INITIAL_MESSAGES: Message[] = [];

export const INITIAL_CONVERSATIONS: Conversation[] = [];

export const INITIAL_APPLICATIONS: JobApplication[] = [
  {
    id: 'app-jane',
    jobId: 'user-job-1',
    jobTitle: 'React Developer for Escrow Module Integration',
    applicantId: 'worker-jane',
    applicantName: 'Jane Cooper',
    applicantPhoto: 'https://api.dicebear.com/7.x/notionists/svg?seed=mock61946',
    applicantTitle: 'UI Developer',
    applicantSkills: ['React', 'TypeScript', 'Stripe Escrows', 'Tailwind CSS'],
    applicantLocation: 'Remote (Chicago)',
    applicantRating: 4.9,
    applicantExperience: 5,
    applicantAvailability: 'Available Now',
    ownerId: 'user',
    ownerName: 'Akhil',
    applicationNote: 'I have built over 4 custom Stripe escrow checkouts and would love to help build this responsive escrow module for OpenComm.',
    status: 'Pending',
    createdAt: '2 days ago',
    updatedAt: '2 days ago',
    bid: '$85/hr'
  },
  {
    id: 'app-guy',
    jobId: 'user-job-1',
    jobTitle: 'React Developer for Escrow Module Integration',
    applicantId: 'worker-guy',
    applicantName: 'Guy Hawkins',
    applicantPhoto: 'https://api.dicebear.com/7.x/notionists/svg?seed=mock18406',
    applicantTitle: 'Senior Payments Architect',
    applicantSkills: ['TypeScript', 'Next.js', 'Escrow Security', 'Node.js'],
    applicantLocation: 'Austin, TX',
    applicantRating: 5.0,
    applicantExperience: 9,
    applicantAvailability: 'Part-time',
    ownerId: 'user',
    ownerName: 'Akhil',
    applicationNote: 'Expert in full-stack payment state management, NextJS, and payment compliance. I can build an ultra-secure escrow solution.',
    status: 'Pending',
    createdAt: '1 day ago',
    updatedAt: '1 day ago',
    bid: '$110/hr'
  },
  {
    id: 'app-user-applied',
    jobId: 'job-1',
    jobTitle: 'React Developer',
    applicantId: 'user',
    applicantName: 'Akhil',
    applicantPhoto: 'https://api.dicebear.com/7.x/notionists/svg?seed=mock69680',
    applicantTitle: 'Product Architect & Tech Lead',
    applicantSkills: ['TypeScript', 'React', 'Tailwind CSS', 'System Design'],
    applicantLocation: 'Austin, TX',
    applicantRating: 4.9,
    applicantExperience: 8,
    applicantAvailability: 'Available Now',
    ownerId: 'company-tata',
    ownerName: 'Tata Consultancy',
    applicationNote: 'Hi! I am extremely interested in your React Developer role. I have extensive experience in responsive UI rendering and TypeScript.',
    status: 'Pending',
    createdAt: '3 hours ago',
    updatedAt: '3 hours ago',
    bid: '$75/hr'
  }
];

export const INITIAL_APP_MESSAGES: ApplicationMessage[] = [
  {
    id: 'app-msg-1',
    applicationId: 'app-jane',
    senderId: 'worker-jane',
    senderName: 'Jane Cooper',
    senderAvatar: 'https://api.dicebear.com/7.x/notionists/svg?seed=mock61946',
    message: 'Hello Akhil! Thanks for considering my application. Just wanted to let you know that I am fully available to start immediately.',
    createdAt: '1 day ago'
  },
  {
    id: 'app-msg-2',
    applicationId: 'app-jane',
    senderId: 'user',
    senderName: 'Akhil',
    senderAvatar: 'https://api.dicebear.com/7.x/notionists/svg?seed=mock69680',
    message: 'Hi Jane, that is great to hear! Have you worked with multi-party escrow states before?',
    createdAt: '18 hours ago'
  },
  {
    id: 'app-msg-3',
    applicationId: 'app-jane',
    senderId: 'worker-jane',
    senderName: 'Jane Cooper',
    senderAvatar: 'https://api.dicebear.com/7.x/notionists/svg?seed=mock61946',
    message: 'Yes! In my last project at DevFlow, we implemented a smart lock system where funds are released only when both the buyer and seller submit validation hashes.',
    createdAt: '12 hours ago'
  }
];

export const INITIAL_ACTIVITIES: Activity[] = [
  {
    id: 'act-1',
    type: 'apply',
    title: 'Applied to Senior Full Stack Engineer at Stripe',
    status: 'In Review',
    statusType: 'pending',
    timestamp: '3 hours ago'
  },
  {
    id: 'act-2',
    type: 'post',
    title: 'Posted job: "Custom Oak Cabinets Needed"',
    status: 'Active (5 offers)',
    statusType: 'success',
    timestamp: '1 day ago'
  },
  {
    id: 'act-3',
    type: 'hire',
    title: 'Hired Marcus Thorne for Office Rewiring',
    status: 'Completed',
    statusType: 'success',
    timestamp: '4 days ago'
  },
  {
    id: 'act-4',
    type: 'message',
    title: 'Received feedback from Stripe Recruiter',
    status: 'Scheduled interview',
    statusType: 'success',
    timestamp: '5 days ago'
  }
];
