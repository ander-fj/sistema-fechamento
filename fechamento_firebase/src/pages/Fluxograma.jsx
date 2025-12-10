import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getPeriodos, getEtapas, getStatusColor as getStatusColorFromDB, getStatusLabel, atualizarEtapa } from '../services/database';
import { format } from 'date-fns';
import { X, Check, Share2, Clock, BarChart2 } from 'lucide-react';
import ReactFlow, { Controls, Background, MiniMap, useNodesState, useEdgesState } from 'reactflow';
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell, Label, LabelList
} from 'recharts';
import 'reactflow/dist/style.css';

const statusColorMap = {
  'bg-green-500': '#22c55e', // Concluído
  'bg-blue-500': '#3b82f6',  // Em Andamento
  'bg-yellow-500': '#eab308', // Pendente
  'bg-orange-500': '#f97316', // Concluído c/ Atraso
  'bg-red-500': '#ef4444',   // Atrasado
};

const calcularAtraso = (etapa) => {
  if (etapa.status !== 'atrasado' && etapa.status !== 'concluido_atraso') {
    return null;
  }
  if (!etapa.dataPrevista) return null;
  const hoje = new Date();
  const dataPrevista = new Date(etapa.dataPrevista);
  const dataReferencia = etapa.dataReal ? new Date(etapa.dataReal) : hoje;

  dataReferencia.setHours(0, 0, 0, 0);
  dataPrevista.setHours(0, 0, 0, 0);

  return Math.floor((dataReferencia - dataPrevista) / (1000 * 60 * 60 * 24));
};

