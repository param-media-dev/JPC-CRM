import { Candidate, User, Payment, FollowUp, InterviewRequest, ActivityLog, Application, Notification as AppNotification } from '../types';

const BASE_URL = '/api/jpc';

class ApiService {
  private token: string | null = localStorage.getItem('jpc_auth_token');

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('jpc_auth_token', token);
    } else {
      localStorage.removeItem('jpc_auth_token');
    }
  }

  public async request(endpoint: string, options: RequestInit = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    } as any;

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
      // Token expired or invalid
      this.setToken(null);
      window.location.hash = '#login';
      throw new Error('Authentication expired. Please login again.');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'API request failed');
    }

    return data;
  }

  // Auth
  async login(credentials: any) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    this.setToken(data.token);
    return data.user;
  }

  async getMe() {
    return this.request('/auth/me');
  }

  async getStats() {
    return this.request('/dashboard/stats');
  }

  // Candidates
  async getCandidates(params?: { stage?: string; search?: string; page?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.stage) searchParams.append('stage', params.stage);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.page) searchParams.append('page', String(params.page));
    
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request(`/candidates${query}`);
  }

  async getCandidate(id: string) {
    return this.request(`/candidates/${id}`);
  }

  async createCandidate(candidate: any) {
    return this.request('/candidates', {
      method: 'POST',
      body: JSON.stringify(candidate),
    });
  }

  async updateCandidate(id: string, updates: any) {
    return this.request(`/candidates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteCandidate(id: string) {
    return this.request(`/candidates/${id}`, {
      method: 'DELETE',
    });
  }

  async moveCandidateStage(id: string, stage: string) {
    return this.request(`/candidates/${id}/move-stage`, {
      method: 'POST',
      body: JSON.stringify({ stage }),
    });
  }

  async updateCandidateFlags(id: string, flags: any) {
    return this.request(`/candidates/${id}/flags`, {
      method: 'PUT',
      body: JSON.stringify(flags),
    });
  }

  // Related data for candidates
  async getCandidatePayments(id: string) {
    return this.request(`/candidates/${id}/payments`);
  }

  async getCandidateFollowups(id: string) {
    return this.request(`/candidates/${id}/followups`);
  }

  async getCandidateInterviews(id: string) {
    return this.request(`/candidates/${id}/interviews`);
  }

  async getCandidateApplications(id: string) {
    return this.request(`/candidates/${id}/applications`);
  }

  async getCandidateLogs(id: string) {
    return this.request(`/candidates/${id}/logs`);
  }

  // Users
  async getUsers(): Promise<User[]> {
    let allUsers: User[] = [];
    let currentPage = 1;
    let totalPages = 1;

    try {
      do {
        const response = await this.request(`/users?page=${currentPage}`);
        
        let users: User[] = [];
        if (Array.isArray(response)) {
          users = response;
          totalPages = 1;
        } else if (response && typeof response === 'object' && Array.isArray((response as any).data)) {
          users = (response as any).data;
          totalPages = (response as any).total_pages || 1;
        }
        
        allUsers = [...allUsers, ...users];
        currentPage++;
      } while (currentPage <= totalPages);
      
      return allUsers;
    } catch (error) {
      console.error('Error fetching all users:', error);
      return [];
    }
  }

  async getUser(id: string | number) {
    return this.request(`/users/${id}`);
  }

  async createUser(user: any) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(user),
    });
  }

  async updateUser(id: string | number, updates: any) {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // Payments
  async getPayments(params?: { status?: 'paid' | 'pending'; candidate_id?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.candidate_id) searchParams.append('candidate_id', params.candidate_id);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request(`/payments${query}`);
  }

  async createPayment(payment: any) {
    return this.request('/payments', {
      method: 'POST',
      body: JSON.stringify(payment),
    });
  }

  async updatePayment(id: string | number, updates: any) {
    return this.request(`/payments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // Follow-ups
  async getFollowups(params?: { done?: 0 | 1; date?: string; candidate_id?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.done !== undefined) searchParams.append('done', String(params.done));
    if (params?.date) searchParams.append('date', params.date);
    if (params?.candidate_id) searchParams.append('candidate_id', params.candidate_id);
    
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request(`/followups${query}`);
  }

  async createFollowup(followup: any) {
    return this.request('/followups', {
      method: 'POST',
      body: JSON.stringify(followup),
    });
  }

  async updateFollowup(id: string | number, updates: any) {
    return this.request(`/followups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // Interviews
  async getInterviews(params?: { status?: 'scheduled' | 'completed'; candidate_id?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.candidate_id) searchParams.append('candidate_id', params.candidate_id);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request(`/interviews${query}`);
  }

  async createInterview(interview: any) {
    return this.request('/interviews', {
      method: 'POST',
      body: JSON.stringify(interview),
    });
  }

  async updateInterview(id: string | number, updates: any) {
    return this.request(`/interviews/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // Job Applications
  async getApplications(params?: { sheetType?: string; candidate_id?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.sheetType) searchParams.append('sheet_type', params.sheetType);
    if (params?.candidate_id) searchParams.append('candidate_id', params.candidate_id);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request(`/applications${query}`);
  }

  async createApplication(application: any) {
    return this.request('/applications', {
      method: 'POST',
      body: JSON.stringify(application),
    });
  }

  // Logs
  async getLogs(date?: string) {
    const query = date ? `?date=${date}` : '';
    return this.request(`/logs${query}`);
  }

  // Generic list fetch for any collection
  async getCollection(collectionName: string, params?: Record<string, string>) {
    const searchParams = new URLSearchParams(params);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request(`/${collectionName}${query}`);
  }
}

export const apiService = new ApiService();
