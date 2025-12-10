import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getPeriodos, getEtapas, getAreas, getResponsaveis, criarEtapa, atualizarEtapa, deletarEtapa, getStatusColor, getStatusLabel } from '../services/database';
import { format } from 'date-fns';
import { Plus, Edit2, Trash2, X, Check, Filter } from 'lucide-react';

export default function Etapas() {
  const { empresaAtual, user } = useAuth();
  const [periodos, setPeriodos] = useState([]);
  const [periodoSelecionado, setPeriodoSelecionado] = useState(null);
  const [etapas, setEtapas] = useState([]);
  const [areas, setAreas] = useState([]);
  const [responsaveis, setResponsaveis] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [etapaEditando, setEtapaEditando] = useState(null);
  const [filtros, setFiltros] = useState({ area: '', responsavel: '', status: '' });

  const [form, setForm] = useState({
    nome: '',
    descricao: '',
    area: '',
    responsavel: '',
    dataPrevista: '',
    dataReal: '',
    ordem: 1,
    observacoes: ''
  });

  useEffect(() => {
    if (!empresaAtual) return;
    
    const unsubPeriodos = getPeriodos(empresaAtual.id, (data) => {
      setPeriodos(data);
      if (data.length > 0 && !data.some(p => p.id === periodoSelecionado?.id)) {
        setPeriodoSelecionado(data[0]);
      }
    });
    
    const unsubAreas = getAreas(empresaAtual.id, setAreas);
    const unsubResp = getResponsaveis(empresaAtual.id, setResponsaveis);
    
    return () => {
      unsubPeriodos();
      unsubAreas();
      unsubResp();
    };
  }, [empresaAtual, periodoSelecionado]);

  useEffect(() => {
    if (!empresaAtual || !periodoSelecionado) return;
    const unsubscribe = getEtapas(empresaAtual.id, periodoSelecionado.id, setEtapas);
    return () => unsubscribe();
  }, [empresaAtual, periodoSelecionado]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Recalcula o status antes de salvar
    let novoStatus = etapaEditando?.status || 'pendente';
    const { dataPrevista, dataReal } = form;

    if (dataReal) {
      const dReal = new Date(dataReal.replace(/-/g, '/'));
      const dPrevista = dataPrevista ? new Date(dataPrevista.replace(/-/g, '/')) : null;

      if (dPrevista && dReal.getTime() < dPrevista.getTime()) {
        novoStatus = 'concluido_antecipado';
      } else if (dPrevista && dReal.getTime() > dPrevista.getTime()) {
        novoStatus = 'concluido_atraso';
      } else {
        novoStatus = 'concluido';
      }
    } else if (dataPrevista && new Date(dataPrevista.replace(/-/g, '/')) < new Date(new Date().setHours(0, 0, 0, 0))) {
      novoStatus = 'atrasado';
    }

    if (etapaEditando) {
      await atualizarEtapa(
        empresaAtual.id,
        periodoSelecionado.id,
        etapaEditando.id,
        // Inclui o status recalculado nos dados a serem salvos
        { ...form, status: novoStatus },
        user.id,
        user.name
      );
    } else {
      await criarEtapa(empresaAtual.id, periodoSelecionado.id, form);
    }
    
    setShowModal(false);
    setEtapaEditando(null);
    setForm({
      nome: '',
      descricao: '',
      area: '',
      responsavel: '',
      dataPrevista: '',
      dataReal: '',
      ordem: etapas.length + 1,
      observacoes: ''
    });
  };

  const handleEditar = (etapa) => {
    setEtapaEditando(etapa);
    setForm({
      nome: etapa.nome || '',
      descricao: etapa.descricao || '',
      area: etapa.area || '',
      responsavel: etapa.responsavel || '',
      dataPrevista: etapa.dataPrevista || '',
      dataReal: etapa.dataReal || '',
      ordem: etapa.ordem || 1,
      observacoes: etapa.observacoes || ''
    });
    setShowModal(true);
  };

  const handleDeletar = async (etapaId) => {
    if (confirm('Deseja realmente excluir esta etapa?')) {
      await deletarEtapa(empresaAtual.id, periodoSelecionado.id, etapaId);
    }
  };

  const etapasFiltradas = etapas.filter(etapa => {
    if (filtros.area && etapa.area !== filtros.area) return false;
    if (filtros.responsavel && etapa.responsavel !== filtros.responsavel) return false;
    if (filtros.status && etapa.status !== filtros.status) return false;
    return true;
  });

  const etapasOrdenadas = etapasFiltradas.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

  if (!empresaAtual) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <p className="text-slate-500">Selecione uma empresa para gerenciar etapas</p>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Etapas do Fechamento</h1>
          <p className="text-slate-500">Gerencie as etapas do fechamento contábil</p>
        </div>
        
        <div className="flex gap-3">
          <select
            value={periodoSelecionado?.id || ''}
            onChange={(e) => {
              const periodo = periodos.find(p => p.id === e.target.value);
              setPeriodoSelecionado(periodo);
            }}
            className="px-4 py-2 border border-slate-200 rounded-lg"
          >
            {periodos.map(p => (
              <option key={p.id} value={p.id}>{p.mes}/{p.ano}</option>
            ))}
          </select>
          
          <button
            onClick={() => {
              setEtapaEditando(null);
              setForm({
                nome: '',
                descricao: '',
                area: '',
                responsavel: '',
                dataPrevista: '',
                dataReal: '',
                ordem: (etapas.length > 0 ? Math.max(...etapas.map(e => e.ordem || 0)) : 0) + 1,
                observacoes: ''
              });
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            Nova Etapa
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Filtros</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select
            value={filtros.area}
            onChange={(e) => setFiltros({ ...filtros, area: e.target.value })}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
          >
            <option value="">Todas as áreas</option>
            {areas.map(a => (
              <option key={a.id} value={a.nome}>{a.nome}</option>
            ))}
          </select>
          
          <select
            value={filtros.responsavel}
            onChange={(e) => setFiltros({ ...filtros, responsavel: e.target.value })}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
          >
            <option value="">Todos os responsáveis</option>
            {responsaveis.map(r => (
              <option key={r.id} value={r.nome}>{r.nome}</option>
            ))}
          </select>
          
          <select
            value={filtros.status}
            onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
          >
            <option value="">Todos os status</option>
            <option value="concluido">Concluído</option>
            <option value="em_andamento">Em Andamento</option>
            <option value="pendente">Pendente</option>
            <option value="concluido_atraso">Concluído c/ Atraso</option>
            <option value="atrasado">Atrasado</option>
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">D+</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Etapa</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Área</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Responsável</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Data Prevista</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Data Real</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {etapasOrdenadas.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  Nenhuma etapa encontrada
                </td>
              </tr>
            ) : (
              etapasOrdenadas.map((etapa, index) => (
                <tr key={etapa.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">
                    D+{etapa.ordem || index}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-800">{etapa.nome}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{etapa.area || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{etapa.responsavel || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {etapa.dataPrevista && typeof etapa.dataPrevista === 'string'
                      ? format(new Date(etapa.dataPrevista.replace(/-/g, '/')), 'dd/MM/yyyy')
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {etapa.dataReal && typeof etapa.dataReal === 'string'
                      ? format(new Date(etapa.dataReal.replace(/-/g, '/')), 'dd/MM/yyyy')
                      : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full text-white ${getStatusColor(etapa.status)}`}>
                      {getStatusLabel(etapa.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditar(etapa)}
                        className="p-1 text-slate-400 hover:text-primary-600"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeletar(etapa.id)}
                        className="p-1 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-slideIn">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">
                {etapaEditando ? 'Editar Etapa' : 'Nova Etapa'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
                  <input
                    type="text"
                    required
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                  <textarea
                    value={form.descricao}
                    onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                    rows={2}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Área</label>
                  <input
                    type="text"
                    value={form.area || ''}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Digite a área"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Responsável</label>
                  <input
                    type="text"
                    value={form.responsavel || ''}
                    onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Digite o responsável"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data Prevista</label>
                  <input
                    type="date"
                    value={form.dataPrevista}
                    onChange={(e) => setForm({ ...form, dataPrevista: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data Real</label>
                  <input
                    type="date"
                    value={form.dataReal}
                    onChange={(e) => setForm({ ...form, dataReal: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ordem (D+)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.ordem}
                    onChange={(e) => setForm({ ...form, ordem: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
                  <textarea
                    value={form.observacoes}
                    onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    rows={2}
                  />
                </div>
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
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  {etapaEditando ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
