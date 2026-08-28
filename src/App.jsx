const gerarPdfUltimaInspecao = async () => {
    const dadosOriginais = obterDadosCheckInOriginal();
    const dataInspecaoFinal = dadosOriginais.dataHora;
    const dataProxStr = dadosOriginais.proximaInspecao;
    const tecnicoOriginal = dadosOriginais.tecnico;

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
          <p><span class="negrito">${cargoLabel}:</span> ${tecnicoOriginal}</p>
          <p><span class="negrito">Data da Inspeção:</span> ${dataInspecaoFinal}</p>
          <p><span class="negrito">Próxima Inspeção Recomendada:</span> ${dataProxStr}</p>

          <h2>Contatos e Chaves do POP</h2>
          <div class="bloco">
      `;

      if (listaContatos.length === 0) {
        htmlRelatorio += `<p>Nenhum contato cadastrado.</p>`;
      } else {
        listaContatos.forEach((c, i) => {
          htmlRelatorio += `
            <p><span class="negrito">Contato ${i + 1} (${c.funcao || 'N/A'}):</span> ${c.nome || 'Não informado'} | Tel: ${c.telefone || 'N/A'} | Última Insp: ${c.ultimaInsp || 'N/A'} (Próxima: ${calcularProximaInspecaoGeral(c.ultimaInsp) || 'N/A'})</p>
          `;
        });
      }

      htmlRelatorio += `
            <p style="margin-top: 10px;"><span class="negrito">Última Insp. Chave:</span> ${chaveUltimaInsp || 'N/A'} | Próxima: ${calcularProximaInspecaoGeral(chaveUltimaInsp) || 'N/A'}</p>
          </div>

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
          const anosTrocaCalculado = (bModel.tipo && bModel.tipo.toLowerCase() === 'lítio') ? 8 : 2;
          const { textoExato } = parseDataFabricacaoBateria(bModel.dataFabricacao);
          const fabExibicao = textoExato ? `${bModel.dataFabricacao} (${textoExato})` : (bModel.dataFabricacao || 'Não informada');
          const proxSub = calcularProximaSubstituicaoBateria(bModel.dataFabricacao, pop.nome, bModel.tipo);
          const resSub = statusData(proxSub);
          const vencidoSub = resSub && resSub.status === 'vencido';

          const proxInsp = calcularProximaInspecaoGeral(bModel.dataUltimaInspecao);
          const resInsp = statusData(proxInsp);
          const vencidoInsp = resInsp && resInsp.status === 'vencido';

          const voltagensHtml = bModel.tipo !== 'Lítio' 
            ? `<br>Voltagens das Baterias: [ Bat 1: ${bModel.voltagens[0] || '-'}V ] [ Bat 2: ${bModel.voltagens[1] || '-'}V ] [ Bat 3: ${bModel.voltagens[2] || '-'}V ] [ Bat 4: ${bModel.voltagens[3] || '-'}V ]` 
            : '';

          htmlRelatorio += `
            <div class="bloco">
              <span class="negrito">Banco ${getLetra(banco)} (${bModel.tipo})</span><br>
              Data de Fabricação: ${fabExibicao}<br>
              <span class="${vencidoSub ? 'vermelho' : ''}">Próxima Substituição (+${anosTrocaCalculado} anos): ${proxSub || 'N/A'} ${vencidoSub ? `(Expirado há ${resSub.dias} dias)` : ''}</span><br>
              Data da Última Inspeção: ${bModel.dataUltimaInspecao || 'N/A'}<br>
              <span class="${vencidoInsp ? 'vermelho' : ''}">Próxima Inspeção de Bateria (3 meses): ${proxInsp || 'N/A'} ${vencidoInsp ? `(Expirado há ${resInsp.dias} dias)` : ''}</span>
              ${voltagensHtml}
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
  };
