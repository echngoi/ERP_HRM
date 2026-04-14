import api from './api';

export const getSiteConfig = () => api.get('/site-config/');

export const getSiteConfigAdmin = () => api.get('/site-config/admin/');

export const uploadSiteLogo = (key, file) => {
  const formData = new FormData();
  formData.append('key', key);
  formData.append('image', file);
  return api.post('/site-config/admin/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
