import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot 
} from 'firebase/firestore';

const style = document.createElement('style');
style.innerHTML = `
  @keyframes piscar {
    0% { opacity: 1; }
    50% { opacity: 0.3; }
    100% { opacity: 1; }
  }
  .alerta-vencido {
    color: #ff4d4d !important;
    animation: piscar 2s infinite;
    font-weight: bold;
  }
  .alerta-amanha {
    color: #ff9800 !important;
    font-weight: bold;
  }
  @media print {
    body {
      background: #ffffff !important;
      color: #000000 !important;
    }
    .no-print {
      display: none !important;
    }
  }
`;
document.head.appendChild(style);

const getLetra = (index) => String.fromCharCode(64 + index);

const statusData = (dataStr) => {
  if (!dataStr) return null;
  try {
    const parts = dataStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const dataVencimento = new Date(year, month, day);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const diffTime = dataVencimento - hoje;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) return { status: 'vencido', dias: Math.abs(diffDays) };
      if (diffDays === 0) return { status: 'hoje', dias: 0 };
      if (diffDays === 1) return { status: 'amanha', dias: 1 };
    }
    return null;
  } catch (e) {
    return null;
  }
};

const calcularProximaSubstituicaoBateria = (dataFabricacaoStr) => {
  try {
    const parts = dataFabricacaoStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10) + 2;
      const date = new Date(year, month, day);
      return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
    }
    return '';
  } catch (e) { return ''; }
};

const calcularProximaLimpezaAr = (dataUltimaLimpezaStr, mesesIntervalo) => {
  try {
    const parts = dataUltimaLimpezaStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1 + mesesIntervalo;
      const year = parseInt(parts[2], 10) + Math.floor(month / 12);
      const adjustedMonth = month % 12;
      const date = new Date(year, adjustedMonth, day);
      return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
    }
    return '';
  } catch (e) { return ''; }
};

const popsIniciaisPadrao = [
  { id: 1, nome: "poseidon", endereco: "Folha 16 Quadra 29 Lote 61, Nova Marabá, mba" },
  { id: 2, nome: "hermes", endereco: "br-222, 57 - São Félix - mba" },
  { id: 3, nome: "eros", endereco: "av. Itacaiúnas, 1878 - Cidade Nova - mba" },
  { id: 4, nome: "hades", endereco: "fl 27 q. Especial, s/n - Nova Marabá - disbravá - mba" },
  { id: 5, nome: "noto", endereco: "br-230, km 9 - Total Ville - mba" },
  { id: 6, nome: "afrodite", endereco: "av. Tocantins, 150, Morada Nova - mba" },
  { id: 7, nome: "hemera", endereco: "av. Boa Esperança, qd 27, lt 03 e 05 - Liberdade - mba" },
  { id: 8, nome: "apolo", endereco: "fl 31, qd 33, lt 02 - mba" },
  { id: 9, nome: "cratos", endereco: "distribuidora nossa agua, km 88 - mba" },
  { id: 10, nome: "helius", endereco: "rua das castanheiras, 123 - Belo Horizonte - mba" },
  { id: 11, nome: "limos", endereco: "Travessa João Passondas de Carvalho - Velha Marabá - mba" },
  { id: 12, nome: "geb", endereco: "Cidade Jardim - pbs" },
  { id: 13, nome: "anubis", endereco: "pa-275, qd 131, lt 37 - Disbrava - pbs" },
  { id: 14, nome: "osiris", endereco: "rua praça da bíblia, grupo correio - Morro dos Ventos - pbs" },
  { id: 15, nome: "set", endereco: "rua m, n 224 - União - Escritório - pbs" },
  { id: 16, nome: "amaterasu", endereco: "av. 31 de março, 220, Centro / Escritório - itg" },
  { id: 17, nome: "odin", endereco: "av. Oscar Tompson Filho, 582 - Morada da Paz - Escritório - rdc" },
  { id: 18, nome: "telesto", endereco: "tv. Brasispampa, 272 - Escritório - sda" },
  { id: 19, nome: "tupã1", endereco: "rua Guajajaras, 55 - Centro - Escritório - xga" },
  { id: 20, nome: "terra", endereco: "Próprio R. JK, 111 - Centro, Canaã dos Carajás - PA, 68537-860 - cna" },
  { id: 21, nome: "marduk", endereco: "v. Conselheiro Furtado, 2865 - Edifício Sintese 21, Sala 701 - Belém" },
  { id: 22, nome: "ceuci", endereco: "Av. Dez, 898 - Centro, Rio Maria - PA, 68530-000 - rma" },
  { id: 23, nome: "fanes", endereco: "distrito industrial - mba" },
  { id: 24, nome: "dereter", endereco: "Avenida Castelo Branco - Centro, 68573-003, São Geraldo do Araguaia" },
  { id: 25, nome: "neftis", endereco: "Avenida Inglaterra 333, Novo Horizonte - Parauapebas - PA, 68515-000" },
  { id: 26, nome: "bastet", endereco: "apartamento - Rio Verde - pbs" },
  { id: 27, nome: "hathor", endereco: "vs10 - pbs" }
];

