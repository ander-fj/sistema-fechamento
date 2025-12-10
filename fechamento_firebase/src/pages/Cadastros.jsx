import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  getPeriodos, criarPeriodo, atualizarPeriodo,
  getAreas, criarArea, deletarArea,
  getResponsaveis, criarResponsavel, deletarResponsavel,
  getTemplates, criarTemplate, deletarTemplate,
  deletarPeriodo
} from '../services/database';
import { Plus, Trash2, Calendar, Users, FolderTree, FileText, Edit, Check, X } from 'lucide-react';

export default function Cadastros() {
  const { empresaAtual } = useAuth();
  const [tab, setTab] = useState('periodos');
  
  const [periodos, setPeriodos] = useState([]);
  const [areas, setAreas] = useState([]);
  const [responsaveis, setResponsaveis] = useState([]);
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    if (!empresaAtual?.id) return;
    
    const unsubPeriodos = getPeriodos(empresaAtual.id, setPeriodos);
    const unsubAreas = getAreas(empresaAtual.id, setAreas);
    const unsubResp = getResponsaveis(empresaAtual.id, setResponsaveis);
    const unsubTemplates = getTemplates(empresaAtual.id, setTemplates);
    
    return () => {
      unsubPeriodos();
      unsubAreas();
      unsubResp();
      unsubTemplates();
    };
  }, [empresaAtual]);

  if (!empresaAtual?.id) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <p className="text-slate-500">Selecione uma empresa para gerenciar cadastros</p>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Cadastros</h1>
        <p className="text-slate-500">Gerencie períodos, áreas, responsáveis e templates</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-200">
        <TabButton active={tab === 'periodos'} onClick={() => setTab('periodos')} icon={<Calendar className="w-4 h-4" />} label="Períodos" />
        <TabButton active={tab === 'areas'} onClick={() => setTab('areas')} icon={<FolderTree className="w-4 h-4" />} label="Áreas" />
        <TabButton active={tab === 'responsaveis'} onClick={() => setTab('responsaveis')} icon={<Users className="w-4 h-4" />} label="Responsáveis" />
        <TabButton active={tab === 'templates'} onClick={() => setTab('templates')} icon={<FileText className="w-4 h-4" />} label="Templates" />
      </div>

      {/* Conteúdo */}
      {tab === 'periodos' && <PeriodosTab empresaId={empresaAtual.id} periodos={periodos} />}
      {tab === 'areas' && <AreasTab empresaId={empresaAtual.id} areas={areas} />}
      {tab === 'responsaveis' && <ResponsaveisTab empresaId={empresaAtual.id} responsaveis={responsaveis} areas={areas} />}
      {tab === 'templates' && <TemplatesTab empresaId={empresaAtual.id} templates={templates} areas={areas} responsaveis={responsaveis} />}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
        active 
          ? 'border-primary-600 text-primary-600' 
          : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function PeriodosTab({ empresaId, periodos }) {
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [ano, setAno] = useState(new Date().getFullYear());

  const [editingPeriodoId, setEditingPeriodoId] = useState(null);
  const [editedMes, setEditedMes] = useState(0);
  const [editedAno, setEditedAno] = useState(0);
  const [isLoading, setIsLoading] = useState(false);


  const handleCriar = async () => {
    // 1. Verificação de segurança para garantir que empresaId existe.
    if (!empresaId) {
      alert("ID da empresa não encontrado. Selecione uma empresa novamente.");
      return;
    }

    // Verifica se o período já existe
    const periodoExistente = periodos.find(p => p.mes === mes && p.ano === ano);
    if (periodoExistente) {
      alert(`O período ${mes}/${ano} já existe.`);
      return;
    }
    
    setIsLoading(true);
    try {
      await criarPeriodo(empresaId, { mes, ano });
    } catch (error) {
      console.error("Erro ao criar período e importar etapas:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async (periodo) => {
    const novoStatus = periodo.status === 'aberto' ? 'fechado' : 'aberto';
    await atualizarPeriodo(empresaId, periodo.id, { status: novoStatus });
  };

  const handleEdit = (periodo) => {
    setEditingPeriodoId(periodo.id);
    setEditedMes(periodo.mes);
    setEditedAno(periodo.ano);
  };

  const handleCancelEdit = () => {
    setEditingPeriodoId(null);
  };

  const handleSaveEdit = async (periodoId) => {
    await atualizarPeriodo(empresaId, periodoId, { mes: editedMes, ano: editedAno });
    setEditingPeriodoId(null);
  };

  const handleDelete = async (periodoId) => {
    if (confirm('Tem certeza que deseja excluir este período? Todas as etapas associadas a ele serão removidas permanentemente.')) {
      try {
        await deletarPeriodo(empresaId, periodoId);
      } catch (error) {
        console.error("Erro ao deletar período:", error);
        alert("Não foi possível excluir o período.");
      }
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex gap-4 mb-6">
        <select
          value={mes}
          onChange={(e) => setMes(parseInt(e.target.value))}
          className="px-3 py-2 border border-slate-200 rounded-lg"
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {new Date(2000, i, 1).toLocaleString('pt-BR', { month: 'long' })}
            </option>
          ))}
        </select>
        
        <input
          type="number"
          value={ano}
          onChange={(e) => setAno(parseInt(e.target.value))}
          className="w-24 px-3 py-2 border border-slate-200 rounded-lg"
        />
        
        <button
          onClick={handleCriar}
          disabled={!empresaId || isLoading} // 2. O botão é desabilitado na UI se não houver ID.
          className="flex items-center justify-center gap-2 w-36 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-slate-400"
        >
          {isLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><Plus className="w-4 h-4" /> Criar Período</>}
        </button>
      </div>

      <div className="space-y-2">
        {periodos.map(periodo => (
          <div key={periodo.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            {editingPeriodoId === periodo.id ? (
              <div className="flex-1 flex items-center gap-2">
                <select
                  value={editedMes}
                  onChange={(e) => setEditedMes(parseInt(e.target.value))}
                  className="px-3 py-1 border border-slate-300 rounded-lg"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2000, i, 1).toLocaleString('pt-BR', { month: 'long' })}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={editedAno}
                  onChange={(e) => setEditedAno(parseInt(e.target.value))}
                  className="w-24 px-3 py-1 border border-slate-300 rounded-lg"
                />
                <button onClick={() => handleSaveEdit(periodo.id)} className="p-2 text-green-600 hover:bg-green-100 rounded-full"><Check className="w-4 h-4" /></button>
                <button onClick={handleCancelEdit} className="p-2 text-red-600 hover:bg-red-100 rounded-full"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <>
                <div>
                  <span className="font-medium text-slate-800">
                    {periodo.mes}/{periodo.ano}
                  </span>
                  <span className={`ml-3 text-xs px-2 py-1 rounded-full ${
                    periodo.status === 'aberto' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {periodo.status === 'aberto' ? 'Aberto' : 'Fechado'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleStatus(periodo)}
                    className={`text-sm font-medium ${
                      periodo.status === 'aberto'
                        ? 'text-red-600 hover:text-red-800'
                        : 'text-green-600 hover:text-green-800'
                    }`}
                  >
                    {periodo.status === 'aberto' ? 'Fechar período' : 'Reabrir período'}
                  </button>
                  <button onClick={() => handleEdit(periodo)} className="p-2 text-slate-500 hover:bg-slate-200 rounded-full"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(periodo.id)} className="p-2 text-slate-500 hover:bg-red-100 hover:text-red-600 rounded-full"><Trash2 className="w-4 h-4" /></button>
                </div>
              </>
            )}
          </div>
        ))}
        {periodos.length === 0 && (
          <p className="text-slate-500 text-center py-8">Nenhum período cadastrado</p>
        )}
      </div>
    </div>
  );
}

function AreasTab({ empresaId, areas }) {
  const [nome, setNome] = useState('');

  const handleCriar = async () => {
    if (!nome.trim()) return;
    await criarArea(empresaId, { nome });
    setNome('');
  };

  const handleDeletar = async (areaId) => {
    if (confirm('Deseja excluir esta área?')) {
      await deletarArea(empresaId, areaId);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex gap-4 mb-6">
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome da área"
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg"
        />
        <button
          onClick={handleCriar}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          Adicionar
        </button>
      </div>

      <div className="space-y-2">
        {areas.map(area => (
          <div key={area.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <span className="text-slate-800">{area.nome}</span>
            <button
              onClick={() => handleDeletar(area.id)}
              className="p-1 text-slate-400 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {areas.length === 0 && (
          <p className="text-slate-500 text-center py-8">Nenhuma área cadastrada</p>
        )}
      </div>
    </div>
  );
}

function ResponsaveisTab({ empresaId, responsaveis, areas }) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [area, setArea] = useState('');

  const handleCriar = async () => {
    if (!nome.trim()) return;
    await criarResponsavel(empresaId, { nome, email, area: area || null });
    setNome('');
    setEmail('');
    setArea('');
  };

  const handleDeletar = async (respId) => {
    if (confirm('Deseja excluir este responsável?')) {
      await deletarResponsavel(empresaId, respId);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome"
          className="px-3 py-2 border border-slate-200 rounded-lg"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="px-3 py-2 border border-slate-200 rounded-lg"
        />
        <select
          value={area}
          onChange={(e) => setArea(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg"
        >
          <option value="">Área</option>
          {areas.map(a => (
            <option key={a.id} value={a.nome}>{a.nome}</option>
          ))}
        </select>
        <button
          onClick={handleCriar}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          Adicionar
        </button>
      </div>

      <div className="space-y-2">
        {responsaveis.map(resp => (
          <div key={resp.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div>
              <span className="font-medium text-slate-800">{resp.nome}</span>
              {resp.email && <span className="text-sm text-slate-500 ml-2">{resp.email}</span>}
              {resp.area && <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded ml-2">{resp.area}</span>}
            </div>
            <button
              onClick={() => handleDeletar(resp.id)}
              className="p-1 text-slate-400 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {responsaveis.length === 0 && (
          <p className="text-slate-500 text-center py-8">Nenhum responsável cadastrado</p>
        )}
      </div>
    </div>
  );
}

function TemplatesTab({ empresaId, templates, areas, responsaveis }) {
  const [nome, setNome] = useState('');
  const [area, setArea] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [ordem, setOrdem] = useState(0);

  useEffect(() => {
    setOrdem((templates.length > 0 ? Math.max(...templates.map(t => t.ordem || 0)) : 0) + 1);
  }, [templates]);

  const handleCriar = async () => {
    if (!nome.trim()) return;
    await criarTemplate(empresaId, { 
      nome, 
      area: area || null, 
      responsavel: responsavel || null, 
      ordem: Number.isInteger(parseInt(ordem)) ? parseInt(ordem) : 0
    });
    setNome('');
    setArea('');
    setResponsavel('');
  };

  const handleDeletar = async (templateId) => {
    if (confirm('Deseja excluir este template?')) {
      await deletarTemplate(empresaId, templateId);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <p className="text-sm text-slate-500 mb-4">
        Templates são modelos de etapas que podem ser aplicados automaticamente a novos períodos.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome da etapa"
          className="px-3 py-2 border border-slate-200 rounded-lg"
        />
        <select
          value={area}
          onChange={(e) => setArea(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg"
        >
          <option value="">Área</option>
          {areas.map(a => (
            <option key={a.id} value={a.nome}>{a.nome}</option>
          ))}
        </select>
        <select
          value={responsavel}
          onChange={(e) => setResponsavel(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg"
        >
          <option value="">Responsável</option>
          {responsaveis.map(r => (
            <option key={r.id} value={r.nome}>{r.nome}</option>
          ))}
        </select>
        <input
          type="number"
          value={ordem}
          onChange={(e) => setOrdem(parseInt(e.target.value))}
          placeholder="D+"
          min="0"
          className="px-3 py-2 border border-slate-200 rounded-lg"
        />
        <button
          onClick={handleCriar}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          Adicionar
        </button>
      </div>

      <div className="space-y-2">
        {templates.sort((a, b) => a.ordem - b.ordem).map(template => (
          <div key={template.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-slate-500">D+{template.ordem}</span>
              <span className="font-medium text-slate-800">{template.nome}</span>
              {template.area && <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded">{template.area}</span>}
              {template.responsavel && <span className="text-sm text-slate-500">{template.responsavel}</span>}
            </div>
            <button
              onClick={() => handleDeletar(template.id)}
              className="p-1 text-slate-400 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {templates.length === 0 && (
          <p className="text-slate-500 text-center py-8">Nenhum template cadastrado</p>
        )}
      </div>
    </div>
  );
}
