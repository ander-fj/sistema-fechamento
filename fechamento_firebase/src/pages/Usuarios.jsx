import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUsuarios, convidarUsuario, atualizarPerfilUsuario } from '../services/database';
import { Users, Plus, X, Mail, Shield } from 'lucide-react';

const perfisDisponiveis = [
  { id: 'admin', nome: 'Administrador' },
  { id: 'usuario', nome: 'Usuário' },
  { id: 'leitor', nome: 'Leitor' },
];

export default function Usuarios() {
  const { empresaAtual, user } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ email: '', perfil: 'usuario' });

  useEffect(() => {
    if (!empresaAtual) {
      setUsuarios([]);
      return;
    }

    const unsubscribe = getUsuarios(empresaAtual.id, setUsuarios);
    return () => unsubscribe();
  }, [empresaAtual]);

  const handleConvidar = async (e) => {
    e.preventDefault();
    if (!form.email) return;

    try {
      await convidarUsuario(empresaAtual.id, form, user.id, user.name);
      setShowModal(false);
      setForm({ email: '', perfil: 'usuario' });
    } catch (error) {
      console.error("Erro ao convidar usuário:", error);
      alert("Não foi possível convidar o usuário. Verifique o e-mail e tente novamente.");
    }
  };

  const handlePerfilChange = async (usuarioId, novoPerfil) => {
    try {
      await atualizarPerfilUsuario(empresaAtual.id, usuarioId, { perfil: novoPerfil }, user.id, user.name);
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      alert("Não foi possível atualizar o perfil do usuário.");
    }
  };

  if (!empresaAtual) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <p className="text-slate-500">Selecione uma empresa para gerenciar os usuários.</p>
      </div>
    );
  }

  // Proteção de Rota: Apenas administradores podem ver esta página
  if (user?.perfil !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <p className="text-slate-500">Você não tem permissão para acessar esta página.</p>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gerenciamento de Usuários</h1>
          <p className="text-slate-500">Convide e gerencie os perfis de acesso da sua equipe.</p>
        </div>
        <button
          onClick={() => {
            setForm({ email: '', perfil: 'usuario' });
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          Convidar Usuário
        </button>
      </div>

      {/* Tabela de Usuários */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">E-mail</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Perfil de Acesso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {usuarios.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-8 text-center text-slate-500">
                  Nenhum usuário encontrado para esta empresa.
                </td>
              </tr>
            ) : (
              usuarios.map((usuario) => (
                <tr key={usuario.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{usuario.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={usuario.perfil}
                      onChange={(e) => handlePerfilChange(usuario.id, e.target.value)}
                      className="px-3 py-1 border border-slate-200 rounded-lg text-sm bg-white"
                    >
                      {perfisDisponiveis.map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Convite */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slideIn">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">Convidar Novo Usuário</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleConvidar} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2"><Mail className="w-4 h-4" /> E-mail *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2"><Shield className="w-4 h-4" /> Perfil de Acesso</label>
                <select
                  value={form.perfil}
                  onChange={(e) => setForm({ ...form, perfil: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  {perfisDisponiveis.map(p => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">Enviar Convite</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}