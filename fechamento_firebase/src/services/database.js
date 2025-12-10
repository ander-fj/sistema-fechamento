import { db, dbRef, dbSet, dbGet, dbPush, dbUpdate, dbRemove, dbOnValue, ref, onValue, get, query, orderByChild, equalTo, push, set } from './firebase';
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, writeBatch, query as firestoreQuery, orderBy, where, getDoc, getDocs } from 'firebase/firestore';

// ==================== EMPRESAS ====================
export const criarEmpresa = async (userId, empresa) => {
  const empresasCollectionRef = collection(db, 'empresas');
  const docRef = await addDoc(empresasCollectionRef, {
    ...empresa,
    ownerId: userId, // Adiciona a referência do dono
    criadoEm: Date.now()
  });
  return docRef.id;
};

export const getEmpresas = (userId, callback) => {
  // Busca empresas onde o usuário é o dono
  const q = firestoreQuery(collection(db, 'empresas'), where('ownerId', '==', userId));
  return onSnapshot(q, (querySnapshot) => {
    const empresas = [];
    querySnapshot.forEach((doc) => {
      empresas.push({ id: doc.id, ...doc.data() });
    });
    callback(empresas);
  }, (error) => {
    console.error("Erro ao buscar empresas:", error);
    // Em caso de erro (ex: permissões), retorna um array vazio para não quebrar a UI
    callback([]);
  });
};

// ==================== PERÍODOS ====================
export const criarPeriodo = async (empresaId, periodo) => {
  const periodosCollectionRef = collection(db, 'empresas', empresaId, 'periodos');
  const docRef = await addDoc(periodosCollectionRef, {
    ...periodo,
    status: 'aberto',
    criadoEm: Date.now()
  });
  const periodoId = docRef.id;

  // Importar etapas dos templates existentes
  // TODO: Migrar a lógica de templates para Firestore também.
  // const templatesSnapshot = await dbGet(`templates/${empresaId}`);
  // if (templatesSnapshot) {
  //   const templates = Object.values(templatesSnapshot);
  //   await importarEtapas(empresaId, periodoId, templates);
  // }

  return periodoId;
};

export const getPeriodos = (empresaId, callback) => {
  const periodosCollectionRef = collection(db, 'empresas', empresaId, 'periodos');
  return onSnapshot(periodosCollectionRef, (querySnapshot) => {
    const periodos = [];
    querySnapshot.forEach((doc) => {
      periodos.push({ id: doc.id, ...doc.data() });
    });
    callback(periodos);
  });
};

export const atualizarPeriodo = (empresaId, periodoId, dados) => {
  const periodoDocRef = doc(db, 'empresas', empresaId, 'periodos', periodoId);
  return updateDoc(periodoDocRef, dados);
};

export const deletarPeriodo = async (empresaId, periodoId) => {
  const periodoDocRef = doc(db, 'empresas', empresaId, 'periodos', periodoId);
  await deleteDoc(periodoDocRef);
  // TODO: Deletar a subcoleção de etapas associada a este período.
};

// ==================== ÁREAS ====================
export const criarArea = async (empresaId, area) => {
  const areasCollectionRef = collection(db, 'empresas', empresaId, 'areas');
  const docRef = await addDoc(areasCollectionRef, {
    ...area,
    criadoEm: Date.now()
  });
  return docRef.id;
};

export const getAreas = (empresaId, callback) => {
  const areasCollectionRef = collection(db, 'empresas', empresaId, 'areas');
  return onSnapshot(areasCollectionRef, (querySnapshot) => {
    const areas = [];
    querySnapshot.forEach((doc) => {
      areas.push({ id: doc.id, ...doc.data() });
    });
    callback(areas);
  });
};

export const deletarArea = (empresaId, areaId) => {
  const areaDocRef = doc(db, 'empresas', empresaId, 'areas', areaId);
  return deleteDoc(areaDocRef);
};

// ==================== RESPONSÁVEIS ====================
export const criarResponsavel = async (empresaId, responsavel) => {
  const responsaveisCollectionRef = collection(db, 'empresas', empresaId, 'responsaveis');
  const docRef = await addDoc(responsaveisCollectionRef, {
    ...responsavel,
    criadoEm: Date.now()
  });
  return docRef.id;
};

export const getResponsaveis = (empresaId, callback) => {
  const responsaveisCollectionRef = collection(db, 'empresas', empresaId, 'responsaveis');
  return onSnapshot(responsaveisCollectionRef, (querySnapshot) => {
    const responsaveis = [];
    querySnapshot.forEach((doc) => {
      responsaveis.push({ id: doc.id, ...doc.data() });
    });
    callback(responsaveis);
  });
};

export const deletarResponsavel = (empresaId, responsavelId) => {
  const respDocRef = doc(db, 'empresas', empresaId, 'responsaveis', responsavelId);
  return deleteDoc(respDocRef);
};

// ==================== ETAPAS ====================
export const criarEtapa = async (empresaId, periodoId, etapa) => {
  const etapasCollectionRef = collection(db, 'empresas', empresaId, 'periodos', periodoId, 'etapas');
  const docRef = await addDoc(etapasCollectionRef, {
    ...etapa,
    status: calcularStatus(etapa.dataPrevista, etapa.dataReal),
    criadoEm: Date.now(),
    atualizadoEm: Date.now()
  });
  return docRef.id;
};

export const getEtapas = (empresaId, periodoId, callback) => {
  const etapasCollectionRef = collection(db, 'empresas', empresaId, 'periodos', periodoId, 'etapas');
  const q = firestoreQuery(etapasCollectionRef, orderBy('ordem', 'asc'));

  return onSnapshot(q, (querySnapshot) => {
    const etapas = [];
    querySnapshot.forEach((doc) => {
      const etapa = doc.data();
      etapas.push({
        id: doc.id,
        ...etapa,
        status: calcularStatus(etapa.dataPrevista, etapa.dataReal)
      });
    });
    callback(etapas);
  });
};

export const atualizarEtapa = async (empresaId, periodoId, etapaId, dados, userId, userName) => {
  const etapaDocRef = doc(db, 'empresas', empresaId, 'periodos', periodoId, 'etapas', etapaId);
  const novosDados = {
    ...dados,
    status: calcularStatus(dados.dataPrevista, dados.dataReal),
    atualizadoEm: Date.now()
  };

  await updateDoc(etapaDocRef, novosDados);
  // A lógica de histórico também foi migrada
  // await registrarHistorico(...)
};

export const deletarEtapa = (empresaId, periodoId, etapaId) => {
  const etapaDocRef = doc(db, 'empresas', empresaId, 'periodos', periodoId, 'etapas', etapaId);
  return deleteDoc(etapaDocRef);
};

export const importarEtapas = async (empresaId, periodoId, etapas) => {
  const batch = writeBatch(db);
  const etapasCollectionRef = collection(db, 'empresas', empresaId, 'periodos', periodoId, 'etapas');

  etapas.forEach((etapa, index) => {
    const etapaDocRef = doc(etapasCollectionRef); // Cria uma nova referência de documento com ID automático
    batch.set(etapaDocRef, { ...etapa, ordem: etapa.ordem || index + 1 });
  });

  return batch.commit();
};

// ==================== HISTÓRICO ====================
export const registrarHistorico = async (empresaId, registro) => {
  const histRef = dbPush(`historico/${empresaId}`, registro);
  return histRef.key;
};

export const getHistorico = (empresaId, callback) => {
  const historicoCollectionRef = collection(db, 'empresas', empresaId, 'historico');
  const q = firestoreQuery(historicoCollectionRef, orderBy('timestamp', 'desc'));
  return onSnapshot(q, (querySnapshot) => {
    const historico = [];
    querySnapshot.forEach((doc) => {
      historico.push({ id: doc.id, ...doc.data() });
    });
    callback(historico);
  });
};

// ==================== TEMPLATES ====================
export const criarTemplate = async (empresaId, template) => {
  const templatesCollectionRef = collection(db, 'empresas', empresaId, 'templates');
  const docRef = await addDoc(templatesCollectionRef, {
    ...template,
    criadoEm: Date.now()
  });
  return docRef.id;
};

export const getTemplates = (empresaId, callback) => {
  const templatesCollectionRef = collection(db, 'empresas', empresaId, 'templates');
  return onSnapshot(templatesCollectionRef, (querySnapshot) => {
    const templates = [];
    querySnapshot.forEach((doc) => {
      templates.push({ id: doc.id, ...doc.data() });
    });
    callback(templates);
  });
};

export const deletarTemplate = (empresaId, templateId) => {
  const templateDocRef = doc(db, 'empresas', empresaId, 'templates', templateId);
  return deleteDoc(templateDocRef);
};

// ==================== HELPERS ====================
export const calcularStatus = (dataPrevista, dataReal) => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  
  const prevista = dataPrevista ? new Date(dataPrevista) : null;
  if (prevista) prevista.setHours(0, 0, 0, 0);
  
  const real = dataReal ? new Date(dataReal) : null;
  if (real) real.setHours(0, 0, 0, 0);
  
  if (real) {
    // Concluído
    if (prevista && real > prevista) {
      return 'concluido_atraso'; // Laranja
    }
    return 'concluido'; // Verde
  }
  
  if (!prevista) {
    return 'pendente'; // Amarelo
  }
  
  if (hoje > prevista) {
    return 'atrasado'; // Vermelho
  }
  
  if (hoje.getTime() === prevista.getTime()) {
    return 'em_andamento'; // Azul
  }
  
  return 'pendente'; // Amarelo
};

export const getStatusColor = (status) => {
  const colors = {
    'concluido': 'bg-green-500',
    'em_andamento': 'bg-blue-500',
    'pendente': 'bg-yellow-500',
    'concluido_atraso': 'bg-orange-500',
    'atrasado': 'bg-red-500'
  };
  return colors[status] || 'bg-gray-500';
};

export const getStatusLabel = (status) => {
  const labels = {
    'concluido': 'Concluído',
    'em_andamento': 'Em Andamento',
    'pendente': 'Pendente',
    'concluido_atraso': 'Concluído c/ Atraso',
    'atrasado': 'Atrasado'
  };
  return labels[status] || status;
};

// Calcular indicadores do dashboard
export const calcularIndicadores = (etapas) => {
  const total = etapas.length;
  if (total === 0) {
    return {
      total: 0,
      concluidas: 0,
      emAndamento: 0,
      pendentes: 0,
      atrasadas: 0,
      concluidasComAtraso: 0,
      percentualConcluido: 0,
      percentualAtrasado: 0,
      tempoMedioAtraso: 0
    };
  }
  
  const concluidas = etapas.filter(e => e.status === 'concluido').length;
  const emAndamento = etapas.filter(e => e.status === 'em_andamento').length;
  const pendentes = etapas.filter(e => e.status === 'pendente').length;
  const atrasadas = etapas.filter(e => e.status === 'atrasado').length;
  const concluidasComAtraso = etapas.filter(e => e.status === 'concluido_atraso').length;
  
  // Calcular tempo médio de atraso
  let totalDiasAtraso = 0;
  let countAtrasos = 0;
  
  etapas.forEach(etapa => {
    if (etapa.status === 'concluido_atraso' && etapa.dataPrevista && etapa.dataReal) {
      const prevista = new Date(etapa.dataPrevista);
      const real = new Date(etapa.dataReal);
      const diasAtraso = Math.ceil((real - prevista) / (1000 * 60 * 60 * 24));
      if (diasAtraso > 0) {
        totalDiasAtraso += diasAtraso;
        countAtrasos++;
      }
    }
  });
  
  return {
    total,
    concluidas,
    emAndamento,
    pendentes,
    atrasadas,
    concluidasComAtraso,
    percentualConcluido: Math.round(((concluidas + concluidasComAtraso) / total) * 100),
    percentualAtrasado: Math.round((atrasadas / total) * 100),
    tempoMedioAtraso: countAtrasos > 0 ? Math.round(totalDiasAtraso / countAtrasos) : 0
  };
};

// ==================== GOOGLE SHEETS ====================
export const listenToSheetData = (callback) => {
  return dbOnValue('sheetData', callback);
};

// ==================== USUÁRIOS/MEMBROS ====================

export const getUsuarios = (empresaId, callback) => {
  const membrosCollectionRef = collection(db, 'empresas', empresaId, 'membros');
  return onSnapshot(membrosCollectionRef, (querySnapshot) => {
    const usuarios = [];
    querySnapshot.forEach((doc) => {
      usuarios.push({ id: doc.id, ...doc.data() });
    });
    callback(usuarios);
  });
};

export const convidarUsuario = async (empresaId, { email, perfil }, inviterUserId, inviterUserName) => {
  const membrosCollectionRef = collection(db, 'empresas', empresaId, 'membros');
  const docRef = await addDoc(membrosCollectionRef, {
    email: email,
    role: perfil,
    convidadoPor: inviterUserName,
    convidadoPorId: inviterUserId,
    convidadoEm: Date.now(),
    status: 'pendente'
  });
  return docRef.id;
};

export const atualizarPerfilUsuario = async (empresaId, membroId, { perfil }, updaterUserId, updaterUserName) => {
  const membroDocRef = doc(db, 'empresas', empresaId, 'membros', membroId);
  return updateDoc(membroDocRef, {
    role: perfil,
    atualizadoPor: updaterUserName,
    atualizadoPorId: updaterUserId,
    atualizadoEm: Date.now()
  });
};

export const getPerfilUsuario = async (empresaId, userId) => {
  // Esta função precisa de um ajuste de lógica para Firestore.
  // Por enquanto, vamos assumir que o ID do membro é o ID do documento.
  const membroDocRef = doc(db, 'empresas', empresaId, 'membros', userId);
  const docSnap = await getDoc(membroDocRef); // getDoc precisa ser importado
  return docSnap.exists() ? docSnap.data().role : null;
};
