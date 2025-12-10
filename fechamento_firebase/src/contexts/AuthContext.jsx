import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth, db, logout, onAuthChange, loginWithGoogle as firebaseLoginWithGoogle, getEtapas } from '../services/firebase';
import { getEmpresas } from '../services/database';
import { doc, updateDoc, runTransaction, collection, onSnapshot, query, where, getDoc, collectionGroup, deleteDoc, addDoc } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [empresaAtual, setEmpresaAtual] = useState(null);
  const [empresas, setEmpresas] = useState([]);
  const [sidebarAberto, setSidebarAberto] = useState(true);
  const [perfilUsuario, setPerfilUsuario] = useState(null);
  const [etapas, setEtapas] = useState([]); // Supondo que você tenha um estado para as etapas

  const toggleSidebar = () => {
    setSidebarAberto(prevState => !prevState);
  };

  // Efeito 1: Lida apenas com a autenticação do usuário e o estado de carregamento inicial.
  useEffect(() => {
    // onAuthChange dispara imediatamente com o estado atual do usuário (logado ou não).
    const unsubscribe = onAuthChange((firebaseUser) => {
      if (firebaseUser) {
        setUser({ id: firebaseUser.uid, email: firebaseUser.email, name: firebaseUser.displayName, photoURL: firebaseUser.photoURL });
      } else {
        setUser(null);
      }
      // Garante que o carregamento termine assim que a verificação do usuário for concluída.
      setLoading(false);
    });
    // Retorna a função de limpeza para o listener de autenticação.
    return () => unsubscribe();
  }, []); // Executa apenas uma vez na montagem

  const selecionarEmpresa = useCallback((empresa) => {
    setEmpresaAtual(empresa);
    localStorage.setItem('empresaAtualId', empresa.id);
  }, []);

  // Efeito 2: Reage à mudança de 'user' para buscar as empresas.
  useEffect(() => {
    if (!user) {
      setEmpresas([]);
      setEmpresaAtual(null);
      return;
    }

    // Consulta o 'collectionGroup' de 'usuarios' para encontrar todas as empresas
    // onde o ID do usuário atual existe como um documento na subcoleção 'usuarios'.
    const q = query(collectionGroup(db, 'usuarios'), where("uid", "==", user.id));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        setEmpresas([]);
        setEmpresaAtual(null);
        return;
      }

      // Para cada associação encontrada, busca os dados do documento pai (a empresa).
      const promises = snapshot.docs.map(docSnapshot => getDoc(docSnapshot.ref.parent.parent));
      const empresaDocs = await Promise.all(promises);

      const empresasData = empresaDocs
        .filter(doc => doc.exists())
        .map(doc => ({ id: doc.id, ...doc.data() }));

      setEmpresas(empresasData);

      // Lógica para manter ou definir a empresa atual
      const empresaSalvaId = localStorage.getItem('empresaAtualId');
      const empresaAtualValida = empresasData.find(e => e.id === empresaAtual?.id);

      if (!empresaAtualValida) {
        const empresaSalva = empresasData.find(e => e.id === empresaSalvaId);
        const nextEmpresa = empresaSalva || empresasData[0] || null;
        if (nextEmpresa) {
          selecionarEmpresa(nextEmpresa);
        }
      }
    });

    return () => unsubscribe();
  }, [user, selecionarEmpresa]); // Re-executa sempre que o objeto 'user' ou a função 'selecionarEmpresa' mudar.

  // Efeito para buscar o perfil do usuário na empresa atual
  useEffect(() => {
    if (!user || !empresaAtual) {
      setPerfilUsuario(null);
      return;
    }

    const usuarioEmpresaRef = doc(db, 'empresas', empresaAtual.id, 'usuarios', user.id);
    const unsubscribe = onSnapshot(usuarioEmpresaRef, (doc) => {
      if (doc.exists()) {
        setPerfilUsuario(doc.data());
      } else {
        setPerfilUsuario(null);
      }
    });

    return () => unsubscribe();
  }, [user, empresaAtual]);

  // Efeito 3: Reage à mudança de 'empresaAtual' para buscar as etapas.
  /*
  useEffect(() => {
    if (!empresaAtual?.id) {
      setEtapas([]);
      return;
    }
    // A função getEtapas deve ser criada e exportada de 'services/firebase.js' ou 'database.js'
    // e deve retornar uma função de unsubscribe.
    const unsubscribeFromEtapas = getEtapas(empresaAtual.id, setEtapas);
    return () => unsubscribeFromEtapas();
  }, [empresaAtual]);
  */

  const loginWithGoogle = () => firebaseLoginWithGoogle();

  const handleLogout = async () => {
    try {
      await logout();
      sessionStorage.removeItem('googleAccessToken');
      setUser(null);
      setEmpresaAtual(null);
      setEmpresas([]);
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      throw error;
    }
  };

  const handleCriarEmpresa = async (dados) => {
    if (!user) throw new Error("Usuário não autenticado.");

    try {
      // Usamos uma transação do Firestore para garantir que ambas as operações ocorram com sucesso.
      const novaEmpresaRef = doc(collection(db, 'empresas'));
      
      await runTransaction(db, async (transaction) => {
        // 1. Cria o documento da empresa
        transaction.set(novaEmpresaRef, { ...dados, criadoEm: new Date(), criadoPor: user.id });

        // 2. Adiciona o usuário criador como administrador na subcoleção 'usuarios'
        const usuarioEmpresaRef = doc(db, 'empresas', novaEmpresaRef.id, 'usuarios', user.id);
        transaction.set(usuarioEmpresaRef, { uid: user.id, email: user.email, nome: user.name, perfil: 'admin' });
      });

      const empresaCriada = { id: novaEmpresaRef.id, ...dados };

      // Atualiza o estado local imediatamente para a UI refletir a mudança.
      setEmpresas(prevEmpresas => [...prevEmpresas, empresaCriada]);

      // Retorna o objeto completo da nova empresa para a UI
      return empresaCriada;
    } catch (error) {
      console.error("Erro na transação de criar empresa:", error);
      throw error; // Re-lança o erro para ser capturado e exibido no componente
    }
  };

  const handleAtualizarEmpresa = async (empresaId, dados) => {
    if (!user) return;
    try {
      const empresaRef = doc(db, 'empresas', empresaId);
      await updateDoc(empresaRef, dados);

      // Atualiza o estado local para refletir a mudança imediatamente
      const dadosAtualizados = { ...dados, id: empresaId };
      setEmpresas(prevEmpresas =>
        prevEmpresas.map(e => e.id === empresaId ? { ...e, ...dadosAtualizados } : e)
      );
      if (empresaAtual?.id === empresaId) {
        setEmpresaAtual(prev => ({ ...prev, ...dadosAtualizados }));
      }
    } catch (error) {
      console.error("Erro ao atualizar empresa:", error);
    }
  };

  const deletarEmpresa = async (empresaId) => {
    if (!user) throw new Error("Usuário não autenticado.");
    try {
      const empresaRef = doc(db, 'empresas', empresaId);
      await deleteDoc(empresaRef);

      if (empresaAtual?.id === empresaId) {
        setEmpresaAtual(null);
        localStorage.removeItem('empresaAtualId');
      }
      // O listener onSnapshot em `useEffect` cuidará de atualizar a lista de empresas.
    } catch (error) {
      console.error("Erro ao deletar empresa:", error.code, error.message);
      // Verifica se o erro é de permissão e exibe uma mensagem mais clara
      if (error.code === 'permission-denied') {
        throw new Error("Permissão negada. Verifique suas regras de segurança do Firestore ou se você é um administrador.");
      }
      // Para outros erros, relança uma mensagem genérica, mas com o erro original no console.
      throw new Error(`Falha ao excluir a empresa: ${error.message || 'Erro desconhecido'}. Tente novamente.`);
    }
  };

  const signInWithGoogleAndGetToken = async () => {
    const provider = new GoogleAuthProvider();
    // Este escopo é crucial: ele solicita permissão para ler as planilhas do usuário.
    provider.addScope('https://www.googleapis.com/auth/spreadsheets.readonly');

    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential.accessToken;

      if (!token) {
        throw new Error("Não foi possível obter o token de acesso do Google.");
      }
      sessionStorage.setItem('googleAccessToken', token);
      return token;
    } catch (error) {
      console.error("Erro durante o login com Google (popup):", error);
      throw new Error(`Erro ao autenticar com Google: ${error.message}`);
    }
  };

  const getSheetData = async ({ spreadsheetId, range, token }) => {
    const finalToken = token || sessionStorage.getItem('googleAccessToken');
    if (!finalToken) {
      throw new Error("Token de acesso não encontrado. Faça login novamente para obter permissão.");
    }

    const finalSpreadsheetId = spreadsheetId || empresaAtual?.spreadsheetId;
    if (!finalSpreadsheetId) {
      throw new Error('Nenhuma planilha Google configurada para esta empresa. Vá para a página de Importação para configurar.');
    }

    let finalRange = range;
    if (!finalRange) {
      try {
        const sheetsResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${finalSpreadsheetId}`, {
          headers: { 'Authorization': `Bearer ${finalToken}` }
        });

        if (!sheetsResponse.ok) {
          const errorBody = await sheetsResponse.json();
          console.error("Falha ao buscar metadados da planilha:", errorBody);
          if (sheetsResponse.status === 403) {
            throw new Error('Acesso negado à planilha. Verifique se a API Google Sheets está ativada no seu projeto Google Cloud e se você compartilhou a planilha com o email da conta de serviço do Firebase.');
          }
          throw new Error('Falha ao buscar metadados da planilha para encontrar o nome da primeira aba.');
        }

        const sheetData = await sheetsResponse.json();
        const firstSheetName = sheetData.sheets?.[0]?.properties?.title;
        if (!firstSheetName) {
          throw new Error('Não foi possível encontrar nenhuma aba na sua planilha.');
        }
        finalRange = firstSheetName;
      } catch (error) {
        // Re-throw specific errors or a generic one
        throw new Error(error.message || 'Ocorreu um erro ao determinar a aba da planilha.');
      }
    }

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${finalSpreadsheetId}/values/${finalRange}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${finalToken}`
      }
    });

    if (!response.ok) {
      const errorBody = await response.json();
      console.error("Falha ao buscar dados da planilha:", errorBody);
      if (response.status === 401) {
        throw new Error('Token de acesso inválido ou expirado. Por favor, faça login novamente para obter um novo token.');
      }
      if (response.status === 403) {
        throw new Error('Acesso negado aos dados da planilha. Verifique as permissões de compartilhamento.');
      }
      throw new Error('Falha ao buscar dados da planilha. Verifique as permissões e o ID da planilha.');
    }

    const data = await response.json();
    return data.values; // Retorna um array de arrays com os valores das células
  };

  const atualizarDataRealEtapa = useCallback(async (etapaId, dataReal) => {
    try {
      if (!empresaAtual?.id) {
        throw new Error("Nenhuma empresa selecionada para atualizar a etapa.");
      }
      // A referência correta deve apontar para a subcoleção 'etapas' dentro da empresa atual.
      const etapaRef = doc(db, 'empresas', empresaAtual.id, 'etapas', etapaId);
      // É uma boa prática converter a data para um Timestamp do Firestore.
      await updateDoc(etapaRef, { dataReal: new Date(dataReal) });

      // Não é necessário atualizar o estado local manualmente.
      // O listener onSnapshot (em getEtapas) fará isso automaticamente.
    } catch (error) {
      console.error("Erro ao atualizar data real da etapa:", error);
    }
  }, [empresaAtual]);

  const criarEtapa = useCallback(async (dadosEtapa) => {
    if (!user || !empresaAtual?.id) {
      throw new Error("Usuário não autenticado ou nenhuma empresa selecionada.");
    }

    try {
      // A referência aponta para a subcoleção 'etapas' dentro da empresa atual.
      const etapasCollectionRef = collection(db, 'empresas', empresaAtual.id, 'etapas');
      
      // Adiciona o novo documento de etapa. A Cloud Function será acionada por esta operação.
      const docRef = await addDoc(etapasCollectionRef, {
        ...dadosEtapa,
        criadoEm: new Date(),
        criadoPor: user.id,
      });
      return docRef; // Retorna a referência do documento criado
    } catch (error) {
      console.error("Erro ao criar nova etapa:", error);
      throw error;
    }
  }, [user, empresaAtual]);

  const value = {
    user,
    loading,
    empresaAtual,
    etapas,
    perfilUsuario,
    empresas,
    sidebarAberto,
    toggleSidebar,
    loginWithGoogle: loginWithGoogle,
    logout: handleLogout,
    criarEmpresa: handleCriarEmpresa,
    deletarEmpresa,
    selecionarEmpresa,
    getSheetData,
    atualizarEmpresa: handleAtualizarEmpresa,
    signInWithGoogleAndGetToken,
    atualizarDataRealEtapa, // Adicione a função ao contexto
    criarEtapa, // Adiciona a nova função ao contexto
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
