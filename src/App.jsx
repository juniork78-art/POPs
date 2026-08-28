import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword
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
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    overflow-x: hidden !important;
  }
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
  @media (max-width: 600px) {
    .container-movel {
      padding: 6px !important;
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
    }
    .card-movel {
      padding: 8px !important;
      border-radius: 4px !important;
      width: 100% !important;
      box-sizing: border-box !important;
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

const parseDataFabricacaoBateria = (fabStr) => {
  if (!fabStr) return { dataObj: null, textoExato: '' };
  const limpo = fabStr.trim();
  
  if (/^\d{1,2}\/\d{2}$/.test(limpo)) {
    const [semanaStr, anoStr] = limpo.split('/');
    const semana = parseInt(semanaStr, 10);
    const ano = 2000 + parseInt(anoStr, 10);
    
    if (semana >= 1 && semana <= 53) {
      const d = new Date(ano, 0, 1 + (semana - 1) * 7);
      const mesesNomes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
      const textoExato = `${semana}ª semana de ${ano} (~${d.getDate()} de ${mesesNomes[d.getMonth()]})`;
      return { dataObj: d, textoExato };
    }
  }
  
  const parts = limpo.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      return { dataObj: d, textoExato: limpo };
    }
  }

  return { dataObj: null, textoExato: limpo };
};

const calcularProximaSubstituicaoBateria = (dataFabricacaoStr, popNome = '', tipoBateria = 'Chumbo') => {
  try {
    const { dataObj } = parseDataFabricacaoBateria(dataFabricacaoStr);
    if (dataObj) {
      let anosAdicionais = (tipoBateria && tipoBateria.toLowerCase() === 'lítio') ? 8 : 2;
      const year = dataObj.getFullYear() + anosAdicionais;
      const month = dataObj.getMonth();
      const day = dataObj.getDate();
      const date = new Date(year, month, day);
      return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
    }
    return '';
  } catch (e) { return ''; }
};

