import axios from 'axios';
import { showToast } from '@/lib/toast';
import type {
  RoadmapResponse, RoadmapItemResponse, CategoryResponse, FinanceSummaryResponse, AssetRecordResponse,
  ExerciseLogResponse, SleepLogResponse, HealthSummaryResponse,
  BookRecordResponse, EnglishLogResponse, GrowthSummaryResponse,
  CareerSettingsResponse, CFRatingLogResponse, CareerSummaryResponse,
  OverviewResponse,
  TripResponse, ChecklistItemResponse, TravelSummaryResponse, TripPlanItemResponse,
} from '@/types';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export const client = axios.create({ baseURL: BASE, timeout: 10000 });

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
      // 토큰이 있을 때만 리다이렉트 (로그인 시도 실패는 호출자가 처리)
      const token = localStorage.getItem('token');
      if (token) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        return Promise.reject(err);
      }
    }
    // API가 반환한 detail 메시지를 err.message에 노출 (호출자가 선택적으로 사용 가능)
    const detail = err.response?.data?.detail;
    if (detail && typeof detail === 'string') {
      err.message = detail;
    } else if (!err.response) {
      err.message = '서버에 연결할 수 없습니다. 네트워크를 확인해주세요.';
    } else if (err.response.status >= 500) {
      err.message = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
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
  getSummary: async (recordsLimit = 20, recordsOffset = 0): Promise<FinanceSummaryResponse> =>
    (await client.get('/api/v1/finance/summary', { params: { records_limit: recordsLimit, records_offset: recordsOffset } })).data,
  listRecords: async (limit = 20, offset = 0): Promise<AssetRecordResponse[]> =>
    (await client.get('/api/v1/finance/records', { params: { limit, offset } })).data,
  createRecord: async (data: {
    record_date: string; total_assets: number;
    monthly_income: number; monthly_expense: number; note?: string;
  }): Promise<AssetRecordResponse> =>
    (await client.post('/api/v1/finance/records', data)).data,
  updateRecord: async (id: number, data: Partial<{
    total_assets: number; monthly_income: number; monthly_expense: number; note: string;
  }>): Promise<AssetRecordResponse> =>
    (await client.put(`/api/v1/finance/records/${id}`, data)).data,
  deleteRecord: async (id: number): Promise<void> => {
    await client.delete(`/api/v1/finance/records/${id}`);
  },
};

export const healthApi = {
  getSummary: async (): Promise<HealthSummaryResponse> =>
    (await client.get('/api/v1/health/summary')).data,
  listExercise: async (limit = 20, offset = 0): Promise<ExerciseLogResponse[]> =>
    (await client.get('/api/v1/health/exercise', { params: { limit, offset } })).data,
  createExercise: async (data: {
    log_date: string; exercise_type: string; duration_minutes: number; note?: string;
  }): Promise<ExerciseLogResponse> =>
    (await client.post('/api/v1/health/exercise', data)).data,
  deleteExercise: async (id: number) => { await client.delete(`/api/v1/health/exercise/${id}`); },
  updateExercise: async (id: number, data: Partial<{
    exercise_type: string; duration_minutes: number; note: string;
  }>): Promise<ExerciseLogResponse> =>
    (await client.put(`/api/v1/health/exercise/${id}`, data)).data,
  listSleep: async (limit = 20, offset = 0): Promise<SleepLogResponse[]> =>
    (await client.get('/api/v1/health/sleep', { params: { limit, offset } })).data,
  createSleep: async (data: {
    log_date: string; sleep_hours: number; quality: number; note?: string;
  }): Promise<SleepLogResponse> =>
    (await client.post('/api/v1/health/sleep', data)).data,
  deleteSleep: async (id: number) => { await client.delete(`/api/v1/health/sleep/${id}`); },
  updateSleep: async (id: number, data: Partial<{
    sleep_hours: number; quality: number; note: string;
  }>): Promise<SleepLogResponse> =>
    (await client.put(`/api/v1/health/sleep/${id}`, data)).data,
};

export const growthApi = {
  getSummary: async (): Promise<GrowthSummaryResponse> =>
    (await client.get('/api/v1/growth/summary')).data,
  listBooks: async (limit = 20, offset = 0): Promise<BookRecordResponse[]> =>
    (await client.get('/api/v1/growth/books', { params: { limit, offset } })).data,
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
  listEnglish: async (limit = 20, offset = 0): Promise<EnglishLogResponse[]> =>
    (await client.get('/api/v1/growth/english', { params: { limit, offset } })).data,
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
  listCFRatings: async (limit = 20, offset = 0): Promise<CFRatingLogResponse[]> =>
    (await client.get('/api/v1/career/cf-ratings', { params: { limit, offset } })).data,
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
  addPlanItem: async (tripId: number, data: {
    day: number; title: string; time?: string; description?: string; sort_order?: number;
  }): Promise<TripPlanItemResponse> =>
    (await client.post(`/api/v1/travel/trips/${tripId}/plan`, data)).data,
  deletePlanItem: async (itemId: number): Promise<void> => {
    await client.delete(`/api/v1/travel/plan/${itemId}`);
  },
};


export type AiChatResponse = {
  reply: string;
  saved: boolean;
  module: string | null;
  action: string | null;
  pending_filter?: Record<string, unknown> | null;
};

export const aiApi = {
  chat: async (
    message: string,
    history: { role: string; text: string }[] = [],
  ): Promise<AiChatResponse> =>
    (await client.post('/api/v1/ai/chat', { message, history })).data,

  execute: async (
    module: string,
    filter: Record<string, unknown>,
  ): Promise<AiChatResponse> =>
    (await client.post('/api/v1/ai/execute', { module, filter })).data,

  weeklyReport: async (): Promise<{ report: string }> =>
    (await client.get('/api/v1/ai/weekly-report')).data,
};

async function _downloadCsv(url: string, filename: string): Promise<void> {
  try {
    const res = await client.get(url, { responseType: 'blob' });
    const href = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(href), 100);
  } catch {
    showToast('CSV 내보내기에 실패했습니다.', 'error');
  }
}

export const exportApi = {
  finance: () => _downloadCsv('/api/v1/export/finance', 'finance.csv'),
  exercise: () => _downloadCsv('/api/v1/export/health/exercise', 'exercise.csv'),
  sleep: () => _downloadCsv('/api/v1/export/health/sleep', 'sleep.csv'),
  books: () => _downloadCsv('/api/v1/export/growth/books', 'books.csv'),
  english: () => _downloadCsv('/api/v1/export/growth/english', 'english.csv'),
  career: () => _downloadCsv('/api/v1/export/career', 'career.csv'),
};
