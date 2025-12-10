import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getPeriodos, getEtapas, atualizarEtapa } from '../services/database';
import { Bell, Clock, AlertTriangle, Settings, Mail, Save } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

export default function Notificacoes() {
  const { empresaAtual, atualizarEmpresa } = useAuth();
  const [periodos, setPeriodos] = useState([]);
  const [periodoSelecionado, setPeriodoSelecionado] = useState(null);
  const [etapas, setEtapas] = useState([]);
  const [tab, setTab] = useState('alertas');
  const [emailAlerta, setEmailAlerta] = useState('');
  const [salvandoEmail, setSalvandoEmail] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [configNotificacoes, setConfigNotificacoes] = useState({
    alertasEmail: false,
    alertasAtraso: true,
    diasAntecedencia: 3,
  });


  useEffect(() => {
    if (!empresaAtual) return;
    const unsubscribe = getPeriodos(empresaAtual.id, (data) => {
      setPeriodos(data);
      if (data.length > 0 && !periodoSelecionado) {
        setPeriodoSelecionado(data[0]);
      }
    });
    setEmailAlerta(empresaAtual.emailAlerta || '');
    setConfigNotificacoes({
      alertasEmail: empresaAtual.configNotificacoes?.alertasEmail || false,
      alertasAtraso: empresaAtual.configNotificacoes?.alertasAtraso !== false, // true por padrão
      diasAntecedencia: empresaAtual.configNotificacoes?.diasAntecedencia || 3,
    });
    return () => unsubscribe();
  }, [empresaAtual]);

  useEffect(() => {
    if (!empresaAtual || !periodoSelecionado) return;
    const unsubscribe = getEtapas(empresaAtual.id, periodoSelecionado.id, setEtapas);
    return () => unsubscribe();
  }, [empresaAtual, periodoSelecionado]);

  const handleSalvarEmailAlerta = async () => {
    if (!empresaAtual?.id) return;
    setSalvandoEmail(true);
    setFeedback('');
    try {
      await atualizarEmpresa(empresaAtual.id, { emailAlerta });
      setFeedback('E-mail salvo com sucesso!');
      setTimeout(() => setFeedback(''), 3000); // Limpa o feedback após 3 segundos
    } catch (error) {
      console.error("Erro ao salvar e-mail de alerta:", error);
      setFeedback('Erro ao salvar e-mail.');
    } finally {
      setSalvandoEmail(false);
    }
  };

  const handleSalvarConfig = async (novasConfig) => {
    if (!empresaAtual?.id) return;
    const configAtualizadas = { ...configNotificacoes, ...novasConfig };
    setConfigNotificacoes(configAtualizadas); // Atualiza o estado local imediatamente
    try {
      // Salva no banco de dados em segundo plano
      await atualizarEmpresa(empresaAtual.id, { configNotificacoes: configAtualizadas });
    } catch (error) {
      console.error("Erro ao salvar configurações de notificação:", error);
    }
  };

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const etapasProximasPrazo = etapas.filter(e => {
    if (e.dataReal) return false;
    if (!e.dataPrevista) return false;
    const prevista = new Date(e.dataPrevista);
    const dias = differenceInDays(prevista, hoje);
    return dias >= 0 && dias <= configNotificacoes.diasAntecedencia;
  });

  const etapasAtrasadas = etapas.filter(e => e.status === 'atrasado');

  if (!empresaAtual) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <p className="text-slate-500">Selecione uma empresa para ver notificações</p>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Notificações</h1>
          <p className="text-slate-500">Configure alertas automáticos para etapas do fechamento</p>
        </div>
        
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
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-200">
        <TabButton active={tab === 'alertas'} onClick={() => setTab('alertas')} icon={<Bell className="w-4 h-4" />} label="Alertas Pendentes" />
        <TabButton active={tab === 'config'} onClick={() => setTab('config')} icon={<Settings className="w-4 h-4" />} label="Configurações" />
      </div>

      {tab === 'alertas' && (
        <div className="space-y-6">
          {/* Próximas do prazo */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-yellow-500" />
              <h2 className="text-lg font-semibold text-slate-800">
                Etapas Próximas do Prazo ({etapasProximasPrazo.length})
              </h2>
            </div>
            <p className="text-sm text-slate-500 mb-4">Etapas que vencem nos próximos 3 dias</p>

            {etapasProximasPrazo.length === 0 ? (
              <p className="text-slate-500 text-center py-6">Nenhuma etapa próxima do prazo</p>
            ) : (
              <div className="space-y-2">
                {etapasProximasPrazo.map(etapa => {
                  const dias = differenceInDays(new Date(etapa.dataPrevista), hoje);
                  return (
                    <div key={etapa.id} className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
                      <div>
                       <p className="font-medium text-slate-800">{etapa.nome}</p>
                       {/* <input
                            type="checkbox"
                            id={`etapa-${etapa.id}`}
                            name={`etapa-${etapa.id}`}
                            value={etapa.nome}
                            className="mr-2"
                          /> */}
                         
                        <p className="font-medium text-slate-800">{etapa.nome}</p>
                        <p className="text-sm text-slate-500">{etapa.responsavel || 'Sem responsável'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-yellow-700">
                          {dias === 0 ? 'Vence hoje' : `Vence em ${dias} dia${dias > 1 ? 's' : ''}`}
                        </p>
                        <p className="text-xs text-slate-500">
                          {format(new Date(etapa.dataPrevista), 'dd/MM/yyyy')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Atrasadas */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h2 className="text-lg font-semibold text-slate-800">
                Etapas Atrasadas ({etapasAtrasadas.length})
              </h2>
            </div>
            <p className="text-sm text-slate-500 mb-4">Etapas com prazo vencido</p>
            
            {etapasAtrasadas.length === 0 ? (
              <p className="text-slate-500 text-center py-6">Nenhuma etapa atrasada</p>
            ) : (
              <div className="space-y-2">
                {etapasAtrasadas.map(etapa => {
                  const dias = differenceInDays(hoje, new Date(etapa.dataPrevista));
                  return (
                    <div key={etapa.id} className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                      <div>
                        <p className="font-medium text-slate-800">{etapa.nome}</p>
                        <p className="text-sm text-slate-500">{etapa.responsavel || 'Sem responsável'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-red-700">
                          {dias} dia{dias > 1 ? 's' : ''} de atraso
                        </p>
                        <p className="text-xs text-slate-500">
                          Prevista: {format(new Date(etapa.dataPrevista), 'dd/MM/yyyy')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'config' && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Configurações de Notificação</h2>
          
          {/* Configuração de Email */}
          <div className="p-4 bg-slate-50 rounded-lg mb-4">
            <div className="flex items-center gap-3 mb-3">
              <Mail className="w-5 h-5 text-slate-500" />
              <div>
                <p className="font-medium text-slate-800">E-mail para Alertas</p>
                <p className="text-sm text-slate-500">Configure o e-mail que receberá os alertas automáticos.</p>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="email"
                value={emailAlerta}
                onChange={(e) => setEmailAlerta(e.target.value)}
                placeholder="seu-email@exemplo.com"
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg"
              />
              <button onClick={handleSalvarEmailAlerta} disabled={salvandoEmail} className="flex items-center justify-center gap-2 w-32 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-slate-400">
                {salvandoEmail ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><Save className="w-4 h-4" /> Salvar</>}
              </button>
            </div>
            {feedback && <p className={`text-sm mt-2 ${feedback.includes('sucesso') ? 'text-green-600' : 'text-red-600'}`}>{feedback}</p>}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="font-medium text-slate-800">Alertas por Email</p>
                  <p className="text-sm text-slate-500">Enviar emails quando etapas estiverem próximas do prazo</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={configNotificacoes.alertasEmail}
                  onChange={(e) => handleSalvarConfig({ alertasEmail: e.target.checked })}
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="font-medium text-slate-800">Alertas de Atraso</p>
                  <p className="text-sm text-slate-500">Notificar quando etapas ficarem atrasadas</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={configNotificacoes.alertasAtraso}
                  onChange={(e) => handleSalvarConfig({ alertasAtraso: e.target.checked })}
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="font-medium text-slate-800 mb-2">Dias de Antecedência</p>
              <p className="text-sm text-slate-500 mb-3">Quantos dias antes do prazo enviar alertas</p>
              <select
                value={configNotificacoes.diasAntecedencia}
                onChange={(e) => handleSalvarConfig({ diasAntecedencia: parseInt(e.target.value) })}
                className="px-3 py-2 border border-slate-200 rounded-lg"
              >
                <option value="1">1 dia</option>
                <option value="2">2 dias</option>
                <option value="3">3 dias</option>
                <option value="5">5 dias</option>
              </select>
            </div>
          </div>
        </div>
      )}
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