const calcularProximaInspecaoGeral = (dataUltimaInspecaoStr) => {
  try {
    const parts = (dataUltimaInspecaoStr || '').split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1 + 3;
      const year = parseInt(parts[2], 10) + Math.floor(month / 12);
      const adjustedMonth = month % 12;
      const date = new Date(year, adjustedMonth, day);
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
  { id: 1, nome: "poseidon", endereco: "Folha 16 Quadra 29 Lote 61, Nova Marabá - mba" },
  { id: 2, nome: "hermes", endereco: "br-222, 57 - São Félix (Casa San João) - mba" },
  { id: 3, nome: "eros", endereco: "av. Itacaiúnas, 1878 - Cidade Nova (CDMA)- mba" },
  { id: 4, nome: "hades", endereco: "fl 27 q. Especial, s/n - Nova Marabá - (disbrava) - mba" },
  { id: 5, nome: "noto", endereco: "br-230, km 9 - (Total Ville) - mba" },
  { id: 6, nome: "afrodite", endereco: "av. Tocantins, 150, Morada Nova (Nutrisolo) - mba" },
  { id: 7, nome: "hemera", endereco: "av. Boa Esperança, qd 27, lt 03 e 05 - Liberdade (Guinhazi) - mba" },
  { id: 8, nome: "apolo", endereco: "fl 31, qd 33, lt 02 (Predio CETIC) - mba" },
  { id: 9, nome: "cratos", endereco: "Distribuidora nossa água, km 8 (Nossa água) - mba" },
  { id: 10, nome: "helius", endereco: "Rua das castanheiras, 123 - Belo Horizonte (Solar das Castanheiras) - mba" },
  { id: 11, nome: "limos", endereco: "Travessa João Passondas de Carvalho - Velha Marabá - POP fica no segundo andar kitnet proxima a varanda que tem vista para rua - mba" },
  { id: 12, nome: "geb", endereco: "Cidade Jardim - pbs" },
  { id: 13, nome: "anubis", endereco: "Lote 37 QD 101, Rodovia, PA-275, Parauapebas - PA, 68515-000 - pbs" },
  { id: 14, nome: "osiris", endereco: "Rua praça da bíblia, grupo correio - Morro dos Ventos - pbs" },
  { id: 15, nome: "set", endereco: "Rua m, n 224 - União - Escritório - pbs" },
  { id: 16, nome: "amaterasu", endereco: "av. 31 de março, 220, Centro / Escritório - itg" },
  { id: 17, nome: "balder", endereco: "R. Dr. Pedro Paulo Barcaúí • Vila Paulista, 68552-700 - Em frente a MEDTRAFEGO - rdc" },
  { id: 18, nome: "telesto", endereco: "Tv. Brasispampa, 272 - Centro, 68520-000, São Domingos do Araguaia-PA - sda" },
  { id: 19, nome: "tupi", endereco: "Rua Guajajaras, 55 - Centro - Escritório - xga" },
  { id: 20, nome: "terra", endereco: "Próprio R. JK, 111 - Centro, Canaã dos Carajás - PA, 68537-860 - cna" },
  { id: 21, nome: "marduk", endereco: "Av. Conselheiro Furtado, 2865 - Edifício Sintese 21, Sala 701 - Belém - bel" },
  { id: 22, nome: "ceuci", endereco: "Av. Dez, 898 - Centro, Rio Maria - PA, 68530-000 - rma" },
  { id: 23, nome: "fanes", endereco: "Distrito industrial - mba" },
  { id: 24, nome: "demeter", endereco: "Avenida Castelo Branco - Centro, 68573-003, São Geraldo do Araguaia - sga" },
  { id: 25, nome: "neftis", endereco: "Avenida Inglaterra 333, Novo Horizonte - Parauapebas - PA, 68515-000 - Galeria - pbs" },
  { id: 26, nome: "bastet", endereco: "Apartamento - Rio Verde - pbs" },
  { id: 27, nome: "hathor", endereco: "vs10 - pbs" },
  { id: 28, nome: "sobek", endereco: "Rio Verde - pbs" }
];

function App() {
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [listaPops, setListaPops] = useState(popsIniciaisPadrao);
  const [ultimosCheckIns, setUltimosCheckIns] = useState([]);
  const [cronogramaLimpezas, setCronogramaLimpezas] = useState([]);
  const [cronogramaBaterias, setCronogramaBaterias] = useState([]);
  const [cronogramaContatos, setCronogramaContatos] = useState([]);
  const [cronogramaChaves, setCronogramaChaves] = useState([]);
  const [dadosGeraisPops, setDadosGeraisPops] = useState({});
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [drawerAberto, setDrawerAberto] = useState(false);
  const [abaDrawer, setAbaDrawer] = useState('checkins');
  const [showAvisoGlobal, setShowAvisoGlobal] = useState(false);
  const [dadosCarregados, setDadosCarregados] = useState(false);

  const [modalFiltroRelatorioAberto, setModalFiltroRelatorioAberto] = useState(false);
  const [cidadesSelecionadasParaRelatorio, setCidadesSelecionadasParaRelatorio] = useState({});
  const [filtrosIncidentes, setFiltrosIncidentes] = useState({
    inspecaoGeral: true,
    incidentesGerais: true,
    baterias: true,
    centraisAr: true,
    contatos: true,
    chaves: true
  });

  const [darkMode, setDarkMode] = useState(() => {
    try {
      const salvo = localStorage.getItem('darkMode_pops');
      if (salvo !== null) return JSON.parse(salvo);
    } catch (e) {}
    return true;
  });

  const [popSelecionado, setPopSelecionado] = useState(() => {
    try {
      const salvo = sessionStorage.getItem('estado_popSelecionado');
      return salvo ? JSON.parse(salvo) : null;
    } catch (e) { return null; }
  });

  const [telaGerenciarPopsAberta, setTelaGerenciarPopsAberta] = useState(() => {
    return sessionStorage.getItem('estado_telaGerenciarPops') === 'true';
  });

  useEffect(() => {
    if (popSelecionado) sessionStorage.setItem('estado_popSelecionado', JSON.stringify(popSelecionado));
    else sessionStorage.removeItem('estado_popSelecionado');
  }, [popSelecionado]);

  useEffect(() => {
    if (telaGerenciarPopsAberta) sessionStorage.setItem('estado_telaGerenciarPops', 'true');
    else sessionStorage.removeItem('estado_telaGerenciarPops');
  }, [telaGerenciarPopsAberta]);

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
    textMuted: darkMode ? '#bbb' : '#444444',
    border: darkMode ? '#333' : '#d0d7de',
    inputBg: darkMode ? '#2d2d2d' : '#ffffff',
    inputText: darkMode ? '#fff' : '#212529'
  };

  const obterSiglaPop = (nomePop) => {
    if (!nomePop) return '';
    const popObj = listaPops.find(p => p.nome.toLowerCase() === nomePop.toLowerCase() || (nomePop.toLowerCase() === 'odin' && p.nome.toLowerCase() === 'balder') || (nomePop.toLowerCase() === 'odim' && p.nome.toLowerCase() === 'balder'));
    if (popObj && popObj.endereco) {
      const partes = popObj.endereco.split('-');
      const ultimaParte = partes[partes.length - 1].trim();
      if (ultimaParte.length <= 5) {
        return ultimaParte.toUpperCase();
      }
    }
    const popPadrao = popsIniciaisPadrao.find(p => p.nome.toLowerCase() === nomePop.toLowerCase() || (nomePop.toLowerCase() === 'odin' && p.nome.toLowerCase() === 'balder') || (nomePop.toLowerCase() === 'odim' && p.nome.toLowerCase() === 'balder'));
    if (popPadrao && popPadrao.endereco) {
      const partes = popPadrao.endereco.split('-');
      const ultimaParte = partes[partes.length - 1].trim();
      if (ultimaParte.length <= 5) {
        return ultimaParte.toUpperCase();
      }
    }
    return '';
  };

  const popPertenceAoUsuario = (nomePop) => {
    if (!usuarioLogado) return true;
    const isPedro = usuarioLogado.toLowerCase().includes('pedro');
    if (!isPedro) return true;
    const popObj = listaPops.find(p => p.nome.toLowerCase() === nomePop.toLowerCase() || (nomePop.toLowerCase() === 'odin' && p.nome.toLowerCase() === 'balder') || (nomePop.toLowerCase() === 'odim' && p.nome.toLowerCase() === 'balder'));
    if (popObj) return popObj.endereco.toLowerCase().endsWith('- pbs');
    return false;
  };

  const obterListaTodasCidades = () => {
    const cidadesSet = new Set();
    listaPops.forEach(pop => {
      if (!popPertenceAoUsuario(pop.nome)) return;
      const sigla = obterSiglaPop(pop.nome) || 'GERAL';
      cidadesSet.add(sigla);
    });
    return Array.from(cidadesSet).sort();
  };

  const abrirModalFiltroRelatorio = () => {
    const cidades = obterListaTodasCidades();
    const mapInicial = {};
    cidades.forEach(c => {
      mapInicial[c] = true;
    });
    setCidadesSelecionadasParaRelatorio(mapInicial);
    setFiltrosIncidentes({
      inspecaoGeral: true,
      incidentesGerais: true,
      baterias: true,
      centraisAr: true,
      contatos: true,
      chaves: true
    });
    setModalFiltroRelatorioAberto(true);
  };

  const verificarAlertasGlobaisDetalhados = () => {
    let vencidos = [];
    let amanha = [];
    const processarItem = (nomePop, baseMsg, dataStr) => {
      const res = statusData(dataStr);
      if (nomePop && res && popPertenceAoUsuario(nomePop)) {
        const nomeReal = (nomePop.toLowerCase() === 'odin' || nomePop.toLowerCase() === 'odim') ? 'balder' : nomePop;
        const sigla = obterSiglaPop(nomeReal);
        const nomeFormatado = sigla ? `${realizarNomeExibicao(nomeReal)} - ${sigla}` : realizarNomeExibicao(nomeReal);
        const msgFinal = baseMsg.replace(`POP: ${nomePop.toUpperCase()}`, `POP: ${nomeFormatado}`);

        if (res.status === 'vencido') {
          vencidos.push(`${msgFinal} (Expirado há ${res.dias} dias)`);
        } else if (res.status === 'amanha' || res.status === 'hoje') {
          amanha.push(`${msgFinal} (${res.status === 'hoje' ? 'Vence hoje' : 'Vence amanhã'})`);
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
    if (cronogramaContatos) {
      cronogramaContatos.forEach(c => processarItem(c.popNome, `POP: ${c.popNome.toUpperCase()} - Inspeção de contato (${c.nomeResponsavel} - ${c.funcao}) expirada`, c.proximaInspecao));
    }
    if (cronogramaChaves) {
      cronogramaChaves.forEach(ch => processarItem(ch.popNome, `POP: ${ch.popNome.toUpperCase()} - Inspeção de chave expirada`, ch.proximaInspecao));
    }
    return { vencidos, amanha };
  };

  const realizarNomeExibicao = (nome) => {
    if (!nome) return '';
    const n = nome.toLowerCase();
    if (n === 'odin' || n === 'odim') return 'BALDER';
    return n.toUpperCase();
  };

  const gerarRelatorioGeralIncidentesPDF = () => {
    setModalFiltroRelatorioAberto(false);
    const janelaPdf = window.open('', '_blank');
    if (!janelaPdf) return;

    const dadosPorCidade = {};

    listaPops.forEach(pop => {
      if (!popPertenceAoUsuario(pop.nome)) return;
      const sigla = obterSiglaPop(pop.nome) || 'GERAL';
      
      if (!cidadesSelecionadasParaRelatorio[sigla]) return;

      const dadosPop = dadosGeraisPops[pop.nome] || {};
      const checkInPop = ultimosCheckIns.find(c => {
        let n = (c.popNome || c.pop || '').toLowerCase();
        if (n === 'odin' || n === 'odim') n = 'balder';
        return n === pop.nome.toLowerCase();
      });

      let temAlgoVencido = false;

      if (filtrosIncidentes.inspecaoGeral) {
        const proxInspGeral = checkInPop ? checkInPop.proximaInspecao : null;
        const statusInsp = statusData(proxInspGeral);
        if (statusInsp && statusInsp.status === 'vencido') {
          temAlgoVencido = true;
        }
      }

      if (filtrosIncidentes.incidentesGerais) {
        if (dadosPop.incidentesGerais && dadosPop.incidentesGerais.trim() !== '') {
          temAlgoVencido = true;
        }
      }

      if (filtrosIncidentes.baterias) {
        const qtdB = dadosPop.qtdBancos || 1;
        for (let b = 1; b <= qtdB; b++) {
          const fab = dadosPop[`bat_${b}_fab`];
          const tipoB = dadosPop[`bat_${b}_tipo`] || 'Chumbo';
          const proxSub = calcularProximaSubstituicaoBateria(fab, pop.nome, tipoB);
          const resSub = statusData(proxSub);
          if (resSub && resSub.status === 'vencido') {
            temAlgoVencido = true;
          }
        }
      }

      if (filtrosIncidentes.centraisAr) {
        const qtdA = dadosPop.qtdAr || 1;
        const nomeLower = pop.nome.toLowerCase();
        const interAr = (nomeLower === 'helius' || nomeLower === 'limos' || nomeLower === 'fanes') ? 5 : 8;
        for (let a = 1; a <= qtdA; a++) {
          const limp = dadosPop[`ar_${a}_limp`];
          const proxLimp = calcularProximaLimpezaAr(limp, interAr);
          const resLimp = statusData(proxLimp);
          if (resLimp && resLimp.status === 'vencido') {
            temAlgoVencido = true;
          }
        }
      }

      if (filtrosIncidentes.contatos) {
        const listaContatos = dadosPop.listaContatos || [];
        listaContatos.forEach(contato => {
          const proxInspContato = calcularProximaInspecaoGeral(contato.ultimaInsp);
          const resContato = statusData(proxInspContato);
          if (resContato && resContato.status === 'vencido') {
            temAlgoVencido = true;
          }
        });
      }

      if (filtrosIncidentes.chaves) {
        const proxInspChave = calcularProximaInspecaoGeral(dadosPop.chave_ultima_insp);
        const resChave = statusData(proxInspChave);
        if (resChave && resChave.status === 'vencido') {
          temAlgoVencido = true;
        }
      }

      if (!temAlgoVencido) return;

      if (!dadosPorCidade[sigla]) {
        dadosPorCidade[sigla] = [];
      }

      dadosPorCidade[sigla].push({
        nome: pop.nome,
        endereco: pop.endereco,
        checkIn: checkInPop || null,
        dados: dadosPop
      });
    });

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Relatório de Itens Vencidos</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 25px; color: #000; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #d9534f; padding-bottom: 12px; margin-bottom: 20px; }
          .header-left { display: flex; align-items: center; gap: 15px; }
          h1 { color: #d9534f; margin: 0; font-size: 20px; text-transform: uppercase; }
          h2 { color: #333; font-size: 16px; margin-top: 25px; border-bottom: 2px solid #007bff; padding-bottom: 4px; text-transform: uppercase; background: #eef2f5; padding-left: 8px; }
          h3 { color: #0056b3; font-size: 14px; margin: 12px 0 4px 0; text-transform: uppercase; }
          p { margin: 4px 0; font-size: 12px; }
          .negrito { font-weight: bold; }
          .vermelho { color: #d9534f; font-weight: bold; }
          .bloco-pop { background: #fdfdfd; border: 1px solid #ddd; padding: 10px 14px; margin-bottom: 10px; border-radius: 4px; border-left: 4px solid #d9534f; }
          .incidente-item { background: #fff5f5; border-left: 3px solid #d9534f; padding: 6px 10px; margin: 4px 0; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <img src="/logo.png" alt="Logo Fibralink" style="width: 110px; object-fit: contain;" />
            <h1>Relatório de Itens Vencidos e Alertas</h1>
          </div>
          <div>
            <p><strong>Emitido por:</strong> ${usuarioLogado ? usuarioLogado.split('@')[0].toUpperCase() : 'Sistema'}</p>
            <p><strong>Data:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
        </div>
    `;

    const regioes = Object.keys(dadosPorCidade).sort();
    if (regioes.length === 0) {
      html += `<p style="text-align: center; font-size: 14px; color: #28a745; margin-top: 40px; font-weight: bold;">Nenhum POP com os itens selecionados está vencido no momento! 👍</p>`;
    } else {
      regioes.forEach(sigla => {
        html += `<h2>Região / Cidade: ${sigla}</h2>`;

        dadosPorCidade[sigla].forEach(item => {
          const { nome, endereco, checkIn, dados } = item;

          html += `
            <div class="bloco-pop">
              <h3>POP: ${nome.toUpperCase()}</h3>
              <p><span class="negrito">Endereço:</span> ${endereco}</p>
          `;

          if (filtrosIncidentes.inspecaoGeral) {
            const proxInspGeral = checkIn ? checkIn.proximaInspecao : null;
            const statusInsp = statusData(proxInspGeral);
            if (statusInsp && statusInsp.status === 'vencido') {
              html += `<p><span class="negrito">Última Inspeção Geral:</span> ${checkIn.dataHora} | <span class="vermelho">Próxima Inspeção: ${checkIn.proximaInspecao} (VENCIDO há ${statusInsp.dias} dias)</span></p>`;
            }
          }

          if (filtrosIncidentes.incidentesGerais) {
            if (dados.incidentesGerais && dados.incidentesGerais.trim() !== '') {
              html += `<p class="vermelho" style="margin-top:6px;">⚠️ Incidentes Registrados:</p>`;
              html += `<div class="incidente-item">${dados.incidentesGerais}</div>`;
            }
          }

          if (filtrosIncidentes.baterias) {
            const qtdB = dados.qtdBancos || 1;
            let bateriasVencidasHtml = '';
            let qtdBateriasVencidas = 0;
            for (let b = 1; b <= qtdB; b++) {
              const fab = dados[`bat_${b}_fab`];
              const tipoB = dados[`bat_${b}_tipo`] || 'Chumbo';
              const proxSub = calcularProximaSubstituicaoBateria(fab, nome, tipoB);
              const resSub = statusData(proxSub);
              if (resSub && resSub.status === 'vencido') {
                qtdBateriasVencidas++;
                const { textoExato } = parseDataFabricacaoBateria(fab);
                const fabExibicao = textoExato ? `${fab} (${textoExato})` : (fab || 'N/A');
                bateriasVencidasHtml += `<br>  • Banco ${getLetra(b)} (${tipoB}) - Fab: ${fabExibicao} | Próx. Troca: <span style="color: #d9534f; font-weight: bold;">${proxSub} (VENCIDO há ${resSub.dias}d)</span>`;
              }
            }
            if (qtdBateriasVencidas > 0) {
              html += `<p style="margin-top: 6px;"><span class="negrito">Bancos de Baterias Vencidos (${qtdBateriasVencidas}):</span>${bateriasVencidasHtml}</p>`;
            }
          }

          if (filtrosIncidentes.centraisAr) {
            const qtdA = dados.qtdAr || 1;
            const nomeLower = nome.toLowerCase();
            const interAr = (nomeLower === 'helius' || nomeLower === 'limos' || nomeLower === 'fanes') ? 5 : 8;
            let aresVencidosHtml = '';
            let qtdAresVencidos = 0;
            for (let a = 1; a <= qtdA; a++) {
              const limp = dados[`ar_${a}_limp`];
              const proxLimp = calcularProximaLimpezaAr(limp, interAr);
              const resLimp = statusData(proxLimp);
              if (resLimp && resLimp.status === 'vencido') {
                qtdAresVencidos++;
                aresVencidosHtml += `<br>  • Central ${getLetra(a)} (${dados[`ar_${a}_mod`] || 'Elgin'}) - Última Limpeza: ${limp || 'N/A'} | Próx. Limpeza: <span style="color: #d9534f; font-weight: bold;">${proxLimp} (VENCIDO há ${resLimp.dias}d)</span>`;
              }
            }
            if (qtdAresVencidos > 0) {
              html += `<p style="margin-top: 4px;"><span class="negrito">Centrais de Ar Vencidas (${qtdAresVencidos}):</span>${aresVencidosHtml}</p>`;
            }
          }

          if (filtrosIncidentes.contatos) {
            const listaContatos = dados.listaContatos || [];
            listaContatos.forEach(contato => {
              const proxInspContato = calcularProximaInspecaoGeral(contato.ultimaInsp);
              const resContato = statusData(proxInspContato);
              if (resContato && resContato.status === 'vencido') {
                html += `<p style="margin-top: 4px;"><span class="negrito">Contato (${contato.nome || 'N/A'} - ${contato.funcao || 'N/A'}):</span> Próx. Insp: <span class="vermelho">${proxInspContato} (VENCIDO há ${resContato.dias}d)</span></p>`;
              }
            });
          }

          if (filtrosIncidentes.chaves) {
            const proxInspChave = calcularProximaInspecaoGeral(dados.chave_ultima_insp);
            const resChave = statusData(proxInspChave);
            if (resChave && resChave.status === 'vencido') {
              html += `<p style="margin-top: 4px;"><span class="negrito">Chave do POP:</span> Próx. Insp: <span class="vermelho">${proxInspChave} (VENCIDO há ${resChave.dias}d)</span></p>`;
            }
          }

          if (dados.anotacoes) {
            html += `<p style="margin-top: 4px;"><span class="negrito">Anotações:</span> ${dados.anotacoes}</p>`;
          }

          html += `</div>`;
        });
      });
    }

    html += `</body></html>`;
    janelaPdf.document.write(html);
    janelaPdf.document.close();
    janelaPdf.focus();
    setTimeout(() => {
      janelaPdf.print();
    }, 600);
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
  }, [usuarioLogado, dadosCarregados, ultimosCheckIns, cronogramaLimpezas, cronogramaBaterias, cronogramaContatos, cronogramaChaves]);

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

      const unsubCheckins = onSnapshot(doc(db, "historico_global", "checkins"), async (snap) => {
        if (snap.exists() && snap.data().lista) {
          let listaOriginal = snap.data().lista;
          let precisaAtualizar = false;

          const listaAtualizada = listaOriginal.map(item => {
            let nomePop = item.popNome || item.pop || item.nomePop || item.nome_pop || item.nome || '';
            if (nomePop.toLowerCase() === 'odin' || nomePop.toLowerCase() === 'odim') {
              precisaAtualizar = true;
              return {
                ...item,
                pop: 'balder',
                popName: 'balder',
                popNome: 'balder'
              };
            }
            return item;
          });

          setUltimosCheckIns(listaAtualizada);

          if (precisaAtualizar) {
            await setDoc(doc(db, "historico_global", "checkins"), { lista: listaAtualizada });
          }
        }
      });

      const unsubPopsDados = onSnapshot(collection(db, "pops_dados"), async (snapshot) => {
        const listaLimpezasTemp = [];
        const listaBateriasTemp = [];
        const listaContatosTemp = [];
        const listaChavesTemp = [];
        const dadosGeraisTemp = {};

        snapshot.forEach(async (d) => {
          let popNome = d.id;
          if (popNome.toLowerCase() === 'odin' || popNome.toLowerCase() === 'odim') popNome = 'balder';
          const data = d.data();

          if (popNome.toLowerCase() === 'balder' && data.bat_1_fab === '21/23') {
            try {
              await setDoc(doc(db, "pops_dados", "balder"), { bat_1_fab: "" }, { merge: true });
              data.bat_1_fab = "";
            } catch (err) {}
          }

          dadosGeraisTemp[popNome.toLowerCase()] = data;

          const listaContatos = data.listaContatos || [];
          listaContatos.forEach(contato => {
            listaContatosTemp.push({
              popNome,
              nomeResponsavel: contato.nome || 'N/A',
              funcao: contato.funcao || 'N/A',
              telefone: contato.telefone || 'N/A',
              ultimaInspecao: contato.ultimaInsp || '',
              proximaInspecao: calcularProximaInspecaoGeral(contato.ultimaInsp)
            });
          });

          if (data.chave_ultima_insp) {
            listaChavesTemp.push({
              popNome,
              ultimaInspecao: data.chave_ultima_insp,
              proximaInspecao: calcularProximaInspecaoGeral(data.chave_ultima_insp)
            });
          }

          const qtdAr = data.qtdAr || 4;
          const nomeLower = popNome.toLowerCase();
          const intervaloAr = (nomeLower === 'helius' || nomeLower === 'limos' || nomeLower === 'fanes') ? 5 : 8;
          for (let i = 1; i <= qtdAr; i++) {
            const ultimaLimp = data[`ar_${i}_limp`] || '';
            if (ultimaLimp) {
              listaLimpezasTemp.push({ popNome, central: `Central ${getLetra(i)}`, ultimaLimpeza: ultimaLimp, proximaLimpeza: calcularProximaLimpezaAr(ultimaLimp, intervaloAr) });
            }
          }
          const qtdBancos = data.qtdBancos || 4;
          for (let i = 1; i <= qtdBancos; i++) {
            const fab = data[`bat_${i}_fab`] || '';
            const tipoBat = data[`bat_${i}_tipo`] || 'Chumbo';
            const ultimaInsp = data[`bat_${i}_insp`] || '';
            if (fab) {
              listaBateriasTemp.push({ 
                popNome, 
                banco: `Banco ${getLetra(i)}`, 
                fabricacao: fab, 
                proximaSubstituicao: calcularProximaSubstituicaoBateria(fab, popNome, tipoBat),
                ultimaInspecao: ultimaInsp,
                proximaInspecao: calcularProximaInspecaoGeral(ultimaInsp)
              });
            }
          }
        });
        setCronogramaLimpezas(listaLimpezasTemp);
        setCronogramaBaterias(listaBateriasTemp);
        setCronogramaContatos(listaContatosTemp);
        setCronogramaChaves(listaChavesTemp);
        setDadosGeraisPops(dadosGeraisTemp);
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
      let nomeDoPop = (item.popNome || item.pop || item.nomePop || item.nome_pop || item.nome || '').toLowerCase().trim();
      if (nomeDoPop === 'odin' || nomeDoPop === 'odim') nomeDoPop = 'balder';
      if (nomeDoPop && !vistos.has(nomeDoPop)) {
        vistos.add(nomeDoPop);
        novaLista.push({ ...item, pop: nomeDoPop, popName: nomeDoPop, popNome: nomeDoPop });
      }
    }
    setUltimosCheckIns(novaLista);
    await setDoc(doc(db, "historico_global", "checkins"), { lista: novaLista });
  };

  const apagarCheckInIndividual = async (idxOriginal) => {
    const senhaDigitada = window.prompt('Digite a senha para confirmar a exclusão deste check-in:');
    if (senhaDigitada !== "%001mNbBa*+!") {
      if (senhaDigitada !== null) alert('Senha incorreta! Ação cancelada.');
      return;
    }
    const novaLista = ultimosCheckIns.filter((_, idx) => idx !== idxOriginal);
    setUltimosCheckIns(novaLista);
    try {
      await setDoc(doc(db, "historico_global", "checkins"), { lista: novaLista });
      alert('Check-in removido com sucesso!');
    } catch (e) {
      alert('Erro ao apagar check-in: ' + e.message);
    }
  };

  if (loadingAuth) return <div style={{ color: theme.textMain, backgroundColor: theme.bg, textAlign: 'center', marginTop: '20vh', fontFamily: 'sans-serif', minHeight: '100vh', fontSize: '15px' }}>Carregando InfraManager...</div>;
  if (!usuarioLogado) return <TelaLogin onLoginSucesso={(email) => setUsuarioLogado(email)} darkMode={darkMode} setDarkMode={alternarTema} theme={theme} />;
  if (telaGerenciarPopsAberta) return <TelaGerenciarPops listaPops={listaPops} onBack={() => { setTelaGerenciarPopsAberta(false); window.history.back(); }} theme={theme} />;
  if (popSelecionado) {
    return (
      <TelaInspecao 
        pop={popSelecionado} 
        tecnico={usuarioLogado} 
        ultimosCheckIns={ultimosCheckIns}
        listaPops={listaPops}
        onSelectPop={(novoPop) => setPopSelecionado(novoPop)}
        onBack={() => { setPopSelecionado(null); window.history.back(); }} 
        onCheckInRealizado={async (novoRegistro, forcarCheckin) => {
          let nomeNormalizado = (novoRegistro.popName || '').toLowerCase();
          if (nomeNormalizado === 'odin' || nomeNormalizado === 'odim') nomeNormalizado = 'balder';
          
          const registroCorrigido = {
            ...novoRegistro,
            pop: nomeNormalizado,
            popName: nomeNormalizado,
            popNome: nomeNormalizado
          };

          let novaLista = [...ultimosCheckIns];
          if (forcarCheckin) novaLista = [registroCorrigido, ...ultimosCheckIns];
          else {
            const idx = novaLista.findIndex(item => {
              let pName = (item.popNome || item.pop || '').toLowerCase();
              if (pName === 'odin' || pName === 'odim') pName = 'balder';
              return pName === nomeNormalizado && item.dataHora === registroCorrigido.dataHora;
            });
            if (idx === -1) novaLista = [registroCorrigido, ...ultimosCheckIns];
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
    <div style={{ backgroundColor: theme.bg, color: theme.textMain, minHeight: '100vh', width: '100%', margin: 0, padding: 0, boxSizing: 'border-box' }}>
      <TelaListaPops 
        tecnico={usuarioLogado} 
        listaPops={listaPops} 
        ultimosCheckIns={ultimosCheckIns}
        cronogramaLimpezas={cronogramaLimpezas}
        cronogramaBaterias={cronogramaBaterias}
        cronogramaContatos={cronogramaContatos}
        cronogramaChaves={cronogramaChaves}
        onPopClick={(pop) => setPopSelecionado(pop)} 
        onOpenDrawer={() => setDrawerAberto(true)}
        onOpenGerenciarPops={() => setTelaGerenciarPopsAberta(true)}
        onOpenAvisos={() => setShowAvisoGlobal(true)}
        onGerarRelatorioGeral={abrirModalFiltroRelatorio}
        totalAlertas={totalAlertas}
        onLogout={() => { 
          sessionStorage.removeItem('avisoMostrado'); 
          sessionStorage.removeItem('estado_popSelecionado');
          sessionStorage.removeItem('estado_telaGerenciarPops');
          signOut(auth); 
          setUsuarioLogado(null); 
        }} 
        darkMode={darkMode}
        setDarkMode={alternarTema}
        theme={theme}
      />

      {modalFiltroRelatorioAberto && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 1150, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '15px', boxSizing: 'border-box' }}>
          <div style={{ background: theme.cardBg, color: theme.textMain, padding: '20px', borderRadius: '10px', width: '100%', maxWidth: '450px', maxHeight: '95vh', border: `1px solid ${theme.border}`, boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginTop: 0, fontSize: '17px', color: '#4dabf7', textAlign: 'center', marginBottom: '15px' }}>Filtro de Relatório</h3>
            
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '5px' }}>
                <h4 style={{ fontSize: '14px', margin: '0 0 8px 0', color: theme.textMain }}>O que incluir no relatório?</h4>
                <div style={{ background: theme.cardInner, padding: '10px', borderRadius: '6px', border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={filtrosIncidentes.inspecaoGeral} onChange={() => setFiltrosIncidentes(p => ({...p, inspecaoGeral: !p.inspecaoGeral}))} /> 
                        Check-ins (Inspeção Geral) Vencidos
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={filtrosIncidentes.incidentesGerais} onChange={() => setFiltrosIncidentes(p => ({...p, incidentesGerais: !p.incidentesGerais}))} /> 
                        Incidentes Relatados Manualmente
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={filtrosIncidentes.baterias} onChange={() => setFiltrosIncidentes(p => ({...p, baterias: !p.baterias}))} /> 
                        Bancos de Baterias Vencidos
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={filtrosIncidentes.centraisAr} onChange={() => setFiltrosIncidentes(p => ({...p, centraisAr: !p.centraisAr}))} /> 
                        Limpezas de Ar Vencidas
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={filtrosIncidentes.contatos} onChange={() => setFiltrosIncidentes(p => ({...p, contatos: !p.contatos}))} /> 
                        Inspeções de Contatos Vencidas
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={filtrosIncidentes.chaves} onChange={() => setFiltrosIncidentes(p => ({...p, chaves: !p.chaves}))} /> 
                        Inspeções de Chaves Vencidas
                    </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '14px', margin: 0, color: theme.textMain }}>Cidades / Regiões</h4>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" onClick={() => {
                        const map = {};
                        obterListaTodasCidades().forEach(c => map[c] = true);
                        setCidadesSelecionadasParaRelatorio(map);
                    }} style={{ background: 'transparent', border: 'none', color: '#4dabf7', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>Marcar Todas</button>
                    <button type="button" onClick={() => {
                        const map = {};
                        obterListaTodasCidades().forEach(c => map[c] = false);
                        setCidadesSelecionadasParaRelatorio(map);
                    }} style={{ background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>Desmarcar Todas</button>
                  </div>
                </div>
                <div style={{ background: theme.cardInner, padding: '10px', borderRadius: '6px', border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px' }}>
                  {obterListaTodasCidades().map(sigla => (
                    <label key={sigla} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: 'bold', textTransform: 'uppercase' }}>
                      <input 
                        type="checkbox" 
                        checked={!!cidadesSelecionadasParaRelatorio[sigla]} 
                        onChange={(e) => {
                          setCidadesSelecionadasParaRelatorio({ ...cidadesSelecionadasParaRelatorio, [sigla]: e.target.checked });
                        }} 
                      />
                      Região / Cidade: {sigla}
                    </label>
                  ))}
                </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button type="button" onClick={() => setModalFiltroRelatorioAberto(false)} style={{ flex: 1, padding: '12px', background: 'transparent', border: `1px solid ${theme.border}`, color: theme.textMain, borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>Cancelar</button>
              <button type="button" onClick={gerarRelatorioGeralIncidentesPDF} style={{ flex: 1, padding: '12px', background: '#007bff', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>Gerar PDF</button>
            </div>
          </div>
        </div>
      )}

      {showAvisoGlobal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '15px', boxSizing: 'border-box' }}>
          <div style={{ background: theme.cardBg, color: theme.textMain, padding: '20px', borderRadius: '12px', border: '2px solid #ff4d4d', width: '100%', maxWidth: '450px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ color: '#ff4d4d', marginTop: 0, fontSize: '17px', textAlign: 'center' }}>⚠️ Atenção: Prazos e Vencimentos</h2>
            <div style={{ margin: '10px 0', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
              {vencidos.length === 0 && amanha.length === 0 ? (
                <p style={{ color: theme.textMuted, textAlign: 'center', fontSize: '14px' }}>Nenhum alerta pendente no momento.</p>
              ) : (
                <>
                  {vencidos.map((msg, i) => (
                    <div key={i} style={{ background: theme.cardInner, padding: '10px', borderRadius: '6px', borderLeft: '3px solid #ff4d4d' }}>
                      <p className="alerta-vencido" style={{ margin: 0, fontSize: '14px' }}>{msg}</p>
                    </div>
                  ))}
                  {amanha.map((msg, i) => (
                    <div key={i} style={{ background: theme.cardInner, padding: '10px', borderRadius: '6px', borderLeft: '3px solid #ff9800' }}>
                      <p className="alerta-amanha" style={{ margin: 0, fontSize: '14px' }}>{msg}</p>
                    </div>
                  ))}
                </>
              )}
            </div>
            <button onClick={() => setShowAvisoGlobal(false)} style={{ width: '100%', padding: '12px', background: '#ff4d4d', border: 'none', color: '#fff', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer', marginTop: '10px', fontSize: '14px' }}>Entendido</button>
          </div>
        </div>
      )}

      {drawerAberto && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex' }}>
          <div style={{ width: '340px', background: theme.cardBg, color: theme.textMain, height: '100%', padding: '20px', boxSizing: 'border-box', overflowY: 'auto', display: 'flex', flexDirection: 'column', borderRight: `1px solid ${theme.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: '0', fontSize: '16px' }}>Menu do Sistema</h3>
              <button onClick={() => setDrawerAberto(false)} style={{ background: 'transparent', border: 'none', color: theme.textMuted, fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '15px', flexWrap: 'wrap' }}>
              <button onClick={() => setAbaDrawer('checkins')} style={{ flex: '1 1 30%', padding: '6px 4px', background: abaDrawer === 'checkins' ? '#007bff' : theme.cardInner, border: `1px solid ${theme.border}`, color: theme.textMain, borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Check-ins</button>
              <button onClick={() => setAbaDrawer('limpezas')} style={{ flex: '1 1 30%', padding: '6px 4px', background: abaDrawer === 'limpezas' ? '#007bff' : theme.cardInner, border: `1px solid ${theme.border}`, color: theme.textMain, borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Limpezas Ar</button>
              <button onClick={() => setAbaDrawer('baterias')} style={{ flex: '1 1 30%', padding: '6px 4px', background: abaDrawer === 'baterias' ? '#007bff' : theme.cardInner, border: `1px solid ${theme.border}`, color: theme.textMain, borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Baterias</button>
              <button onClick={() => setAbaDrawer('contatos')} style={{ flex: '1 1 45%', padding: '6px 4px', background: abaDrawer === 'contatos' ? '#007bff' : theme.cardInner, border: `1px solid ${theme.border}`, color: theme.textMain, borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Contatos</button>
              <button onClick={() => setAbaDrawer('chaves')} style={{ flex: '1 1 45%', padding: '6px 4px', background: abaDrawer === 'chaves' ? '#007bff' : theme.cardInner, border: `1px solid ${theme.border}`, color: theme.textMain, borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Chaves</button>
            </div>

            {abaDrawer === 'checkins' ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1.5px solid ${theme.border}`, paddingBottom: '6px', marginBottom: '10px' }}>
                  <h4 style={{ color: theme.textMuted, fontSize: '15px', margin: 0 }}>Últimos Check-ins</h4>
                  {ultimosCheckIns.length > 0 && (
                    <button onClick={apagarCheckinsAntigos} style={{ background: '#dc3545', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Apagar Antigos</button>
                  )}
                </div>
                {ultimosCheckIns.length === 0 ? (
                  <p style={{ color: theme.textMuted, fontSize: '14px' }}>Nenhum check-in registrado.</p>
                ) : (
                  ultimosCheckIns.map((item, idx) => {
                    let nomeDoPop = (item.popNome || item.pop || item.nomePop || item.nome_pop || item.nome || '');
                    if (nomeDoPop.toLowerCase() === 'odin' || nomeDoPop.toLowerCase() === 'odim') nomeDoPop = 'balder';
                    if (!popPertenceAoUsuario(nomeDoPop)) return null;
                    const sigla = obterSiglaPop(nomeDoPop);
                    const nomeExibicao = sigla ? `${realizarNomeExibicao(nomeDoPop)} - ${sigla}` : realizarNomeExibicao(nomeDoPop);
                    const res = statusData(item.proximaInspecao);
                    const vencido = res && res.status === 'vencido';
                    const alertaAmanha = res && (res.status === 'amanha' || res.status === 'hoje');

                    return (
                      <div key={idx} style={{ background: theme.cardInner, padding: '10px', borderRadius: '6px', marginBottom: '8px', fontSize: '14px', border: `1px solid ${theme.border}`, position: 'relative' }}>
                        <button onClick={() => apagarCheckInIndividual(idx)} style={{ position: 'absolute', top: '8px', right: '8px', background: 'transparent', border: 'none', color: '#ff4d4d', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}>✕</button>
                        <p style={{ margin: '0 0 4px 0', color: '#4dabf7', fontWeight: 'bold', textTransform: 'uppercase', paddingRight: '15px', fontSize: '14px' }}>POP: {nomeExibicao}</p>
                        <p style={{ margin: '0 0 4px 0', color: theme.textMain }}>Técnico: {item.tecnico}</p>
                        <p style={{ margin: '0 0 4px 0', color: theme.textMuted }}>Data: {item.dataHora}</p>
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
                <h4 style={{ color: theme.textMuted, fontSize: '15px', borderBottom: `1.5px solid ${theme.border}`, paddingBottom: '6px', marginTop: 0 }}>Cronograma Limpezas de Ar</h4>
                {cronogramaLimpezas.map((item, idx) => {
                  let nomeDoPop = item.popNome;
                  if (nomeDoPop.toLowerCase() === 'odin' || nomeDoPop.toLowerCase() === 'odim') nomeDoPop = 'balder';
                  if (!popPertenceAoUsuario(nomeDoPop)) return null;
                  const sigla = obterSiglaPop(nomeDoPop);
                  const nomeExibicao = sigla ? `${realizarNomeExibicao(nomeDoPop)} - ${sigla}` : realizarNomeExibicao(nomeDoPop);
                  const res = statusData(item.proximaLimpeza);
                  const vencido = res && res.status === 'vencido';
                  const alertaAmanha = res && (res.status === 'amanha' || res.status === 'hoje');

                  return (
                    <div key={idx} style={{ background: theme.cardInner, padding: '10px', borderRadius: '6px', marginBottom: '8px', fontSize: '14px', border: `1px solid ${theme.border}` }}>
                      <p style={{ margin: '0 0 4px 0', color: '#4dabf7', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '14px' }}>{nomeExibicao} ({item.central})</p>
                      <p style={{ margin: '0 0 4px 0', color: theme.textMain }}>Última: {item.ultimaLimpeza}</p>
                      <p className={vencido ? 'alerta-vencido' : alertaAmanha ? 'alerta-amanha' : ''} style={{ margin: 0, color: vencido ? undefined : alertaAmanha ? undefined : '#28a745' }}>
                        Próxima: {item.proximaLimpeza} {vencido ? `(Expirado há ${res.dias}d)` : alertaAmanha ? `(${res.status === 'hoje' ? 'Vence hoje' : 'Vence amanhã'})` : ''}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : abaDrawer === 'baterias' ? (
              <div>
                <h4 style={{ color: theme.textMuted, fontSize: '15px', borderBottom: `1.5px solid ${theme.border}`, paddingBottom: '6px', marginTop: 0 }}>Cronograma de Baterias</h4>
                {cronogramaBaterias.map((item, idx) => {
                  let nomeDoPop = item.popNome;
                  if (nomeDoPop.toLowerCase() === 'odin' || nomeDoPop.toLowerCase() === 'odim') nomeDoPop = 'balder';
                  if (!popPertenceAoUsuario(nomeDoPop)) return null;
                  const sigla = obterSiglaPop(nomeDoPop);
                  const nomeExibicao = sigla ? `${realizarNomeExibicao(nomeDoPop)} - ${sigla}` : realizarNomeExibicao(nomeDoPop);
                  const res = statusData(item.proximaSubstituicao);
                  const vencido = res && res.status === 'vencido';
                  const alertaAmanha = res && (res.status === 'amanha' || res.status === 'hoje');

                  const resInsp = statusData(item.proximaInspecao);
                  const vencidoInsp = resInsp && resInsp.status === 'vencido';
                  const alertaInspAmanha = resInsp && (resInsp.status === 'amanha' || resInsp.status === 'hoje');

                  const { textoExato } = parseDataFabricacaoBateria(item.fabricacao);
            
                  return (
                    <div key={idx} style={{ background: theme.cardInner, padding: '10px', borderRadius: '6px', marginBottom: '8px', fontSize: '14px', border: `1px solid ${theme.border}` }}>
                      <p style={{ margin: '0 0 4px 0', color: '#4dabf7', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '14px' }}>{nomeExibicao} ({item.banco})</p>
                      <p style={{ margin: '0 0 4px 0', color: theme.textMain }}>Fabricação: {item.fabricacao} {textoExato ? `(${textoExato})` : ''}</p>
                      <p className={vencido ? 'alerta-vencido' : alertaAmanha ? 'alerta-amanha' : ''} style={{ margin: '0 0 4px 0', color: vencido ? undefined : alertaAmanha ? undefined : '#28a745' }}>
                        Troca: {item.proximaSubstituicao} {vencido ? `(Expirado há ${res.dias}d)` : alertaAmanha ? `(${res.status === 'hoje' ? 'Vence hoje' : 'Vence amanhã'})` : ''}
                      </p>
                      <p style={{ margin: '0 0 4px 0', color: theme.textMain }}>Data de Inspeção: {item.ultimaInspecao || 'N/A'}</p>
                      <p className={vencidoInsp ? 'alerta-vencido' : alertaInspAmanha ? 'alerta-amanha' : ''} style={{ margin: 0, color: vencidoInsp ? undefined : alertaInspAmanha ? undefined : '#28a745' }}>
                        Próxima Inspeção: {item.proximaInspecao || 'N/A'} {vencidoInsp ? `(Expirado há ${resInsp.dias}d)` : alertaInspAmanha ? `(${resInsp.status === 'hoje' ? 'Vence hoje' : 'Vence amanhã'})` : ''}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : abaDrawer === 'contatos' ? (
              <div>
                <h4 style={{ color: theme.textMuted, fontSize: '15px', borderBottom: `1.5px solid ${theme.border}`, paddingBottom: '6px', marginTop: 0 }}>Contatos dos POPs</h4>
                {cronogramaContatos.length === 0 ? (
                  <p style={{ color: theme.textMuted, fontSize: '14px' }}>Nenhum contato cadastrado.</p>
                ) : (
                  cronogramaContatos.map((item, idx) => {
                    let nomeDoPop = item.popNome;
                    if (nomeDoPop.toLowerCase() === 'odin' || nomeDoPop.toLowerCase() === 'odim') nomeDoPop = 'balder';
                    if (!popPertenceAoUsuario(nomeDoPop)) return null;
                    const sigla = obterSiglaPop(nomeDoPop);
                    const nomeExibicao = sigla ? `${realizarNomeExibicao(nomeDoPop)} - ${sigla}` : realizarNomeExibicao(nomeDoPop);
                    const res = statusData(item.proximaInspecao);
                    const vencido = res && res.status === 'vencido';
                    const alertaAmanha = res && (res.status === 'amanha' || res.status === 'hoje');

                    return (
                      <div key={idx} style={{ background: theme.cardInner, padding: '10px', borderRadius: '6px', marginBottom: '8px', fontSize: '14px', border: `1px solid ${theme.border}` }}>
                        <p style={{ margin: '0 0 4px 0', color: '#4dabf7', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '14px' }}>POP: {nomeExibicao}</p>
                        <p style={{ margin: '0 0 3px 0', color: theme.textMain }}><b>Responsável:</b> {item.nomeResponsavel} ({item.funcao})</p>
                        <p style={{ margin: '0 0 3px 0', color: theme.textMain }}><b>Telefone:</b> {item.telefone}</p>
                        <p style={{ margin: '0 0 3px 0', color: theme.textMuted }}>Última Insp: {item.ultimaInspecao || 'N/A'}</p>
                        <p className={vencido ? 'alerta-vencido' : alertaAmanha ? 'alerta-amanha' : ''} style={{ margin: 0, color: vencido ? undefined : alertaAmanha ? undefined : '#28a745' }}>
                          Próx. Insp: {item.proximaInspecao || 'N/A'} {vencido ? `(Expirado há ${res.dias}d)` : alertaAmanha ? `(${res.status === 'hoje' ? 'Vence hoje' : 'Vence amanhã'})` : ''}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div>
                <h4 style={{ color: theme.textMuted, fontSize: '15px', borderBottom: `1.5px solid ${theme.border}`, paddingBottom: '6px', marginTop: 0 }}>Controle de Chaves</h4>
                {cronogramaChaves.length === 0 ? (
                  <p style={{ color: theme.textMuted, fontSize: '14px' }}>Nenhuma chave registrada.</p>
                ) : (
                  cronogramaChaves.map((item, idx) => {
                    let nomeDoPop = item.popNome;
                    if (nomeDoPop.toLowerCase() === 'odin' || nomeDoPop.toLowerCase() === 'odim') nomeDoPop = 'balder';
                    if (!popPertenceAoUsuario(nomeDoPop)) return null;
                    const sigla = obterSiglaPop(nomeDoPop);
                    const nomeExibicao = sigla ? `${realizarNomeExibicao(nomeDoPop)} - ${sigla}` : realizarNomeExibicao(nomeDoPop);
                    const res = statusData(item.proximaInspecao);
                    const vencido = res && res.status === 'vencido';
                    const alertaAmanha = res && (res.status === 'amanha' || res.status === 'hoje');

                    return (
                      <div key={idx} style={{ background: theme.cardInner, padding: '10px', borderRadius: '6px', marginBottom: '8px', fontSize: '14px', border: `1px solid ${theme.border}` }}>
                        <p style={{ margin: '0 0 4px 0', color: '#4dabf7', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '14px' }}>POP: {nomeExibicao}</p>
                        <p style={{ margin: '0 0 3px 0', color: theme.textMuted }}>Última Insp: {item.ultimaInspecao || 'N/A'}</p>
                        <p className={vencido ? 'alerta-vencido' : alertaAmanha ? 'alerta-amanha' : ''} style={{ margin: 0, color: vencido ? undefined : alertaAmanha ? undefined : '#28a745' }}>
                          Próx. Insp: {item.proximaInspecao || 'N/A'} {vencido ? `(Expirado há ${res.dias}d)` : alertaAmanha ? `(${res.status === 'hoje' ? 'Vence hoje' : 'Vence amanhã'})` : ''}
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
    </div>
  );
}

function TelaLogin({ onLoginSucesso, darkMode, setDarkMode, theme }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');

  const [showTrocarSenhaModal, setShowTrocarSenhaModal] = useState(false);
  const [emailTroca, setEmailTroca] = useState('');
  const [senhaAntiga, setSenhaAntiga] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [mostrarSenhaTroca, setMostrarSenhaTroca] = useState(false);
  const [sucessoTroca, setSucessoTroca] = useState('');
  const [erroTroca, setErroTroca] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setErro('');
    try {
      const res = await signInWithEmailAndPassword(auth, email, senha);
      onLoginSucesso(res.user.email);
    } catch (e) { setErro(`Erro: ${e.message}`); }
  };

  const handleTrocarSenha = async (e) => {
    e.preventDefault();
    setErroTroca('');
    setSucessoTroca('');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, emailTroca, senhaAntiga);
      const user = userCredential.user;
      const credential = EmailAuthProvider.credential(user.email, senhaAntiga);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, senhaNova);
      setSucessoTroca('Senha alterada com sucesso! Você já pode entrar com a nova senha.');
      setEmailTroca('');
      setSenhaAntiga('');
      setSenhaNova('');
      await signOut(auth);
    } catch (e) {
      setErroTroca(`Erro ao alterar senha: ${e.message}`);
    }
  };

  return (
    <div style={{ backgroundColor: theme.bg, color: theme.textMain, minHeight: '100vh', width: '100vw', margin: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '15px', position: 'relative', boxSizing: 'border-box' }}>
      <button type="button" onClick={setDarkMode} style={{ position: 'absolute', top: '15px', right: '15px', background: theme.cardBg, border: `1px solid ${theme.border}`, color: theme.textMain, padding: '8px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
        {darkMode ? '☀️ Modo Claro' : '🌙 Modo Escuro'}
      </button>

      <form onSubmit={handleLogin} style={{ background: theme.cardBg, color: theme.textMain, padding: '30px', borderRadius: '8px', width: '340px', border: `1px solid ${theme.border}`, textAlign: 'center', boxSizing: 'border-box' }}>
        <img src="/logo.png" alt="Logo Fibralink" style={{ width: '150px', marginBottom: '15px', objectFit: 'contain' }} />
        <h2 style={{ marginBottom: '20px', fontSize: '18px' }}>InfraManager POP</h2>
        {erro && <p style={{ color: '#ff6b6b', fontSize: '14px', marginBottom: '10px' }}>{erro}</p>}
        
        <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '10px', marginBottom: '15px', background: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.inputText, boxSizing: 'border-box', fontSize: '15px' }} />
        
        <div style={{ position: 'relative', marginBottom: '15px' }}>
          <input type={mostrarSenha ? "text" : "password"} placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} required style={{ width: '100%', padding: '10px', paddingRight: '40px', background: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.inputText, boxSizing: 'border-box', fontSize: '15px' }} />
          <button type="button" onClick={() => setMostrarSenha(!mostrarSenha)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: theme.textMuted, cursor: 'pointer', fontSize: '16px' }}>
            {mostrarSenha ? '🔓' : '🔒'}
          </button>
        </div>

        <button type="submit" style={{ width: '100%', padding: '12px', background: '#007bff', border: 'none', color: '#fff', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer', marginBottom: '15px', fontSize: '15px' }}>Entrar</button>
        
        <button type="button" onClick={() => { setShowTrocarSenhaModal(true); setErroTroca(''); setSucessoTroca(''); }} style={{ background: 'transparent', border:
