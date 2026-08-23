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

  const popPertenceAoUsuario = (nomePop) => {
    if (!usuarioLogado) return true;
    const isPedro = usuarioLogado.toLowerCase().includes('pedro');
    if (!isPedro) return true;

    const popObj = listaPops.find(p => p.nome.toLowerCase() === nomePop.toLowerCase());
    if (popObj) {
      return popObj.endereco.toLowerCase().endsWith('- pbs');
    }
    return false;
  };

  const verificarAlertasGlobaisDetalhados = () => {
    let vencidos = [];
    let amanha = [];

    const processarItem = (nomePop, baseMsg, dataStr) => {
      const res = statusData(dataStr);
      if (nomePop && res && popPertenceAoUsuario(nomePop)) {
        if (res.status === 'vencido') {
          const diasTxt = res.dias === 1 ? '1 dia' : `${res.dias} dias`;
          vencidos.push(`${baseMsg} (Expirado há ${diasTxt})`);
        } else if (res.status === 'amanha' || res.status === 'hoje') {
          const tempoTxt = res.status === 'hoje' ? 'Vence hoje' : 'Vence amanhã';
          amanha.push(`${baseMsg} (${tempoTxt})`);
        }
      }
    };

    if (ultimosCheckIns) {
      ultimosCheckIns.forEach(c => {
        const nomePop = c.popNome || c.pop || c.nomePop || c.nome_pop || c.nome;
        if (nomePop) {
          processarItem(nomePop, `POP: ${nomePop.toUpperCase()} - Data de inspeção expirada`, c.proximaInspecao);
        }
      });
    }

    if (cronogramaLimpezas) {
      cronogramaLimpezas.forEach(l => {
        processarItem(l.popNome, `POP: ${l.popNome.toUpperCase()} - Limpeza de ar (${l.central}) expirada`, l.proximaLimpeza);
      });
    }

    if (cronogramaBaterias) {
      cronogramaBaterias.forEach(b => {
        processarItem(b.popNome, `POP: ${b.popNome.toUpperCase()} - Banco de Bateria (${b.banco}) expirado`, b.proximaSubstituicao);
      });
    }

    return { vencidos, amanha };
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUsuarioLogado(user.email);
      } else {
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
      if (popSelecionado) {
        setPopSelecionado(null);
      } else if (telaGerenciarPopsAberta) {
        setTelaGerenciarPopsAberta(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [popSelecionado, telaGerenciarPopsAberta]);

  useEffect(() => {
    if (popSelecionado || telaGerenciarPopsAberta) {
      window.history.pushState(null, '', window.location.pathname);
    }
  }, [popSelecionado, telaGerenciarPopsAberta]);

  useEffect(() => {
    if (usuarioLogado) {
      const unsubPops = onSnapshot(doc(db, "config", "lista_pops"), (snap) => {
        if (snap.exists() && snap.data().pops) {
          setListaPops(snap.data().pops);
        } else {
          setDoc(doc(db, "config", "lista_pops"), { pops: popsIniciaisPadrao });
        }
      });

      const unsubCheckins = onSnapshot(doc(db, "historico_global", "checkins"), (snap) => {
        if (snap.exists() && snap.data().lista) {
          setUltimosCheckIns(snap.data().lista);
        }
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
              const proximaLimp = calcularProximaLimpezaAr(ultimaLimp, intervaloAr);
              listaLimpezasTemp.push({
                popNome,
                central: `Central ${getLetra(i)}`,
                ultimaLimpeza: ultimaLimp,
                proximaLimpeza: proximaLimp
              });
            }
          }

          const qtdBancos = data.qtdBancos || 1;
          for (let i = 1; i <= qtdBancos; i++) {
            const fab = data[`bat_${i}_fab`] || '';
            if (fab) {
              const proxSub = calcularProximaSubstituicaoBateria(fab);
              listaBateriasTemp.push({
                popNome,
                banco: `Banco ${getLetra(i)}`,
                fabricacao: fab,
                proximaSubstituicao: proxSub
              });
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

  if (loadingAuth) {
    return <div style={{ color: '#fff', textAlign: 'center', marginTop: '20vh', fontFamily: 'sans-serif' }}>Carregando InfraManager...</div>;
  }

  if (!usuarioLogado) {
    return <TelaLogin onLoginSucesso={(email) => setUsuarioLogado(email)} />;
  }

  if (telaGerenciarPopsAberta) {
    return (
      <TelaGerenciarPops 
        listaPops={listaPops} 
        onBack={() => {
          setTelaGerenciarPopsAberta(false);
          window.history.back();
        }} 
      />
    );
  }

  if (popSelecionado) {
    return (
      <TelaInspecao 
        pop={popSelecionado} 
        tecnico={usuarioLogado} 
        onBack={() => {
          setPopSelecionado(null);
          window.history.back();
        }} 
        onCheckInRealizado={async (novoRegistro, forcarCheckin) => {
          let novaLista = [...ultimosCheckIns];
          
          if (forcarCheckin) {
            novaLista = [novoRegistro, ...ultimosCheckIns];
          } else {
            const indexExistente = novaLista.findIndex(item => 
              (item.popNome || item.pop || '').toLowerCase() === novoRegistro.popName?.toLowerCase() &&
              item.dataHora === novoRegistro.dataHora
            );
            if (indexExistente === -1) {
              novaLista = [novoRegistro, ...ultimosCheckIns];
            }
          }

          setUltimosCheckIns(novaLista);
          await setDoc(doc(db, "historico_global", "checkins"), { lista: novaLista });
        }}
      />
    );
  }

  const { vencidos, amanha } = verificarAlertasGlobaisDetalhados();

  return (
    <>
      <TelaListaPops 
        tecnico={usuarioLogado} 
        listaPops={listaPops} 
        ultimosCheckIns={ultimosCheckIns}
        cronogramaLimpezas={cronogramaLimpezas}
        cronogramaBaterias={cronogramaBaterias}
        onPopClick={(pop) => setPopSelecionado(pop)} 
        onOpenDrawer={() => setDrawerAberto(true)}
        onOpenGerenciarPops={() => setTelaGerenciarPopsAberta(true)}
        onLogout={() => { 
          sessionStorage.removeItem('avisoMostrado');
          signOut(auth); 
          setUsuarioLogado(null); 
        }} 
      />

      {showAvisoGlobal && (vencidos.length > 0 || amanha.length > 0) && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '15px', boxSizing: 'border-box' }}>
          <div style={{ background: '#1e1e1e', padding: '20px', borderRadius: '12px', border: '2px solid #ff4d4d', width: '100%', maxWidth: '450px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
            <h2 style={{ color: '#ff4d4d', marginTop: 0, fontSize: '16px', textAlign: 'center' }}>⚠️ Atenção: Prazos e Vencimentos</h2>
            <p style={{ color: '#ccc', fontSize: '12px', marginBottom: '10px', textAlign: 'center' }}>Acompanhe os itens que exigem atenção:</p>
            
            <div style={{ margin: '10px 0', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, paddingRight: '4px' }}>
              {vencidos.length > 0 && (
                <div>
                  <h4 style={{ color: '#ff4d4d', fontSize: '11px', margin: '0 0 4px 0', textTransform: 'uppercase', borderBottom: '1px solid #ff4d4d', paddingBottom: '2px' }}>🔴 Itens Vencidos</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {vencidos.map((msg, i) => (
                      <div key={i} style={{ background: '#252525', padding: '8px', borderRadius: '6px', borderLeft: '3px solid #ff4d4d' }}>
                        <p className="alerta-vencido" style={{ margin: 0, fontSize: '11px', lineHeight: '1.4' }}>{msg}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {amanha.length > 0 && (
                <div>
                  <h4 style={{ color: '#ff9800', fontSize: '11px', margin: '8px 0 4px 0', textTransform: 'uppercase', borderBottom: '1px solid #ff9800', paddingBottom: '2px' }}>🟠 Vencem Hoje / Amanhã</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {amanha.map((msg, i) => (
                      <div key={i} style={{ background: '#252525', padding: '8px', borderRadius: '6px', borderLeft: '3px solid #ff9800' }}>
                        <p className="alerta-amanha" style={{ margin: 0, fontSize: '11px', lineHeight: '1.4' }}>{msg}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={() => setShowAvisoGlobal(false)} 
              style={{ width: '100%', padding: '10px', background: '#ff4d4d', border: 'none', color: '#fff', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', marginTop: '10px', flexShrink: 0 }}>
              Entendido
            </button>
          </div>
        </div>
      )}

      {drawerAberto && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex' }}>
          <div style={{ width: '320px', background: '#1e1e1e', height: '100%', padding: '20px', boxSizing: 'border-box', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Menu do Sistema</h3>
              <button onClick={() => setDrawerAberto(false)} style={{ background: 'transparent', border: 'none', color: '#aaa', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: '5px', marginBottom: '15px' }}>
              <button onClick={() => setAbaDrawer('checkins')} style={{ flex: 1, padding: '8px 4px', background: abaDrawer === 'checkins' ? '#007bff' : '#333', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>Check-ins</button>
              <button onClick={() => setAbaDrawer('limpezas')} style={{ flex: 1, padding: '8px 4px', background: abaDrawer === 'limpezas' ? '#007bff' : '#333', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>Limpezas Ar</button>
              <button onClick={() => setAbaDrawer('baterias')} style={{ flex: 1, padding: '8px 4px', background: abaDrawer === 'baterias' ? '#007bff' : '#333', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>Baterias</button>
            </div>

            {abaDrawer === 'checkins' ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #333', paddingBottom: '6px', marginBottom: '10px' }}>
                  <h4 style={{ color: '#aaa', fontSize: '14px', margin: 0 }}>Últimos Check-ins</h4>
                  {ultimosCheckIns.length > 0 && (
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button 
                        onClick={apagarCheckinsAntigos}
                        style={{ background: '#dc3545', border: 'none', color: '#fff', padding: '4px 6px', borderRadius: '4px', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold' }}>
                        Apagar Antigos
                      </button>
                      <button 
                        onClick={limparTodosOsCheckIns}
                        style={{ background: '#b02a37', border: 'none', color: '#fff', padding: '4px 6px', borderRadius: '4px', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold' }}>
                        Limpar Tudo
                      </button>
                    </div>
                  )}
                </div>

                {ultimosCheckIns.length === 0 ? (
                  <p style={{ color: '#777', fontSize: '13px' }}>Nenhum check-in registrado.</p>
                ) : (
                  ultimosCheckIns.map((item, idx) => {
                    const nomeDoPop = (item.popNome || item.pop || item.nomePop || item.nome_pop || item.nome || 'Não Informado');
                    if (!popPertenceAoUsuario(nomeDoPop)) return null;
                    
                    const resSt = statusData(item.proximaInspecao);
                    const estaVencido = resSt && resSt.status === 'vencido';
                    const estaQuaseVencendo = resSt && (resSt.status === 'amanha' || resSt.status === 'hoje');
                    
                    const nomeTecnicoStr = item.tecnico || '';
                    const isDuandysRegistro = nomeTecnicoStr.toLowerCase().includes('duandys');
                    const labelCargoRegistro = isDuandysRegistro ? 'Gestor' : 'Técnico';
                    
                    return (
                      <div key={idx} style={{ background: '#252525', padding: '10px', borderRadius: '6px', marginBottom: '8px', fontSize: '12px' }}>
                        <p style={{ margin: '0 0 3px 0', color: '#4dabf7', fontWeight: 'bold', textTransform: 'uppercase' }}>
                          POP: {nomeDoPop}
                        </p>
                        <p style={{ margin: '0 0 3px 0', color: '#ccc' }}>{labelCargoRegistro}: {nomeTecnicoStr || 'N/I'}</p>
                        <p style={{ margin: '0 0 3px 0', color: '#aaa' }}>Data: {item.dataHora || 'N/I'}</p>
                        
                        <p className={estaVencido || estaQuaseVencendo ? 'alerta-vencido' : ''} style={{ margin: '0 0 6px 0', color: (estaVencido || estaQuaseVencendo) ? undefined : '#28a745' }}>
                          Próx. Insp: {item.proximaInspecao || 'Não informada'} 
                          {estaVencido && ` (Exp. há ${resSt.dias}d)`}
                          {resSt && resSt.status === 'hoje' && ` (Vence HOJE)`}
                          {resSt && resSt.status === 'amanha' && ` (Vence amanhã)`}
                        </p>

                        <span style={{ color: '#28a745', fontSize: '11px', display: 'block' }}>✔ Check-in registrado com sucesso</span>
                      </div>
                    );
                  })
                )}
              </div>
            ) : abaDrawer === 'limpezas' ? (
              <div>
                <h4 style={{ color: '#aaa', fontSize: '14px', borderBottom: '1.5px solid #333', paddingBottom: '6px' }}>Cronograma Limpezas de Ar</h4>
                {cronogramaLimpezas.length === 0 ? (
                  <p style={{ color: '#777', fontSize: '13px' }}>Nenhuma limpeza registrada.</p>
                ) : (
                  cronogramaLimpezas.map((item, idx) => {
                    if (!popPertenceAoUsuario(item.popNome)) return null;
                    const resSt = statusData(item.proximaLimpeza);
                    const vencido = resSt && resSt.status === 'vencido';
                    return (
                      <div key={idx} style={{ background: '#252525', padding: '10px', borderRadius: '6px', marginBottom: '8px', fontSize: '12px' }}>
                        <p style={{ margin: '0 0 3px 0', color: '#4dabf7', fontWeight: 'bold', textTransform: 'uppercase' }}>{item.popNome} ({item.central})</p>
                        <p style={{ margin: '0 0 3px 0', color: '#ccc' }}>Última: {item.ultimaLimpeza}</p>
                        <p className={vencido ? 'alerta-vencido' : ''} style={{ margin: 0, color: vencido ? undefined : '#28a745' }}>
                          Próxima: {item.proximaLimpeza} {vencido && `(Exp. há ${resSt.dias}d)`}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div>
                <h4 style={{ color: '#aaa', fontSize: '14px', borderBottom: '1.5px solid #333', paddingBottom: '6px' }}>Cronograma de Baterias</h4>
                {cronogramaBaterias.length === 0 ? (
                  <p style={{ color: '#777', fontSize: '13px' }}>Nenhuma bateria registrada.</p>
                ) : (
                  cronogramaBaterias.map((item, idx) => {
                    if (!popPertenceAoUsuario(item.popNome)) return null;
                    const resSt = statusData(item.proximaSubstituicao);
                    const vencido = resSt && resSt.status === 'vencido';
                    return (
                      <div key={idx} style={{ background: '#252525', padding: '10px', borderRadius: '6px', marginBottom: '8px', fontSize: '12px' }}>
                        <p style={{ margin: '0 0 3px 0', color: '#4dabf7', fontWeight: 'bold', textTransform: 'uppercase' }}>{item.popNome} ({item.banco})</p>
                        <p style={{ margin: '0 0 3px 0', color: '#ccc' }}>Fabricação: {item.fabricacao}</p>
                        <p className={vencido ? 'alerta-vencido' : ''} style={{ margin: 0, color: vencido ? undefined : '#28a745' }}>
                          Troca: {item.proximaSubstituicao} {vencido && `(Exp. há ${resSt.dias}d)`}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
          <div style={{ flex: 1 }} onClick={() => setDrawerAberto(false)}></div>
        </div>
      )}
    </>
  );
}

function TelaLogin({ onLoginSucesso }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setErro('');
    try {
      const result = await signInWithEmailAndPassword(auth, email, senha);
      onLoginSucesso(result.user.email);
    } catch (e) {
      setErro(`Erro: ${e.message}`);
    }
  };

  return (
    <div style={{ backgroundColor: '#121212', color: '#fff', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'sans-serif' }}>
      <form onSubmit={handleLogin} style={{ background: '#1e1e1e', padding: '30px', borderRadius: '8px', width: '340px', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>InfraManager POP</h2>
        {erro && <p style={{ color: '#ff6b6b', fontSize: '14px', marginBottom: '15px' }}>{erro}</p>}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', fontSize: '12px', marginBottom: '5px' }}>E-mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #444', background: '#2d2d2d', color: '#fff', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', marginBottom: '5px' }}>Senha</label>
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #444', background: '#2d2d2d', color: '#fff', boxSizing: 'border-box' }} />
        </div>
        <button type="submit" style={{ width: '100%', padding: '12px', background: '#007bff', border: 'none', color: '#fff', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer' }}>Entrar</button>
      </form>
    </div>
  );
}

function TelaListaPops({ tecnico, listaPops, ultimosCheckIns, cronogramaLimpezas, cronogramaBaterias, onPopClick, onOpenDrawer, onOpenGerenciarPops, onLogout }) {
  const [busca, setBusca] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showNotificacoes, setShowNotificacoes] = useState(false);

  const popPertenceAoUsuario = (nomePop) => {
    const isPedro = tecnico.toLowerCase().includes('pedro');
    if (!isPedro) return true;

    const popObj = listaPops.find(p => p.nome.toLowerCase() === nomePop.toLowerCase());
    if (popObj) {
      return popObj.endereco.toLowerCase().endsWith('- pbs');
    }
    return false;
  };

  const getNotificacoes = () => {
    let alertas = [];
    if (ultimosCheckIns) {
      ultimosCheckIns.forEach(c => {
        const nomePop = c.popNome || c.pop || c.nomePop || c.nome_pop || c.nome;
        const resSt = statusData(c.proximaInspecao);
        if (nomePop && resSt && popPertenceAoUsuario(nomePop)) {
          if (resSt.status === 'vencido') alertas.push(`POP: ${nomePop.toUpperCase()} - Inspeção expirada há ${resSt.dias} dias`);
          else if (resSt.status === 'amanha' || resSt.status === 'hoje') alertas.push(`POP: ${nomePop.toUpperCase()} - Inspeção vence ${resSt.status === 'hoje' ? 'hoje' : 'amanhã'}`);
        }
      });
    }

    if (cronogramaLimpezas) {
      cronogramaLimpezas.forEach(l => {
        const resSt = statusData(l.proximaLimpeza);
        if (l.popNome && resSt && popPertenceAoUsuario(l.popNome)) {
          if (resSt.status === 'vencido') alertas.push(`POP: ${l.popNome.toUpperCase()} - Limpeza de ar (${l.central}) expirada há ${resSt.dias} dias`);
          else if (resSt.status === 'amanha' || resSt.status === 'hoje') alertas.push(`POP: ${l.popNome.toUpperCase()} - Limpeza de ar (${l.central}) vence ${resSt.status === 'hoje' ? 'hoje' : 'amanhã'}`);
        }
      });
    }

    if (cronogramaBaterias) {
      cronogramaBaterias.forEach(b => {
        const resSt = statusData(b.proximaSubstituicao);
        if (b.popNome && resSt && popPertenceAoUsuario(b.popNome)) {
          if (resSt.status === 'vencido') alertas.push(`POP: ${b.popNome.toUpperCase()} - Banco de Bateria (${b.banco}) expirado há ${resSt.dias} dias`);
          else if (resSt.status === 'amanha' || resSt.status === 'hoje') alertas.push(`POP: ${b.popNome.toUpperCase()} - Troca do Banco (${b.banco}) vence ${resSt.status === 'hoje' ? 'hoje' : 'amanhã'}`);
        }
      });
    }
    return alertas;
  };

  const notificacoes = getNotificacoes();
  const nomeFormatado = tecnico.split('@')[0].replace('.', ' ').toUpperCase();
  const isPedro = tecnico.toLowerCase().includes('pedro');

  const popsFiltrados = listaPops.filter((pop) => {
    const atendeFiltroPedro = isPedro ? pop.endereco.toLowerCase().endsWith('- pbs') : true;
    const atendeBusca = pop.nome.toLowerCase().includes(busca.toLowerCase()) || pop.endereco.toLowerCase().includes(busca.toLowerCase());
    return atendeFiltroPedro && atendeBusca;
  });

  return (
    <div style={{ backgroundColor: '#121212', color: '#fff', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={onOpenDrawer} style={{ background: '#333', border: '1px solid #555', color: '#fff', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}>☰ Menu</button>
          <h1 style={{ margin: 0, fontSize: '18px' }}>Olá, {nomeFormatado}</h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowNotificacoes(!showNotificacoes)} 
              style={{ background: '#333', border: '1px solid #555', color: '#fff', padding: '8px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Notificações"
            >
              🔔
              {notificacoes.length > 0 && (
                <span style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#dc3545', color: '#fff', fontSize: '10px', fontWeight: 'bold', padding: '2px 5px', borderRadius: '50%' }}>
                  {notificacoes.length}
                </span>
              )}
            </button>

            {showNotificacoes && (
              <div style={{ position: 'absolute', top: '40px', right: 0, width: '280px', background: '#1e1e1e', border: '1px solid #444', padding: '15px', borderRadius: '8px', zIndex: 2000, boxShadow: '0 4px 15px rgba(0,0,0,0.7)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '8px', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0, color: '#fff', fontSize: '14px' }}>Notificações de Alerta</h4>
                  <button onClick={() => setShowNotificacoes(false)} style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '14px' }}>✕</button>
                </div>

                {notificacoes.length === 0 ? (
                  <p style={{ color: '#777', fontSize: '12px', margin: 0 }}>Nenhuma pendência ou prazo próximo.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                    {notificacoes.map((notif, idx) => (
                      <div key={idx} style={{ background: '#252525', padding: '8px', borderRadius: '4px', borderLeft: '3px solid #ff4d4d' }}>
                        <p style={{ margin: 0, fontSize: '11px', color: '#ff4d4d', lineHeight: '1.4' }}>{notif}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button onClick={() => setShowPasswordDialog(true)} style={{ background: '#333', border: '1px solid #555', color: '#fff', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer' }}>Gerenciar POPs</button>
          <button onClick={onLogout} style={{ background: '#dc3545', border: 'none', color: '#fff', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer' }}>Sair</button>
        </div>
      </header>

      {showPasswordDialog && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
          <div style={{ background: '#1e1e1e', padding: '25px', borderRadius: '8px', width: '300px' }}>
            <h3>Senha Necessária</h3>
            <input type="password" placeholder="Senha do Sistema" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} style={{ width: '100%', padding: '8px', margin: '15px 0', background: '#2d2d2d', border: '1px solid #444', color: '#fff', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowPasswordDialog(false)} style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => {
                if (passwordInput === "@fibralink00") {
                  setShowPasswordDialog(false);
                  setPasswordInput('');
                  onOpenGerenciarPops();
                } else {
                  alert('Senha incorreta!');
                  setPasswordInput('');
                }
              }} style={{ background: '#007bff', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      <input type="text" placeholder="Pesquisar POP (Nome ou Endereço)" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #444', background: '#1e1e1e', color: '#fff', marginBottom: '20px', boxSizing: 'border-box' }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
        {popsFiltrados.map((pop) => (
          <div key={pop.id} onClick={() => onPopClick(pop)} style={{ background: '#1e1e1e', padding: '15px', borderRadius: '8px', border: '1px solid #333', cursor: 'pointer' }}>
            <h3 style={{ margin: '0 0 8px 0', color: '#4dabf7', textTransform: 'uppercase' }}>{pop.nome}</h3>
            <p style={{ margin: 0, color: '#aaa', fontSize: '13px' }}>{pop.endereco}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TelaGerenciarPops({ listaPops, onBack }) {
  const [showDialog, setShowDialog] = useState(false);
  const [popEdicao, setPopEdicao] = useState(null);
  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');

  const salvarPop = async () => {
    if (!nome.trim()) return;
    const novaLista = [...listaPops];
    const index = novaLista.findIndex(p => p.id === popEdicao.id);
    
    if (index !== -1) {
      novaLista[index] = { ...popEdicao, nome: nome.toLowerCase().trim(), endereco };
    } else {
      const novoId = Math.max(...novaLista.map(p => p.id), 0) + 1;
      novaLista.push({ id: novoId, nome: nome.toLowerCase().trim(), endereco });
    }

    await setDoc(doc(db, "config", "lista_pops"), { pops: novaLista });
    setShowDialog(false);
  };

  return (
    <div style={{ backgroundColor: '#121212', color: '#fff', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={onBack} style={{ background: 'transparent', border: '1px solid #777', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>← Voltar</button>
        <h2>Gerenciar POPs</h2>
        <button onClick={() => { setPopEdicao({ id: Date.now(), nome: '', endereco: '' }); setNome(''); setEndereco(''); setShowDialog(true); }} style={{ background: '#28a745', border: 'none', color: '#fff', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer' }}>+ Novo POP</button>
      </div>

      {showDialog && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
          <div style={{ background: '#1e1e1e', padding: '25px', borderRadius: '8px', width: '350px' }}>
            <h3>{nome ? 'Editar POP' : 'Novo POP'}</h3>
            <input type="text" placeholder="Nome do POP" value={nome} onChange={(e) => setNome(e.target.value)} style={{ width: '100%', padding: '8px', margin: '10px 0', background: '#2d2d2d', border: '1px solid #444', color: '#fff', boxSizing: 'border-box' }} />
            <input type="text" placeholder="Endereço" value={endereco} onChange={(e) => setEndereco(e.target.value)} style={{ width: '100%', padding: '8px', margin: '10px 0 20px', background: '#2d2d2d', border: '1px solid #444', color: '#fff', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowDialog(false)} style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvarPop} style={{ background: '#007bff', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {listaPops.map((pop) => (
          <div key={pop.id} style={{ background: '#1e1e1e', padding: '15px', borderRadius: '8px', border: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ margin: '0 0 5px 0', color: '#4dabf7', textTransform: 'uppercase' }}>[ID: {pop.id}] {pop.nome}</h4>
              <p style={{ margin: 0, color: '#aaa', fontSize: '13px' }}>{pop.endereco}</p>
            </div>
            <button onClick={() => { setPopEdicao(pop); setNome(pop.nome); setEndereco(pop.endereco); setShowDialog(true); }} style={{ background: '#333', border: '1px solid #555', color: '#fff', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer' }}>Editar</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TelaInspecao({ pop, tecnico, onBack, onCheckInRealizado }) {
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

  const gerarEBaixarPdf = async () => {
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

    const htmlConteudo = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Relatório de Inspeção - ${pop.nome.toUpperCase()}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 30px; color: #333; line-height: 1.5; background: #fff; }
          h2 { color: #0056b3; border-bottom: 2px solid #0056b3; padding-bottom: 8px; margin-bottom: 15px; }
          h3 { margin-top: 20px; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
          .section { margin-bottom: 15px; }
          .item { margin-bottom: 6px; }
        </style>
      </head>
      <body>
        <h2>RELATÓRIO DE INSPEÇÃO DE POP</h2>
        <p><strong>POP:</strong> ${pop.nome.toUpperCase()} (ID: ${pop.id})</p>
        <p><strong>Endereço:</strong> ${pop.endereco}</p>
        <p><strong>${cargoLabel} Responsável:</strong> ${nomeTecnico}</p>
        <p><strong>Check-in / Data:</strong> ${dataInspecaoFinal}</p>
        <p><strong>Próxima Inspeção (Previsão):</strong> ${dataProxStr}</p>
        
        <div class="section">
          <h3>Status dos Ativos:</h3>
          ${Object.entries(statusAtivos).map(([ativo, st]) => {
            const presente = ativosPresentes[ativo];
            if (!presente) return `<div class="item">- ${ativo}: <em>Não disponível neste POP</em></div>`;
            let txt = `<div class="item">- ${ativo}: <strong>${st}</strong></div>`;
            if (st === 'Incidente') {
              txt += `<div style="margin-left: 20px; color: #dc3545;">-> Detalhe: ${detalhesIncidentes[ativo] || 'Sem descrição'}</div>`;
            }
            return txt;
          }).join('')}
        </div>

        <div class="section">
          <h3>Bancos de Baterias:</h3>
          ${Array.from({ length: qtdBancos }, (_, i) => i + 1).map((banco) => {
            const bModel = bancosBateria[banco] || { dataFabricacao: '', voltagens: ['', '', '', ''] };
            const proxSub = calcularProximaSubstituicaoBateria(bModel.dataFabricacao);
            const resSub = statusData(proxSub);
            const vencidoSub = resSub && resSub.status === 'vencido';
            const diasVencido = vencidoSub ? resSub.dias : 0;
            return `
              <div style="margin-bottom: 8px; border-left: 3px solid ${vencidoSub ? '#ff4d4d' : '#0056b3'}; padding-left: 8px;">
                <strong>Banco ${getLetra(banco)}</strong><br/>
                - Data de Fabricação: ${bModel.dataFabricacao || 'Não informada'}<br/>
                - Próxima Substituição: ${proxSub || 'Not calculated'}
                ${vencidoSub ? `<br/><span style="color: #ff4d4d; font-weight: bold;">⚠️ AVISO: BANCO DE BATERIA EXPIRADO HÁ ${diasVencido} DIAS!</span>` : ''}<br/>
                - Voltagens: ${bModel.voltagens.map((v, vIdx) => `Bat ${vIdx + 1}: ${v || 'N/I'}V`).join(' | ')}
              </div>
            `;
          }).join('')}
        </div>

        <div class="section">
          <h3>Centrais de Ar:</h3>
          ${Array.from({ length: qtdAr }, (_, i) => i + 1).map((idx) => {
            const ar = centraisAr[idx] || { modelo: '', btu: '', dataInstalacao: '', dataUltimaLimpeza: '' };
            const proxLimp = calcularProximaLimpezaAr(ar.dataUltimaLimpeza, intervaloAr);
            const resLimp = statusData(proxLimp);
            const vencidoLimp = resLimp && resLimp.status === 'vencido';
            const diasVencidoLimp = vencidoLimp ? resLimp.dias : 0;
            return `
              <div style="margin-bottom: 8px; border-left: 3px solid ${vencidoLimp ? '#ff4d4d' : '#28a745'}; padding-left: 8px;">
                <strong>Central ${getLetra(idx)}</strong> (${ar.modelo || 'Modelo N/I'} - ${ar.btu || 'N/I'} BTUs)<br/>
                - Instalação: ${ar.dataInstalacao || 'N/I'} | Última Limpeza: ${ar.dataUltimaLimpeza || 'N/I'}<br/>
                - Próxima Limpeza: ${proxLimp || 'Não calculada'}
                ${vencidoLimp ? `<br/><span style="color: #ff4d4d; font-weight: bold;">⚠️ AVISO: LIMPEZA DE AR EXPIRADA HÁ ${diasVencidoLimp} DIAS!</span>` : ''}
              </div>
            `;
          }).join('')}
        </div>

        <div class="section">
          <h3>Observações e Notas:</h3>
          <p><strong>Situação da Limpeza:</strong> ${precisaLimpeza ? 'Limpeza Necessária' : 'Área Limpa / OK'}</p>
          <p><strong>Incidentes Gerais:</strong> ${incidentesGerais || 'Nenhum incidente relatado'}</p>
          <p><strong>Anotações Extras:</strong> ${anotacoes || 'Nenhuma anotação'}</p>
        </div>
      </body>
      </html>
    `;

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

      const janelaPdf = window.open('', '_blank');
      if (janelaPdf) {
        janelaPdf.document.write(htmlConteudo);
        janelaPdf.document.close();
        janelaPdf.focus();
        setTimeout(() => janelaPdf.print(), 500);
      } else {
        alert("O navegador bloqueou a abertura da janela. Permita pop-ups para este site.");
      }

    } catch (error) {
      alert("Erro ao registrar o check-in: " + error.message);
    }
  };

  return (
    <div style={{ backgroundColor: '#121212', color: '#fff', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif', maxWidth: '750px', margin: '0 auto', boxSizing: 'border-box' }}>
      <button onClick={onBack} style={{ background: 'transparent', border: '1px solid #777', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', marginBottom: '20px' }}>← Voltar</button>
      
      <div style={{ background: '#1e1e1e', padding: '25px', borderRadius: '8px', border: '1px solid #333', boxSizing: 'border-box' }}>
        <h2 style={{ textTransform: 'uppercase', color: '#4dabf7', marginTop: 0 }}>Inspeção: {pop.nome}</h2>
        <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '20px' }}>{pop.endereco}</p>

        <p style={{ color: '#ccc', fontSize: '15px', fontWeight: 'bold', marginBottom: '15px' }}>{cargoLabel}: {nomeTecnico}</p>
        
        <div style={{ marginBottom: '20px', background: '#252525', padding: '12px', borderRadius: '6px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>Tipo de Data da Inspeção</label>
          <div style={{ display: 'flex', gap: '15px', marginBottom: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '13px' }}>
              <input type="radio" name="tipoData" checked={tipoData === 'atual'} onChange={() => setTipoData('atual')} /> Data Atual + GPS
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '13px' }}>
              <input type="radio" name="tipoData" checked={tipoData === 'manual'} onChange={() => setTipoData('manual')} /> Data Manual Salva
            </label>
          </div>

          {tipoData === 'manual' && (
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#aaa', marginBottom: '3px' }}>Informe a data que foi feita a inspeção</label>
              <input type="text" value={dataManualInspecao} onChange={(e) => setDataManualInspecao(e.target.value)} placeholder="ex: 20/08/2026" style={{ width: '100%', padding: '8px', background: '#1e1e1e', border: '1px solid #444', color: '#fff', boxSizing: 'border-box' }} />
            </div>
          )}
        </div>

        <h3>Status dos Ativos no POP</h3>
        {Object.keys(statusAtivos).map((ativo) => {
          const presente = ativosPresentes[ativo];
          return (
            <div key={ativo} style={{ background: '#252525', padding: '12px', borderRadius: '6px', marginBottom: '10px', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={presente} onChange={(e) => setAtivosPresentes({ ...ativosPresentes, [ativo]: e.target.checked })} />
                  {ativo}
                </label>
                {presente && (
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={() => setStatusAtivos({ ...statusAtivos, [ativo]: 'OK' })} style={{ background: statusAtivos[ativo] === 'OK' ? '#28a745' : '#444', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer' }}>OK</button>
                    <button onClick={() => setStatusAtivos({ ...statusAtivos, [ativo]: 'Incidente' })} style={{ background: statusAtivos[ativo] === 'Incidente' ? '#dc3545' : '#444', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer' }}>Incidente</button>
                  </div>
                )}
              </div>
              {presente && statusAtivos[ativo] === 'Incidente' && (
                <input type="text" placeholder={`Relatar incidente em ${ativo}`} value={detalhesIncidentes[ativo] || ''} onChange={(e) => setDetalhesIncidentes({ ...detalhesIncidentes, [ativo]: e.target.value })} style={{ width: '100%', marginTop: '8px', padding: '6px', background: '#1e1e1e', border: '1px solid #555', color: '#fff', boxSizing: 'border-box' }} />
              )}
            </div>
          );
        })}

        <button onClick={salvarStatusAtivosFirebase} style={{ width: '100%', padding: '10px', background: '#17a2b8', border: 'none', color: '#fff', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer', marginTop: '10px', marginBottom: '20px' }}>
          Salvar Status dos Ativos
        </button>

        <div style={{ marginTop: '20px' }}>
          <h3>Bancos de Baterias</h3>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
            {[1, 2, 3, 4].map((num) => (
              <button key={num} onClick={() => { setQtdBancos(num); salvarNoFirebase({ qtdBancos: num }); }} style={{ padding: '6px 12px', background: qtdBancos === num ? '#007bff' : '#333', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>{num}</button>
            ))}
          </div>
          {Array.from({ length: qtdBancos }, (_, i) => i + 1).map((banco) => {
            const bModel = bancosBateria[banco] || { dataFabricacao: '', voltagens: ['', '', '', ''], salvo: false };
            const proxSub = calcularProximaSubstituicaoBateria(bModel.dataFabricacao);
            const resSub = statusData(proxSub);
            const vencidoSub = resSub && resSub.status === 'vencido';

            return (
              <div key={banco} style={{ background: '#252525', padding: '12px', borderRadius: '6px', marginBottom: '15px', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ margin: 0 }}>Banco {getLetra(banco)}</h4>
                  <button onClick={() => {
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
                  }} style={{ background: bModel.salvo ? '#6c757d' : '#28a745', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                    {bModel.salvo ? 'Editar Banco' : 'Salvar Banco'}
                  </button>
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '3px' }}>Data de Fabricação (dd/MM/aaaa)</label>
                  <input type="text" disabled={bModel.salvo} placeholder="dd/MM/aaaa" value={bModel.dataFabricacao} onChange={(e) => {
                    const novoVal = e.target.value;
                    setBancosBateria({ ...bancosBateria, [banco]: { ...bModel, dataFabricacao: novoVal } });
                  }} style={{ width: '100%', padding: '6px', background: '#1e1e1e', border: '1px solid #444', color: '#fff', boxSizing: 'border-box' }} />
                </div>
                
                <p className={vencidoSub ? 'alerta-vencido' : ''} style={{ fontSize: '12px', color: vencidoSub ? undefined : '#4dabf7', margin: '0 0 8px 0' }}>
                  Próxima Substituição (+2 anos): {proxSub || 'Preencha a data'} {vencidoSub && `(Exp. há ${resSub.dias}d)`}
                </p>

                <div style={{ fontSize: '12px', color: '#ccc', marginBottom: '5px' }}>Voltagem das 4 Baterias do Banco:</div>
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
                      style={{ width: '100%', padding: '6px', background: '#1e1e1e', border: '1px solid #444', color: '#fff', boxSizing: 'border-box', textAlign: 'center' }} 
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: '20px' }}>
          <h3>Centrais de Ar</h3>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
            {[1, 2, 3, 4].map((num) => (
              <button key={num} onClick={() => { setQtdAr(num); salvarNoFirebase({ qtdAr: num }); }} style={{ padding: '6px 12px', background: qtdAr === num ? '#007bff' : '#333', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>{num}</button>
            ))}
          </div>
          {Array.from({ length: qtdAr }, (_, i) => i + 1).map((idx) => {
            const ar = centraisAr[idx] || { modelo: '', btu: '', dataInstalacao: '', dataUltimaLimpeza: '', salvo: false };
            const proxLimp = calcularProximaLimpezaAr(ar.dataUltimaLimpeza, intervaloAr);
            const resLimp = statusData(proxLimp);
            const vencidoLimp = resLimp && resLimp.status === 'vencido';

            return (
              <div key={idx} style={{ background: '#252525', padding: '12px', borderRadius: '6px', marginBottom: '10px', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4>Central {getLetra(idx)}</h4>
                  <button onClick={() => {
                    const novoSalvo = !ar.salvo;
                    setCentraisAr({ ...centraisAr, [idx]: { ...ar, salvo: novoSalvo } });
                    salvarNoFirebase({ 
                      [`ar_${idx}_mod`]: ar.modelo, 
                      [`ar_${idx}_btu`]: ar.btu, 
                      [`ar_${idx}_inst`]: ar.dataInstalacao, 
                      [`ar_${idx}_limp`]: ar.dataUltimaLimpeza, 
                      [`ar_${idx}_salvo`]: novoSalvo 
                    });
                  }} style={{ background: ar.salvo ? '#6c757d' : '#28a745', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                    {ar.salvo ? 'Editar Central' : 'Salvar Central'}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', marginTop: '8px', boxSizing: 'border-box' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '11px', color: '#aaa', marginBottom: '2px' }}>Modelo</label>
                    <input type="text" disabled={ar.salvo} placeholder="Modelo" value={ar.modelo} onChange={(e) => setCentraisAr({ ...centraisAr, [idx]: { ...ar, modelo: e.target.value } })} style={{ width: '100%', padding: '6px', background: '#1e1e1e', border: '1px solid #444', color: '#fff', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '11px', color: '#aaa', marginBottom: '2px' }}>BTU</label>
                    <input type="text" disabled={ar.salvo} placeholder="BTU" value={ar.btu} onChange={(e) => setCentraisAr({ ...centraisAr, [idx]: { ...ar, btu: e.target.value } })} style={{ width: '100%', padding: '6px', background: '#1e1e1e', border: '1px solid #444', color: '#fff', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#aaa', marginBottom: '2px' }}>Data de Instalação (dd/MM/aaaa)</label>
                  <input type="text" disabled={ar.salvo} placeholder="dd/MM/aaaa" value={ar.dataInstalacao} onChange={(e) => setCentraisAr({ ...centraisAr, [idx]: { ...ar, dataInstalacao: e.target.value } })} style={{ width: '100%', padding: '6px', background: '#1e1e1e', border: '1px solid #444', color: '#fff', boxSizing: 'border-box' }} />
                </div>
                <div style={{ marginBottom: '4px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#aaa', marginBottom: '2px' }}>Data da Última Limpeza (dd/MM/aaaa)</label>
                  <input type="text" disabled={ar.salvo} placeholder="dd/MM/aaaa" value={ar.dataUltimaLimpeza} onChange={(e) => setCentraisAr({ ...centraisAr, [idx]: { ...ar, dataUltimaLimpeza: e.target.value } })} style={{ width: '100%', padding: '6px', background: '#1e1e1e', border: '1px solid #444', color: '#fff', boxSizing: 'border-box' }} />
                </div>
                <p className={vencidoLimp ? 'alerta-vencido' : ''} style={{ fontSize: '12px', color: vencidoLimp ? undefined : '#4dabf7', margin: '6px 0 8px 0' }}>
                  Próxima Limpeza ({intervaloAr} meses): {proxLimp || 'Preencha a última limpeza'} {vencidoLimp && `(Exp. há ${resLimp.dias}d)`}
                </p>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: '20px' }}>
          <input type="text" placeholder="Relatar Incidentes Gerais" value={incidentesGerais} onChange={(e) => setIncidentesGerais(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '15px', background: '#2d2d2d', border: '1px solid #444', color: '#fff', boxSizing: 'border-box' }} />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
            <input type="checkbox" checked={precisaLimpeza} onChange={(e) => setPrecisaLimpeza(e.target.checked)} id="limpCheck" />
            <label htmlFor="limpCheck">Limpeza Necessária</label>
          </div>

          <textarea placeholder="Anotações Extras" rows="3" value={anotacoes} onChange={(e) => setAnotacoes(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '20px', background: '#2d2d2d', border: '1px solid #444', color: '#fff', boxSizing: 'border-box' }} />

          <button onClick={gerarEBaixarPdf} style={{ width: '100%', padding: '14px', background: '#28a745', border: 'none', color: '#fff', fontWeight: 'bold', fontSize: '16px', borderRadius: '4px', cursor: 'pointer' }}>
            Gerar, Abrir e Salvar Relatório PDF
          </button>
        </div>
      </div>
    </div>
  );
}