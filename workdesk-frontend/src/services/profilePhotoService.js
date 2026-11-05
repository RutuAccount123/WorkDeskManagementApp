import { http } from './http.js';

const photoPath = (employeeId) => employeeId == null ? '/api/profile/photo' : `/api/employees/${employeeId}/photo`;

export const profilePhotoService = {
  async get(employeeId) {
    const response = await http(photoPath(employeeId), { raw: true });
    if (response.status === 204) return null;
    return URL.createObjectURL(await response.blob());
  },
  save: (image, employeeId) => http(photoPath(employeeId), { method: 'PUT', body: { image } }),
  remove: (employeeId) => http(photoPath(employeeId), { method: 'DELETE' }),
};
