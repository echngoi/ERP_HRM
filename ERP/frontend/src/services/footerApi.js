import api from './api';

export const getActiveFooterItems = () => api.get('/footer-items/active/');

export const getFooterItems = () => api.get('/footer-items/');
export const createFooterItem = (data) => api.post('/footer-items/', data);
export const updateFooterItem = (id, data) => api.patch(`/footer-items/${id}/`, data);
export const deleteFooterItem = (id) => api.delete(`/footer-items/${id}/`);
