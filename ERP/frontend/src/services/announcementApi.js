import api from './api';

export const getActiveAnnouncements = () => api.get('/announcements/active/');

export const getAnnouncements = () => api.get('/announcements/');
export const createAnnouncement = (data) => api.post('/announcements/', data);
export const updateAnnouncement = (id, data) => api.patch(`/announcements/${id}/`, data);
export const deleteAnnouncement = (id) => api.delete(`/announcements/${id}/`);
