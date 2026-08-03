export type CategoryRow = {
  slug: string;
  name: string;
  icon: string;
  sort_order: number;
  open_jobs: number;
};

export type JobRow = {
  id: string;
  title: string;
  description: string;
  category_slug: string;
  area: string;
  budget_min: number | null;
  budget_max: number | null;
  budget_note: string | null;
  urgent: boolean;
  applicants_count: number;
  created_at: string;
  employer_name: string | null;
};

export type WorkerRow = {
  id: string;
  full_name: string;
  headline: string | null;
  area: string | null;
  category_slug: string | null;
  skills: string[];
  rate_label: string | null;
  rating_avg: number;
  rating_count: number;
  verification: string;
  avatar_url: string | null;
};

export type HomeFeed = {
  categories: CategoryRow[];
  jobs: JobRow[];
  workers: WorkerRow[];
};
