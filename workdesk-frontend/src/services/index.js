// Every call to the backend goes through one of these services.
// To connect a different backend, only this folder changes — screens stay the same.
export { authService } from './authService.js';
export { employeeService } from './employeeService.js';
export { taskService } from './taskService.js';
export { recurringService } from './recurringService.js';
export { holidayService } from './holidayService.js';
export { notificationService } from './notificationService.js';
export { reportService } from './reportService.js';
export { workflowService } from './workflowService.js';
export { profilePhotoService } from './profilePhotoService.js';