export default function App() {
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [popSelecionado, setPopSelecionado] = useState(null);
  const [telaGerenciarPopsAberta, setTelaGerenciarPopsAberta] = useState(false);
  const [listaPops, setListaPops] = useState(popsIniciaisPadrao);
  const [ultimosCheckIns, setUltimosCheckIns] = useState([]);
  const [cronogramaLimpezas, setCronogramaLimpezas] = useState([]);
  const [cronogramaBaterias, setCronogramaBaterias] = useState([]);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [drawerAberto, setDrawerAberto] = useState(false);
  const [abaDrawer, setAbaDrawer] = useState('checkins');
  const [showAvisoGlobal, setShowAvisoGlobal] = useState(false);
  const [dadosCarregados, setDadosCarregados] = useState(false);

  const [darkMode, setDarkMode] = useState(() => {
    try {
      const salvo = localStorage.getItem('darkMode_pops');
      if (salvo !== null) return JSON.parse(salvo);
    } catch (e) {}
    return true;
  });

  const alternarTema = () => {
    setDarkMode(prev => {
      const novoTema = !prev;
      try {
        localStorage.setItem('darkMode_pops', JSON.stringify(novoTema));
      } catch (e) {}
      return novoTema;
    });
  };

  const theme = {
    bg: darkMode ? '#121212' : '#eef2f5',
    cardBg: darkMode ? '#1e1e1e' : '#ffffff',
    cardInner: darkMode ? '#252525' : '#f8f9fa',
    textMain: darkMode ? '#fff' : '#212529',
    textMuted: darkMode ? '#aaa' : '#555555',
    border: darkMode ? '#333' : '#d0d7de',
    inputBg: darkMode ? '#2d2d2d' : '#ffffff',
    inputText: darkMode ? '#fff' : '#212529'
  };

  const popPertenceAoUsuario = (nomePop) => {
    if (!usuarioLogado) return true;
    const isPedro = usuarioLogado.toLowerCase().includes('pedro');
    if (!isPedro) return true;
    const popObj = listaPops.find(p => p.nome.toLowerCase() === nomePop.toLowerCase());
    if (popObj) return popObj.endereco.toLowerCase().endsWith('- pbs');
    return false;
  };

  const verificarAlertasGlobaisDetalhados = () => {
    let vencidos = [];
    let amanha = [];
    const processarItem = (nomePop, baseMsg, dataStr) => {
      const res = statusData(dataStr);
      if (nomePop && res && popPertenceAoUsuario(nomePop)) {
        if (res.status === 'vencido') {
          vencidos.push(`${baseMsg} (Expirado há ${res.dias} dias)`);
        } else if (res.status === 'amanha' || res.status === 'hoje') {
          amanha.push(`${baseMsg} (${res.status === 'hoje' ? 'Vence hoje' : 'Vence amanhã'})`);
        }
      }
    };
    if (ultimosCheckIns) {
      ultimosCheckIns.forEach(c => {
        const nomePop = c.popNome || c.pop || c.nomePop || c.nome_pop || c.nome;
        if (nomePop) processarItem(nomePop, `POP: ${nomePop.toUpperCase()} - Data de inspeção expirada`, c.proximaInspecao);
      });
    }
    if (cronogramaLimpezas) {
      cronogramaLimpezas.forEach(l => processarItem(l.popNome, `POP: ${l.popNome.toUpperCase()} - Limpeza de ar (${l.central}) expirada`, l.proximaLimpeza));
    }
    if (cronogramaBaterias) {
      cronogramaBaterias.forEach(b => processarItem(b.popNome, `POP: ${b.popNome.toUpperCase()} - Banco de Bateria (${b.banco}) expirado`, b.proximaSubstituicao));
    }
    return { vencidos, amanha };
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setUsuarioLogado(user.email);
      else {
        setUsuarioLogado(null);
        setDadosCarregados(false);
        setShowAvisoGlobal(false);
        sessionStorage.removeItem('avisoMostrado');
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (usuarioLogado && dadosCarregados && !sessionStorage.getItem('avisoMostrado')) {
      const { vencidos, amanha } = verificarAlertasGlobaisDetalhados();
      if (vencidos.length > 0 || amanha.length > 0) {
        setShowAvisoGlobal(true);
        sessionStorage.setItem('avisoMostrado', 'true');
      }
    }
  }, [usuarioLogado, dadosCarregados, ultimosCheckIns, cronogramaLimpezas, cronogramaBaterias]);

  useEffect(() => {
    const handlePopState = () => {
      if (popSelecionado) setPopSelecionado(null);
      else if (telaGerenciarPopsAberta) setTelaGerenciarPopsAberta(false);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [popSelecionado, telaGerenciarPopsAberta]);

  useEffect(() => {
    if (popSelecionado || telaGerenciarPopsAberta) window.history.pushState(null, '', window.location.pathname);
  }, [popSelecionado, telaGerenciarPopsAberta]);

  useEffect(() => {
    if (usuarioLogado) {
      const unsubPops = onSnapshot(doc(db, "config", "lista_pops"), (snap) => {
        if (snap.exists() && snap.data().pops) setListaPops(snap.data().pops);
        else setDoc(doc(db, "config", "lista_pops"), { pops: popsIniciaisPadrao });
      });

      const unsubCheckins = onSnapshot(doc(db, "historico_global", "checkins"), (snap) => {
        if (snap.exists() && snap.data().lista) setUltimosCheckIns(snap.data().lista);
      });

      const unsubPopsDados = onSnapshot(collection(db, "pops_dados"), (snapshot) => {
        const listaLimpezasTemp = [];
        const listaBateriasTemp = [];
        snapshot.forEach((d) => {
          const popNome = d.id;
          const data = d.data();
          const qtdAr = data.qtdAr || 0;
          const intervaloAr = (popNome.toLowerCase() === 'helius' || popNome.toLowerCase() === 'limos') ? 5 : 8;
          for (let i = 1; i <= qtdAr; i++) {
            const ultimaLimp = data[`ar_${i}_limp`] || '';
            if (ultimaLimp) {
              listaLimpezasTemp.push({ popNome, central: `Central ${getLetra(i)}`, ultimaLimpeza: ultimaLimp, proximaLimpeza: calcularProximaLimpezaAr(ultimaLimp, intervaloAr) });
            }
          }
          const qtdBancos = data.qtdBancos || 1;
          for (let i = 1; i <= qtdBancos; i++) {
            const fab = data[`bat_${i}_fab`] || '';
            if (fab) {
              listaBateriasTemp.push({ popNome, banco: `Banco ${getLetra(i)}`, fabricacao: fab, proximaSubstituicao: calcularProximaSubstituicaoBateria(fab) });
            }
          }
        });
        setCronogramaLimpezas(listaLimpezasTemp);
        setCronogramaBaterias(listaBateriasTemp);
        setDadosCarregados(true);
      });

      return () => {
        unsubPops();
        unsubCheckins();
        unsubPopsDados();
      };
    }
  }, [usuarioLogado]);

  const apagarCheckinsAntigos = async () => {
    const confirmacao = window.confirm('Deseja apagar os check-ins mais antigos, mantendo apenas o mais recente de cada POP?');
    if (!confirmacao) return;
    const vistos = new Set();
    const novaLista = [];
    for (const item of ultimosCheckIns) {
      const nomeDoPop = (item.popNome || item.pop || item.nomePop || item.nome_pop || item.nome || '').toLowerCase().trim();
      if (nomeDoPop && !vistos.has(nomeDoPop)) {
        vistos.add(nomeDoPop);
        novaLista.push(item);
      }
    }
    setUltimosCheckIns(novaLista);
    await setDoc(doc(db, "historico_global", "checkins"), { lista: novaLista });
  };

  const limparTodosOsCheckIns = async () => {
    const senhaDigitada = window.prompt('Digite a senha para confirmar a exclusão de TODOS os check-ins:');
    if (senhaDigitada !== "@fibralink00") {
      if (senhaDigitada !== null) alert('Senha incorreta! Ação cancelada.');
      return;
    }
    const confirmacao = window.confirm('TEM CERTEZA? Isso apagará TODOS os registros de check-in do sistema permanentemente.');
    if (!confirmacao) return;
    try {
      await setDoc(doc(db, "historico_global", "checkins"), { lista: [] });
      setUltimosCheckIns([]);
      alert('Todos os check-ins foram removidos com sucesso!');
    } catch (e) {
      alert('Erro ao limpar check-ins: ' + e.message);
    }
  };

  if (loadingAuth) return <div style={{ color: theme.textMain, backgroundColor: theme.bg, textAlign: 'center', marginTop: '20vh', fontFamily: 'sans-serif', minHeight: '100vh' }}>Carregando InfraManager...</div>;
  if (!usuarioLogado) return <TelaLogin onLoginSucesso={(email) => setUsuarioLogado(email)} darkMode={darkMode} setDarkMode={alternarTema} theme={theme} />;
  if (telaGerenciarPopsAberta) return <TelaGerenciarPops listaPops={listaPops} onBack={() => { setTelaGerenciarPopsAberta(false); window.history.back(); }} theme={theme} />;
  if (popSelecionado) {
    return (
      <TelaInspecao 
        pop={popSelecionado} 
        tecnico={usuarioLogado} 
        onBack={() => { setPopSelecionado(null); window.history.back(); }} 
        onCheckInRealizado={async (novoRegistro, forcarCheckin) => {
          let novaLista = [...ultimosCheckIns];
          if (forcarCheckin) novaLista = [novoRegistro, ...ultimosCheckIns];
          else {
            const idx = novaLista.findIndex(item => (item.popNome || item.pop || '').toLowerCase() === novoRegistro.popName?.toLowerCase() && item.dataHora === novoRegistro.dataHora);
            if (idx === -1) novaLista = [novoRegistro, ...ultimosCheckIns];
          }
          setUltimosCheckIns(novaLista);
          await setDoc(doc(db, "historico_global", "checkins"), { lista: novaLista });
        }}
        darkMode={darkMode}
        setDarkMode={alternarTema}
        theme={theme}
      />
    );
  }

  const { vencidos, amanha } = verificarAlertasGlobaisDetalhados();

  return (
    <div style={{ backgroundColor: theme.bg, color: theme.textMain, minHeight: '100vh' }}>
      <TelaListaPops 
        tecnico={usuarioLogado} 
        listaPops={listaPops} 
        ultimosCheckIns={ultimosCheckIns}
        cronogramaLimpezas={cronogramaLimpezas}
        cronogramaBaterias={cronogramaBaterias}
        onPopClick={(pop) => setPopSelecionado(pop)} 
        onOpenDrawer={() => setDrawerAberto(true)}
        onOpenGerenciarPops={() => setTelaGerenciarPopsAberta(true)}
        onLogout={() => { sessionStorage.removeItem('avisoMostrado'); signOut(auth); setUsuarioLogado(null); }} 
        darkMode={darkMode}
        setDarkMode={alternarTema}
        theme={theme}
      />

      {showAvisoGlobal && (vencidos.length > 0 || amanha.length > 0) && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '15px', boxSizing: 'border-box' }}>
          <div style={{ background: theme.cardBg, color: theme.textMain, padding: '20px', borderRadius: '12px', border: '2px solid #ff4d4d', width: '100%', maxWidth: '450px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ color: '#ff4d4d', marginTop: 0, fontSize: '16px', textAlign: 'center' }}>⚠️ Atenção: Prazos e Vencimentos</h2>
            <div style={{ margin: '10px 0', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
              {vencidos.length > 0 && vencidos.map((msg, i) => (
                <div key={i} style={{ background: theme.cardInner, padding: '8px', borderRadius: '6px', borderLeft: '3px solid #ff4d4d' }}>
                  <p className="alerta-vencido" style={{ margin: 0, fontSize: '11px' }}>{msg}</p>
                </div>
              ))}
              {amanha.length > 0 && amanha.map((msg, i) => (
                <div key={i} style={{ background: theme.cardInner, padding: '8px', borderRadius: '6px', borderLeft: '3px solid #ff9800' }}>
                  <p className="alerta-amanha" style={{ margin: 0, fontSize: '11px' }}>{msg}</p>
                </div>
              ))}
            </div>
            <button onClick={() => setShowAvisoGlobal(false)} style={{ width: '100%', padding: '10px', background: '#ff4d4d', border: 'none', color: '#fff', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer', marginTop: '10px' }}>Entendido</button>
          </div>
        </div>
      )}

      {drawerAberto && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex' }}>
          <div style={{ width: '320px', background: theme.cardBg, color: theme.textMain, height: '100%', padding: '20px', boxSizing: 'border-box', overflowY: 'auto', display: 'flex', flexDirection: 'column', borderRight: `1px solid ${theme.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0 }}>Menu do Sistema</h3>
              <button onClick={() => setDrawerAberto(false)} style={{ background: 'transparent', border: 'none', color: theme.textMuted, fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: '5px', marginBottom: '15px' }}>
              <button onClick={() => setAbaDrawer('checkins')} style={{ flex: 1, padding: '8px 4px', background: abaDrawer === 'checkins' ? '#007bff' : theme.cardInner, border: `1px solid ${theme.border}`, color: theme.textMain, borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>Check-ins</button>
              <button onClick={() => setAbaDrawer('limpezas')} style={{ flex: 1, padding: '8px 4px', background: abaDrawer === 'limpezas' ? '#007bff' : theme.cardInner, border: `1px solid ${theme.border}`, color: theme.textMain, borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>Limpezas Ar</button>
              <button onClick={() => setAbaDrawer('baterias')} style={{ flex: 1, padding: '8px 4px', background: abaDrawer === 'baterias' ? '#007bff' : theme.cardInner, border: `1px solid ${theme.border}`, color: theme.textMain, borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>Baterias</button>
            </div>

            {abaDrawer === 'checkins' ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1.5px solid ${theme.border}`, paddingBottom: '6px', marginBottom: '10px' }}>
                  <h4 style={{ color: theme.textMuted, fontSize: '14px', margin: 0 }}>Últimos Check-ins</h4>
                  {ultimosCheckIns.length > 0 && (
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button onClick={apagarCheckinsAntigos} style={{ background: '#dc3545', border: 'none', color: '#fff', padding: '4px 6px', borderRadius: '4px', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold' }}>Apagar Antigos</button>
                      <button onClick={limparTodosOsCheckIns} style={{ background: '#b02a37', border: 'none', color: '#fff', padding: '4px 6px', borderRadius: '4px', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold' }}>Limpar Tudo</button>
                    </div>
                  )}
                </div>
                {ultimosCheckIns.length === 0 ? (
                  <p style={{ color: theme.textMuted, fontSize: '13px' }}>Nenhum check-in registrado.</p>
                ) : (
                  ultimosCheckIns.map((item, idx) => {
                    const nomeDoPop = (item.popNome || item.pop || item.nomePop || item.nome_pop || item.nome || '');
                    if (!popPertenceAoUsuario(nomeDoPop)) return null;
                    return (
                      <div key={idx} style={{ background: theme.cardInner, padding: '10px', borderRadius: '6px', marginBottom: '8px', fontSize: '12px', border: `1px solid ${theme.border}` }}>
                        <p style={{ margin: '0 0 3px 0', color: '#4dabf7', fontWeight: 'bold', textTransform: 'uppercase' }}>POP: {nomeDoPop}</p>
                        <p style={{ margin: '0 0 3px 0', color: theme.textMain }}>Técnico: {item.tecnico}</p>
                        <p style={{ margin: '0 0 3px 0', color: theme.textMuted }}>Data: {item.dataHora}</p>
                        <p style={{ margin: 0, color: '#28a745' }}>Próx. Insp: {item.proximaInspecao}</p>
                      </div>
                    );
                  })
                )}
              </div>
            ) : abaDrawer === 'limpezas' ? (
              <div>
                <h4 style={{ color: theme.textMuted, fontSize: '14px', borderBottom: `1.5px solid ${theme.border}`, paddingBottom: '6px' }}>Cronograma Limpezas de Ar</h4>
                {cronogramaLimpezas.map((item, idx) => {
                  if (!popPertenceAoUsuario(item.popNome)) return null;
                  return (
                    <div key={idx} style={{ background: theme.cardInner, padding: '10px', borderRadius: '6px', marginBottom: '8px', fontSize: '12px', border: `1px solid ${theme.border}` }}>
                      <p style={{ margin: '0 0 3px 0', color: '#4dabf7', fontWeight: 'bold', textTransform: 'uppercase' }}>{item.popNome} ({item.central})</p>
                      <p style={{ margin: '0 0 3px 0', color: theme.textMain }}>Última: {item.ultimaLimpeza}</p>
                      <p style={{ margin: 0, color: '#28a745' }}>Próxima: {item.proximaLimpeza}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div>
                <h4 style={{ color: theme.textMuted, fontSize: '14px', borderBottom: `1.5px solid ${theme.border}`, paddingBottom: '6px' }}>Cronograma de Baterias</h4>
                {cronogramaBaterias.map((item, idx) => {
                  if (!popPertenceAoUsuario(item.popNome)) return null;
                  return (
                    <div key={idx} style={{ background: theme.cardInner, padding: '10px', borderRadius: '6px', marginBottom: '8px', fontSize: '12px', border: `1px solid ${theme.border}` }}>
                      <p style={{ margin: '0 0 3px 0', color: '#4dabf7', fontWeight: 'bold', textTransform: 'uppercase' }}>{item.popNome} ({item.banco})</p>
                      <p style={{ margin: '0 0 3px 0', color: theme.textMain }}>Fabricação: {item.fabricacao}</p>
                      <p style={{ margin: 0, color: '#28a745' }}>Troca: {item.proximaSubstituicao}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div style={{ flex: 1 }} onClick={() => setDrawerAberto(false)}></div>
        </div>
      )}
    </div>
  );
}

function TelaLogin({ onLoginSucesso, darkMode, setDarkMode, theme }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const handleLogin = async (e) => {
    e.preventDefault();
    setErro('');
    try {
      const res = await signInWithEmailAndPassword(auth, email, senha);
      onLoginSucesso(res.user.email);
    } catch (e) { setErro(`Erro: ${e.message}`); }
  };
  return (
    <div style={{ backgroundColor: theme.bg, color: theme.textMain, minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '15px', position: 'relative' }}>
      <button type="button" onClick={setDarkMode} style={{ position: 'absolute', top: '15px', right: '15px', background: theme.cardBg, border: `1px solid ${theme.border}`, color: theme.textMain, padding: '8px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
        {darkMode ? '☀️ Modo Claro' : '🌙 Modo Escuro'}
      </button>
      <form onSubmit={handleLogin} style={{ background: theme.cardBg, color: theme.textMain, padding: '30px', borderRadius: '8px', width: '340px', border: `1px solid ${theme.border}` }}>
        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>InfraManager POP</h2>
        {erro && <p style={{ color: '#ff6b6b', fontSize: '14px' }}>{erro}</p>}
        <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '10px', marginBottom: '15px', background: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.inputText, boxSizing: 'border-box' }} />
        <input type="password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} required style={{ width: '100%', padding: '10px', marginBottom: '20px', background: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.inputText, boxSizing: 'border-box' }} />
        <button type="submit" style={{ width: '100%', padding: '12px', background: '#007bff', border: 'none', color: '#fff', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer' }}>Entrar</button>
      </form>
    </div>
  );
}

function TelaListaPops({ tecnico, listaPops, ultimosCheckIns, cronogramaLimpezas, cronogramaBaterias, onPopClick, onOpenDrawer, onOpenGerenciarPops, onLogout, darkMode, setDarkMode, theme }) {
  const [busca, setBusca] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const isPedro = tecnico.toLowerCase().includes('pedro');
  const popsFiltrados = listaPops.filter(p => (isPedro ? p.endereco.toLowerCase().endsWith('- pbs') : true) && (p.nome.toLowerCase().includes(busca.toLowerCase()) || p.endereco.toLowerCase().includes(busca.toLowerCase())));
  return (
    <div style={{ backgroundColor: theme.bg, color: theme.textMain, minHeight: '100vh', padding: '20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: `1px solid ${theme.border}`, paddingBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={onOpenDrawer} style={{ background: theme.cardInner, border: `1px solid ${theme.border}`, color: theme.textMain, padding: '8px 12px', borderRadius: '4px', cursor: 'pointer' }}>☰ Menu</button>
          <h1 style={{ margin: 0, fontSize: '18px' }}>Olá, {tecnico.split('@')[0].toUpperCase()}</h1>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={() => setShowPasswordDialog(true)} style={{ background: theme.cardInner, border: `1px solid ${theme.border}`, color: theme.textMain, padding: '8px 12px', borderRadius: '4px', cursor: 'pointer' }}>Gerenciar POPs</button>
          <button type="button" onClick={setDarkMode} style={{ background: theme.cardInner, border: `1px solid ${theme.border}`, color: theme.textMain, padding: '8px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>{darkMode ? '☀️ Modo Claro' : '🌙 Modo Escuro'}</button>
          <button onClick={onLogout} style={{ background: '#dc3545', border: 'none', color: '#fff', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer' }}>Sair</button>
        </div>
      </header>
      {showPasswordDialog && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '15px' }}>
          <div style={{ background: theme.cardBg, color: theme.textMain, padding: '25px', borderRadius: '8px', width: '300px', border: `1px solid ${theme.border}` }}>
            <h3>Senha Necessária</h3>
            <input type="password" placeholder="Senha do Sistema" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} style={{ width: '100%', padding: '8px', margin: '15px 0', background: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.inputText, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowPasswordDialog(false)} style={{ background: 'transparent', border: 'none', color: theme.textMuted, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => {
                if (passwordInput === "@fibralink00") { setShowPasswordDialog(false); setPasswordInput(''); onOpenGerenciarPops(); }
                else { alert('Senha incorreta!'); setPasswordInput(''); }
              }} style={{ background: '#007bff', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
      <input type="text" placeholder="Pesquisar POP" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.inputText, marginBottom: '20px', boxSizing: 'border-box' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
        {popsFiltrados.map((pop) => (
          <div key={pop.id} onClick={() => onPopClick(pop)} style={{ background: theme.cardBg, padding: '15px', borderRadius: '8px', border: `1px solid ${theme.border}`, cursor: 'pointer' }}>
            <h3 style={{ margin: '0 0 8px 0', color: '#4dabf7', textTransform: 'uppercase' }}>{pop.nome}</h3>
            <p style={{ margin: 0, color: theme.textMuted, fontSize: '13px' }}>{pop.endereco}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TelaGerenciarPops({ listaPops, onBack, theme }) {
  const [showDialog, setShowDialog] = useState(false);
  const [popEdicao, setPopEdicao] = useState(null);
  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const salvarPop = async () => {
    if (!nome.trim()) return;
    const novaLista = [...listaPops];
    const index = novaLista.findIndex(p => p.id === popEdicao.id);
    if (index !== -1) novaLista[index] = { ...popEdicao, nome: nome.toLowerCase().trim(), endereco };
    else novaLista.push({ id: Date.now(), nome: nome.toLowerCase().trim(), endereco });
    await setDoc(doc(db, "config", "lista_pops"), { pops: novaLista });
    setShowDialog(false);
  };
  return (
    <div style={{ backgroundColor: theme.bg, color: theme.textMain, minHeight: '100vh', padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={onBack} style={{ background: 'transparent', border: `1px solid ${theme.border}`, color: theme.textMain, padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>← Voltar</button>
        <h2>Gerenciar POPs</h2>
        <button onClick={() => { setPopEdicao({ id: Date.now() }); setNome(''); setEndereco(''); setShowDialog(true); }} style={{ background: '#28a745', border: 'none', color: '#fff', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer' }}>+ Novo POP</button>
      </div>
      {showDialog && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '15px' }}>
          <div style={{ background: theme.cardBg, color: theme.textMain, padding: '25px', borderRadius: '8px', width: '350px', border: `1px solid ${theme.border}` }}>
            <h3>Editar/Novo POP</h3>
            <input type="text" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} style={{ width: '100%', padding: '8px', margin: '10px 0', background: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.inputText, boxSizing: 'border-box' }} />
            <input type="text" placeholder="Endereço" value={endereco} onChange={(e) => setEndereco(e.target.value)} style={{ width: '100%', padding: '8px', margin: '10px 0 20px', background: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.inputText, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowDialog(false)} style={{ background: 'transparent', border: 'none', color: theme.textMuted, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvarPop} style={{ background: '#007bff', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Salvar</button>
            </div>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {listaPops.map((pop) => (
          <div key={pop.id} style={{ background: theme.cardBg, color: theme.textMain, padding: '15px', borderRadius: '8px', border: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ margin: '0 0 5px 0', color: '#4dabf7', textTransform: 'uppercase' }}>{pop.nome}</h4>
              <p style={{ margin: 0, color: theme.textMuted, fontSize: '13px' }}>{pop.endereco}</p>
            </div>
            <button onClick={() => { setPopEdicao(pop); setNome(pop.nome); setEndereco(pop.endereco); setShowDialog(true); }} style={{ background: theme.cardInner, border: `1px solid ${theme.border}`, color: theme.textMain, padding: '6px 10px', borderRadius: '4px', cursor: 'pointer' }}>Editar</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TelaInspecao({ pop, tecnico, onBack, onCheckInRealizado, darkMode, setDarkMode, theme }) {
  const nomeTecnico = tecnico.split('@')[0].toUpperCase();
  const [tipoData, setTipoData] = useState('atual');
  const [dataManualInspecao, setDataManualInspecao] = useState('');
  const [incidentesGerais, setIncidentesGerais] = useState('');
  const [precisaLimpeza, setPrecisaLimpeza] = useState(false);
  const [anotacoes, setAnotacoes] = useState('');
  const [statusAtivos, setStatusAtivos] = useState({ "Motor de Portão": "OK", "Câmeras": "OK", "Controle de Acesso": "OK", "Sensores": "OK", "Central de Alarme": "OK" });
  const [ativosPresentes, setAtivosPresentes] = useState({ "Motor de Portão": true, "Câmeras": true, "Controle de Acesso": true, "Sensores": true, "Central de Alarme": true });
  const [detalhesIncidentes, setDetalhesIncidentes] = useState({});
  const [qtdBancos, setQtdBancos] = useState(1);
  const [bancosBateria, setBancosBateria] = useState({ 1: { dataFabricacao: '', voltagens: ['', '', '', ''], salvo: false } });
  const intervaloAr = (pop.nome.toLowerCase() === 'helius' || pop.nome.toLowerCase() === 'limos') ? 5 : 8;
  const [qtdAr, setQtdAr] = useState(1);
  const [centraisAr, setCentraisAr] = useState({ 1: { modelo: '', btu: '', dataInstalacao: '', dataUltimaLimpeza: '', salvo: false } });
  const docRef = doc(db, "pops_dados", pop.nome);

  useEffect(() => {
    getDoc(docRef).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.qtdBancos) setQtdBancos(data.qtdBancos);
        if (data.qtdAr) setQtdAr(data.qtdAr);
        if (data.statusAtivos) setStatusAtivos(data.statusAtivos);
        if (data.ativosPresentes) setAtivosPresentes(data.ativosPresentes);
        if (data.detalhesIncidentes) setDetalhesIncidentes(data.detalhesIncidentes);
        if (data.incidentesGerais) setIncidentesGerais(data.incidentesGerais);
        if (data.precisaLimpeza !== undefined) setPrecisaLimpeza(data.precisaLimpeza);
        if (data.anotacoes) setAnotacoes(data.anotacoes);
        if (data.ultimaDataInspecao) { setDataManualInspecao(data.ultimaDataInspecao); setTipoData('manual'); }
      }
    });
  }, [pop.nome]);

  const salvarNoFirebase = async (dados) => { await setDoc(docRef, dados, { merge: true }); };
  const exportarPDF = (e) => { e.preventDefault(); window.print(); };

  const finalizarInspecao = async () => {
    let dataInspecaoFinal = '', dataProxStr = '';
    if (tipoData === 'manual' && dataManualInspecao.trim()) {
      dataInspecaoFinal = `${dataManualInspecao.trim()} (Manual)`;
      const p = dataManualInspecao.trim().split('/');
      if (p.length === 3) {
        const d = new Date(p[2], p[1] - 1, p[0]);
        d.setDate(d.getDate() + 90);
        dataProxStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      }
    } else {
      const agora = new Date();
      dataInspecaoFinal = `${String(agora.getDate()).padStart(2, '0')}/${String(agora.getMonth() + 1).padStart(2, '0')}/${agora.getFullYear()} ${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
      const d = new Date(agora);
      d.setDate(d.getDate() + 90);
      dataProxStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }
    await salvarNoFirebase({ statusAtivos, ativosPresentes, detalhesIncidentes, incidentesGerais, precisaLimpeza, anotacoes });
    await onCheckInRealizado({ pop: pop.nome, popName: pop.nome, popNome: pop.nome, dataHora: dataInspecaoFinal, tecnico: nomeTecnico, proximaInspecao: dataProxStr }, true);
    alert("Check-in salvo com sucesso!");
    onBack();
  };

  return (
    <div style={{ backgroundColor: theme.bg, color: theme.textMain, minHeight: '100vh', padding: '20px', maxWidth: '750px', margin: '0 auto', boxSizing: 'border-box' }}>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button type="button" onClick={onBack} style={{ background: 'transparent', border: `1px solid ${theme.border}`, color: theme.textMain, padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>← Voltar</button>
        <button type="button" onClick={setDarkMode} style={{ background: theme.cardInner, border: `1px solid ${theme.border}`, color: theme.textMain, padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' }}>{darkMode ? '☀️ Modo Claro' : '🌙 Modo Escuro'}</button>
      </div>
      <div style={{ background: theme.cardBg, color: theme.textMain, padding: '25px', borderRadius: '8px', border: `1px solid ${theme.border}` }}>
        <h2 style={{ textTransform: 'uppercase', color: '#4dabf7', marginTop: 0 }}>Inspeção: {pop.nome}</h2>
        <p style={{ color: theme.textMuted, fontSize: '13px', marginBottom: '20px' }}>{pop.endereco}</p>
        
        <div className="no-print" style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
          <button type="button" onClick={exportarPDF} style={{ flex: 1, minWidth: '200px', padding: '14px', background: '#17a2b8', border: 'none', color: '#fff', fontWeight: 'bold', fontSize: '15px', borderRadius: '4px', cursor: 'pointer' }}>📄 Salvar Relatório em PDF</button>
          <button type="button" onClick={finalizarInspecao} style={{ flex: 1, minWidth: '200px', padding: '14px', background: '#28a745', border: 'none', color: '#fff', fontWeight: 'bold', fontSize: '15px', borderRadius: '4px', cursor: 'pointer' }}>Finalizar e Salvar Inspeção</button>
        </div>
      </div>
    </div>
  );
}
