/**
 * DEMO DATA — clearly marked sample content for the v1 interface build.
 * Replace with Lovable Cloud queries when the backend is wired up.
 */

export type Category = {
  slug: string;
  name: string;
  icon: string;
  openJobs: number;
};

export type Worker = {
  id: string;
  name: string;
  trade: string;
  area: string;
  rating: number;
  reviews: number;
  rate: string;
  verified: boolean;
  initials: string;
  about: string;
  skills: string[];
};

export type Job = {
  id: string;
  title: string;
  category: string;
  area: string;
  budget: string;
  postedBy: string;
  postedAgo: string;
  urgent: boolean;
  applicants: number;
  description: string;
};

export const categories: Category[] = [
  { slug: "electrician", name: "Electrician", icon: "Zap", openJobs: 42 },
  { slug: "plumber", name: "Plumber", icon: "Droplets", openJobs: 31 },
  { slug: "mechanic", name: "Mechanic", icon: "Wrench", openJobs: 27 },
  { slug: "cleaner", name: "House cleaning", icon: "Sparkles", openJobs: 58 },
  { slug: "painter", name: "Painter", icon: "PaintRoller", openJobs: 19 },
  { slug: "tutor", name: "Tutor", icon: "GraduationCap", openJobs: 24 },
  { slug: "welder", name: "Welder", icon: "Flame", openJobs: 12 },
  { slug: "hairdresser", name: "Hairdresser", icon: "Scissors", openJobs: 22 },
  { slug: "driver", name: "Driver", icon: "Car", openJobs: 16 },
  { slug: "farmer", name: "Farm work", icon: "Sprout", openJobs: 14 },
];

export const workers: Worker[] = [
  {
    id: "w1",
    name: "Grace Wanjiru",
    trade: "House cleaning",
    area: "Kilimani, Nairobi",
    rating: 4.9,
    reviews: 128,
    rate: "KSh 1,200 / day",
    verified: true,
    initials: "GW",
    about:
      "Six years cleaning homes and offices around Nairobi. I bring my own supplies and always finish on time.",
    skills: ["Deep cleaning", "Laundry", "Move-out cleaning"],
  },
  {
    id: "w2",
    name: "Samuel Otieno",
    trade: "Electrician",
    area: "Westlands, Nairobi",
    rating: 4.8,
    reviews: 94,
    rate: "KSh 2,500 / job",
    verified: true,
    initials: "SO",
    about:
      "Licensed electrician. Wiring, fault finding, security lights and solar installation for homes and shops.",
    skills: ["Wiring", "Solar", "Fault finding"],
  },
  {
    id: "w3",
    name: "Amina Hassan",
    trade: "Tutor",
    area: "Nyali, Mombasa",
    rating: 5.0,
    reviews: 41,
    rate: "KSh 800 / hour",
    verified: true,
    initials: "AH",
    about: "Maths and science tutor for Grade 4 to Form 4. Patient, and I share progress every week.",
    skills: ["Maths", "Physics", "Exam prep"],
  },
  {
    id: "w4",
    name: "Peter Mwangi",
    trade: "Plumber",
    area: "Thika Road, Nairobi",
    rating: 4.7,
    reviews: 76,
    rate: "KSh 1,800 / job",
    verified: false,
    initials: "PM",
    about: "Leaks, blocked drains, water tanks and bathroom fittings. Available on short notice.",
    skills: ["Leak repair", "Drainage", "Tank fitting"],
  },
];

export const jobs: Job[] = [
  {
    id: "j1",
    title: "Fix leaking kitchen sink",
    category: "Plumber",
    area: "Lavington, Nairobi",
    budget: "KSh 2,000 – 3,500",
    postedBy: "Njeri K.",
    postedAgo: "20 min ago",
    urgent: true,
    applicants: 3,
    description:
      "The sink pipe has been dripping for two days and the cabinet below is getting wet. I need someone who can come today or tomorrow morning with their own tools.",
  },
  {
    id: "j2",
    title: "Paint a two bedroom apartment",
    category: "Painter",
    area: "Ruaka, Kiambu",
    budget: "KSh 18,000",
    postedBy: "Daniel M.",
    postedAgo: "2 hours ago",
    urgent: false,
    applicants: 9,
    description:
      "Interior painting only, walls and ceiling. Paint will be provided. The house is empty so you can work any day this week.",
  },
  {
    id: "j3",
    title: "Weekly house cleaning",
    category: "House cleaning",
    area: "Kileleshwa, Nairobi",
    budget: "KSh 1,500 / visit",
    postedBy: "Aisha B.",
    postedAgo: "5 hours ago",
    urgent: false,
    applicants: 12,
    description:
      "Looking for someone reliable to clean every Saturday morning. Three bedroom house, no pets.",
  },
  {
    id: "j4",
    title: "Service and repair a Probox",
    category: "Mechanic",
    area: "Industrial Area, Nairobi",
    budget: "KSh 6,000",
    postedBy: "Kevin O.",
    postedAgo: "Yesterday",
    urgent: false,
    applicants: 4,
    description:
      "Full service plus the front brakes are making noise. I can bring the car to your garage.",
  },
];

export const conversations = [
  {
    id: "c1",
    name: "Samuel Otieno",
    initials: "SO",
    lastMessage: "I can pass by tomorrow at 9am if that works for you.",
    time: "12:40",
    unread: 2,
    online: true,
  },
  {
    id: "c2",
    name: "Grace Wanjiru",
    initials: "GW",
    lastMessage: "Thank you for the review, see you next Saturday.",
    time: "Yesterday",
    unread: 0,
    online: false,
  },
  {
    id: "c3",
    name: "Njeri K.",
    initials: "NK",
    lastMessage: "Is the price still 2,000?",
    time: "Mon",
    unread: 0,
    online: false,
  },
];

export const applications = [
  { id: "a1", job: "Fix leaking kitchen sink", status: "Shortlisted", when: "Applied 20 min ago" },
  { id: "a2", job: "Paint a two bedroom apartment", status: "Sent", when: "Applied 3 hours ago" },
  { id: "a3", job: "Service and repair a Probox", status: "Not selected", when: "Applied Monday" },
];

export const savedJobs = [jobs[1], jobs[2]];
