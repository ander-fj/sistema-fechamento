import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../contexts/AuthContext';
import { ChevronsLeft } from 'lucide-react';

export default function Layout() {
  const { sidebarAberto, toggleSidebar } = useAuth();

  return (
    <div className="relative min-h-screen bg-slate-50 flex">
      {/* Sidebar posicionado de forma fixa */}
      <Sidebar />

      {/* Conteúdo principal com margem dinâmica */}
      <main className={`flex-1 p-6 overflow-auto transition-all duration-300 ${sidebarAberto ? 'ml-64' : 'ml-0'}`}>
        <Outlet />
      </main>

      {/* Botão para controlar o sidebar */}
      <button
        onClick={toggleSidebar}
        className="fixed top-1/2 p-1.5 bg-slate-700 border border-slate-600 rounded-full text-slate-300 hover:bg-slate-600 hover:text-white transition-all duration-300 z-50"
        style={{ 
          left: sidebarAberto ? '16rem' : '0.5rem',
          transform: `translateY(-50%) ${sidebarAberto ? 'rotate(0deg)' : 'rotate(180deg)'}` 
        }}
        title={sidebarAberto ? 'Recolher menu' : 'Expandir menu'}
      >
        <ChevronsLeft className="w-4 h-4" />
      </button>
    </div>
  );
}
