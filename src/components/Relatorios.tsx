import { useState, useEffect } from "react";
import { supabase } from "../config/supabase";
import { CalendarDays, Download, Copy, CheckCircle2, TrendingDown, Users, Activity } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { GerenciarEmails } from "./GerenciarEmails";

// IMPORTAÇÕES DO PADRÃO ADAPTER 
import { XMLDataGenerator, XMLToJsonAdapter } from "../services/ExportAdapter";

// ============================================================================
// COLOQUE AQUI O CÓDIGO BASE64 DA SUA LOGO
// ============================================================================
const LOGO_BASE64 = ""; 
// ============================================================================

const formatarDataExcel = (data: string) => {
  if (!data) return "-";
  const [, mes, dia] = data.split("T")[0].split("-");
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${parseInt(dia)}-${meses[parseInt(mes) - 1]}`;
};

const formatarMoeda = (valor: number) => {
  if (valor === 0) return "-";
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export function Relatorios() {
  const [mesesDisponiveis, setMesesDisponiveis] = useState<any[]>([]);
  const [mesSelecionado, setMesSelecionado] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [relatorio, setRelatorio] = useState<any>(null);
  const [copiado, setCopiado] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  
  // ESTADO DO ADAPTER PARA EXPORTAÇÃO
  const [isExportingAdapter, setIsExportingAdapter] = useState(false);

  // 1. CARREGA OS MESES DISPONÍVEIS QUANDO A TELA ABRE
  useEffect(() => {
    async function carregarDados() {
      const { data } = await supabase.from("financeiro").select("mes_referencia");
      const mSet = new Set<string>();
      const hoje = new Date();
      mSet.add(`${String(hoje.getMonth() + 1).padStart(2, "0")}/${hoje.getFullYear()}`);
      
      data?.forEach((i: any) => i.mes_referencia && mSet.add(i.mes_referencia));
      
      const opcoes = Array.from(mSet).map((v: string) => {
        const [m, a] = v.split("/");
        return { valor: v, label: `${m}/${a}`, ordem: parseInt(`${a}${m}`) };
      }).sort((a, b) => b.ordem - a.ordem);

      setMesesDisponiveis(opcoes);
      if (opcoes.length > 0) setMesSelecionado(opcoes[0].valor);
    }
    carregarDados();
  }, []);

  // 2. A MÁGICA AUTOMÁTICA: GERA O RELATÓRIO SOZINHO SEMPRE QUE O MÊS MUDA
  useEffect(() => {
    async function carregarDashboardAutomatico() {
      if (!mesSelecionado) return;
      setCarregando(true);

      try {
        const { data: finGeral } = await supabase.from("financeiro").select("valor, tipo");
        const saldoTotalConta = (finGeral || []).reduce((acc: number, m: any) => m.tipo === "ENTRADA" ? acc + m.valor : acc - m.valor, 0);

        const { data: finMes } = await supabase.from("financeiro").select("*").eq("mes_referencia", mesSelecionado);
        const { data: filhos } = await supabase.from("filhos").select("*").order("nome");
        const { data: festas } = await supabase.from("festas").select("id, nome");

        const movimentacoes = finMes || [];
        const listaFilhos = filhos || [];
        const listaFestas = festas || [];

        const movGeral = movimentacoes.filter((m: any) => !m.festa_id);
        const movFestas = movimentacoes.filter((m: any) => m.festa_id);

        const entradasGerais = movGeral.filter((m: any) => m.tipo === "ENTRADA");
        const saidasGerais = movGeral.filter((m: any) => m.tipo === "SAIDA").sort((a: any, b: any) => new Date(a.data_pagamento).getTime() - new Date(b.data_pagamento).getTime());

        const totalEntradasGerais = entradasGerais.reduce((acc: number, m: any) => acc + m.valor, 0);
        const totalSaidasGerais = saidasGerais.reduce((acc: number, m: any) => acc + m.valor, 0);

        const pagamentosMensalidade = entradasGerais.filter((m: any) => m.categoria === "MENSALIDADE" && m.filho_id);
        const entradasExtras = entradasGerais.filter((m: any) => m.categoria !== "MENSALIDADE" || !m.filho_id); 

        let pagantesQtd = 0;
        let pendentesQtd = 0;
        let isentosQtd = 0;

        const [mRefStr, aRefStr] = mesSelecionado.split('/');
        const filtroNum = parseInt(aRefStr) * 100 + parseInt(mRefStr);

        const membrosValidosParaOMes = listaFilhos.filter((f: any) => {
          if (f.data_entrada) {
            const dataLimpa = f.data_entrada.split('T')[0];
            const partes = dataLimpa.includes('/') ? dataLimpa.split('/') : dataLimpa.split('-');
            const anoE = parseInt(dataLimpa.includes('/') ? partes[2] : partes[0]);
            const mesE = parseInt(dataLimpa.includes('/') ? partes[1] : partes[1]);

            const entradaNum = anoE * 100 + mesE;
            if (entradaNum > filtroNum) return false; 
          }

          if (f.ativo === false) {
            if (!f.data_saida) return false; 
            
            const dataLimpaS = f.data_saida.split('T')[0];
            const partesS = dataLimpaS.includes('/') ? dataLimpaS.split('/') : dataLimpaS.split('-');
            const anoS = parseInt(dataLimpaS.includes('/') ? partesS[2] : partesS[0]);
            const mesS = parseInt(dataLimpaS.includes('/') ? partesS[1] : partesS[1]);

            const saidaNum = anoS * 100 + mesS;
            if (saidaNum < filtroNum) return false; 
          }

          return true; 
        });

        const membrosCorrente = membrosValidosParaOMes.map((f: any, index: number) => {
          const pgto = pagamentosMensalidade.find((m: any) => m.filho_id === f.id);
          
          if (f.isento) {
            isentosQtd++;
          } else {
            if (pgto) pagantesQtd++;
            else pendentesQtd++;
          }

          return {
            qtde: index + 1,
            nome: f.nome,
            isento: f.isento,
            pago: !!pgto,
            valor: pgto ? pgto.valor : 0,
            data: pgto ? pgto.data_pagamento : null,
            formaPg: pgto ? "Pix" : "-",
            vencimento: f.dia_vencimento || 10
          };
        });

        const totalMensalidades = membrosCorrente.reduce((acc: number, m: any) => acc + m.valor, 0);

        const festasIdsNoMes = [...new Set(movFestas.map((m: any) => m.festa_id))];
        const relatorioFestas = festasIdsNoMes.map(festaId => {
          const nomeFesta = listaFestas.find((f: any) => f.id === festaId)?.nome || "Festa Desconhecida";
          const movsDestaFesta = movFestas.filter((m: any) => m.festa_id === festaId);
          const entFesta = movsDestaFesta.filter((m: any) => m.tipo === "ENTRADA");
          const saiFesta = movsDestaFesta.filter((m: any) => m.tipo === "SAIDA");
          
          const abreviarNome = (nomeCompleto: string) => {
            if (!nomeCompleto) return "";
            const partes = nomeCompleto.split(" ");
            return partes.length === 1 ? partes[0] : `${partes[0]} ${partes[partes.length - 1]}`;
          };

          const idsPagantesFesta = entFesta.filter((m: any) => m.filho_id).map((m: any) => m.filho_id);
          
          const pagantesFestaNomes = membrosValidosParaOMes
            .filter((f: any) => idsPagantesFesta.includes(f.id))
            .map((f: any) => abreviarNome(f.nome))
            .join(", ");
            
          const pendentesFestaNomes = membrosValidosParaOMes
            .filter((f: any) => !f.isento && !idsPagantesFesta.includes(f.id))
            .map((f: any) => abreviarNome(f.nome))
            .join(", ");

          return {
            nome: nomeFesta,
            entradas: entFesta,
            totalEntradas: entFesta.reduce((acc: number, m: any) => acc + m.valor, 0),
            saidas: saiFesta,
            totalSaidas: saiFesta.reduce((acc: number, m: any) => acc + m.valor, 0),
            saldo: entFesta.reduce((acc: number, m: any) => acc + m.valor, 0) - saiFesta.reduce((acc: number, m: any) => acc + m.valor, 0),
            pagantesLista: pagantesFestaNomes || "Nenhum",
            pendentesLista: pendentesFestaNomes || "Nenhum"
          };
        });

        const ranking = saidasGerais.reduce((acc: any, curr: any) => {
          acc[curr.categoria] = (acc[curr.categoria] || 0) + curr.valor;
          return acc;
        }, {} as Record<string, number>);
        const rankingDespesas = Object.entries(ranking).sort((a: any, b: any) => b[1] - a[1]).slice(0, 3);
        
        const taxaPagamento = (pagantesQtd + pendentesQtd) > 0 
          ? Math.round((pagantesQtd / (pagantesQtd + pendentesQtd)) * 100) 
          : 0;

        const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const [mesNum, anoNum] = mesSelecionado.split("/");
        const nomeMes = `${mesesNomes[parseInt(mesNum) - 1]}-${anoNum.slice(2)}`;

        setRelatorio({
          mesNome: nomeMes,
          mes: mesSelecionado,
          geral: {
            saidas: saidasGerais,
            entradasExtras: entradasExtras,
            totalEntradas: totalEntradasGerais,
            totalSaidas: totalSaidasGerais,
            saldo: totalEntradasGerais - totalSaidasGerais,
            saldoConta: saldoTotalConta 
          },
          corrente: {
            lista: membrosCorrente,
            totalMensalidades,
            resumo: { pagantes: pagantesQtd, pendentes: pendentesQtd, isentos: isentosQtd }
          },
          festas: relatorioFestas,
          insights: { rankingDespesas, taxaPagamento, totalCorrente: pagantesQtd + pendentesQtd + isentosQtd }
        });
      } catch (error) {
        console.error("Erro ao montar o dashboard: ", error);
      } finally {
        setCarregando(false);
      }
    }

    carregarDashboardAutomatico();
  }, [mesSelecionado]); 

  // FUNÇÃO DE EXPORTAÇÃO (PADRÃO ADAPTER XML -> JSON)
  const handleExportarFinanceiroAdapter = async () => {
    setIsExportingAdapter(true);
    try {
      const { data, error } = await supabase.from('financeiro').select('*');

      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        alert('Nenhuma movimentação financeira encontrada para exportar.');
        return;
      }

      const xmlGenerator = new XMLDataGenerator();
      const adapter = new XMLToJsonAdapter(xmlGenerator);
      const jsonFinal = adapter.exportDataAsJson(data);

      const blob = new Blob([jsonFinal], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'relatorio_financeiro.json';
      
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro na exportação:', error);
      alert('Erro ao exportar via Adapter.');
    } finally {
      setIsExportingAdapter(false);
    }
  };

  function copiarParaWhatsApp() {
    if (!relatorio) return;
    const r = relatorio.corrente.resumo;
    const total = r.pagantes + r.pendentes + r.isentos;
    
    let texto = `📊 *BALANCETE - ${relatorio.mes}*\n\n`;
    texto += `🟢 Arrecadado: R$ ${formatarMoeda(relatorio.geral.totalEntradas)}\n`;
    texto += `🔴 Gasto: R$ ${formatarMoeda(relatorio.geral.totalSaidas)}\n`;
    texto += `💰 Saldo do Mês: R$ ${formatarMoeda(relatorio.geral.saldo)}\n`;
    texto += `🏦 *SALDO TOTAL CONTA: R$ ${formatarMoeda(relatorio.geral.saldoConta)}*\n\n`;
    texto += `*RADAR DA CORRENTE (${total} Médiuns)*\n`;
    texto += `✅ Pagaram: ${r.pagantes}\n`;
    texto += `⚠️ Pendentes: ${r.pendentes}\n`;
    texto += `🤍 Isentos: ${r.isentos}\n`;
    
    navigator.clipboard.writeText(texto + `\n_Gerado por TTZ Gestão_`);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  }

  async function baixarPDF() {
    setGerandoPdf(true);
    try {
      const doc = new jsPDF('l', 'mm', 'a4'); 
      const r = relatorio.corrente.resumo;
      const totalMembros = r.pagantes + r.pendentes + r.isentos;
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`TTZ GESTÃO - FECHAMENTO DE CAIXA (${relatorio.mes})`, 10, 14);
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')} | Total da Corrente: ${totalMembros} Médiuns (${r.pagantes} Pagos | ${r.pendentes} Pendentes | ${r.isentos} Isentos)`, 10, 20);

      if (LOGO_BASE64.length > 50) {
        doc.addImage(LOGO_BASE64, 'PNG', 265, 5, 20, 20);
      }

      const correnteBody = relatorio.corrente.lista.map((m: any) => [
        m.qtde,
        m.nome + (!m.pago && !m.isento ? ` (dia ${m.vencimento})` : ''),
        m.valor > 0 ? formatarMoeda(m.valor) : '-',
        m.isento ? 'Isento' : (m.pago ? 'Pg' : 'Pendente'),
        m.pago ? formatarDataExcel(m.data) : '-'
      ]);
      correnteBody.push(['', 'VALOR MENSALIDADE', formatarMoeda(relatorio.corrente.totalMensalidades), '', '']);

      autoTable(doc, {
        startY: 28,
        margin: { left: 10, right: 145 }, 
        head: [['Qtd', 'Mensalidade', 'Valor', 'Status', 'Data']],
        body: correnteBody,
        theme: 'grid',
        headStyles: { fillColor: [217, 225, 242], textColor: 0, fontStyle: 'bold' },
        styles: { fontSize: 7.5, cellPadding: 0.8, textColor: 0 }, 
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 85 },
          2: { cellWidth: 15, halign: 'center' },
          3: { cellWidth: 16, halign: 'center' },
          4: { cellWidth: 15, halign: 'center' }
        },
        willDrawCell: function(data) {
          if (data.row.index === correnteBody.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [242, 242, 242];
          }
          if (data.column.index === 3) {
            if (data.cell.raw === 'Pendente') data.cell.styles.textColor = [192, 0, 0];
            if (data.cell.raw === 'Pg' || data.cell.raw === 'Isento') data.cell.styles.textColor = [0, 128, 0];
          }
        }
      });

      doc.setPage(1);
      let alturaLadoDireito = 28;

      const resumoBody = [
        ['Total Arrecadado', formatarMoeda(relatorio.geral.totalEntradas)],
        ['Total Gasto', `- ${formatarMoeda(relatorio.geral.totalSaidas)}`],
        ['Saldo Líquido do Mês', formatarMoeda(relatorio.geral.saldo)],
        ['SALDO TOTAL EM CONTA', formatarMoeda(relatorio.geral.saldoConta)] 
      ];
      autoTable(doc, {
        startY: alturaLadoDireito,
        margin: { left: 160, right: 10 },
        body: resumoBody,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1.5, textColor: 0, fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 50 }, 1: { halign: 'right' } },
        willDrawCell: function(data) {
          if (data.row.index === 2) {
            data.cell.styles.fillColor = [242, 242, 242]; 
            if (relatorio.geral.saldo < 0) data.cell.styles.textColor = [192, 0, 0];
          }
          if (data.row.index === 3) {
            data.cell.styles.fillColor = [226, 239, 218]; 
            if (relatorio.geral.saldoConta < 0) data.cell.styles.textColor = [192, 0, 0];
            else data.cell.styles.textColor = [0, 100, 0]; 
          }
          if (data.row.index === 1 && data.column.index === 1) data.cell.styles.textColor = [192, 0, 0];
        }
      });
      alturaLadoDireito = (doc as any).lastAutoTable.finalY + 4;

      if (relatorio.geral.entradasExtras.length > 0) {
        const extrasBody = relatorio.geral.entradasExtras.map((e: any) => [
          formatarDataExcel(e.data_pagamento),
          formatarMoeda(e.valor),
          e.descricao || e.categoria
        ]);
        autoTable(doc, {
          startY: alturaLadoDireito,
          margin: { left: 160, right: 10 },
          head: [['Data', 'Valor', 'Outras Entradas / Doações']],
          body: extrasBody,
          theme: 'grid',
          headStyles: { fillColor: [226, 239, 218], textColor: 0 },
          styles: { fontSize: 7.5, cellPadding: 1, textColor: 0 },
          columnStyles: { 0: { cellWidth: 15, halign: 'center' }, 1: { cellWidth: 18, halign: 'center' } }
        });
        alturaLadoDireito = (doc as any).lastAutoTable.finalY + 4;
      }

      const gastosBody = relatorio.geral.saidas.map((s: any) => [
        formatarDataExcel(s.data_pagamento),
        formatarMoeda(s.valor),
        s.descricao || s.categoria
      ]);
      if (gastosBody.length === 0) gastosBody.push(['-', '-', 'Sem gastos registrados']);
      gastosBody.push(['', formatarMoeda(relatorio.geral.totalSaidas), 'TOTAL GASTOS']);

      autoTable(doc, {
        startY: alturaLadoDireito,
        margin: { left: 160, right: 10 },
        head: [['Data', 'Valor', 'Relação de Gastos / Despesas']],
        body: gastosBody,
        theme: 'grid',
        headStyles: { fillColor: [248, 215, 218], textColor: [114, 28, 36] },
        styles: { fontSize: 7.5, cellPadding: 1, textColor: 0 },
        columnStyles: {
          0: { cellWidth: 15, halign: 'center' },
          1: { cellWidth: 20, halign: 'right', textColor: [192, 0, 0], fontStyle: 'bold' },
          2: { textColor: [192, 0, 0] }
        },
        willDrawCell: function(data) {
          if (data.row.index === gastosBody.length - 1) {
            data.cell.styles.fillColor = [242, 242, 242];
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = [0, 0, 0];
          }
        }
      });
      alturaLadoDireito = (doc as any).lastAutoTable.finalY + 4;

      relatorio.festas.forEach((f: any) => {
        const festaBody = [
          ['Arrecadado Total', formatarMoeda(f.totalEntradas)],
          ['Gasto Total', `- ${formatarMoeda(f.totalSaidas)}`],
          [{ content: `(+) AJUDARAM: ${f.pagantesLista}`, colSpan: 2 }],
          [{ content: `(-) PENDENTES: ${f.pendentesLista}`, colSpan: 2 }]
        ];

        autoTable(doc, {
          startY: alturaLadoDireito,
          margin: { left: 160, right: 10 },
          head: [[`FESTA: ${f.nome}`, `Saldo: ${formatarMoeda(f.saldo)}`]],
          body: festaBody,
          theme: 'grid',
          headStyles: { fillColor: [255, 242, 204], textColor: 0 },
          styles: { fontSize: 8, cellPadding: 1.5, textColor: 0, fontStyle: 'bold' },
          columnStyles: { 0: { cellWidth: 50 }, 1: { halign: 'right' } },
          willDrawCell: function(data) {
            if (data.row.index === 1 && data.column.index === 1) data.cell.styles.textColor = [192, 0, 0];
            if (data.row.index === 2) {
              data.cell.styles.fontSize = 6;
              data.cell.styles.fontStyle = 'normal';
              data.cell.styles.textColor = [0, 100, 0]; 
            }
            if (data.row.index === 3) {
              data.cell.styles.fontSize = 6; 
              data.cell.styles.fontStyle = 'normal';
              data.cell.styles.textColor = [192, 0, 0];
            }
          }
        });
        alturaLadoDireito = (doc as any).lastAutoTable.finalY + 4;
      });

      doc.save(`Balancete_TTZ_${relatorio.mes.replace("/", "-")}.pdf`);
    } catch (error) {
      alert("Houve um erro ao gerar o PDF.");
    } finally {
      setGerandoPdf(false);
    }
  }

  return (
    <div style={{ width: "100%", paddingBottom: "30px" }}>
      
      <div className="table-container" style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '250px' }}>
            <CalendarDays size={20} color="var(--primary)" />
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Mês de Referência</label>
              <select 
                value={mesSelecionado} 
                onChange={(e) => setMesSelecionado(e.target.value)} 
                disabled={carregando}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-dark)', opacity: carregando ? 0.7 : 1, cursor: carregando ? 'not-allowed' : 'pointer' }}
              >
                <option value="">Selecione...</option>
                {mesesDisponiveis.map(m => <option key={m.valor} value={m.valor}>{m.label}</option>)}
              </select>
            </div>
          </div>
          
          {/* MENSAGEM DE CARREGAMENTO NO LUGAR DO BOTÃO */}
          {carregando && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontSize: '0.9rem', fontWeight: 'bold' }}>
              ⏳ Calculando dados do mês...
            </div>
          )}
        </div>
      </div>

      {/* TELA DE DADOS FICA INVISÍVEL ATÉ TERMINAR DE CARREGAR O NOVO MÊS */}
      {relatorio && !carregando && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.5s ease-in-out' }}>
          
          <div style={{ background: "var(--bg-card)", padding: "25px", borderRadius: "8px", border: "1px solid var(--border)" }}> 
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px" }}>
              <div>
                <h2 style={{ fontSize: "1.2rem", color: "var(--text-dark)", margin: '0 0 5px 0' }}>
                  Análise do Mês Pronta!
                </h2>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: 0 }}>
                  Os dados abaixo representam o fechamento do mês de {relatorio.mes}.
                </p>
              </div>
              
              {/* BOTÕES DE EXPORTAÇÃO */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button onClick={handleExportarFinanceiroAdapter} disabled={isExportingAdapter} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#3b82f6', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '4px', cursor: isExportingAdapter ? 'not-allowed' : 'pointer', fontSize: '0.9rem', fontWeight: 'bold', opacity: isExportingAdapter ? 0.7 : 1 }}>
                  <Download size={18}/> {isExportingAdapter ? "Convertendo XML..." : "Baixar Financeiro JSON"}
                </button>
                <button onClick={copiarParaWhatsApp} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#25D366', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}>
                  {copiado ? <CheckCircle2 size={18}/> : <Copy size={18}/>} Copiar Resumo (Zap)
                </button>
                <button onClick={baixarPDF} disabled={gerandoPdf} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--primary)', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}>
                  <Download size={18}/> {gerandoPdf ? "Montando..." : "Baixar PDF Oficial"}
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            
            {/* 1. RANKING DE DESPESAS */}
            <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <h4 style={{ margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
                <TrendingDown size={20} /> Principais Gastos
              </h4>
              {relatorio.insights.rankingDespesas.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Nenhum gasto registrado neste mês.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {relatorio.insights.rankingDespesas.map((item: any, index: number) => (
                    <div key={item[0]} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '10px', borderRadius: '6px', borderLeft: '4px solid var(--danger)' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>{index + 1}º Lugar</div>
                        <div style={{ fontWeight: 800, color: 'var(--text-dark)' }}>{item[0].replace('_', ' ')}</div>
                      </div>
                      <div style={{ fontWeight: 'bold', color: 'var(--danger)' }}>
                        R$ {item[1].toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. TERMÔMETRO DA CORRENTE */}
            <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <h4 style={{ margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                <Users size={20} /> Termometro da Corrente
              </h4>
              <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 900, color: relatorio.insights.taxaPagamento >= 70 ? 'var(--success)' : 'var(--warning)', lineHeight: '1' }}>
                  {relatorio.insights.taxaPagamento}%
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '5px' }}>Taxa de Pagamento (Adimplência)</div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-dark)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <strong style={{ color: 'var(--success)' }}>{relatorio.corrente.resumo.pagantes}</strong> Pagaram
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <strong style={{ color: 'var(--danger)' }}>{relatorio.corrente.resumo.pendentes}</strong> Pendentes
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <strong style={{ color: '#8b5cf6' }}>{relatorio.corrente.resumo.isentos}</strong> Isentos
                </div>
              </div>
              
              {/* Barra visual de progresso */}
              <div style={{ width: '100%', height: '8px', background: 'var(--border)', borderRadius: '4px', marginTop: '15px', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${relatorio.insights.taxaPagamento}%`, background: 'var(--success)' }}></div>
                <div style={{ width: `${100 - relatorio.insights.taxaPagamento}%`, background: 'var(--danger)' }}></div>
              </div>
            </div>

            {/* 3. RESUMO OPERACIONAL */}
            <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <h4 style={{ margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)' }}>
                <Activity size={20} /> Balanço Operacional
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Arrecadação Total:</span>
                  <strong style={{ color: 'var(--success)' }}>+ R$ {relatorio.geral.totalEntradas.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Gasto Total:</span>
                  <strong style={{ color: 'var(--danger)' }}>- R$ {relatorio.geral.totalSaidas.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '10px', borderRadius: '6px' }}>
                  <span style={{ fontWeight: 'bold', color: 'var(--text-dark)' }}>Lucro/Prejuízo:</span>
                  <strong style={{ color: relatorio.geral.saldo >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: '1.1rem' }}>
                    R$ {relatorio.geral.saldo.toFixed(2)}
                  </strong>
                </div>
              </div>
            </div>

          </div>

          {/* COMPONENTE DE EMAILS INTEGRADO NO FINAL */}
          <div style={{ marginTop: '40px' }}>
            <GerenciarEmails />
          </div>

        </div>
      )}
    </div>
  );
}