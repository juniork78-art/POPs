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
  const totalAlertas = vencidos.length + amanha.length;

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
        onOpenAvisos={() => setShowAvisoGlobal(true)}
        totalAlertas={totalAlertas}
        onLogout={() => { sessionStorage.removeItem('avisoMostrado'); signOut(auth); setUsuarioLogado(null); }} 
        darkMode={darkMode}
        setDarkMode={alternarTema}
        theme={theme}
      />

      {showAvisoGlobal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '15px', boxSizing: 'border-box' }}>
          <div style={{ background: theme.cardBg, color: theme.textMain, padding: '20px', borderRadius: '12px', border: '2px solid #ff4d4d', width: '100%', maxWidth: '450px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ color: '#ff4d4d', marginTop: 0, fontSize: '16px', textAlign: 'center' }}>⚠️ Atenção: Prazos e Vencimentos</h2>
            <div style={{ margin: '10px 0', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
              {vencidos.length === 0 && amanha.length === 0 ? (
                <p style={{ color: theme.textMuted, textAlign: 'center', fontSize: '13px' }}>Nenhum alerta pendente no momento.</p>
              ) : (
                <>
                  {vencidos.map((msg, i) => (
                    <div key={i} style={{ background: theme.cardInner, padding: '8px', borderRadius: '6px', borderLeft: '3px solid #ff4d4d' }}>
                      <p className="alerta-vencido" style={{ margin: 0, fontSize: '11px' }}>{msg}</p>
                    </div>
                  ))}
                  {amanha.map((msg, i) => (
                    <div key={i} style={{ background: theme.cardInner, padding: '8px', borderRadius: '6px', borderLeft: '3px solid #ff9800' }}>
                      <p className="alerta-amanha" style={{ margin: 0, fontSize: '11px' }}>{msg}</p>
                    </div>
                  ))}
                </>
              )}
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
                    const res = statusData(item.proximaInspecao);
                    const vencido = res && res.status === 'vencido';
                    const alertaAmanha = res && (res.status === 'amanha' || res.status === 'hoje');

                    return (
                      <div key={idx} style={{ background: theme.cardInner, padding: '10px', borderRadius: '6px', marginBottom: '8px', fontSize: '12px', border: `1px solid ${theme.border}` }}>
                        <p style={{ margin: '0 0 3px 0', color: '#4dabf7', fontWeight: 'bold', textTransform: 'uppercase' }}>POP: {nomeDoPop}</p>
                        <p style={{ margin: '0 0 3px 0', color: theme.textMain }}>Técnico: {item.tecnico}</p>
                        <p style={{ margin: '0 0 3px 0', color: theme.textMuted }}>Data: {item.dataHora}</p>
                        <p className={vencido ? 'alerta-vencido' : alertaAmanha ? 'alerta-amanha' : ''} style={{ margin: 0, color: vencido ? undefined : alertaAmanha ? undefined : '#28a745' }}>
                          Próx. Insp: {item.proximaInspecao} {vencido ? `(Expirado há ${res.dias}d)` : alertaAmanha ? `(${res.status === 'hoje' ? 'Vence hoje' : 'Vence amanhã'})` : ''}
                        </p>
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
                  const res = statusData(item.proximaLimpeza);
                  const vencido = res && res.status === 'vencido';
                  const alertaAmanha = res && (res.status === 'amanha' || res.status === 'hoje');

                  return (
                    <div key={idx} style={{ background: theme.cardInner, padding: '10px', borderRadius: '6px', marginBottom: '8px', fontSize: '12px', border: `1px solid ${theme.border}` }}>
                      <p style={{ margin: '0 0 3px 0', color: '#4dabf7', fontWeight: 'bold', textTransform: 'uppercase' }}>{item.popNome} ({item.central})</p>
                      <p style={{ margin: '0 0 3px 0', color: theme.textMain }}>Última: {item.ultimaLimpeza}</p>
                      <p className={vencido ? 'alerta-vencido' : alertaAmanha ? 'alerta-amanha' : ''} style={{ margin: 0, color: vencido ? undefined : alertaAmanha ? undefined : '#28a745' }}>
                        Próxima: {item.proximaLimpeza} {vencido ? `(Expirado há ${res.dias}d)` : alertaAmanha ? `(${res.status === 'hoje' ? 'Vence hoje' : 'Vence amanhã'})` : ''}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div>
                <h4 style={{ color: theme.textMuted, fontSize: '14px', borderBottom: `1.5px solid ${theme.border}`, paddingBottom: '6px' }}>Cronograma de Baterias</h4>
                {cronogramaBaterias.map((item, idx) => {
                  if (!popPertenceAoUsuario(item.popNome)) return null;
                  const res = statusData(item.proximaSubstituicao);
                  const vencido = res && res.status === 'vencido';
                  const alertaAmanha = res && (res.status === 'amanha' || res.status === 'hoje');

                  return (
                    <div key={idx} style={{ background: theme.cardInner, padding: '10px', borderRadius: '6px', marginBottom: '8px', fontSize: '12px', border: `1px solid ${theme.border}` }}>
                      <p style={{ margin: '0 0 3px 0', color: '#4dabf7', fontWeight: 'bold', textTransform: 'uppercase' }}>{item.popNome} ({item.banco})</p>
                      <p style={{ margin: '0 0 3px 0', color: theme.textMain }}>Fabricação: {item.fabricacao}</p>
                      <p className={vencido ? 'alerta-vencido' : alertaAmanha ? 'alerta-amanha' : ''} style={{ margin: 0, color: vencido ? undefined : alertaAmanha ? undefined : '#28a745' }}>
                        Troca: {item.proximaSubstituicao} {vencido ? `(Expirado há ${res.dias}d)` : alertaAmanha ? `(${res.status === 'hoje' ? 'Vence hoje' : 'Vence amanhã'})` : ''}
                      </p>
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
      <form onSubmit={handleLogin} style={{ background: theme.cardBg, color: theme.textMain, padding: '30px', borderRadius: '8px', width: '340px', border: `1px solid ${theme.border}`, textAlign: 'center' }}>
        <img src="/logo.png" alt="Logo Fibralink" style={{ width: '150px', marginBottom: '15px', objectFit: 'contain' }} />
        <h2 style={{ marginBottom: '20px', fontSize: '18px' }}>InfraManager POP</h2>
        {erro && <p style={{ color: '#ff6b6b', fontSize: '14px' }}>{erro}</p>}
        <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '10px', marginBottom: '15px', background: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.inputText, boxSizing: 'border-box' }} />
        <input type="password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} required style={{ width: '100%', padding: '10px', marginBottom: '20px', background: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.inputText, boxSizing: 'border-box' }} />
        <button type="submit" style={{ width: '100%', padding: '12px', background: '#007bff', border: 'none', color: '#fff', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer' }}>Entrar</button>
      </form>
    </div>
  );
}

function TelaListaPops({ tecnico, listaPops, ultimosCheckIns, cronogramaLimpezas, cronogramaBaterias, onPopClick, onOpenDrawer, onOpenGerenciarPops, onOpenAvisos, totalAlertas, onLogout, darkMode, setDarkMode, theme }) {
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
          <img src="/logo.png" alt="Logo Fibralink" style={{ width: '100px', objectFit: 'contain' }} />
          <h1 style={{ margin: 0, fontSize: '16px' }}>| Olá, {tecnico.split('@')[0].toUpperCase()}</h1>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={onOpenAvisos} style={{ background: theme.cardInner, border: `1px solid ${theme.border}`, color: theme.textMain, padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px' }}>
            🔔
            {totalAlertas > 0 && (
              <span style={{ background: '#ff4d4d', color: '#fff', fontSize: '10px', fontWeight: 'bold', padding: '1px 5px', borderRadius: '10px' }}>
                {totalAlertas}
              </span>
            )}
          </button>
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
  const isDuandys = tecnico.toLowerCase().includes('duandys');
  const cargoLabel = isDuandys ? "Gestor" : "Técnico";
  const nomeTecnico = tecnico.split('@')[0].replace('.', ' ').toUpperCase();
  
  const [tipoData, setTipoData] = useState('atual');
  const [dataManualInspecao, setDataManualInspecao] = useState('');
  const [ultimaDataSalva, setUltimaDataSalva] = useState('');
  const [incidentesGerais, setIncidentesGerais] = useState('');
  const [precisaLimpeza, setPrecisaLimpeza] = useState(false);
  const [anotacoes, setAnotacoes] = useState('');

  const [statusAtivos, setStatusAtivos] = useState({
    "Motor de Portão": "OK",
    "Câmeras": "OK",
    "Controle de Acesso": "OK",
    "Sensores": "OK",
    "Central de Alarme": "OK"
  });

  const [ativosPresentes, setAtivosPresentes] = useState({
    "Motor de Portão": true,
    "Câmeras": true,
    "Controle de Acesso": true,
    "Sensores": true,
    "Central de Alarme": true
  });

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

        if (data.statusAtivos) {
          const filtrados = { ...data.statusAtivos };
          delete filtrados["Bancos de Bateria"];
          delete filtrados["Centrais de Ar"];
          setStatusAtivos(filtrados);
        }
        if (data.ativosPresentes) {
          const filtradosPres = { ...data.ativosPresentes };
          delete filtradosPres["Bancos de Bateria"];
          delete filtradosPres["Centrais de Ar"];
          setAtivosPresentes(filtradosPres);
        }
        if (data.detalhesIncidentes) setDetalhesIncidentes(data.detalhesIncidentes);
        if (data.incidentesGerais) setIncidentesGerais(data.incidentesGerais);
        if (data.precisaLimpeza !== undefined) setPrecisaLimpeza(data.precisaLimpeza);
        if (data.anotacoes) setAnotacoes(data.anotacoes);

        if (data.ultimaDataInspecao) {
          setDataManualInspecao(data.ultimaDataInspecao);
          setUltimaDataSalva(data.ultimaDataInspecao);
          setTipoData('manual');
        }

        const loadedBancos = {};
        for (let i = 1; i <= (data.qtdBancos || 1); i++) {
          loadedBancos[i] = {
            dataFabricacao: data[`bat_${i}_fab`] || '',
            voltagens: [
              data[`bat_${i}_v1`] || '',
              data[`bat_${i}_v2`] || '',
              data[`bat_${i}_v3`] || '',
              data[`bat_${i}_v4`] || ''
            ],
            salvo: data[`bat_${i}_salvo`] || false
          };
        }
        setBancosBateria(loadedBancos);

        const loadedAr = {};
        for (let i = 1; i <= (data.qtdAr || 1); i++) {
          loadedAr[i] = {
            modelo: data[`ar_${i}_mod`] || '',
            btu: data[`ar_${i}_btu`] || '',
            dataInstalacao: data[`ar_${i}_inst`] || '',
            dataUltimaLimpeza: data[`ar_${i}_limp`] || '',
            salvo: data[`ar_${i}_salvo`] || false
          };
        }
        setCentraisAr(loadedAr);
      }
    });
  }, [pop.nome]);

  const salvarNoFirebase = async (dadosNovos) => {
    try {
      await setDoc(docRef, dadosNovos, { merge: true });
    } catch (e) {
      console.error("Erro ao salvar:", e);
    }
  };

  const salvarStatusAtivosFirebase = async () => {
    await salvarNoFirebase({
      statusAtivos,
      ativosPresentes,
      detalhesIncidentes,
      incidentesGerais,
      precisaLimpeza,
      anotacoes
    });
    alert("Status dos ativos e observações salvos com sucesso!");
  };

  const finalizarInspecao = async () => {
    let dataInspecaoFinal = '';
    let dataProxStr = '';
    let forcarCheckin = false;
    let dataParaSalvar = '';

    if (tipoData === 'manual' && dataManualInspecao.trim() !== '') {
      const dataFormatada = dataManualInspecao.trim();
      dataInspecaoFinal = `${dataFormatada} (Manual)`;
      dataParaSalvar = dataFormatada;
      
      if (dataFormatada !== ultimaDataSalva) {
        forcarCheckin = true;
      }

      try {
        const parts = dataFormatada.split('/');
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          const dataProx = new Date(year, month, day);
          dataProx.setDate(dataProx.getDate() + 90);
          dataProxStr = `${String(dataProx.getDate()).padStart(2, '0')}/${String(dataProx.getMonth() + 1).padStart(2, '0')}/${dataProx.getFullYear()}`;
        }
      } catch (e) {}
    } else {
      forcarCheckin = true;
      const obterLocalizacao = () => new Promise((resolve) => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(`GPS: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`),
            () => resolve("Sem GPS"),
            { timeout: 10000 }
          );
        } else {
          resolve("Sem GPS");
        }
      });

      const coords = await obterLocalizacao();
      const agora = new Date();
      const diaStr = String(agora.getDate()).padStart(2, '0');
      const mesStr = String(agora.getMonth() + 1).padStart(2, '0');
      const anoStr = agora.getFullYear();
      const horaStr = String(agora.getHours()).padStart(2, '0');
      const minStr = String(agora.getMinutes()).padStart(2, '0');

      const dataSimples = `${diaStr}/${mesStr}/${anoStr}`;
      dataParaSalvar = dataSimples;
      dataInspecaoFinal = `${dataSimples} ${horaStr}:${minStr} (${coords})`;

      const dataProx = new Date(agora);
      dataProx.setDate(dataProx.getDate() + 90);
      dataProxStr = `${String(dataProx.getDate()).padStart(2, '0')}/${String(dataProx.getMonth() + 1).padStart(2, '0')}/${dataProx.getFullYear()}`;
    }

    if (!dataProxStr) {
      const agora = new Date();
      const dataProx = new Date(agora);
      dataProx.setDate(dataProx.getDate() + 90);
      dataProxStr = `${String(dataProx.getDate()).padStart(2, '0')}/${String(dataProx.getMonth() + 1).padStart(2, '0')}/${dataProx.getFullYear()}`;
    }

    try {
      await salvarNoFirebase({
        statusAtivos,
        ativosPresentes,
        detalhesIncidentes,
        incidentesGerais,
        precisaLimpeza,
        anotacoes,
        ultimaDataInspecao: dataParaSalvar
      });

      setDataManualInspecao(dataParaSalvar);
      setUltimaDataSalva(dataParaSalvar);
      setTipoData('manual');

      const novoRegistro = {
        pop: pop.nome,
        popName: pop.nome,
        popNome: pop.nome,
        dataHora: dataInspecaoFinal,
        tecnico: nomeTecnico,
        proximaInspecao: dataProxStr
      };

      await onCheckInRealizado(novoRegistro, forcarCheckin);

      alert("Check-in e dados de inspeção salvos com sucesso!");

      const janelaPdf = window.open('', '_blank');
      if (janelaPdf) {
        let htmlRelatorio = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Relatório de Inspeção - ${pop.nome.toUpperCase()}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 30px; color: #000; line-height: 1.6; }
              .header-rel { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0056b3; padding-bottom: 10px; margin-bottom: 15px; }
              h1 { color: #0056b3; text-transform: uppercase; margin: 0; font-size: 22px; }
              h2 { font-size: 15px; color: #333; margin-top: 25px; border-bottom: 1px solid #ccc; padding-bottom: 3px; text-transform: uppercase; }
              p { margin: 6px 0; }
              .negrito { font-weight: bold; }
              .vermelho { color: #d9534f; font-weight: bold; }
              .bloco { margin-bottom: 12px; background: #f9f9f9; padding: 10px 15px; border-left: 4px solid #0056b3; border-radius: 4px; }
            </style>
          </head>
          <body>
            <div class="header-rel">
              <h1>Relatório de Inspeção - POP: ${pop.nome.toUpperCase()}</h1>
              <img src="/logo.png" alt="Logo" style="width: 120px; object-fit: contain;" />
            </div>
            <p><span class="negrito">Endereço:</span> ${pop.endereco}</p>
            <p><span class="negrito">${cargoLabel}:</span> ${nomeTecnico}</p>
            <p><span class="negrito">Data da Inspeção:</span> ${dataInspecaoFinal}</p>
            <p><span class="negrito">Próxima Inspeção Recomendada:</span> ${dataProxStr}</p>

            <h2>Status dos Ativos no POP</h2>
        `;

        Object.keys(statusAtivos).forEach(ativo => {
          if (ativosPresentes[ativo]) {
            const st = statusAtivos[ativo];
            const det = detalhesIncidentes[ativo];
            htmlRelatorio += `<div class="bloco"><span class="negrito">${ativo}:</span> <span style="color: ${st === 'OK' ? '#28a745' : '#d9534f'}; font-weight: bold;">${st}</span>`;
            if (st === 'Incidente' && det) {
              htmlRelatorio += `<br><span class="vermelho">Incidente Relatado: ${det}</span>`;
            }
            htmlRelatorio += `</div>`;
          }
        });

        htmlRelatorio += `<h2>Bancos de Baterias</h2>`;
        Array.from({ length: qtdBancos }, (_, i) => i + 1).forEach(banco => {
          const bModel = bancosBateria[banco];
          if (bModel) {
            const proxSub = calcularProximaSubstituicaoBateria(bModel.dataFabricacao);
            const resSub = statusData(proxSub);
            const vencidoSub = resSub && resSub.status === 'vencido';

            htmlRelatorio += `
              <div class="bloco">
                <span class="negrito">Banco ${getLetra(banco)}</span><br>
                Data de Fabricação: ${bModel.dataFabricacao || 'Não informada'}<br>
                <span class="${vencidoSub ? 'vermelho' : ''}">Próxima Substituição (+2 anos): ${proxSub || 'N/A'} ${vencidoSub ? `(Expirado há ${resSub.dias} dias)` : ''}</span><br>
                Voltagens das Baterias: [ Bat 1: ${bModel.voltagens[0] || '-'}V ] [ Bat 2: ${bModel.voltagens[1] || '-'}V ] [ Bat 3: ${bModel.voltagens[2] || '-'}V ] [ Bat 4: ${bModel.voltagens[3] || '-'}V ]
              </div>
            `;
          }
        });

        htmlRelatorio += `<h2>Centrais de Ar Condicionado</h2>`;
        Array.from({ length: qtdAr }, (_, i) => i + 1).forEach(idx => {
          const ar = centraisAr[idx];
          if (ar) {
            const proxLimp = calcularProximaLimpezaAr(ar.dataUltimaLimpeza, intervaloAr);
            const resLimp = statusData(proxLimp);
            const vencidoLimp = resLimp && resLimp.status === 'vencido';

            htmlRelatorio += `
              <div class="bloco">
                <span class="negrito">Central ${getLetra(idx)}</span> (${ar.modelo || 'Modelo não informado'} - ${ar.btu || 'BTU não inf.'})<br>
                Data de Instalação: ${ar.dataInstalacao || 'N/A'}<br>
                Data da Última Limpeza: ${ar.dataUltimaLimpeza || 'N/A'}<br>
                <span class="${vencidoLimp ? 'vermelho' : ''}">Próxima Limpeza (${intervaloAr} meses): ${proxLimp || 'N/A'} ${vencidoLimp ? `(Expirado há ${resLimp.dias} dias)` : ''}</span>
              </div>
            `;
          }
        });

        htmlRelatorio += `
          <h2>Observações e Incidentes Gerais</h2>
          <div class="bloco">
            <p><span class="negrito">Incidentes Gerais:</span> ${incidentesGerais || 'Nenhum incidente relatado.'}</p>
            <p><span class="negrito">Limpeza Necessária:</span> <span class="${precisaLimpeza ? 'vermelho' : ''}">${precisaLimpeza ? 'SIM' : 'NÃO'}</span></p>
            <p><span class="negrito">Anotações Extras:</span> ${anotacoes || 'Nenhuma anotação.'}</p>
          </div>
        </body></html>`;

        janelaPdf.document.write(htmlRelatorio);
        janelaPdf.document.close();
        janelaPdf.focus();
        setTimeout(() => {
          janelaPdf.print();
        }, 600);
      }

      onBack();

    } catch (error) {
      alert("Erro ao registrar o check-in: " + error.message);
    }
  };

  return (
    <div style={{ backgroundColor: theme.bg, color: theme.textMain, minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif', maxWidth: '750px', margin: '0 auto', boxSizing: 'border-box' }}>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <button type="button" onClick={onBack} style={{ background: 'transparent', border: `1px solid ${theme.border}`, color: theme.textMain, padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>← Voltar</button>
        <button type="button" onClick={setDarkMode} style={{ background: theme.cardInner, border: `1px solid ${theme.border}`, color: theme.textMain, padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
          {darkMode ? '☀️ Modo Claro' : '🌙 Modo Escuro'}
        </button>
      </div>
      
      <div style={{ background: theme.cardBg, color: theme.textMain, padding: '25px', borderRadius: '8px', border: `1px solid ${theme.border}`, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '15px' }}>
          <h2 style={{ textTransform: 'uppercase', color: '#4dabf7', margin: 0 }}>Inspeção: {pop.nome}</h2>
          <img src="/logo.png" alt="Logo" style={{ width: '100px', objectFit: 'contain' }} />
        </div>
        <p style={{ color: theme.textMuted, fontSize: '13px', marginBottom: '20px' }}>{pop.endereco}</p>

        <p style={{ color: theme.textMain, fontSize: '15px', fontWeight: 'bold', marginBottom: '15px' }}>{cargoLabel}: {nomeTecnico}</p>
        
        <div className="no-print" style={{ marginBottom: '20px', background: theme.cardInner, padding: '12px', borderRadius: '6px', border: `1px solid ${theme.border}` }}>
          <label style={{ display: 'block', fontSize: '12px', color: theme.textMuted, marginBottom: '6px' }}>Tipo de Data da Inspeção</label>
          <div style={{ display: 'flex', gap: '15px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '13px' }}>
              <input type="radio" name="tipoData" checked={tipoData === 'atual'} onChange={() => setTipoData('atual')} /> Data Atual + GPS
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '13px' }}>
              <input type="radio" name="tipoData" checked={tipoData === 'manual'} onChange={() => setTipoData('manual')} /> Data Manual Salva
            </label>
          </div>

          {tipoData === 'manual' && (
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: theme.textMuted, marginBottom: '3px' }}>Informe a data que foi feita a inspeção</label>
              <input type="text" value={dataManualInspecao} onChange={(e) => setDataManualInspecao(e.target.value)} placeholder="ex: 20/08/2026" style={{ width: '100%', padding: '8px', background: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.inputText, boxSizing: 'border-box' }} />
            </div>
          )}
        </div>

        <h3>Status dos Ativos no POP</h3>
        {Object.keys(statusAtivos).map((ativo) => {
          const presente = ativosPresentes[ativo];
          return (
            <div key={ativo} style={{ background: theme.cardInner, padding: '12px', borderRadius: '6px', marginBottom: '10px', boxSizing: 'border-box', border: `1px solid ${theme.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={presente} onChange={(e) => setAtivosPresentes({ ...ativosPresentes, [ativo]: e.target.checked })} />
                  {ativo}
                </label>
                {presente && (
                  <div className="no-print" style={{ display: 'flex', gap: '5px' }}>
                    <button type="button" onClick={() => setStatusAtivos({ ...statusAtivos, [ativo]: 'OK' })} style={{ background: statusAtivos[ativo] === 'OK' ? '#28a745' : theme.cardBg, border: `1px solid ${theme.border}`, color: '#fff', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer' }}>OK</button>
                    <button type="button" onClick={() => setStatusAtivos({ ...statusAtivos, [ativo]: 'Incidente' })} style={{ background: statusAtivos[ativo] === 'Incidente' ? '#dc3545' : theme.cardBg, border: `1px solid ${theme.border}`, color: '#fff', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer' }}>Incidente</button>
                  </div>
                )}
              </div>
              {presente && statusAtivos[ativo] === 'Incidente' && (
                <input type="text" placeholder={`Relatar incidente em ${ativo}`} value={detalhesIncidentes[ativo] || ''} onChange={(e) => setDetalhesIncidentes({ ...detalhesIncidentes, [ativo]: e.target.value })} style={{ width: '100%', marginTop: '8px', padding: '6px', background: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.inputText, boxSizing: 'border-box' }} />
              )}
            </div>
          );
        })}

        <button type="button" onClick={salvarStatusAtivosFirebase} className="no-print" style={{ width: '100%', padding: '10px', background: '#17a2b8', border: 'none', color: '#fff', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer', marginTop: '10px', marginBottom: '20px' }}>
          Salvar Status dos Ativos
        </button>

        <div style={{ marginTop: '20px' }}>
          <h3>Bancos de Baterias</h3>
          <div className="no-print" style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
            {[1, 2, 3, 4].map((num) => (
              <button key={num} type="button" onClick={() => { setQtdBancos(num); salvarNoFirebase({ qtdBancos: num }); }} style={{ padding: '6px 12px', background: qtdBancos === num ? '#007bff' : theme.cardInner, border: `1px solid ${theme.border}`, color: theme.textMain, borderRadius: '4px', cursor: 'pointer' }}>{num}</button>
            ))}
          </div>
          {Array.from({ length: qtdBancos }, (_, i) => i + 1).map((banco) => {
            const bModel = bancosBateria[banco] || { dataFabricacao: '', voltagens: ['', '', '', ''], salvo: false };
            const proxSub = calcularProximaSubstituicaoBateria(bModel.dataFabricacao);
            const resSub = statusData(proxSub);
            const vencidoSub = resSub && resSub.status === 'vencido';

            return (
              <div key={banco} style={{ background: theme.cardInner, padding: '12px', borderRadius: '6px', marginBottom: '15px', boxSizing: 'border-box', border: `1px solid ${theme.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '10px' }}>
                  <h4 style={{ margin: 0 }}>Banco {getLetra(banco)}</h4>
                  <button type="button" onClick={() => {
                    const novoSalvo = !bModel.salvo;
                    const novoEstado = { ...bancosBateria, [banco]: { ...bModel, salvo: novoSalvo } };
                    setBancosBateria(novoEstado);
                    salvarNoFirebase({ 
                      [`bat_${banco}_fab`]: bModel.dataFabricacao, 
                      [`bat_${banco}_v1`]: bModel.voltagens[0],
                      [`bat_${banco}_v2`]: bModel.voltagens[1],
                      [`bat_${banco}_v3`]: bModel.voltagens[2],
                      [`bat_${banco}_v4`]: bModel.voltagens[3],
                      [`bat_${banco}_salvo`]: novoSalvo 
                    });
                  }} className="no-print" style={{ background: bModel.salvo ? '#6c757d' : '#28a745', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                    {bModel.salvo ? 'Editar Banco' : 'Salvar Banco'}
                  </button>
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: theme.textMuted, marginBottom: '3px' }}>Data de Fabricação (dd/MM/aaaa)</label>
                  <input type="text" disabled={bModel.salvo} placeholder="dd/MM/aaaa" value={bModel.dataFabricacao} onChange={(e) => {
                    const novoVal = e.target.value;
                    setBancosBateria({ ...bancosBateria, [banco]: { ...bModel, dataFabricacao: novoVal } });
                  }} style={{ width: '100%', padding: '6px', background: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.inputText, boxSizing: 'border-box' }} />
                </div>
                
                <p className={vencidoSub ? 'alerta-vencido' : ''} style={{ fontSize: '12px', color: vencidoSub ? undefined : '#4dabf7', margin: '0 0 8px 0' }}>
                  Próxima Substituição (+2 anos): {proxSub || 'Preencha a data'} {vencidoSub && `(Exp. há ${resSub.dias}d)`}
                </p>

                <div style={{ fontSize: '12px', color: theme.textMuted, marginBottom: '5px' }}>Voltagem das 4 Baterias do Banco:</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', boxSizing: 'border-box' }}>
                  {[0, 1, 2, 3].map((vIdx) => (
                    <input 
                      key={vIdx} 
                      type="text" 
                      disabled={bModel.salvo}
                      placeholder={`Bat ${vIdx + 1} (V)`} 
                      value={bModel.voltagens[vIdx] || ''} 
                      onChange={(e) => {
                        const novasVols = [...bModel.voltagens];
                        novasVols[vIdx] = e.target.value;
                        setBancosBateria({ ...bancosBateria, [banco]: { ...bModel, voltagens: novasVols } });
                      }} 
                      style={{ width: '100%', padding: '6px', background: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.inputText, boxSizing: 'border-box', textAlign: 'center' }} 
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: '20px' }}>
          <h3>Centrais de Ar</h3>
          <div className="no-print" style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
            {[1, 2, 3, 4].map((num) => (
              <button key={num} type="button" onClick={() => { setQtdAr(num); salvarNoFirebase({ qtdAr: num }); }} style={{ padding: '6px 12px', background: qtdAr === num ? '#007bff' : theme.cardInner, border: `1px solid ${theme.border}`, color: theme.textMain, borderRadius: '4px', cursor: 'pointer' }}>{num}</button>
            ))}
          </div>
          {Array.from({ length: qtdAr }, (_, i) => i + 1).map((idx) => {
            const ar = centraisAr[idx] || { modelo: '', btu: '', dataInstalacao: '', dataUltimaLimpeza: '', salvo: false };
            const proxLimp = calcularProximaLimpezaAr(ar.dataUltimaLimpeza, intervaloAr);
            const resLimp = statusData(proxLimp);
            const vencidoLimp = resLimp && resLimp.status === 'vencido';

            return (
              <div key={idx} style={{ background: theme.cardInner, padding: '12px', borderRadius: '6px', marginBottom: '10px', boxSizing: 'border-box', border: `1px solid ${theme.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <h4>Central {getLetra(idx)}</h4>
                  <button type="button" onClick={() => {
                    const novoSalvo = !ar.salvo;
                    setCentraisAr({ ...centraisAr, [idx]: { ...ar, salvo: novoSalvo } });
                    salvarNoFirebase({ 
                      [`ar_${idx}_mod`]: ar.modelo, 
                      [`ar_${idx}_btu`]: ar.btu, 
                      [`ar_${idx}_inst`]: ar.dataInstalacao, 
                      [`ar_${idx}_limp`]: ar.dataUltimaLimpeza, 
                      [`ar_${idx}_salvo`]: novoSalvo 
                    });
                  }} className="no-print" style={{ background: ar.salvo ? '#6c757d' : '#28a745', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                    {ar.salvo ? 'Editar Central' : 'Salvar Central'}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', marginTop: '8px', boxSizing: 'border-box', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '130px' }}>
                    <label style={{ display: 'block', fontSize: '11px', color: theme.textMuted, marginBottom: '2px' }}>Modelo</label>
                    <input type="text" disabled={ar.salvo} placeholder="Modelo" value={ar.modelo} onChange={(e) => setCentraisAr({ ...centraisAr, [idx]: { ...ar, modelo: e.target.value } })} style={{ width: '100%', padding: '6px', background: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.inputText, boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: '130px' }}>
                    <label style={{ display: 'block', fontSize: '11px', color: theme.textMuted, marginBottom: '2px' }}>BTU</label>
                    <input type="text" disabled={ar.salvo} placeholder="BTU" value={ar.btu} onChange={(e) => setCentraisAr({ ...centraisAr, [idx]: { ...ar, btu: e.target.value } })} style={{ width: '100%', padding: '6px', background: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.inputText, boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: theme.textMuted, marginBottom: '2px' }}>Data de Instalação (dd/MM/aaaa)</label>
                  <input type="text" disabled={ar.salvo} placeholder="dd/MM/aaaa" value={ar.dataInstalacao} onChange={(e) => setCentraisAr({ ...centraisAr, [idx]: { ...ar, dataInstalacao: e.target.value } })} style={{ width: '100%', padding: '6px', background: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.inputText, boxSizing: 'border-box' }} />
                </div>
                <div style={{ marginBottom: '4px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color theme.textMuted, marginBottom: '2px' }}>Data da Última Limpeza (dd/MM/aaaa)</label>
                  <input type="text" disabled={ar.salvo} placeholder="dd/MM/aaaa" value={ar.dataUltimaLimpeza} onChange={(e) => setCentraisAr({ ...centraisAr, [idx]: { ...ar, dataUltimaLimpeza: e.target.value } })} style={{ width: '100%', padding: '6px', background: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.inputText, boxSizing: 'border-box' }} />
                </div>
                <p className={vencidoLimp ? 'alerta-vencido' : ''} style={{ fontSize: '12px', color: vencidoLimp ? undefined : '#4dabf7', margin: '6px 0 8px 0' }}>
                  Próxima Limpeza ({intervaloAr} meses): {proxLimp || 'Preencha a última limpeza'} {vencidoLimp && `(Exp. há ${resLimp.dias}d)`}
                </p>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: '20px' }}>
          <input type="text" placeholder="Relatar Incidentes Gerais" value={incidentesGerais} onChange={(e) => setIncidentesGerais(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '15px', background: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.inputText, boxSizing: 'border-box' }} />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
            <input type="checkbox" checked={precisaLimpeza} onChange={(e) => setPrecisaLimpeza(e.target.checked)} id="limpCheck" />
            <label htmlFor="limpCheck">Limpeza Necessária</label>
          </div>

          <textarea placeholder="Anotações Extras" rows="3" value={anotacoes} onChange={(e) => setAnotacoes(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '20px', background: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.inputText, boxSizing: 'border-box' }} />

          <button type="button" onClick={finalizarInspecao} className="no-print" style={{ width: '100%', padding: '14px', background: '#28a745', border: 'none', color: '#fff', fontWeight: 'bold', fontSize: '16px', borderRadius: '4px', cursor: 'pointer' }}>
            Finalizar, Salvar e Gerar Relatório
          </button>
        </div>
      </div>
    </div>
  );
}