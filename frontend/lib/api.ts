import axios from 'axios';
import type {
  RoadmapResponse, RoadmapItemResponse, CategoryResponse, FinanceSummaryResponse, AssetRecordResponse,
  ExerciseLogResponse, SleepLogResponse, HealthSummaryResponse,
  BookRecordResponse, EnglishLogResponse, GrowthSummaryResponse,
  CareerSettingsResponse, CFRatingLogResponse, CareerSummaryResponse,
  OverviewResponse,
  TripResponse, ChecklistItemResponse, TravelSummaryResponse,
} from '@/types';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export const client = axios.create({ baseURL: BASE });

client.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login: async (username: string, password: string) => {
    const form = new URLSearchParams({ username, password });
    const res = await client.post<{ access_token: string; token_type: string }>(
      '/api/v1/auth/token', form,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    return res.data;
  },
};

export const plannerApi = {
  getRoadmap: async (): Promise<RoadmapResponse> =>
    (await client.get('/api/v1/planner/roadmap')).data,
  getSettings: async (): Promise<{ start_date: string | null }> =>
    (await client.get('/api/v1/planner/settings')).data,
  updateSettings: async (start_date: string | null) =>
    (await client.put('/api/v1/planner/settings', { start_date })).data,
  toggleItem: async (id: number): Promise<{ id: number; is_completed: boolean }> =>
    (await client.patch(`/api/v1/planner/items/${id}/toggle`)).data,
  createItem: async (data: { category_id: number; text: string; offset: number }): Promise<RoadmapItemResponse> =>
    (await client.post('/api/v1/planner/items', data)).data,
  updateItem: async (id: number, data: { text?: string; offset?: number }): Promise<RoadmapItemResponse> =>
    (await client.put(`/api/v1/planner/items/${id}`, data)).data,
  deleteItem: async (id: number): Promise<void> => {
    await client.delete(`/api/v1/planner/items/${id}`);
  },
  updatePhase: async (id: number, data: { name?: string; label?: string; months?: number; color?: string }) =>
    (await client.put(`/api/v1/planner/phases/${id}`, data)).data,
  updateCategory: async (id: number, data: { icon?: string; title?: string; subtitle?: string }) =>
    (await client.put(`/api/v1/planner/categories/${id}`, data)).data,
  createCategory: async (data: { phase_id: number; icon?: string; title: string; subtitle?: string }): Promise<CategoryResponse> =>
    (await client.post('/api/v1/planner/categories', data)).data,
  deleteCategory: async (id: number): Promise<void> => {
    await client.delete(`/api/v1/planner/categories/${id}`);
  },
};

export const financeApi = {
  getSummary: async (): Promise<FinanceSummaryResponse> =>
    (await client.get('/api/v1/finance/summary')).data,
  createRecord: async (data: {
    record_date: string; total_assets: number;
    monthly_income: number; monthly_expense: number; note?: string;
  }): Promise<AssetRecordResponse> =>
    (await client.post('/api/v1/finance/records', data)).data,
  deleteRecord: async (id: number): Promise<void> => {
    await client.delete(`/api/v1/finance/records/${id}`);
  },
};

export const healthApi = {
  getSummary: async (): Promise<HealthSummaryResponse> =>
    (await client.get('/api/v1/health/summary')).data,
  listExercise: async (): Promise<ExerciseLogResponse[]> =>
    (await client.get('/api/v1/health/exercise')).data,
  createExercise: async (data: {
    log_date: string; exercise_type: string; duration_minutes: number; note?: string;
  }): Promise<ExerciseLogResponse> =>
    (await client.post('/api/v1/health/exercise', data)).data,
  deleteExercise: async (id: number) => { await client.delete(`/api/v1/health/exercise/${id}`); },
  listSleep: async (): Promise<SleepLogResponse[]> =>
    (await client.get('/api/v1/health/sleep')).data,
  createSleep: async (data: {
    log_date: string; sleep_hours: number; quality: number; note?: string;
  }): Promise<SleepLogResponse> =>
    (await client.post('/api/v1/health/sleep', data)).data,
  deleteSleep: async (id: number) => { await client.delete(`/api/v1/health/sleep/${id}`); },
};

