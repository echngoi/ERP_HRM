import api from './api';

// --- Employee CRUD ---
export const getEmployees = (params) => api.get('/employees/', { params });
export const getEmployee = (id) => api.get(`/employees/${id}/`);
export const updateEmployee = (id, data) => {
  if (data instanceof FormData) {
    return api.patch(`/employees/${id}/`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }
  return api.patch(`/employees/${id}/`, data);
};

// --- My profile ---
export const getMyEmployeeProfile = () => api.get('/employees/me/');
export const requestMyProfileUpdate = (data) => {
  if (data instanceof FormData) {
    return api.patch('/employees/me/update/', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }
  return api.patch('/employees/me/update/', data);
};

// --- Config ---
export const getEmployeeConfig = () => api.get('/employees/config/');
export const updateEmployeeConfig = (data) => api.put('/employees/config/', data);

// --- Profile completeness check ---
export const checkProfileCompleteness = () => api.get('/employees/profile-check/');

// --- Update requests ---
export const getEmployeeUpdateRequests = (params) => api.get('/employee-update-requests/', { params });
export const approveEmployeeUpdate = (id, note) => api.post(`/employee-update-requests/${id}/approve/`, { note });
export const rejectEmployeeUpdate = (id, note) => api.post(`/employee-update-requests/${id}/reject/`, { note });

// --- Rewards ---
export const getRewards = (params) => api.get('/rewards/', { params });
export const getRecentRewards = (limit = 20) => api.get('/rewards/recent/', { params: { limit } });
export const createReward = (data) => api.post('/rewards/', data);
export const updateReward = (id, data) => api.put(`/rewards/${id}/`, data);
export const deleteReward = (id) => api.delete(`/rewards/${id}/`);
export const toggleRewardVisibility = (id) => api.post(`/rewards/${id}/toggle-visibility/`);
export const checkRewardPermission = () => api.get('/rewards/check-permission/');

// --- Dashboard ---
export const getBirthdaysThisMonth = (params) => api.get('/employees/birthdays/', { params });

// --- Vietnamese banks list ---
export const VIETNAM_BANKS = [
  'Vietcombank (VCB)',
  'VietinBank (CTG)',
  'BIDV',
  'Agribank',
  'Techcombank (TCB)',
  'MB Bank',
  'ACB',
  'VPBank',
  'SHB',
  'Sacombank (STB)',
  'HDBank',
  'TPBank',
  'LienVietPostBank (LPB)',
  'OCB',
  'SeABank',
  'VIB',
  'MSB',
  'Eximbank (EIB)',
  'ABBank',
  'BacABank',
  'BaoVietBank',
  'CBBank',
  'DongABank',
  'GPBank',
  'KienLongBank',
  'NamABank',
  'NCB',
  'PGBank',
  'PVcomBank',
  'SaigonBank (SGB)',
  'VietABank',
  'VietBank',
];
