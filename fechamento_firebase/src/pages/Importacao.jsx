import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getPeriodos, importarEtapas, getEtapas } from '../services/database';
import { Upload, FileSpreadsheet, Check, AlertCircle, Link2, Save } from 'lucide-react';
import * as XLSX from 'xlsx';
import { db } from '../services/firebase'; // Importar 'db'
import { writeBatch, doc, collection, addDoc } from 'firebase/firestore'; // Importar funções do firestore

export default function Importacao() {
  const { empresaAtual, user, atualizarEmpresa, getSheetData, signInWithGoogleAndGetToken } = useAuth();
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [periodos, setPeriodos] = useState([]);
  const [periodoSelecionado, setPeriodoSelecionado] = useState(null);
  const [preview, setPreview] = useState([]);
  const [erros, setErros] = useState([]);
  const [importando, setImportando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [salvandoUrl, setSalvandoUrl] = useState(false);
  const [googleSheetData, setGoogleSheetData] = useState([]);
  const [loadingSheetData, setLoadingSheetData] = useState(false);
  const [sheetError, setSheetError] = useState('');
  const [dataInicioFiltro, setDataInicioFiltro] = useState('');
  const [dataFimFiltro, setDataFimFiltro] = useState('');
  const [etapasAtuais, setEtapasAtuais] = useState([]);

  useEffect(() => {
    if (!empresaAtual?.id) return;
    const unsubscribe = getPeriodos(empresaAtual.id, (data) => {
      setPeriodos(data);
      if (data.length > 0 && !periodoSelecionado) {
        setPeriodoSelecionado(data[0]);
      }
    });
    setGoogleSheetUrl(empresaAtual?.googleSheetUrl || '');
    if (empresaAtual?.spreadsheetId) {
      handleFetchSheetData(empresaAtual.spreadsheetId);
    }
    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAtual?.id, empresaAtual?.googleSheetUrl]);

  useEffect(() => {
    if (!empresaAtual?.id || !periodoSelecionado?.id) {
      setEtapasAtuais([]);
      return;
    }
    const unsubscribe = getEtapas(empresaAtual.id, periodoSelecionado.id, setEtapasAtuais);
    return () => unsubscribe();
  }, [empresaAtual?.id, periodoSelecionado?.id]);

  const handleFetchSheetData = useCallback(async (spreadsheetId, token = null) => {
    if (!spreadsheetId) return;
    setLoadingSheetData(true);
    setSheetError('');
    setGoogleSheetData([]);
    try {
      const data = await getSheetData({ spreadsheetId, token });
      if (data && data.length > 0) {
        setGoogleSheetData(data);
      } else {
        setSheetError('Nenhum dado encontrado na planilha ou a planilha está vazia.');
      }
    } catch (error) {
      console.error("Erro ao buscar dados da planilha:", error);
      const errorMessage = error.message || 'Ocorreu um erro desconhecido.';
      setSheetError(`Erro ao buscar dados. Verifique se a URL está correta, se a planilha é pública ou se você tem permissão de acesso. (Detalhe: ${errorMessage})`);
    } finally {
      setLoadingSheetData(false);
    }
  }, [getSheetData]);

  const handleSaveSheetUrl = async () => {
    if (!empresaAtual?.id) return;
    setSalvandoUrl(true);    
    try {
      await signInWithGoogleAndGetToken();
      const spreadsheetId = googleSheetUrl.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] || '';
      await atualizarEmpresa(empresaAtual.id, { googleSheetUrl, spreadsheetId });
    } catch (error) {
      setSheetError(`Falha ao salvar URL ou buscar dados. Tente novamente. (Detalhe: ${error.message})`);
    } finally {
      setSalvandoUrl(false);
    }
  };

  const handleLoginAndFetch = async () => {
    try {
      const token = await signInWithGoogleAndGetToken();
      if (empresaAtual?.spreadsheetId) {
        await handleFetchSheetData(empresaAtual.spreadsheetId, token);
      }
    } catch (error) {
      setSheetError(`Falha no login com Google. Tente novamente. (Detalhe: ${error.message})`);
    }
  };

  const parseDate = (dateString) => {
    if (!dateString) return '';

    if (dateString instanceof Date) {
      const dia = String(dateString.getDate()).padStart(2, '0');
      const mes = String(dateString.getMonth() + 1).padStart(2, '0');
      const ano = dateString.getFullYear();
      return `${dia}/${mes}/${ano}`;
    }

    if (typeof dateString === 'number') {
      const date = XLSX.SSF.parse_date_code(dateString);
      return `${String(date.d).padStart(2, '0')}/${String(date.m).padStart(2, '0')}/${date.y}`;
    }

    // Adicionado para lidar com o formato 'YYYY-MM-DD' já processado
    if (typeof dateString === 'string' && dateString.includes('-')) {
      const parts = dateString.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }

    return dateString;
  };

  const toInputDate = (dateString) => {
    if (!dateString || typeof dateString !== 'string') return '';
    const parts = dateString.split('/');
    if (parts.length !== 3) return '';
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  };

  const processarDadosDaPlanilha = (dados) => {
    const etapasValidadas = [];
    const errosEncontrados = [];

    dados.forEach((row, index) => {
      const linha = index + 2;

      if (!row['TAREFA']) {
        errosEncontrados.push(`Linha ${linha}: Nome da etapa é obrigatório`);
        return;
      }

      const dataPrevista = row['INÍCIO'] ? toInputDate(parseDate(row['INÍCIO'])) : '';
      const dataReal = row['TÉRMINO'] ? toInputDate(parseDate(row['TÉRMINO'])) : '';

      let status = 'pendente';
      const hoje = new Date(new Date().setHours(0, 0, 0, 0));
      if (dataReal) {
        // Para evitar problemas com fuso horário, criamos as datas em UTC para comparação
        const dReal = new Date(dataReal.replace(/-/g, '/'));
        const dPrevista = dataPrevista ? new Date(dataPrevista.replace(/-/g, '/')) : null;

        if (dPrevista && dReal.getTime() < dPrevista.getTime()) {
          status = 'concluido_antecipado';
        } else if (dPrevista && dReal.getTime() > dPrevista.getTime()) {
          status = 'concluido_atraso';
        } else {
          status = 'concluido';
        }
      } else if (dataPrevista && new Date(dataPrevista) < hoje) {
        status = 'atrasado';
      }

      etapasValidadas.push({
        codigo: row['CODIGO'] || '',
        nome: row['TAREFA'],
        responsavel: row['ATRIBUÍDO PARA'] || '',
        area: row['ÁREA'] || row['area'] || '',
        dataPrevista: dataPrevista,
        dataReal: dataReal,
        ordem: parseInt(String(row['D+'] || row['POSIÇÃO'] || '').replace(/D\+/i, ''), 10) || index + 1,
        status: status,
      });
    });
    return { etapasValidadas, errosEncontrados };
  };

  const previewFiltrado = useMemo(() => {
    if (!dataInicioFiltro && !dataFimFiltro) {
      return preview;
    }
    return preview.filter(etapa => {
      if (!etapa.dataPrevista) return false;
      // Usar new Date('YYYY-MM-DD') cria a data em UTC, evitando problemas de fuso.
      const etapaDate = new Date(etapa.dataPrevista);
      const startDate = dataInicioFiltro ? new Date(dataInicioFiltro) : null;
      const endDate = dataFimFiltro ? new Date(dataFimFiltro) : null;

      if (startDate && etapaDate < startDate) return false; // Compara as datas diretamente
      if (endDate && etapaDate > endDate) return false; // Compara as datas diretamente
      return true;
    });
  }, [preview, dataInicioFiltro, dataFimFiltro]);

  const transformSheetData = (data) => {
    if (!data || data.length < 1) return [];
    const headers = data[0];
    const body = data.slice(1);
    return body.map(row => {
      const rowObject = {};
      headers.forEach((header, index) => {
        rowObject[header] = row[index];
      });
      return rowObject;
    });
  };

  const handleUseSheetData = () => {
    if (googleSheetData.length === 0) return;

    setSucesso(false);
    setErros([]);

    try {
      const dadosProcessados = transformSheetData(googleSheetData);
      const { etapasValidadas, errosEncontrados } = processarDadosDaPlanilha(dadosProcessados);
      etapasValidadas.sort((a, b) => a.ordem - b.ordem);
      setPreview(etapasValidadas);
      setErros(errosEncontrados);
    } catch (error) {
      setErros(['Erro ao processar dados da planilha. Verifique o formato.']);
      setPreview([]);
    }
  };

  const handleImportar = async () => {
    if (!periodoSelecionado || previewFiltrado.length === 0) return;
    
    setImportando(true);
    setErros([]);
    setSucesso(false);

    try {
      const mapaEtapasAtuais = new Map(etapasAtuais.map(e => [e.codigo, e]));
      const etapasParaCriar = [];
      const etapasParaAtualizar = [];
      const etapasIgnoradas = [];

      previewFiltrado.forEach(etapaDaPlanilha => {
        if (etapaDaPlanilha.codigo && mapaEtapasAtuais.has(etapaDaPlanilha.codigo)) {
          const etapaExistente = mapaEtapasAtuais.get(etapaDaPlanilha.codigo);
          etapasParaAtualizar.push({ ...etapaExistente, ...etapaDaPlanilha });
        } else if (etapaDaPlanilha.codigo) {
          etapasParaCriar.push(etapaDaPlanilha);
        } else {
          etapasIgnoradas.push(etapaDaPlanilha);
        }
      });

      const batch = writeBatch(db);

      if (etapasParaCriar.length > 0) {
        etapasParaCriar.forEach(etapa => {
          const novaEtapaRef = doc(collection(db, 'empresas', empresaAtual.id, 'periodos', periodoSelecionado.id, 'etapas'));
          batch.set(novaEtapaRef, etapa);
        });
      }

      if (etapasParaAtualizar.length > 0) {
        etapasParaAtualizar.forEach(etapa => {
          const etapaRef = doc(db, 'empresas', empresaAtual.id, 'periodos', periodoSelecionado.id, 'etapas', etapa.id);
          batch.update(etapaRef, etapa);
        });
      }

      if (etapasParaCriar.length === 0 && etapasParaAtualizar.length === 0) {
        setErros([`Nenhuma etapa para importar. Todas as ${previewFiltrado.length} etapas da planilha já estão sincronizadas ou não possuem código.`]);
        setSucesso(false);
      } else {
        // Adiciona um único registro no histórico para a operação em massa
        const historicoRef = doc(collection(db, 'empresas', empresaAtual.id, 'historico'));
        batch.set(historicoRef, { acao: 'importacao_planilha', detalhes: `${etapasParaCriar.length} criadas, ${etapasParaAtualizar.length} atualizadas.`, userId: user.id, userName: user.name, timestamp: new Date() });

        await batch.commit();

        setSucesso(true);
        setErros([`Importação concluída: ${etapasParaCriar.length} etapas criadas, ${etapasParaAtualizar.length} atualizadas. ${etapasIgnoradas.length > 0 ? `${etapasIgnoradas.length} ignoradas por falta de código.` : ''}`.trim()]);
        setPreview([]);
      }
    } catch (error) {
      setSucesso(false);
      setErros([`Erro ao importar etapas. Tente novamente. (Detalhe: ${error.message})`]);
    } finally {
      setImportando(false);
    }
  };

  if (!empresaAtual) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <p className="text-slate-500">Selecione uma empresa para importar etapas</p>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Importação via Google Sheets</h1>
          <p className="text-slate-500">Importe etapas do fechamento diretamente da sua planilha.</p>
        </div>
      </div>

      {/* Conexão com Planilha Google */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Link2 className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-slate-800">Conexão com Planilha Google</h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Cole a URL da sua Planilha Google para habilitar a importação direta.
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            value={googleSheetUrl}
            onChange={(e) => setGoogleSheetUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg"
          />
          <button
            onClick={handleSaveSheetUrl}
            disabled={salvandoUrl}
            className="flex items-center justify-center gap-2 w-32 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-slate-400"
          >
            {salvandoUrl ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><Save className="w-4 h-4" /> Salvar</>}
          </button>
        </div>
      </div>

      {/* Tabela de Dados da Planilha Google */}
      {(loadingSheetData || googleSheetData.length > 0 || sheetError) && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 animate-fadeIn">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Dados da Planilha Conectada</h2>
          {loadingSheetData && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="ml-3 text-slate-500">Carregando dados da planilha...</p>
            </div>
          )}
          {sheetError && !loadingSheetData && (
            <>
              <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                {sheetError}
              </div>
              <div className="mt-4 p-4 bg-amber-50 text-amber-800 rounded-lg text-sm">
                <h3 className="font-semibold mb-2">Como resolver problemas de acesso?</h3>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Acesse as configurações do seu projeto no <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-900">Firebase Console</a>.</li>
                  <li>Vá para "Contas de serviço" e copie o e-mail da conta de serviço (geralmente termina com <code className="text-xs bg-amber-200 p-1 rounded">@...gserviceaccount.com</code>).</li>
                  <li>Na sua Planilha Google, clique em "Compartilhar" e cole o e-mail da conta de serviço, dando a ele permissão de "Leitor".</li>
                </ol>
                <p className="mt-2">
                  Se o erro persistir, pode ser necessário autenticar com sua conta Google na aplicação.
                  <button
                    onClick={handleLoginAndFetch}
                    className="ml-2 font-semibold underline hover:text-amber-900"
                  >
                    Clique aqui para fazer login com Google.
                  </button>
                </p>
              </div>
            </>
          )}
          {googleSheetData.length > 0 && !loadingSheetData && (
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {googleSheetData[0].map((header, index) => (
                      <th key={index} className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {googleSheetData.slice(1).map((row, index) => (
                    <tr key={index}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="px-3 py-2 text-slate-600 whitespace-nowrap">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {googleSheetData.length > 0 && !loadingSheetData && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-slate-400">
                Verifique se os dados estão corretos antes de importar.
              </p>
              <button
                onClick={handleUseSheetData}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
              >
                <Check className="w-4 h-4" /> Usar dados da planilha
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {/* Preview e Importação */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Preview e Importação</h2>
          
          {preview.length === 0 ? (
            <div className="text-center py-12">
              <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">
                Use os dados da planilha conectada para visualizar e importar.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Período de Destino</label>
                  <select
                    value={periodoSelecionado ? periodoSelecionado.id : ''}
                    onChange={(e) => {
                      const periodo = periodos.find(p => p.id === e.target.value);
                      setPeriodoSelecionado(periodo);
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  >
                    {periodos.map(p => (
                      <option key={p.id} value={p.id}>{p.mes}/{p.ano}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="startDate" className="block text-sm font-medium text-slate-700 mb-1">Filtrar por Data de Início (Prevista)</label>
                  <input
                    type="date"
                    id="startDate"
                    value={dataInicioFiltro}
                    onChange={(e) => setDataInicioFiltro(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="endDate" className="block text-sm font-medium text-slate-700 mb-1">Filtrar por Data de Fim (Prevista)</label>
                  <input
                    type="date"
                    id="endDate"
                    value={dataFimFiltro}
                    onChange={(e) => setDataFimFiltro(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="max-h-96 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">D+</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">CODIGO</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">TAREFA</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">ATRIBUÍDO PARA</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">ÁREA</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">INÍCIO</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">TÉRMINO</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewFiltrado.map((etapa, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2 text-slate-600">{etapa.ordem}</td>
                        <td className="px-3 py-2 text-slate-600 font-mono text-xs">{etapa.codigo}</td>
                        <td className="px-3 py-2 text-slate-800">{etapa.nome}</td>
                        <td className="px-3 py-2 text-slate-600">{etapa.responsavel}</td>
                        <td className="px-3 py-2 text-slate-600">{etapa.area}</td>
                        <td className="px-3 py-2 text-slate-600">{parseDate(etapa.dataPrevista)}</td>
                        <td className="px-3 py-2 text-slate-600">{parseDate(etapa.dataReal)}</td>
                        <td className="px-3 py-2 text-slate-600">{getStatusText(etapa.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {sucesso && (
                <div className="mt-4 p-4 bg-green-50 text-green-700 rounded-lg flex items-center gap-2">
                  <Check className="w-5 h-5 flex-shrink-0" />
                  Operação concluída com sucesso! Verifique os detalhes abaixo.
                </div>
              )}

              {erros.length > 0 && (
                <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">Resultado da Importação:</span>
                  </div>
                  <ul className="list-disc list-inside text-sm">
                    {erros.map((erro, i) => (
                      <li key={i}>{erro}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={handleImportar}
                disabled={!periodoSelecionado || previewFiltrado.length === 0 || importando}
                className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-4 h-4" />
                {importando ? 'Importando...' : `Importar ${previewFiltrado.length} Etapas`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const getStatusText = (status) => {
  switch (status) {
    case 'concluido':
      return 'Concluído';
    case 'concluido_atraso':
      return 'Concluído c/ Atraso';
    case 'concluido_antecipado':
      return 'Concluído Antecipado';
    case 'atrasado':
      return 'Atrasado';
    case 'pendente':
      return 'Pendente';
    default:
      return status;
  }
};