export const growthApi = {
  getSummary: async (): Promise<GrowthSummaryResponse> =>
    (await client.get('/api/v1/growth/summary')).data,
  listBooks: async (): Promise<BookRecordResponse[]> =>
    (await client.get('/api/v1/growth/books')).data,
  createBook: async (data: {
    title: string; author?: string; status?: string;
    start_date?: string; end_date?: string; rating?: number; note?: string;
  }): Promise<BookRecordResponse> =>
    (await client.post('/api/v1/growth/books', data)).data,
  updateBook: async (id: number, data: Partial<{
    title: string; author: string; status: string;
    start_date: string; end_date: string; rating: number; note: string;
  }>): Promise<BookRecordResponse> =>
    (await client.put(`/api/v1/growth/books/${id}`, data)).data,
  deleteBook: async (id: number) => { await client.delete(`/api/v1/growth/books/${id}`); },
  listEnglish: async (): Promise<EnglishLogResponse[]> =>
    (await client.get('/api/v1/growth/english')).data,
  createEnglish: async (data: {
    log_date: string; activity_type: string; duration_minutes: number; note?: string;
  }): Promise<EnglishLogResponse> =>
    (await client.post('/api/v1/growth/english', data)).data,
  deleteEnglish: async (id: number) => { await client.delete(`/api/v1/growth/english/${id}`); },
};

export const careerApi = {
  getSettings: async (): Promise<CareerSettingsResponse> =>
    (await client.get('/api/v1/career/settings')).data,
  updateSettings: async (data: {
    cf_handle?: string; github_username?: string; blog_url?: string;
  }): Promise<CareerSettingsResponse> =>
    (await client.put('/api/v1/career/settings', data)).data,
  listCFRatings: async (): Promise<CFRatingLogResponse[]> =>
    (await client.get('/api/v1/career/cf-ratings')).data,
  createCFRating: async (data: {
    log_date: string; rating: number; rank_name: string;
  }): Promise<CFRatingLogResponse> =>
    (await client.post('/api/v1/career/cf-ratings', data)).data,
  deleteCFRating: async (id: number) => { await client.delete(`/api/v1/career/cf-ratings/${id}`); },
};

export const dashboardApi = {
  getOverview: async (): Promise<OverviewResponse> =>
    (await client.get('/api/v1/dashboard/overview')).data,
};

export const travelApi = {
  getSummary: async (): Promise<TravelSummaryResponse> =>
    (await client.get('/api/v1/travel/summary')).data,
  listTrips: async (): Promise<TripResponse[]> =>
    (await client.get('/api/v1/travel/trips')).data,
  getTrip: async (id: number): Promise<TripResponse> =>
    (await client.get(`/api/v1/travel/trips/${id}`)).data,
  createTrip: async (data: {
    name: string; destination: string; start_date: string; end_date: string;
    status?: string; note?: string;
  }): Promise<TripResponse> =>
    (await client.post('/api/v1/travel/trips', data)).data,
  updateTrip: async (id: number, data: Partial<{
    name: string; destination: string; start_date: string; end_date: string;
    status: string; note: string;
  }>): Promise<TripResponse> =>
    (await client.put(`/api/v1/travel/trips/${id}`, data)).data,
  deleteTrip: async (id: number): Promise<void> => {
    await client.delete(`/api/v1/travel/trips/${id}`);
  },
  addChecklistItem: async (tripId: number, data: { text: string; order_index?: number }): Promise<ChecklistItemResponse> =>
    (await client.post(`/api/v1/travel/trips/${tripId}/checklist`, data)).data,
  toggleChecklistItem: async (itemId: number): Promise<ChecklistItemResponse> =>
    (await client.patch(`/api/v1/travel/checklist/${itemId}/toggle`)).data,
  deleteChecklistItem: async (itemId: number): Promise<void> => {
    await client.delete(`/api/v1/travel/checklist/${itemId}`);
  },
};


export const aiApi = {
  chat: async (message: string): Promise<{ message: string; saved: boolean; module: string | null }> =>
    (await client.post('/api/v1/ai/chat', { message })).data,
};
