import { http } from './http.js';

export const profilePhotoService = {
  async get() {
    const response = await http('/api/profile/photo', { raw: true });
    if (response.status === 204) return null;
    return URL.createObjectURL(await response.blob());
  },
  save: (image) => http('/api/profile/photo', { method: 'PUT', body: { image } }),
  remove: () => http('/api/profile/photo', { method: 'DELETE' }),
};
