import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  GitBranch, 
  ListChecks, 
  FileText, 
  Bell, 
  History, 
  Upload, 
  Settings,
  Building2,
  LogOut,
  ChevronDown,
  Users
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useState } from 'react';

const menuItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/fluxograma', icon: GitBranch, label: 'Fluxograma' },
  { path: '/etapas', icon: ListChecks, label: 'Etapas' },
  { path: '/relatorios', icon: FileText, label: 'Relatórios' },
  { path: '/notificacoes', icon: Bell, label: 'Notificações' },
  { path: '/historico', icon: History, label: 'Histórico' },
  { path: '/importacao', icon: Upload, label: 'Importação' },
  { path: '/cadastros', icon: Settings, label: 'Cadastros' },
  { path: '/usuarios', icon: Users, label: 'Usuários' },
  { path: '/empresas', icon: Building2, label: 'Empresas' },
];

export default function Sidebar() {
  const { user, logout, empresaAtual, empresas, selecionarEmpresa, sidebarAberto } = useAuth();
  const [showEmpresas, setShowEmpresas] = useState(false);

  return (
    <aside className={`fixed top-0 left-0 h-full z-40 bg-slate-800 text-white flex flex-col transition-all duration-300 ${
      sidebarAberto ? 'w-64' : 'w-0 overflow-hidden'
    }`}
    >
      {/* Logo */}
      <div className="p-4 border-b border-slate-700">
        <h1 className="text-lg font-bold text-primary-400">Fechamento Contábil</h1>
      </div>

      {/* Seletor de Empresa */}
      {empresaAtual && (
        <div className="p-4 border-b border-slate-700">
          <button
            onClick={() => setShowEmpresas(!showEmpresas)}
            className="w-full flex items-center justify-between text-sm bg-slate-700 rounded-lg p-2 hover:bg-slate-600 transition-colors"
          >
            <span className="truncate">{empresaAtual.nome}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showEmpresas ? 'rotate-180' : ''}`} />
          </button>
          
          {showEmpresas && empresas.length > 1 && (
            <div className="mt-2 bg-slate-700 rounded-lg overflow-hidden">
              {empresas.map(empresa => (
                <button
                  key={empresa.id}
                  onClick={() => {
                    selecionarEmpresa(empresa);
                    setShowEmpresas(false);
                  }}
                  className={`w-full text-left p-2 text-sm hover:bg-slate-600 transition-colors ${
                    empresa.id === empresaAtual.id ? 'bg-slate-600' : ''
                  }`}
                >
                  {empresa.nome}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Menu */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {menuItems
            .filter(item => {
              return item.path !== '/usuarios' || user?.perfil === 'admin';
            }).map(item => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Usuário */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-3 mb-3">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center">
              {user?.name?.charAt(0) || 'U'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