export default function Fluxograma() {
  const { empresaAtual, user } = useAuth();
  const [periodos, setPeriodos] = useState([]);
  const [periodoSelecionado, setPeriodoSelecionado] = useState(null);
  const [etapas, setEtapas] = useState([]);
  const [etapaSelecionada, setEtapaSelecionada] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('Todos');
  const [view, setView] = useState('timeline'); // 'fluxo' ou 'timeline'

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Memoriza a função para evitar re-renderizações desnecessárias no useEffect que gera os nós.
  const getStatusColor = useCallback((status) => getStatusColorFromDB(status), []);

  // Fetch periods when company changes
  useEffect(() => {
    if (!empresaAtual?.id) {
      setPeriodos([]);
      setPeriodoSelecionado(null);
      return;
    }

    const unsubscribe = getPeriodos(empresaAtual.id, (data) => {
      setPeriodos(data);
      // Automatically select the first period of a new company
      if (data.length > 0 && !periodoSelecionado) {
        setPeriodoSelecionado(data[0]);
      }
    });

    return () => unsubscribe();
  }, [empresaAtual, periodoSelecionado]);

  // Fetch etapas when company or period changes
  useEffect(() => {
    if (!empresaAtual?.id || !periodoSelecionado) {
      setEtapas([]);
      return;
    }

    const unsubscribe = getEtapas(empresaAtual.id, periodoSelecionado.id, setEtapas);
    return () => unsubscribe();
  }, [empresaAtual, periodoSelecionado]);

  const handleConcluir = async (etapa) => {
    await atualizarEtapa(
      empresaAtual.id,
      periodoSelecionado.id,
      etapa.id,
      { ...etapa, dataReal: format(new Date(), 'yyyy-MM-dd') },
      user.uid,
      user.displayName
    );
    // A atualização do estado local é feita pelo listener onValue em getEtapas
    // setEtapaSelecionada(null); // Fechar o modal após a ação
  };

  const etapasFiltradas = useMemo(() => {
    if (filtroStatus === 'Todos') {
      return etapas;
    }
    return etapas.filter(e => e.status === filtroStatus);
  }, [etapas, filtroStatus]);

  // Re-organize nodes and edges based on chronological order
  useEffect(() => {
    const etapasOrdenadas = [...etapasFiltradas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    if (etapasOrdenadas.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const nodesByOrdem = etapasOrdenadas.reduce((acc, etapa) => {
      const ordem = etapa.ordem || 0;
      if (!acc[ordem]) acc[ordem] = [];
      acc[ordem].push(etapa);
      return acc;
    }, {});
    const ordensUnicas = [...new Set(Object.keys(nodesByOrdem).map(Number))].sort((a, b) => a - b);
    
    const nodeWidth = 200;
    const nodeHeight = 70;
    const xGap = 50;
    const yGap = 100;
    const nodesPerRow = 4;

    const newNodes = etapasOrdenadas.map((etapa, index) => {
      const nodeId = `etapa-${etapa.id}`;
      const position = {
        x: (index % nodesPerRow) * (nodeWidth + xGap),
        y: Math.floor(index / nodesPerRow) * (nodeHeight + yGap),
      };

      return {
        id: nodeId,
        position,
        ariaLabel: (() => {
          const diasAtraso = calcularAtraso(etapa);
          let tooltip = `Responsável: ${etapa.responsavel || 'Não definido'}`;
          if (diasAtraso !== null && diasAtraso >= 0) {
            tooltip += `\n${etapa.status === 'atrasado' ? 'Atrasado' : 'Concluído com'} ${diasAtraso} dia(s) de atraso`;
          }
          return tooltip;
        })(),
        data: {
          label: `D+${etapa.ordem}: ${etapa.nome}\n(${etapa.responsavel || 'Sem resp.'})`,
          etapa: etapa,
        },
        style: {
          backgroundColor: statusColorMap[getStatusColor(etapa.status)] ?? '#64748b',
          color: 'white',
          width: nodeWidth,
          height: nodeHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: 'bold',
          textAlign: 'center',
          cursor: 'pointer',
          padding: '10px',
          whiteSpace: 'pre-wrap',
        },
      };
    });

    setNodes(newNodes);

    const newEdges = [];
    for (let i = 0; i < ordensUnicas.length - 1; i++) {
      const sourceEtapas = nodesByOrdem[ordensUnicas[i]] || [];
      const targetEtapas = nodesByOrdem[ordensUnicas[i + 1]] || [];
      const sourceNodes = sourceEtapas.map(e => `etapa-${e.id}`);
      const targetNodes = targetEtapas.map(e => `etapa-${e.id}`);
      sourceNodes.forEach(sourceId => {
        targetNodes.forEach(targetId => {
          newEdges.push({
            id: `e-${sourceId}-${targetId}`,
            source: sourceId,
            target: targetId,
            animated: true,
            style: { stroke: '#94a3b8', strokeWidth: 2 },
          });
        });
      });
    }
    setEdges(newEdges);
  }, [etapasFiltradas, getStatusColor, setNodes, setEdges, user]);


  if (!empresaAtual) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <p className="text-slate-500">Selecione uma empresa para visualizar o fluxograma</p>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Fluxograma do Fechamento</h1>
          <p className="text-slate-500">Visualização interativa das etapas do fechamento contábil</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg"
          >
            <option value="Todos">Todos os Status</option>
            <option value="concluido">Concluído</option>
            <option value="em_andamento">Em Andamento</option>
            <option value="pendente">Pendente</option>
            <option value="concluido_atraso">Concluído c/ Atraso</option>
            <option value="atrasado">Atrasado</option>
          </select>

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
      </div>

      {/* Legenda */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6 flex flex-wrap gap-4">
        <LegendItem color="bg-green-500" label="Concluído" />
        <LegendItem color="bg-blue-500" label="Em Andamento" />
        <LegendItem color="bg-yellow-500" label="Pendente" />
        <LegendItem color="bg-orange-500" label="Concluído c/ Atraso" />
        <LegendItem color="bg-red-500" label="Atrasado" />
      </div>

      {/* Seletor de Visualização */}
      <div className="mb-4 flex justify-center">
        <div className="bg-slate-100 p-1 rounded-lg flex gap-1">
          <ViewButton icon={<Share2 />} label="Fluxo" active={view === 'fluxo'} onClick={() => setView('fluxo')} />
          <ViewButton icon={<BarChart2 />} label="Gantt" active={view === 'timeline'} onClick={() => setView('timeline')} />
        </div>
      </div>



      {/* Fluxograma */}
      <div className="bg-white rounded-xl shadow-sm h-[600px] w-full">
        {etapasFiltradas.length === 0 ? (
          <p className="text-slate-500 text-center py-12">Nenhuma etapa cadastrada para este período</p>
        ) : (
          view === 'fluxo' ? (
            <ReactFlow
              key={periodoSelecionado?.id || 'no-period'}
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              fitView
              onNodeClick={(event, node) => setEtapaSelecionada(node.data.etapa)}
            >
              <MiniMap />
              <Controls />
              <Background variant="dots" gap={12} size={1} />
            </ReactFlow>
          ) : (
            <GanttChart etapas={etapasFiltradas} periodoSelecionado={periodoSelecionado} />
          )
        )}
      </div>

      {/* Modal de Detalhes */}
      {etapaSelecionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-slideIn">
            <div className={`p-4 rounded-t-2xl text-white ${getStatusColor(etapaSelecionada.status)}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{etapaSelecionada.nome}</h3>
                <button onClick={() => setEtapaSelecionada(null)} className="p-1 hover:bg-white/20 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm opacity-80">{getStatusLabel(etapaSelecionada.status)}</p>
            </div>
            
            <div className="p-6 space-y-4">
              <InfoRow label="Área" value={etapaSelecionada.area || '-'} />
              <InfoRow label="Responsável" value={etapaSelecionada.responsavel || '-'} />
              <InfoRow label="Data Prevista" value={etapaSelecionada.dataPrevista ? format(new Date(etapaSelecionada.dataPrevista), 'dd/MM/yyyy') : '-'} />
              <InfoRow label="Data Real" value={etapaSelecionada.dataReal ? format(new Date(etapaSelecionada.dataReal), 'dd/MM/yyyy') : '-'} />
              {etapaSelecionada.descricao && (
                <div>
                  <p className="text-sm text-slate-500">Descrição</p>
                  <p className="text-slate-800">{etapaSelecionada.descricao}</p>
                </div>
              )}
              {etapaSelecionada.observacoes && (
                <div>
                  <p className="text-sm text-slate-500">Observações</p>
                  <p className="text-slate-800">{etapaSelecionada.observacoes}</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setEtapaSelecionada(null)}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Fechar
              </button>
              {!etapaSelecionada.dataReal && (
                <button
                  onClick={() => {
                    handleConcluir(etapaSelecionada);
                    setEtapaSelecionada(null);
                  }}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Concluir
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ViewButton({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm transition-colors ${
        active ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}

function GanttChart({ etapas, periodoSelecionado }) {
  const minPeriodDate = useMemo(() => {
    if (!periodoSelecionado) return null;
    return new Date(periodoSelecionado.ano, periodoSelecionado.mes - 1, 1);
  }, [periodoSelecionado]);
  
  const ganttData = useMemo(() => {
    if (!etapas || etapas.length === 0 || !minPeriodDate) 
      return { rows: [], domain: [0, 0], ticks: [] };

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const tasks = etapas
      .map(etapa => {
        const inicio = etapa.dataPrevista ? new Date(etapa.dataPrevista.replace(/-/g, '/')) : hoje;

        let fim;
        if (etapa.dataReal) {
          fim = new Date(etapa.dataReal.replace(/-/g, '/'));
        } else {
          fim = hoje > inicio ? hoje : new Date(inicio);
        }

        // Ensure fim is not before inicio
        if (fim < inicio) fim = inicio;
        
        const startOffset = minPeriodDate ? Math.floor((inicio.getTime() - minPeriodDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
        const durationInDays = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        return {
          ...etapa,
          startOffset: startOffset < 0 ? 0 : startOffset, // Ensure offset is not negative
          duration: durationInDays,
          color: statusColorMap[getStatusColorFromDB(etapa.status)] ?? '#64748b',
        };
      });

    const grupos = tasks.reduce((acc, task) => {
      const responsavel = task.responsavel || "Sem responsável";
      if (!acc[responsavel]) {
        acc[responsavel] = { responsavel, tasks: [], tasksByOffset: {} };
      }
      // Usamos um dataKey dinâmico para cada barra
      const offsetKey = `offset_${task.startOffset}`;
      const durationKey = `duration_${task.startOffset}`;
      acc[responsavel][offsetKey] = task.startOffset;
      acc[responsavel][durationKey] = task.duration;
      acc[responsavel].tasks.push({ ...task, offsetKey, durationKey });
      return acc;
    }, {});

    const rows = Object.keys(grupos).map(resp => ({
      ...grupos[resp]
    }));

    // Determine the max number of days to display on the X-axis
    const maxDays = Math.max(
      ...rows.flatMap(r => r.tasks.map(t => t.startOffset + t.duration))
    , 30) + 3;
    
    const ticks = Array.from({ length: Math.ceil(maxDays) }, (_, i) => i);

    return { rows, domain: [0, maxDays], ticks };
  }, [etapas, minPeriodDate]);



  const renderCustomizedLabel = (props) => {
    const { x, y, width, height, value, payload } = props;
    const taskName = value || '';
    const isHighlighted = taskName === 'Encerramento de pedidos de compra e venda no sistema';

    // Estilos para o texto destacado
    const highlightedStyle = {
      fontSize: '14px',
      fontWeight: 'bold',
      textShadow: '0 0 5px rgba(0,0,0,0.7)',
    };

    const defaultStyle = { textShadow: '0 0 10px rgba(0,0,0,0.6)' };

    const textWidth = taskName.length * 6; // Estimativa da largura do texto

    // Se a barra for muito curta, posiciona o texto à direita da barra
    if (width < textWidth) {
      return (
        <text x={x + width + 5} y={y + height / 2} fill="#555" textAnchor="start" dominantBaseline="middle" fontSize="14">
          {taskName}
        </text>
      );
    }

    // Caso contrário, posiciona o texto dentro da barra
    return (
      <text x={x + 10} y={y + height / 2} fill="#fff" textAnchor="start" dominantBaseline="middle" fontSize="12" style={isHighlighted ? highlightedStyle : defaultStyle}>{taskName}</text>
    );
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length && minPeriodDate) {
      const rowPayload = payload[0].payload;
      const dataKey = payload[0].dataKey; // e.g., duration_5
      const startOffset = parseInt(dataKey.split('_')[1]);
      const task = rowPayload.tasks.find(t => t.startOffset === startOffset);
      if (!task) return null;

      return (
        <div className="bg-white p-3 shadow-lg rounded-lg border border-slate-200">
          <p className="font-bold text-slate-800">{task.nome}</p>
          <p className="text-sm text-slate-500">Responsável: {task.responsavel || '-'}</p>
          <hr className="my-1" />
          <p className="text-sm">Status: {getStatusLabel(task.status)}</p>
          <p className="text-sm">Início: {format(new Date(minPeriodDate.getTime() + task.startOffset * (1000 * 60 * 60 * 24)), 'dd/MM/yyyy')}</p>
          <p className="text-sm">Fim: {format(new Date(minPeriodDate.getTime() + (task.startOffset + task.duration - 1) * (1000 * 60 * 60 * 24)), 'dd/MM/yyyy')}</p>
          <p className="text-sm">Duração: {task.duration} dia(s)</p>
        </div>
      );
    }
    return null;
  };

  if (ganttData.rows.length === 0) {
    return <div className="flex items-center justify-center h-full text-slate-500">Nenhuma etapa para exibir no gráfico.</div>;
  }

  return (
    <div className="h-full w-full p-15">
      <ResponsiveContainer width="100%" height={ganttData.rows.length * 45}>
        <BarChart
          data={ganttData.rows}
          layout="vertical" // <-- CORREÇÃO: Layout vertical para barras horizontais
          margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
          barSize={-4}
          
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            ticks={ganttData.ticks}
            type="number"
            domain={ganttData.domain}
            tickFormatter={(day) => {
              if (!minPeriodDate) return '';
              const date = new Date(minPeriodDate.getTime());
              date.setDate(minPeriodDate.getDate() + day);
              return format(date, 'dd/MM');
            }}
            tick={{ fontSize: 12 }}
            interval={0}
          />
          <YAxis
            dataKey="responsavel"
            type="category"
            width={180}
            tick={{ fontSize: 16 }}
            interval={0}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(200,200,200,0.1)' }} />
          {minPeriodDate && (
            <ReferenceLine x={Math.floor((new Date().getTime() - minPeriodDate.getTime()) / (1000 * 60 * 60 * 24))} stroke="red" strokeDasharray="3 3">
              <Label value="Hoje" position="top" fill="red" fontSize={13} />
            </ReferenceLine>
          )}
          {ganttData.rows.map((row, rowIdx) =>
            row.tasks.map((task) => (
              <>
                <Bar
                  key={`empty-${task.id}`}
                  dataKey={task.offsetKey}
                  stackId={row.responsavel}
                  fill="transparent"
                  
                />
                <Bar
                  key={`task-${task.id}`}
                  dataKey={task.durationKey}
                  stackId={row.responsavel}
                  fill={task.color}
                  
                >
                  <LabelList dataKey={(data) => data.responsavel === row.responsavel ? task.nome : null} content={renderCustomizedLabel} />
                </Bar>
              </>
            ))
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function LegendItem({ color, label }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-8 h-8 rounded ${color}`} />
      <span className="text-sm text-slate-800">{label}</span>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-800">{value}</span>
    </div>
  );
}
