export type ItemStatus = 'completed' | 'urgent' | 'on_track' | 'overdue';
export type BookStatus = 'planned' | 'reading' | 'completed';

// Planner
export interface RoadmapItemResponse {
  id: number;
  text: string;
  offset: number;
  is_completed: boolean;
  deadline: string | null;
  status: ItemStatus | null;
}

export interface CategoryResponse {
  id: number;
  icon: string;
  title: string;
  subtitle: string;
  order_index: number;
  items: RoadmapItemResponse[];
}

export interface PhaseResponse {
  id: number;
  name: string;
  label: string;
  order_index: number;
  months: number;
  color: string;
  start_date: string | null;
  categories: CategoryResponse[];
}

export interface RoadmapResponse {
  start_date: string | null;
  phases: PhaseResponse[];
}

// Finance
export interface AssetRecordResponse {
  id: number;
  record_date: string;
  total_assets: number;
  monthly_income: number;
  monthly_expense: number;
  savings_amount: number;
  savings_rate: number | null;
  note: string | null;
}

export interface FinanceSummaryResponse {
  latest_total_assets: number | null;
  avg_savings_rate: number | null;
  records: AssetRecordResponse[];
}

// Health
export interface ExerciseLogResponse {
  id: number;
  log_date: string;
  exercise_type: string;
  duration_minutes: number;
  note: string | null;
}

export interface SleepLogResponse {
  id: number;
  log_date: string;
  sleep_hours: number;
  quality: number;
  note: string | null;
}

export interface HealthSummaryResponse {
  exercise_days_this_week: number;
  total_exercise_minutes_this_week: number;
  avg_sleep_hours_this_week: number | null;
  avg_sleep_quality_this_week: number | null;
}

// Growth
export interface BookRecordResponse {
  id: number;
  title: string;
  author: string | null;
  status: BookStatus;
  start_date: string | null;
  end_date: string | null;
  rating: number | null;
  note: string | null;
}

export interface EnglishLogResponse {
  id: number;
  log_date: string;
  activity_type: string;
  duration_minutes: number;
  note: string | null;
}

export interface GrowthSummaryResponse {
  books_completed_this_year: number;
  books_reading: number;
  english_days_this_month: number;
  english_minutes_this_month: number;
}

// Career
export interface CareerSettingsResponse {
  cf_handle: string | null;
  github_username: string | null;
  blog_url: string | null;
}

export interface CFRatingLogResponse {
  id: number;
  log_date: string;
  rating: number;
  rank_name: string;
}

export interface CareerSummaryResponse {
  cf_handle: string | null;
  github_username: string | null;
  latest_cf_rating: number | null;
  latest_cf_rank: string | null;
}

// Dashboard
export interface PlannerSnapshot {
  start_date: string | null;
  total_items: number;
  completed_items: number;
  urgent_items: number;
  overdue_items: number;
}

export interface FinanceSnapshot {
  latest_total_assets: number | null;
  avg_savings_rate: number | null;
}

export interface HealthSnapshot {
  exercise_days_this_week: number;
  total_exercise_minutes_this_week: number;
  avg_sleep_hours_this_week: number | null;
  avg_sleep_quality_this_week: number | null;
}

export interface GrowthSnapshot {
  books_completed_this_year: number;
  books_reading: number;
  english_days_this_month: number;
  english_minutes_this_month: number;
}

export interface CareerSnapshot {
  cf_handle: string | null;
  latest_cf_rating: number | null;
  latest_cf_rank: string | null;
}

export interface TravelSnapshot {
  total: number;
  upcoming: number;
  ongoing: number;
  next_trip_name: string | null;
  next_trip_destination: string | null;
}

export interface OverviewResponse {
  planner: PlannerSnapshot | null;
  finance: FinanceSnapshot | null;
  health: HealthSnapshot | null;
  growth: GrowthSnapshot | null;
  career: CareerSnapshot | null;
  travel: TravelSnapshot | null;
}

// Travel
export type TripStatus = 'planned' | 'ongoing' | 'completed';

export interface ChecklistItemResponse {
  id: number;
  text: string;
  is_checked: boolean;
  order_index: number;
}

export interface TripPlanItemResponse {
  id: number;
  day: number;
  sort_order: number;
  time: string | null;
  title: string;
  description: string | null;
}

export interface TripResponse {
  id: number;
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  status: TripStatus;
  note: string | null;
  checklist_items: ChecklistItemResponse[];
  plan_items: TripPlanItemResponse[];
}

export interface TravelSummaryResponse {
  total: number;
  planned: number;
  ongoing: number;
  completed: number;
}
