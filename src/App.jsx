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
      let anosAdicionais = tipoBateria === 'Lítio' ? 8 : 2;

      const year = dataObj.getFullYear() + anosAdicionais;
      const month = dataObj.getMonth();
      const day = dataObj.getDate();
      const date = new Date(year, month, day);
      return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
    }
    return '';
  } catch (e) { return ''; }
};

const calcularProximaInspecaoBateria = (dataUltimaInspecaoStr) => {
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

export default function App() {
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [popSelecionado, setPopSelecionado] = useState(null);
  const [telaGerenciarPopsAberta, setTelaGerenciarPopsAberta] = useState(false);
  const [listaPops, setListaPops] = useState(popsIniciaisPadrao);
  const [ultimosCheckIns, setUltimosCheckIns] = useState([]);
  const [cronogramaLimpezas, setCronogramaLimpezas] = useState([]);
  const [cronogramaBaterias, setCronogramaBaterias] = useState([]);
  const [dadosGeraisPops, setDadosGeraisPops] = useState({});
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
    return { vencidos, amanha };
  };

  const realizarNomeExibicao = (nome) => {
    if (!nome) return '';
    const n = nome.toLowerCase();
    if (n === 'odin' || n === 'odim') return 'BALDER';
    return n.toUpperCase();
  };

  const gerarRelatorioGeralIncidentesPDF = () => {
    const janelaPdf = window.open('', '_blank');
    if (!janelaPdf) return;

    const dadosPorCidade = {};

    listaPops.forEach(pop => {
      if (!popPertenceAoUsuario(pop.nome)) return;
      const sigla = obterSiglaPop(pop.nome) || 'GERAL';
      if (!dadosPorCidade[sigla]) {
        dadosPorCidade[sigla] = [];
      }

      const dadosPop = dadosGeraisPops[pop.nome] || {};
      const checkInPop = ultimosCheckIns.find(c => {
        let n = (c.popNome || c.pop || '').toLowerCase();
        if (n === 'odin' || n === 'odim') n = 'balder';
        return n === pop.nome.toLowerCase();
      });

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
        <title>Relatório Geral de Incidentes e Operações</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 25px; color: #000; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0056b3; padding-bottom: 12px; margin-bottom: 20px; }
          h1 { color: #0056b3; margin: 0; font-size: 20px; text-transform: uppercase; }
          h2 { color: #333; font-size: 16px; margin-top: 25px; border-bottom: 2px solid #007bff; padding-bottom: 4px; text-transform: uppercase; background: #eef2f5; padding-left: 8px; }
          h3 { color: #0056b3; font-size: 14px; margin: 12px 0 4px 0; text-transform: uppercase; }
          p { margin: 4px 0; font-size: 12px; }
          .negrito { font-weight: bold; }
          .vermelho { color: #d9534f; font-weight: bold; }
          .bloco-pop { background: #fdfdfd; border: 1px solid #ddd; padding: 10px 14px; margin-bottom: 10px; border-radius: 4px; border-left: 4px solid #007bff; }
          .incidente-item { background: #fff5f5; border-left: 3px solid #d9534f; padding: 6px 10px; margin: 4px 0; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Relatório Geral - Incidentes, Baterias e Limpezas</h1>
          <div>
            <p><strong>Emitido por:</strong> ${usuarioLogado ? usuarioLogado.split('@')[0].toUpperCase() : 'Sistema'}</p>
            <p><strong>Data:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
        </div>
    `;

    Object.keys(dadosPorCidade).sort().forEach(sigla => {
      html += `<h2>Região / Cidade: ${sigla}</h2>`;

      dadosPorCidade[sigla].forEach(item => {
        const { nome, endereco, checkIn, dados } = item;
        
        let temIncidentesAtivos = false;
        if (dados.statusAtivos) {
          Object.keys(dados.statusAtivos).forEach(atv => {
            if (dados.statusAtivos[atv] === 'Incidente') temIncidentesAtivos = true;
          });
        }

        html += `
          <div class="bloco-pop">
            <h3>POP: ${nome.toUpperCase()}</h3>
            <p><span class="negrito">Endereço:</span> ${endereco}</p>
            <p><span class="negrito">Última Inspeção:</span> ${checkIn ? checkIn.dataHora : (dados.ultimaDataInspecao ? `${dados.ultimaDataInspecao} (Salva)` : 'Nenhuma registrada')}</p>
            <p><span class="negrito">Próxima Inspeção:</span> ${checkIn ? checkIn.proximaInspecao : 'N/A'}</p>
        `;

        if (temIncidentesAtivos || (dados.incidentesGerais && dados.incidentesGerais.trim() !== '')) {
          html += `<p class="vermelho" style="margin-top:6px;">⚠️ Incidentes Registrados:</p>`;
          if (dados.statusAtivos) {
            Object.keys(dados.statusAtivos).forEach(atv => {
              if (dados.statusAtivos[atv] === 'Incidente') {
                const det = dados.detalhesIncidentes?.[atv] || 'Sem detalhes';
                html += `<div class="incidente-item"><strong>Ativo (${atv}):</strong> ${det}</div>`;
              }
            });
          }
          if (dados.incidentesGerais) {
            html += `<div class="incidente-item"><strong>Incidentes Gerais:</strong> ${dados.incidentesGerais}</div>`;
          }
        } else {
          html += `<p style="color: #666; font-style: italic; margin-top: 4px;">Nenhum incidente relatado neste POP.</p>`;
        }

        const qtdB = dados.qtdBancos || 1;
        html += `<p style="margin-top: 6px;"><span class="negrito">Bancos de Baterias (${qtdB}):</span>`;
        for (let b = 1; b <= qtdB; b++) {
          const fab = dados[`bat_${b}_fab`];
          const tipoB = dados[`bat_${b}_tipo`] || 'Chumbo';
          const { textoExato } = parseDataFabricacaoBateria(fab);
          const fabExibicao = textoExato ? `${fab} (${textoExato})` : (fab || 'N/A');
          const proxSub = calcularProximaSubstituicaoBateria(fab, nome, tipoB);
          const resSub = statusData(proxSub);
          const estiloTroca = resSub?.status === 'vencido' ? 'color: #d9534f; font-weight: bold;' : '';
          html += `<br>&nbsp;&nbsp;• Banco ${getLetra(b)} (${tipoB}) - Fab: ${fabExibicao} | Próx. Troca: <span style="${estiloTroca}">${proxSub || 'N/A'}</span>`;
        }
        html += `</p>`;

        const qtdA = dados.qtdAr || 1;
        const nomeLower = nome.toLowerCase();
        const interAr = (nomeLower === 'helius' || nomeLower === 'limos' || nomeLower === 'fanes') ? 5 : 8;
        html += `<p style="margin-top: 4px;"><span class="negrito">Centrais de Ar (${qtdA}):</span>`;
        for (let a = 1; a <= qtdA; a++) {
          const limp = dados[`ar_${a}_limp`];
          const proxLimp = calcularProximaLimpezaAr(limp, interAr);
          const resLimp = statusData(proxLimp);
          const estiloLimp = resLimp?.status === 'vencido' ? 'color: #d9534f; font-weight: bold;' : '';
          html += `<br>&nbsp;&nbsp;• Central ${getLetra(a)} (${dados[`ar_${a}_mod`] || 'Mod. N/I'}) - Última Limpeza: ${limp || 'N/A'} | Próx. Limpeza: <span style="${estiloLimp}">${proxLimp || 'N/A'}</span>`;
        }
        html += `</p>`;

        if (dados.anotacoes) {
          html += `<p style="margin-top: 4px;"><span class="negrito">Anotações:</span> ${dados.anotacoes}</p>`;
        }

        html += `</div>`;
      });
    });

    html += `</body></html>`;
    janelaPdf.document.write(html);
    janelaPdf.document.close();
    janelaPdf.focus();
    setTimeout(() => {
      janelaPdf.print();
    }, 600);
  };

  // ... (o restante do código permanece igual)
