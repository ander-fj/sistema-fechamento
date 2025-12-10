import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getPeriodos, getEtapas, calcularIndicadores, getStatusColor, getStatusLabel } from '../services/database';
import { BarChart3, Clock, AlertTriangle, TrendingUp, PieChart as PieIcon, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Line, Label,
  AreaChart, Area, 
  RadialBarChart, RadialBar,
  ComposedChart, ReferenceLine
} from 'recharts';

const COLORS = {
  concluido: '#22c55e',
  concluido_atraso: '#f97316',
  em_andamento: '#3b82f6',
  pendente: '#eab308',
  atrasado: '#ef4444'
};

function Card({ title, value, subtitle, icon, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    red: 'bg-red-50 text-red-600',
    orange: 'bg-orange-50 text-orange-600',
    green: 'bg-green-50 text-green-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{value}</p>
          <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
        </div>
        <div className={`p-3 rounded-xl ${colors[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ color, label, count }) {
  const colors = {
    green: 'bg-green-500',
    orange: 'bg-orange-500',
    blue: 'bg-blue-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${colors[color]}`} />
      <span className="text-slate-600">{label}: {count}</span>
    </div>
  );
}

export default function Dashboard() {
  const { empresaAtual } = useAuth();
  const [periodos, setPeriodos] = useState([]);
  const [periodoSelecionado, setPeriodoSelecionado] = useState(null);
  const [etapas, setEtapas] = useState([]);
  const [isTimelineVisible, setIsTimelineVisible] = useState(true);
  const [areaSelecionada, setAreaSelecionada] = useState('Todas');

  useEffect(() => {
    if (!empresaAtual?.id) return;

    // Garante que o período selecionado seja limpo se não pertencer à empresa atual
    if (periodoSelecionado && !periodos.find(p => p.id === periodoSelecionado.id)) {
      setPeriodoSelecionado(null);
    }

    const unsubscribe = getPeriodos(empresaAtual.id, (data) => {
      setPeriodos(data);
      // Se nenhum período estiver selecionado, seleciona o primeiro da lista.
      if (data.length > 0 && !data.find(p => p.id === periodoSelecionado?.id)) {
        setPeriodoSelecionado(data[0]);
      }
    });
    return () => unsubscribe();
  }, [empresaAtual, periodos, periodoSelecionado]);

  useEffect(() => {
    if (!empresaAtual?.id || !periodoSelecionado) {
      setEtapas([]);
      return;
    }

    if (periodoSelecionado.id === 'todos') {
      setEtapas([]); // Limpa etapas antes de carregar as novas
      const unsubscribes = periodos.map(p => getEtapas(empresaAtual.id, p.id, (etapasPeriodo) => {
        setEtapas(prevEtapas => {
          const outrasEtapas = prevEtapas.filter(e => e.periodoId !== p.id);
          return [...outrasEtapas, ...etapasPeriodo.map(e => ({...e, periodoId: p.id}))];
        });
      }));
      return () => unsubscribes.forEach(unsub => unsub());
    } else {
      const unsubscribe = getEtapas(empresaAtual.id, periodoSelecionado.id, setEtapas);
      return () => unsubscribe();
    }
  }, [empresaAtual, periodoSelecionado, periodos]);

  const areas = useMemo(() => {
    const allAreas = new Set(etapas.map(e => e.area || 'Sem área'));
    return ['Todas', ...Array.from(allAreas)];
  }, [etapas]);

  const etapasFiltradas = useMemo(() => {
    if (areaSelecionada === 'Todas') {
      return etapas;
    }
    return etapas.filter(e => (e.area || 'Sem área') === areaSelecionada);
  }, [etapas, areaSelecionada]);

  const indicadores = useMemo(() => {
    return calcularIndicadores(etapasFiltradas);
  }, [etapasFiltradas]);

  const pieData = useMemo(() => {
    if (!indicadores) return [];
    return [
      { name: 'Concluído', value: indicadores.concluidas || 0, color: COLORS.concluido },
      { name: 'Concl. c/ Atraso', value: indicadores.concluidasComAtraso || 0, color: COLORS.concluido_atraso },
      { name: 'Em Andamento', value: indicadores.emAndamento || 0, color: COLORS.em_andamento },
      { name: 'Pendente', value: indicadores.pendentes || 0, color: COLORS.pendente },
      { name: 'Atrasado', value: indicadores.atrasadas || 0, color: COLORS.atrasado },
    ].filter(d => d.value > 0);
  }, [indicadores]);

  const barDataArea = useMemo(() => {
    const areaMap = {};
    etapasFiltradas.forEach(e => {
      const area = e.area || 'Sem área';
      if (!areaMap[area]) {
        areaMap[area] = { area, concluidas: 0, pendentes: 0, atrasadas: 0 };
      }
      if (e.status === 'concluido' || e.status === 'concluido_atraso') {
        areaMap[area].concluidas++;
      } else if (e.status === 'atrasado') {
        areaMap[area].atrasadas++;
      } else {
        areaMap[area].pendentes++;
      }
    });
    return Object.values(areaMap);
  }, [etapasFiltradas]);

  const lineData = useMemo(() => {
    const timeline = [];
    for (let i = 0; i <= 10; i++) {
      const etapasDia = etapasFiltradas.filter(e => (e.ordem || 0) === i);
      const concluidas = etapasDia.filter(e => e.status === 'concluido' || e.status === 'concluido_atraso').length;
      timeline.push({
        dia: `D+${i}`,
        total: etapasDia.length,
        concluidas,
        pendentes: etapasDia.length - concluidas
      });
    }
    return timeline;
  }, [etapasFiltradas]);

  const areaData = useMemo(() => {
    let acumulado = 0;
    const total = etapasFiltradas.length || 1;
    return lineData.map(d => {
      acumulado += d.concluidas;
      return {
        dia: d.dia,
        progresso: Math.round((acumulado / total) * 100),
        meta: Math.round(((lineData.indexOf(d) + 1) / 11) * 100)
      };
    });
  }, [lineData, etapasFiltradas]);

  const radialData = useMemo(() => {
    return barDataArea.map((d, i) => {
      const total = d.concluidas + d.pendentes + d.atrasadas;
      return {
        name: d.area,
        value: total > 0 ? Math.round((d.concluidas / total) * 100) : 0,
        fill: ['#3b82f6', '#22c55e', '#f97316', '#eab308', '#ef4444', '#8b5cf6'][i % 6]
      };
    });
  }, [barDataArea]);

  const rankingData = useMemo(() => {
    const respMap = {};
    etapasFiltradas.forEach(e => {
      const resp = e.responsavel || 'Sem responsável';
      if (!respMap[resp]) {
        respMap[resp] = { nome: resp, total: 0, concluidas: 0, atrasadas: 0 };
      }
      respMap[resp].total++;
      if (e.status === 'concluido' || e.status === 'concluido_atraso') {
        respMap[resp].concluidas++;
      }
      if (e.status === 'atrasado' || e.status === 'concluido_atraso') {
        respMap[resp].atrasadas++;
      }
    });
    return Object.values(respMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [etapasFiltradas]);

  // Calcula o índice do dia atual para a ReferenceLine
  const diaAtualIndex = useMemo(() => {
    if (!periodoSelecionado || periodoSelecionado.id === 'todos') return -1;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const inicioPeriodo = new Date(periodoSelecionado.ano, periodoSelecionado.mes - 1, 1);
    const diffTime = hoje - inicioPeriodo;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }, [periodoSelecionado]);

  if (!empresaAtual) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <p className="text-slate-500 mb-4">Nenhuma empresa selecionada</p>
        <a href="/empresas" className="text-primary-600 hover:underline">
          Criar ou selecionar uma empresa
        </a>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard do Fechamento</h1>
          <p className="text-slate-500">Acompanhe o progresso do fechamento contábil</p>
        </div>
        
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="periodo-select" className="block text-sm font-medium text-slate-700 mb-1">Período</label>
            <select
              id="periodo-select"
              value={periodoSelecionado?.id || ''}
              onChange={(e) => {
                if (e.target.value === 'todos') {
                  setPeriodoSelecionado({ id: 'todos', mes: 'Todos', ano: 'Períodos' });
                } else {
                  const periodo = periodos.find(p => p.id === e.target.value);
                  setPeriodoSelecionado(periodo);
                }
              }}
              className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
            >
              {periodos.length === 0 && <option value="">Nenhum período</option>}
              {periodos.length > 1 && <option value="todos">Todos os períodos</option>}
              {periodos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.mes}/{p.ano}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="area-select" className="block text-sm font-medium text-slate-700 mb-1">Área</label>
            <select
              id="area-select"
              value={areaSelecionada}
              onChange={(e) => setAreaSelecionada(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
              disabled={areas.length <= 1}
            >
              {areas.map(area => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Cards de Indicadores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card
          title="Progresso Total"
          value={`${indicadores?.percentualConcluido || 0}%`}
          subtitle={`${indicadores?.concluidas || 0} de ${indicadores?.total || 0} etapas`}
          icon={<BarChart3 className="w-6 h-6" />}
          color="blue"
        />
        <Card
          title="Em Andamento"
          value={indicadores?.emAndamento || 0}
          subtitle="Etapas em execução"
          icon={<Clock className="w-6 h-6" />}
          color="cyan"
        />
        <Card
          title="Atrasadas"
          value={indicadores?.atrasadas || 0}
          subtitle={`${indicadores?.percentualAtrasado || 0}% do total`}
          icon={<AlertTriangle className="w-6 h-6" />}
          color="red"
        />
        <Card
          title="Tempo Médio de Atraso"
          value={`${indicadores?.tempoMedioAtraso || 0} dias`}
          subtitle={`${indicadores?.concluidasComAtraso || 0} entregues com atraso`}
          icon={<TrendingUp className="w-6 h-6" />}
          color="orange"
        />
      </div>

      {/* Barra de Progresso Geral */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Progresso Geral do Fechamento</h2>
        <p className="text-sm text-slate-500 mb-3">
          Período: {periodoSelecionado ? `${periodoSelecionado.mes}/${periodoSelecionado.ano}` : '-'}
          {areaSelecionada !== 'Todas' && ` • Área: ${areaSelecionada}`}
        </p>
        
        <div className="h-6 bg-slate-100 rounded-full overflow-hidden mb-4 flex">
          {pieData.map((d, i) => (
            <div
              key={i}
              className="h-full transition-all duration-500"
              style={{ 
                width: `${(d.value / (indicadores?.total || 1)) * 100}%`,
                backgroundColor: d.color
              }}
              title={`${d.name}: ${d.value}`}
            />
          ))}
        </div>
        
        <div className="flex flex-wrap gap-4 text-sm">
          <StatusBadge color="green" label="Concluídas" count={indicadores?.concluidas || 0} />
          <StatusBadge color="orange" label="Concluídas c/ Atraso" count={indicadores?.concluidasComAtraso || 0} />
          <StatusBadge color="blue" label="Em Andamento" count={indicadores?.emAndamento || 0} />
          <StatusBadge color="yellow" label="Pendentes" count={indicadores?.pendentes || 0} />
          <StatusBadge color="red" label="Atrasadas" count={indicadores?.atrasadas || 0} />
        </div>
      </div>

      {/* Linha 1 de Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Gráfico 1: Pizza - Distribuição por Status */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <PieIcon className="w-5 h-5 text-primary-600" />
            Distribuição por Status
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-4">
            {pieData.map((entry, index) => (
              <div key={index} className="flex items-center gap-1 text-xs">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-slate-600">{entry.name}: {entry.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Gráfico 2: Barras - Etapas por Área */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary-600" />
            Etapas por Área
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barDataArea} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="area" type="category" width={100} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="concluidas" name="Concluídas" fill={COLORS.concluido} stackId="a" />
                <Bar dataKey="pendentes" name="Pendentes" fill={COLORS.pendente} stackId="a" />
                <Bar dataKey="atrasadas" name="Atrasadas" fill={COLORS.atrasado} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Linha 2 de Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Gráfico 3: Linha - Timeline D+0 a D+10 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary-600" />
            Timeline do Fechamento (D+0 a D+10)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" name="Total" fill="#94a3b8" />
                <Line type="monotone" dataKey="concluidas" name="Concluídas" stroke={COLORS.concluido} strokeWidth={3} dot={{ r: 4 }} />
                {diaAtualIndex >= 0 && diaAtualIndex <= 10 && (
                  <ReferenceLine x={`D+${diaAtualIndex}`} stroke="red" strokeDasharray="3 3">
                    <Label value="Hoje" position="insideTopRight" fill="red" fontSize={12} />
                  </ReferenceLine>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 4: Área - Progresso Acumulado vs Meta */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary-600" />
            Progresso Acumulado vs Meta
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} unit="%" />
                <Tooltip formatter={(value) => `${value}%`} />
                <Legend />
                <Area type="monotone" dataKey="meta" name="Meta" stroke="#94a3b8" fill="#e2e8f0" strokeDasharray="5 5" />
                <Area type="monotone" dataKey="progresso" name="Progresso Real" stroke="#3b82f6" fill="#93c5fd" />
                {diaAtualIndex >= 0 && diaAtualIndex <= 10 && (
                  <ReferenceLine x={`D+${diaAtualIndex}`} stroke="red" strokeDasharray="3 3">
                    <Label value="Hoje" position="insideTopRight" fill="red" fontSize={12} />
                  </ReferenceLine>
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Linha 3 de Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Gráfico 5: Radial - Progresso por Área */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <PieIcon className="w-5 h-5 text-primary-600" />
            % Conclusão por Área
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="90%" data={radialData} startAngle={180} endAngle={0}>
                <RadialBar minAngle={15} background clockWise dataKey="value" label={{ position: 'insideStart', fill: '#fff', fontSize: 11 }} />
                <Legend iconSize={10} layout="horizontal" verticalAlign="bottom" />
                <Tooltip formatter={(value) => `${value}%`} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 6: Barras Horizontal - Ranking de Responsáveis */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary-600" />
            Top 5 Responsáveis
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rankingData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="nome" type="category" width={100} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="concluidas" name="Concluídas" fill={COLORS.concluido} />
                <Bar dataKey="atrasadas" name="Atrasadas" fill={COLORS.atrasado} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Timeline Detalhada</h2>
          <button
            onClick={() => setIsTimelineVisible(!isTimelineVisible)}
            className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800"
          >
            {isTimelineVisible ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Recolher
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Mostrar
              </>
            )}
          </button>
        </div>
        
        {isTimelineVisible && (
          <>
            {etapasFiltradas.length === 0 ? (
              <p className="text-slate-500 text-center py-8">Nenhuma etapa encontrada para este período/área.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {etapasFiltradas.map((etapa, index) => (
                  <div key={etapa.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${getStatusColor(etapa.status)}`}>
                      D+{etapa.ordem || index}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 truncate">{etapa.nome}</p>
                      <p className="text-sm text-slate-500">{etapa.responsavel || 'Sem responsável'} • {etapa.area || 'Sem área'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-700">
                        {etapa.dataPrevista ? format(new Date(etapa.dataPrevista), 'dd/MM/yyyy') : '-'}
                      </p>
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(etapa.status)} text-white`}>
                        {getStatusLabel(etapa.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}