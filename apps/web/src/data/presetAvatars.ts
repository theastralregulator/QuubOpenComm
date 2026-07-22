export interface PresetAvatar {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  profession: string;
  url: string;
}

export const PRESET_AVATARS: PresetAvatar[] = [
  // 1-10 Professional Developers & Tech
  {
    id: 'avatar-tech-01',
    name: 'Alex (Lead Architect)',
    gender: 'neutral',
    profession: 'Software Engineering',
    url: 'https://api.dicebear.com/7.x/notionists/svg?seed=AlexArchitect&backgroundColor=e0e7ff'
  },
  {
    id: 'avatar-tech-02',
    name: 'Sarah (Frontend Developer)',
    gender: 'female',
    profession: 'Web Development',
    url: 'https://api.dicebear.com/7.x/notionists/svg?seed=SarahDev&backgroundColor=fce7f3'
  },
  {
    id: 'avatar-tech-03',
    name: 'David (Backend Engineer)',
    gender: 'male',
    profession: 'Cloud Infrastructure',
    url: 'https://api.dicebear.com/7.x/notionists/svg?seed=DavidBackend&backgroundColor=dcfce7'
  },
  {
    id: 'avatar-tech-04',
    name: 'Priya (Full Stack Developer)',
    gender: 'female',
    profession: 'Software Engineering',
    url: 'https://api.dicebear.com/7.x/notionists/svg?seed=PriyaFullStack&backgroundColor=fef3c7'
  },
  {
    id: 'avatar-tech-05',
    name: 'Marcus (DevOps Specialist)',
    gender: 'male',
    profession: 'DevOps & Security',
    url: 'https://api.dicebear.com/7.x/notionists/svg?seed=MarcusDevOps&backgroundColor=e0f2fe'
  },
  {
    id: 'avatar-tech-06',
    name: 'Elena (AI Researcher)',
    gender: 'female',
    profession: 'Machine Learning',
    url: 'https://api.dicebear.com/7.x/notionists/svg?seed=ElenaAI&backgroundColor=fae8ff'
  },
  {
    id: 'avatar-tech-07',
    name: 'Kevin (Mobile Developer)',
    gender: 'male',
    profession: 'iOS & Android',
    url: 'https://api.dicebear.com/7.x/notionists/svg?seed=KevinMobile&backgroundColor=ffedd5'
  },
  {
    id: 'avatar-tech-08',
    name: 'Aisha (Data Scientist)',
    gender: 'female',
    profession: 'Analytics & Data',
    url: 'https://api.dicebear.com/7.x/notionists/svg?seed=AishaData&backgroundColor=ccfbf1'
  },
  {
    id: 'avatar-tech-09',
    name: 'Liam (Cybersecurity Lead)',
    gender: 'male',
    profession: 'Security Compliance',
    url: 'https://api.dicebear.com/7.x/notionists/svg?seed=LiamSec&backgroundColor=f3e8ff'
  },
  {
    id: 'avatar-tech-10',
    name: 'Zoe (QA Engineer)',
    gender: 'female',
    profession: 'Software Quality',
    url: 'https://api.dicebear.com/7.x/notionists/svg?seed=ZoeQA&backgroundColor=ffe4e6'
  },

  // 11-20 Designers & Creatives
  {
    id: 'avatar-design-01',
    name: 'Chloe (Product Designer)',
    gender: 'female',
    profession: 'UI/UX Design',
    url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=ChloeProduct&backgroundColor=fbcfe8'
  },
  {
    id: 'avatar-design-02',
    name: 'Daniel (Graphic Illustrator)',
    gender: 'male',
    profession: 'Visual Art',
    url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=DanielArt&backgroundColor=bae6fd'
  },
  {
    id: 'avatar-design-03',
    name: 'Maya (3D Animator)',
    gender: 'female',
    profession: '3D & Motion',
    url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=Maya3D&backgroundColor=ddd6fe'
  },
  {
    id: 'avatar-design-04',
    name: 'Julian (Brand Designer)',
    gender: 'male',
    profession: 'Branding & Identity',
    url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=JulianBrand&backgroundColor=fef08a'
  },
  {
    id: 'avatar-design-05',
    name: 'Sophia (Design Director)',
    gender: 'female',
    profession: 'Creative Direction',
    url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=SophiaDir&backgroundColor=bbf7d0'
  },
  {
    id: 'avatar-design-06',
    name: 'Ethan (UX Researcher)',
    gender: 'male',
    profession: 'User Research',
    url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=EthanUX&backgroundColor=fed7aa'
  },
  {
    id: 'avatar-design-07',
    name: 'Amara (Copywriter & Content)',
    gender: 'female',
    profession: 'Creative Writing',
    url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=AmaraCopy&backgroundColor=e9d5ff'
  },
  {
    id: 'avatar-design-08',
    name: 'Noah (Video Editor)',
    gender: 'male',
    profession: 'Video Production',
    url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=NoahVideo&backgroundColor=99f6e4'
  },
  {
    id: 'avatar-design-09',
    name: 'Mia (Interior Designer)',
    gender: 'female',
    profession: 'Interior Architecture',
    url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=MiaInterior&backgroundColor=fecdd3'
  },
  {
    id: 'avatar-design-10',
    name: 'Lucas (Photographer)',
    gender: 'male',
    profession: 'Commercial Photography',
    url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=LucasPhoto&backgroundColor=cbd5e1'
  },

  // 21-30 Business, Trades & Service Specialists
  {
    id: 'avatar-biz-01',
    name: 'Rohan (Project Manager)',
    gender: 'male',
    profession: 'Project Management',
    url: 'https://api.dicebear.com/7.x/micah/svg?seed=RohanPM&backgroundColor=c7d2fe'
  },
  {
    id: 'avatar-biz-02',
    name: 'Kavya (HR Consultant)',
    gender: 'female',
    profession: 'Human Resources',
    url: 'https://api.dicebear.com/7.x/micah/svg?seed=KavyaHR&backgroundColor=fbcfe8'
  },
  {
    id: 'avatar-biz-03',
    name: 'Vikram (Electrician Specialist)',
    gender: 'male',
    profession: 'Electrical Contracting',
    url: 'https://api.dicebear.com/7.x/micah/svg?seed=VikramElectric&backgroundColor=fef08a'
  },
  {
    id: 'avatar-biz-04',
    name: 'Ananya (Financial Analyst)',
    gender: 'female',
    profession: 'Finance & Accounting',
    url: 'https://api.dicebear.com/7.x/micah/svg?seed=AnanyaFinance&backgroundColor=bbf7d0'
  },
  {
    id: 'avatar-biz-05',
    name: 'Suresh (Plumbing Technician)',
    gender: 'male',
    profession: 'Plumbing & Mechanical',
    url: 'https://api.dicebear.com/7.x/micah/svg?seed=SureshPlumb&backgroundColor=bae6fd'
  },
  {
    id: 'avatar-biz-06',
    name: 'Meera (Legal Consultant)',
    gender: 'female',
    profession: 'Corporate Law',
    url: 'https://api.dicebear.com/7.x/micah/svg?seed=MeeraLaw&backgroundColor=ddd6fe'
  },
  {
    id: 'avatar-biz-07',
    name: 'Arjun (Carpentry Master)',
    gender: 'male',
    profession: 'Custom Carpentry',
    url: 'https://api.dicebear.com/7.x/micah/svg?seed=ArjunWood&backgroundColor=fed7aa'
  },
  {
    id: 'avatar-biz-08',
    name: 'Tanvi (Marketing Specialist)',
    gender: 'female',
    profession: 'Digital Marketing',
    url: 'https://api.dicebear.com/7.x/micah/svg?seed=TanviMkt&backgroundColor=fecdd3'
  },
  {
    id: 'avatar-biz-09',
    name: 'Rajesh (HVAC Technician)',
    gender: 'male',
    profession: 'Climate Control Systems',
    url: 'https://api.dicebear.com/7.x/micah/svg?seed=RajeshHVAC&backgroundColor=99f6e4'
  },
  {
    id: 'avatar-biz-10',
    name: 'Diya (Event Manager)',
    gender: 'female',
    profession: 'Event Operations',
    url: 'https://api.dicebear.com/7.x/micah/svg?seed=DiyaEvent&backgroundColor=e9d5ff'
  },

  // 31-40 Modern Avataaars Series
  {
    id: 'avatar-av-01',
    name: 'Benjamin (System Administrator)',
    gender: 'male',
    profession: 'IT Infrastructure',
    url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=BenSysAdmin&backgroundColor=dbeafe'
  },
  {
    id: 'avatar-av-02',
    name: 'Olivia (Product Owner)',
    gender: 'female',
    profession: 'Agile Management',
    url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=OliviaPO&backgroundColor=fce7f3'
  },
  {
    id: 'avatar-av-03',
    name: 'Mason (Security Guard Lead)',
    gender: 'male',
    profession: 'Physical Security',
    url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MasonSec&backgroundColor=e2e8f0'
  },
  {
    id: 'avatar-av-04',
    name: 'Isabella (Medical Assistant)',
    gender: 'female',
    profession: 'Healthcare Support',
    url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=IsabellaHealth&backgroundColor=ccfbf1'
  },
  {
    id: 'avatar-av-05',
    name: 'William (Construction Supervisor)',
    gender: 'male',
    profession: 'Civil Engineering',
    url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=WillBuild&backgroundColor=fef3c7'
  },
  {
    id: 'avatar-av-06',
    name: 'Charlotte (Translator)',
    gender: 'female',
    profession: 'Linguistic Services',
    url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=CharlotteTrans&backgroundColor=f3e8ff'
  },
  {
    id: 'avatar-av-07',
    name: 'James (Logistics Coordinator)',
    gender: 'male',
    profession: 'Supply Chain',
    url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=JamesLogistics&backgroundColor=ffedd5'
  },
  {
    id: 'avatar-av-08',
    name: 'Amelia (Customer Support Specialist)',
    gender: 'female',
    profession: 'Client Operations',
    url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AmeliaSupport&backgroundColor=ffe4e6'
  },
  {
    id: 'avatar-av-09',
    name: 'Alexander (Solar Installation Tech)',
    gender: 'male',
    profession: 'Renewable Energy',
    url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AlexSolar&backgroundColor=dcfce7'
  },
  {
    id: 'avatar-av-10',
    name: 'Harper (Content Strategist)',
    gender: 'female',
    profession: 'Media & Branding',
    url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=HarperContent&backgroundColor=e0f2fe'
  },

  // 41-52 Open Peeps Professional Series
  {
    id: 'avatar-peep-01',
    name: 'Tara (Architectural Draftsperson)',
    gender: 'female',
    profession: 'CAD & 3D Drafting',
    url: 'https://api.dicebear.com/7.x/open-peeps/svg?seed=TaraCAD&backgroundColor=f1f5f9'
  },
  {
    id: 'avatar-peep-02',
    name: 'Siddharth (Automotive Mechanic)',
    gender: 'male',
    profession: 'Auto Servicing',
    url: 'https://api.dicebear.com/7.x/open-peeps/svg?seed=SidAuto&backgroundColor=e2e8f0'
  },
  {
    id: 'avatar-peep-03',
    name: 'Nisha (Fitness Trainer)',
    gender: 'female',
    profession: 'Wellness & Health',
    url: 'https://api.dicebear.com/7.x/open-peeps/svg?seed=NishaFit&backgroundColor=cbd5e1'
  },
  {
    id: 'avatar-peep-04',
    name: 'Kabir (Network Engineer)',
    gender: 'male',
    profession: 'Telecommunications',
    url: 'https://api.dicebear.com/7.x/open-peeps/svg?seed=KabirNet&backgroundColor=f8fafc'
  },
  {
    id: 'avatar-peep-05',
    name: 'Leah (Chef & Culinary Expert)',
    gender: 'female',
    profession: 'Food & Hospitality',
    url: 'https://api.dicebear.com/7.x/open-peeps/svg?seed=LeahChef&backgroundColor=fce7f3'
  },
  {
    id: 'avatar-peep-06',
    name: 'Manish (Landscaping Specialist)',
    gender: 'male',
    profession: 'Garden & Grounds',
    url: 'https://api.dicebear.com/7.x/open-peeps/svg?seed=ManishGreen&backgroundColor=dcfce7'
  },
  {
    id: 'avatar-peep-07',
    name: 'Riya (SEO Specialist)',
    gender: 'female',
    profession: 'Search Engine Marketing',
    url: 'https://api.dicebear.com/7.x/open-peeps/svg?seed=RiyaSEO&backgroundColor=e0e7ff'
  },
  {
    id: 'avatar-peep-08',
    name: 'Vikas (Facility Painter)',
    gender: 'male',
    profession: 'Commercial Painting',
    url: 'https://api.dicebear.com/7.x/open-peeps/svg?seed=VikasPaint&backgroundColor=fef3c7'
  },
  {
    id: 'avatar-peep-09',
    name: 'Pooja (Virtual Assistant)',
    gender: 'female',
    profession: 'Admin Support',
    url: 'https://api.dicebear.com/7.x/open-peeps/svg?seed=PoojaVA&backgroundColor=fae8ff'
  },
  {
    id: 'avatar-peep-10',
    name: 'Gaurav (Appliance Repair Tech)',
    gender: 'male',
    profession: 'Home Maintenance',
    url: 'https://api.dicebear.com/7.x/open-peeps/svg?seed=GauravFix&backgroundColor=ffedd5'
  },
  {
    id: 'avatar-peep-11',
    name: 'Shruti (Data Entry Specialist)',
    gender: 'female',
    profession: 'Information Management',
    url: 'https://api.dicebear.com/7.x/open-peeps/svg?seed=ShrutiData&backgroundColor=ccfbf1'
  },
  {
    id: 'avatar-peep-12',
    name: 'Karan (Handyman)',
    gender: 'male',
    profession: 'General Repairs',
    url: 'https://api.dicebear.com/7.x/open-peeps/svg?seed=KaranHandy&backgroundColor=dbeafe'
  }
];

export const DEFAULT_AVATAR_URL = PRESET_AVATARS[0].url;
