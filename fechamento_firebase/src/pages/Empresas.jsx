import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Building2, Check, X, Trash2 } from 'lucide-react';

export default function Empresas() {
  const { empresas, empresaAtual, selecionarEmpresa, criarEmpresa, deletarEmpresa, perfilUsuario } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');  

  const handleCriar = async (e) => {
    e.preventDefault();
    if (!nome.trim()) return;
    
    setLoading(true);
    setError('');
    try {
      const novaEmpresa = await criarEmpresa({ nome, cnpj });
      // Seleciona a empresa recém-criada para garantir que a UI seja atualizada
      if (novaEmpresa) {
        selecionarEmpresa(novaEmpresa);
      }
      setNome('');
      setCnpj('');
      setShowModal(false);
    } catch (err) {
      console.error("Erro ao criar empresa:", err);
      setError(err.message || 'Ocorreu um erro. Verifique as permissões e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletar = async (e, empresa) => {
    e.stopPropagation(); // Impede que o evento de clique chegue ao card e selecione a empresa
    if (window.confirm(`Tem certeza que deseja excluir a empresa "${empresa.nome}"? Esta ação é irreversível e apagará todos os dados associados.`)) {
      try {
        await deletarEmpresa(empresa.id);
      } catch (err) {
        console.error("Erro ao deletar empresa:", err);
        alert(err.message);
      }
    }
  };

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Empresas</h1>
          <p className="text-slate-500">Gerencie suas empresas e organizações</p>
        </div>
        
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          Nova Empresa
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {empresas.map(empresa => (
          <div
            key={empresa.id}
            onClick={() => selecionarEmpresa(empresa)}
            className={`group relative bg-white rounded-xl shadow-sm p-6 cursor-pointer transition-all hover:shadow-md ${
              empresaAtual?.id === empresa.id ? 'ring-2 ring-primary-500' : 'hover:ring-2 hover:ring-slate-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">{empresa.nome}</h3>
                  {empresa.cnpj && <p className="text-sm text-slate-500">{empresa.cnpj}</p>}
                </div>
              </div>
              {empresaAtual?.id === empresa.id && (
                <div className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
              {/* Mostra o botão de deletar apenas se o usuário for admin da empresa selecionada */}
              {empresaAtual?.id === empresa.id && perfilUsuario?.perfil === 'admin' && (
                <button
                  onClick={(e) => handleDeletar(e, empresa)}
                  className="absolute top-3 right-3 p-2 text-slate-400 rounded-full hover:bg-red-100 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}

        {empresas.length === 0 && (
          <div className="col-span-full bg-white rounded-xl shadow-sm p-12 text-center">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 mb-4">Nenhuma empresa cadastrada</p>
            <button
              onClick={() => setShowModal(true)}
              className="text-primary-600 hover:underline"
            >
              Criar primeira empresa
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slideIn">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">Nova Empresa</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <form onSubmit={handleCriar} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
                  <strong>Erro:</strong> {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Nome da empresa"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ</label>
                <input
                  type="text"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="00.000.000/0000-00"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-primary-400"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Criar'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
