import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthContext.jsx';
import PublicFormPage from '@/features/public-form/PublicFormPage.jsx';
import AppRoutes from './AppRoutes.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* shareable FMS form links: open without signing in */}
        <Route path="/f/:token" element={<PublicFormPage />} />
        <Route path="*" element={<AuthProvider><AppRoutes /></AuthProvider>} />
      </Routes>
    </BrowserRouter>
  );
}
