import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import AppLayout from '@/components/layout/AppLayout.jsx';
import LoginPage from '@/features/auth/LoginPage.jsx';
import AdminDashboardPage from '@/features/dashboard/AdminDashboardPage.jsx';
import MyWorkPage from '@/features/my-work/MyWorkPage.jsx';
import TasksPage from '@/features/tasks/TasksPage.jsx';
import TaskDetailPage from '@/features/tasks/TaskDetailPage.jsx';
import EmployeesPage from '@/features/employees/EmployeesPage.jsx';
import EmployeeDetailPage from '@/features/employees/EmployeeDetailPage.jsx';
import RecurringPage from '@/features/recurring/RecurringPage.jsx';
import HolidaysPage from '@/features/holidays/HolidaysPage.jsx';
import WorkflowsPage from '@/features/workflows/WorkflowsPage.jsx';
import WorkflowEditorPage from '@/features/workflows/WorkflowEditorPage.jsx';
import WorkflowSheetPage from '@/features/workflows/WorkflowSheetPage.jsx';
import ReportsPage from '@/features/reports/ReportsPage.jsx';
import AccountPage from '@/features/account/AccountPage.jsx';

/** Every screen in the app, and who can open it. */
export default function AppRoutes() {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <div className="boot">Loading…</div>;
  if (!user) return <LoginPage />;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* shared */}
        <Route index element={isAdmin ? <AdminDashboardPage /> : <MyWorkPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="tasks/:id" element={<TaskDetailPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="holidays" element={<HolidaysPage />} />
        <Route path="workflows" element={<WorkflowsPage />} />
        <Route path="workflows/new" element={<WorkflowEditorPage />} />
        <Route path="workflows/:id/sheet" element={<WorkflowSheetPage />} />
        <Route path="workflows/:id" element={<WorkflowSheetPage />} />
        <Route path="workflows/:id/edit" element={<WorkflowEditorPage />} />
        <Route path="account" element={<AccountPage />} />

        {/* admin only */}
        {isAdmin && <Route path="employees" element={<EmployeesPage />} />}
        {isAdmin && <Route path="employees/:id" element={<EmployeeDetailPage />} />}
        {isAdmin && <Route path="recurring" element={<RecurringPage />} />}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
