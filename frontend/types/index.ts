export type ItemStatus = 'completed' | 'urgent' | 'on_track' | 'overdue';
export type BookStatus = 'planned' | 'reading' | 'completed' | 'wishlist';

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
  end_date: string | null;
  is_current: boolean;
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
  asset_change: number | null;
  records: AssetRecordResponse[];
}

export interface GoalScenario {
  annual_return_rate: number;
  required_monthly_saving: number;
}

export interface FinanceGoalResponse {
  target_amount: number | null;
  target_date: string | null;
  expected_annual_return_rate: number;
  progress_pct: number | null;
  months_remaining: number | null;
  required_monthly_saving: number | null;
  achieved: boolean;
  scenarios: GoalScenario[];
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
  exercise_streak: number;
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
  books_wishlist: number;
  english_days_this_month: number;
  english_minutes_this_month: number;
  english_streak: number;
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
  peak_cf_rating: number | null;
  rating_delta: number | null;
}

// Dashboard
export interface PhaseProgress {
  name: string;
  label: string;
  color: string;
  total: number;
  completed: number;
  is_current: boolean;
}

export interface PlannerSnapshot {
  start_date: string | null;
  total_items: number;
  completed_items: number;
  urgent_items: number;
  overdue_items: number;
  phases: PhaseProgress[];
}

export interface FinanceSnapshot {
  latest_total_assets: number | null;
  avg_savings_rate: number | null;
  asset_change: number | null;
  goal_target_amount: number | null;
  goal_progress_pct: number | null;
}

export interface HealthSnapshot {
  exercise_days_this_week: number;
  total_exercise_minutes_this_week: number;
  avg_sleep_hours_this_week: number | null;
  avg_sleep_quality_this_week: number | null;
  exercise_streak: number;
}

export interface GrowthSnapshot {
  books_completed_this_year: number;
  books_reading: number;
  books_wishlist: number;
  english_days_this_month: number;
  english_minutes_this_month: number;
  english_streak: number;
}

export interface CareerSnapshot {
  cf_handle: string | null;
  latest_cf_rating: number | null;
  latest_cf_rank: string | null;
  rating_delta: number | null;
}

export interface TravelSnapshot {
  total: number;
  upcoming: number;
  ongoing: number;
  next_trip_name: string | null;
  next_trip_destination: string | null;
  next_trip_start_date: string | null;
  next_trip_checklist_total: number;
  next_trip_checklist_done: number;
  next_trip_plan_total: number;
}

export interface OverviewMeta {
  partial_failure: boolean;
  failed_modules: string[];
}

export interface OverviewResponse {
  planner: PlannerSnapshot | null;
  finance: FinanceSnapshot | null;
  health: HealthSnapshot | null;
  growth: GrowthSnapshot | null;
  career: CareerSnapshot | null;
  travel: TravelSnapshot | null;
  meta: OverviewMeta;
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

export interface RestaurantResponse {
  id: number;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  cuisine: string | null;
  note: string | null;
  is_visited: boolean;
  order_index: number;
}

// Dev Status (harness / task engineering status)
export interface TaskCounts {
  draft: number;
  approved: number;
  working: number;
  blocked: number;
  implemented: number;
  reviewed: number;
  done: number;
}

export interface TaskSummary {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  task_type: string | null;
  updated_at: string | null;
}

export interface HookInfo {
  file: string;
  events: string[];
}

export interface SkillInfo {
  name: string;
  description: string;
}

export interface HarnessStatus {
  permission_rule_count: number;
  hooks: HookInfo[];
  skills: SkillInfo[];
  claudeignore_present: boolean;
}

export interface DevLogEntry {
  date: string;
  summary: string;
}

export interface GitStatus {
  branch: string | null;
  last_commit_hash: string | null;
  last_commit_message: string | null;
  last_commit_date: string | null;
}

export interface DevStatusOverview {
  task_counts: TaskCounts;
  active_tasks: TaskSummary[];
  recent_done: TaskSummary[];
  harness: HarnessStatus;
  recent_dev_log: DevLogEntry[];
  git: GitStatus;
}

export interface TripResponse {
  id: number;
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  status: TripStatus;
  note: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  checklist_items: ChecklistItemResponse[];
  plan_items: TripPlanItemResponse[];
  restaurants: RestaurantResponse[];
}

export interface TravelSummaryResponse {
  total: number;
  planned: number;
  ongoing: number;
  completed: number;
}
