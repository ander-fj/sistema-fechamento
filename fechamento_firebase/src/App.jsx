import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Fluxograma from './pages/Fluxograma';
import Etapas from './pages/Etapas';
import Cadastros from './pages/Cadastros';
import Empresas from './pages/Empresas';
import Relatorios from './pages/Relatorios';
import Notificacoes from './pages/Notificacoes';
import Historico from './pages/Historico';
import Importacao from './pages/Importacao';
import Usuarios from './pages/Usuarios';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route path="/" element={
        <PrivateRoute>
          <Layout />
        </PrivateRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="fluxograma" element={<Fluxograma />} />
        <Route path="etapas" element={<Etapas />} />
        <Route path="cadastros" element={<Cadastros />} />
        <Route path="empresas" element={<Empresas />} />
        <Route path="relatorios" element={<Relatorios />} />
        <Route path="notificacoes" element={<Notificacoes />} />
        <Route path="historico" element={<Historico />} />
        <Route path="importacao" element={<Importacao />} />
        <Route path="usuarios" element={<Usuarios />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
