// ============================================================
// View - App.tsx
// Componente de apresentacao puro. Toda a logica vive no controller.
// ============================================================

import React, { useEffect, useState } from 'react'
import { useAppController } from './controllers/useAppController'
import { supabase } from './config/supabase'
import { CadastroFilho } from './components/CadastroFilho'
import { LancamentoFinanceiro } from './components/LancamentoFinanceiro'
import { GestaoFestas } from './components/GestaoFestas'
import { GestaoVendas } from './components/GestaoVendas'
import { Login } from './components/Login'
import { PerfilUsuario } from './components/PerfilUsuario'
import { Relatorios } from './components/Relatorios'
import {
  LayoutDashboard, Users, Wallet, AlertCircle,
  CalendarDays, Pencil, UserPlus, ChevronDown,
  ChevronUp, Camera, CheckCircle2, FastForward,
  Moon, Sun, LogOut, Search, UserMinus, UserCheck, User,
  AlertTriangle, PartyPopper, FileText, Trash2, Store, Clock, List
} from 'lucide-react'
import './App.css'

const formatarData = (data: string) => {
  if (!data) return '--/--/----'
  const [ano, mes, dia] = data.split('T')[0].split('-')
  return `${dia}/${mes}/${ano}`
}

export default function App() {
  const ctrl = useAppController()

  const adminEmails = [
    'joaopedrovieirapereira5@gmail.com',
    'deboramoreiradelima@hotmail.com'
  ]
  const isAdmin = adminEmails.includes(ctrl.session?.user?.email)

  // --- Estado local da View (UI only) ---
  const [tema, setTema] = useState(localStorage.getItem('ttz-tema') || 'dark')
  const [mostrarFormFilho, setMostrarFormFilho] = useState(false)
  const [filhoEditando, setFilhoEditando] = useState<any>(null)
  const [filhoExpandido, setFilhoExpandido] = useState<number | null>(null)
  const [historicoMensalidades, setHistoricoMensalidades] = useState<any[]>([])
  const [termoBusca, setTermoBusca] = useState('')
  const [abaInativos, setAbaInativos] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema)
    localStorage.setItem('ttz-tema', tema)
  }, [tema])

  const alternarTema = () => setTema((t: string) => t === 'light' ? 'dark' : 'light')

  // --- Historico de mensalidades de um membro ---
  const calcularHistorico = async (filho: any) => {
    if (!filho) return
    const { data: pagamentos } = await supabase
      .from('financeiro').select('*')
      .eq('filho_id', filho.id)
      .eq('categoria', 'MENSALIDADE')

    const histGerado: any[] = []
    const dataAtual = new Date()
    const normalizarMes = (mr: string) => {
      if (!mr || !mr.includes('/')) return mr
      const [m, a] = mr.split('/')
      return `${m.padStart(2, '0')}/${a}`
    }

    if (filho.data_entrada) {
      const [anoE, mesE] = filho.data_entrada.split('T')[0].split('-')
      let dataIter = new Date(parseInt(anoE), parseInt(mesE) - 1, 1)
      while (dataIter <= dataAtual || (dataIter.getMonth() === dataAtual.getMonth() && dataIter.getFullYear() === dataAtual.getFullYear())) {
        const refOriginal = `${String(dataIter.getMonth() + 1).padStart(2, '0')}/${dataIter.getFullYear()}`
        const pagou = pagamentos?.find((p: any) => normalizarMes(p.mes_referencia) === normalizarMes(refOriginal))
        let statusMensalidade = 'PENDENTE'
        if (pagou) {
          statusMensalidade = pagou.is_isencao === true ? 'ISENTO' : 'PAGO'
        } else if (filho.isento) {
          statusMensalidade = 'ISENTO'
        } else {
          const [mRef, aRef] = refOriginal.split('/')
          const diaVenc = filho.dia_vencimento || 10
          const dataVencimento = new Date(parseInt(aRef), parseInt(mRef) - 1, diaVenc)
          const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
          if (hoje > dataVencimento) statusMensalidade = 'VENCIDA'
        }
        histGerado.push({ ref: refOriginal, status: statusMensalidade, dt: pagou ? pagou.data_pagamento : null })
        dataIter.setMonth(dataIter.getMonth() + 1)
      }
    }

    pagamentos?.forEach((p: any) => {
      const mesRefBD = normalizarMes(p.mes_referencia)
      if (!histGerado.find((h: any) => normalizarMes(h.ref) === mesRefBD)) {
        const [mBD, aBD] = mesRefBD.split('/')
        const dataPagamentoRef = new Date(parseInt(aBD), parseInt(mBD) - 1, 1)
        const dataAtualVerificacao = new Date()
        let statusFinal = 'INCONSISTENTE'
        if (dataPagamentoRef.getFullYear() > dataAtualVerificacao.getFullYear() ||
          (dataPagamentoRef.getFullYear() === dataAtualVerificacao.getFullYear() && dataPagamentoRef.getMonth() > dataAtualVerificacao.getMonth())) {
          statusFinal = 'ADIANTADO'
        }
        histGerado.push({ ref: mesRefBD, status: statusFinal, dt: p.data_pagamento })
      }
    })

    setHistoricoMensalidades(histGerado.sort((a: any, b: any) => {
      const [mA, aA] = a.ref.split('/')
      const [mB, aB] = b.ref.split('/')
      return parseInt(`${aB}${mB}`) - parseInt(`${aA}${mA}`)
    }))
  }

  const toggleExpandir = (filho: any) => {
    if (filhoExpandido === filho.id) { setFilhoExpandido(null); return }
    setFilhoExpandido(filho.id)
    calcularHistorico(filho).catch(console.error)
  }

  useEffect(() => {
    if (filhoExpandido) {
      const filhoAtualizado = ctrl.listaFilhos.find((f: any) => f.id === filhoExpandido)
      if (filhoAtualizado) calcularHistorico(filhoAtualizado).catch(console.error)
    }
  }, [ctrl.listaFilhos, filhoExpandido])

  // --- Filtro de membros exibidos ---
  const filhosExibidos = ctrl.listaFilhos.filter((f: any) => {
    const statusCerto = abaInativos ? f.ativo === false : f.ativo !== false
    const nomeBate = f.nome.toLowerCase().includes(termoBusca.toLowerCase())
    return statusCerto && nomeBate
  })

  // --- Login ---
  if (!ctrl.session) return <Login />

  // --- Render ---
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand-container">
          <img src="/logo.png" alt="Logo TTZ" className="brand-logo" onError={(e) => (e.currentTarget.style.display = 'none')} />
          <h2>TTZ GESTAO</h2>
          <h5>Terreiro de Umbanda<br />Baiana Terezinha e Ze Pelintra</h5>
        </div>
        <nav>
          <button className={`nav-item ${ctrl.telaAtiva === 'dashboard' ? 'active' : ''}`} onClick={() => ctrl.setTelaAtiva('dashboard')}>
            <LayoutDashboard size={24} /> Inicio
          </button>
          <button className={`nav-item ${ctrl.telaAtiva === 'filhos' ? 'active' : ''}`} onClick={() => { ctrl.setTelaAtiva('filhos'); setMostrarFormFilho(false) }}>
            <Users size={24} /> Membros
          </button>
          <button className={`nav-item ${ctrl.telaAtiva === 'financeiro' ? 'active' : ''}`} onClick={() => ctrl.setTelaAtiva('financeiro')}>
            <Wallet size={24} /> Caixa
          </button>
          <button className={`nav-item ${ctrl.telaAtiva === 'vendas' ? 'active' : ''}`} onClick={() => ctrl.setTelaAtiva('vendas')}>
            <Store size={24} /> Lojinha
          </button>
          <button className={`nav-item ${ctrl.telaAtiva === 'festas' ? 'active' : ''}`} onClick={() => ctrl.setTelaAtiva('festas')}>
            <PartyPopper size={24} /> Festas
          </button>
          <button className={`nav-item ${ctrl.telaAtiva === 'relatorios' ? 'active' : ''}`} onClick={() => ctrl.setTelaAtiva('relatorios')}>
            <FileText size={24} /> Relatorios
          </button>
        </nav>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div className="header-top">
            <h1>
              {ctrl.telaAtiva === 'dashboard' ? 'Painel Geral' :
                ctrl.telaAtiva === 'filhos' ? 'Gestao da Corrente' :
                  ctrl.telaAtiva === 'perfil' ? 'Meu Perfil' :
                    ctrl.telaAtiva === 'vendas' ? 'Lojinha do Terreiro' :
                      ctrl.telaAtiva === 'festas' ? 'Gestao de Festas' : 'Fluxo de Caixa'}
            </h1>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="theme-toggle-btn" onClick={alternarTema} title="Mudar Tema">
                {tema === 'light' ? <Moon size={22} /> : <Sun size={22} />}
              </button>
              <button className="theme-toggle-btn" onClick={() => ctrl.setTelaAtiva('perfil')} title="Meu Perfil">
                <User size={22} />
              </button>
              <button className="theme-toggle-btn" onClick={ctrl.handleLogout} title="Sair do Sistema" style={{ color: 'var(--danger)' }}>
                <LogOut size={22} />
              </button>
            </div>
          </div>
          <div className="header-actions">
            {ctrl.telaAtiva === 'filhos' && isAdmin && (
              <button className="btn-primary" onClick={() => { setMostrarFormFilho(!mostrarFormFilho); setFilhoEditando(null) }}>
                {mostrarFormFilho ? <><List size={20} /> Ver Lista Completa</> : <><UserPlus size={20} /> Adicionar Novo Filho</>}
              </button>
            )}
            <div className="filter-box">
              <CalendarDays size={20} color="var(--primary)" />
              <select value={ctrl.mesAtual} onChange={e => ctrl.setMesAtual(e.target.value)}>
                {ctrl.mesesDisponiveis.map((m: any) => <option key={m.valor} value={m.valor}>{m.label}</option>)}
              </select>
            </div>
          </div>
        </header>

        {/* ============ DASHBOARD ============ */}
        {ctrl.telaAtiva === 'dashboard' && ctrl.dashboardData && (
          <div style={{ width: '100%' }}>
            <section className="stats-grid">
              <div className="stat-card blue">
                <h3>Total Entradas ({ctrl.mesAtual})</h3>
                <div className="stat-value">R$ {ctrl.dashboardData.totalBruto.toFixed(2)}</div>
              </div>
              <div className="stat-card red">
                <h3>Total Saidas ({ctrl.mesAtual})</h3>
                <div className="stat-value">R$ {ctrl.dashboardData.gastos.toFixed(2)}</div>
              </div>
              <div className="stat-card green">
                <h3>Saldo em Conta (Total)</h3>
                <div className="stat-value">R$ {ctrl.dashboardData.saldoAcumulado.toFixed(2)}</div>
                <div style={{ fontSize: '0.85rem', marginTop: '8px', opacity: 0.9, fontWeight: 500 }}>
                  Saldo do mes filtrado: R$ {ctrl.dashboardData.lucro.toFixed(2)}
                </div>
              </div>
            </section>

            <div className="dashboard-grid">
              <div className="table-container">
                <h3><AlertCircle size={22} color="var(--warning)" /> Mensalidades em Aberto</h3>
                <div className="table-responsive">
                  <table style={{ tableLayout: 'fixed', width: '100%' }}>
                    <thead><tr><th style={{ width: '65%' }}>Nome do Membro</th><th style={{ width: '35%' }}>Situacao</th></tr></thead>
                    <tbody>
                      {ctrl.dashboardData.devedores.length === 0 ? (
                        <tr><td colSpan={2} style={{ textAlign: 'center', color: 'var(--success)', fontWeight: 'bold', padding: '20px' }}>Nenhuma pendencia encontrada.</td></tr>
                      ) : (
                        ctrl.dashboardData.devedores.map((p: any) => (
                          <tr key={p.id}>
                            <td data-label="Membro" style={{ wordBreak: 'break-word' }}><strong>{p.nome}</strong></td>
                            <td data-label="Situacao">
                              {p.statusCalc === 'VENCIDA' ? (
                                <span className="badge-status" style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
                                  <AlertTriangle size={14} /> VENCIDA
                                </span>
                              ) : (
                                <span className="badge-status" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)', border: '1px solid var(--warning)' }}>
                                  <Clock size={14} /> PENDENTE
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="table-container">
                <h3><CheckCircle2 size={22} color="var(--success)" /> Mensalidades Recebidas</h3>
                <div className="table-responsive">
                  <table style={{ tableLayout: 'fixed', width: '100%' }}>
                    <thead><tr><th style={{ width: '65%' }}>Nome do Membro</th><th style={{ width: '35%' }}>Data Pgto</th></tr></thead>
                    <tbody>
                      {ctrl.dashboardData.pagantes.length === 0 ? (
                        <tr><td colSpan={2} style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 'bold', padding: '20px' }}>Nenhum pagamento recebido ainda.</td></tr>
                      ) : (
                        ctrl.dashboardData.pagantes.map((p: any) => (
                          <tr key={p.id}>
                            <td data-label="Membro" style={{ wordBreak: 'break-word' }}>
                              <strong>{p.nome}</strong>
                              {p.is_isencao && (
                                <span style={{ marginLeft: '8px', fontSize: '0.7rem', color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.1)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', display: 'inline-block', marginTop: '4px' }}>
                                  ISENTO
                                </span>
                              )}
                            </td>
                            <td data-label="Data Pgto" style={{ color: 'var(--success)', fontWeight: 'bold' }}>
                              {formatarData(p.data_pagamento)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============ MEMBROS ============ */}
        {ctrl.telaAtiva === 'filhos' && (
          <div style={{ width: '100%' }}>
            {mostrarFormFilho ? (
              <div className="table-container" style={{ maxWidth: '850px', margin: '0 auto' }}>
                <CadastroFilho
                  filhoEditando={filhoEditando}
                  onSucesso={() => { setMostrarFormFilho(false) }}
                  onCancelar={() => setMostrarFormFilho(false)}
                />
              </div>
            ) : (
              <div className="table-container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0 }}>
                      <Users size={22} color={abaInativos ? 'var(--text-muted)' : 'var(--primary)'} />
                      {abaInativos ? 'Arquivo Morto (Inativos)' : 'Corrente Ativa'}
                    </h3>
                    <button
                      onClick={() => setAbaInativos(!abaInativos)}
                      style={{
                        background: abaInativos ? 'var(--primary-light)' : 'var(--bg-sub)',
                        color: abaInativos ? 'var(--primary)' : 'var(--text-muted)',
                        border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '8px',
                        cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px'
                      }}>
                      {abaInativos ? <UserCheck size={16} /> : <UserMinus size={16} />}
                      {abaInativos ? 'Voltar para Ativos' : 'Ver Inativos'}
                    </button>
                  </div>
                  <div className="input-with-icon" style={{ maxWidth: '300px' }}>
                    <Search size={20} className="input-icon" style={{ color: 'var(--primary)' }} />
                    <input
                      type="text"
                      placeholder="Buscar membro..."
                      value={termoBusca}
                      onChange={(e) => setTermoBusca(e.target.value)}
                      style={{ borderRadius: '20px' }}
                    />
                  </div>
                </div>

                <div className="table-responsive">
                  <table style={{ tableLayout: 'fixed', width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '50px' }}></th>
                        <th style={{ width: 'auto' }}>Nome Completo</th>
                        <th style={{ width: '110px' }}>Vencimento</th>
                        <th style={{ textAlign: 'center', width: '120px' }}>Gestao</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filhosExibidos.length === 0 ? (
                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Nenhum membro encontrado na lista de {abaInativos ? 'Inativos' : 'Ativos'}.</td></tr>
                      ) : (
                        filhosExibidos.map((f: any) => (
                          <React.Fragment key={f.id}>
                            <tr
                              className={`main-row ${filhoExpandido === f.id ? 'is-expanded' : ''}`}
                              onClick={() => toggleExpandir(f)}
                              style={{ cursor: 'pointer', opacity: f.ativo === false ? 0.7 : 1 }}
                            >
                              <td style={{ textAlign: 'center' }}>{filhoExpandido === f.id ? <ChevronUp size={22} color="var(--text-muted)" /> : <ChevronDown size={22} color="var(--text-muted)" />}</td>
                              <td data-label="Nome" style={{ fontWeight: 700 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  {f.foto_url ? (
                                    <img src={f.foto_url} alt="Foto" style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                                  ) : (
                                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--bg-sub)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><User size={16} /></div>
                                  )}
                                  <span style={{ wordBreak: 'break-word' }}>{f.nome}</span>
                                </div>
                              </td>
                              <td data-label="Vencimento">Dia {f.dia_vencimento || 10}</td>
                              <td data-label="Acoes" className="action-cell" onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                                {isAdmin ? (
                                  <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', alignItems: 'center' }}>
                                    {f.ativo !== false ? (
                                      <>
                                        <button onClick={() => { setFilhoEditando(f); setMostrarFormFilho(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer' }} title="Editar Ficha"><Pencil size={20} color="var(--warning)" /></button>
                                        <button onClick={() => ctrl.alternarAtivo(f.id, false, f.nome)} style={{ background: 'none', border: 'none', cursor: 'pointer' }} title="Desligar Membro"><UserMinus size={20} color="var(--danger)" /></button>
                                      </>
                                    ) : (
                                      <>
                                        <button onClick={() => ctrl.alternarAtivo(f.id, true, f.nome)} style={{ background: 'var(--success)', color: 'white', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }} title="Reativar Membro">
                                          <UserCheck size={16} />
                                        </button>
                                        <button onClick={() => ctrl.excluirFilhoDefinitivo(f.id, f.nome)} style={{ background: 'none', border: 'none', cursor: 'pointer' }} title="Excluir Permanentemente">
                                          <Trash2 size={20} color="var(--danger)" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                ) : (
                                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 'bold' }}>SOMENTE LEITURA</div>
                                )}
                              </td>
                            </tr>

                            {filhoExpandido === f.id && (
                              <tr className="expanded-crm-row">
                                <td colSpan={4}>
                                  <div className="crm-box">
                                    <div className="crm-grid">
                                      <div className="crm-profile">
                                        {f.foto_url ? (
                                          <img src={f.foto_url} alt={f.nome} style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)', marginBottom: '15px' }} />
                                        ) : (
                                          <div className="crm-avatar"><Camera size={35} /></div>
                                        )}
                                        <h4 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '5px', wordBreak: 'break-word' }}>{f.nome}</h4>
                                        <div style={{ marginBottom: '12px' }}>
                                          <span style={{ background: 'var(--bg-main)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-dark)', border: '1px solid var(--border)' }}>
                                            {f.cargo || 'Medium'}
                                          </span>
                                        </div>
                                        {f.ativo === false ? (
                                          <span className="badge-status badge-pendente">MEMBRO INATIVO</span>
                                        ) : f.isento ? (
                                          <span className="badge-status badge-isento">ISENTO DE MENSALIDADE</span>
                                        ) : (
                                          <span className="badge-status badge-pago">ATIVO NA CORRENTE</span>
                                        )}
                                        <div style={{ marginTop: '20px', textAlign: 'left' }}>
                                          <div className="crm-info-item"><span>ID de Registo:</span> <strong>#{f.id}</strong></div>
                                          <div className="crm-info-item"><span>Dia de Vencimento:</span> <strong>Dia {f.dia_vencimento || 10}</strong></div>
                                          <div className="crm-info-item"><span>Data de Nascimento:</span> <strong>{formatarData(f.data_nascimento)}</strong></div>
                                          <div className="crm-info-item"><span>Entrou na Casa em:</span> <strong>{formatarData(f.data_entrada)}</strong></div>
                                        </div>
                                      </div>
                                      <div className="crm-history">
                                        <h4 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}><Wallet size={20} color="var(--success)" /> Historico Financeiro</h4>
                                        <div className="history-scroll">
                                          <table style={{ minWidth: '100%' }}>
                                            <thead><tr><th>Mes Ref.</th><th>Status</th><th>Data Pagamento</th></tr></thead>
                                            <tbody>
                                              {historicoMensalidades.map((h: any, i: number) => (
                                                <tr key={i} style={{ marginBottom: '0', padding: '10px', boxShadow: 'none', borderBottom: '1px solid var(--border)', borderRadius: '0' }}>
                                                  <td data-label="Mes Ref."><strong>{h.ref}</strong></td>
                                                  <td data-label="Status">
                                                    {h.status === 'PAGO' && <span className="badge-status badge-pago"><CheckCircle2 size={14} /> PAGO</span>}
                                                    {h.status === 'PENDENTE' && <span className="badge-status" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)', border: '1px solid var(--warning)' }}><Clock size={14} /> PENDENTE</span>}
                                                    {h.status === 'VENCIDA' && <span className="badge-status" style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', border: '1px solid var(--danger)' }}><AlertTriangle size={14} /> VENCIDA</span>}
                                                    {h.status === 'ADIANTADO' && <span className="badge-status badge-adiantado"><FastForward size={14} /> ADIANTADO</span>}
                                                    {h.status === 'ISENTO' && <span className="badge-status badge-isento">ISENTO</span>}
                                                    {h.status === 'INCONSISTENTE' && <span className="badge-status" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', border: '1px solid #8b5cf6' }}><AlertCircle size={14} /> INCONSISTENTE</span>}
                                                  </td>
                                                  <td data-label="Data Pgto">{formatarData(h.dt)}</td>
                                                </tr>
                                              ))}
                                              {historicoMensalidades.length === 0 && (
                                                <tr><td colSpan={3} style={{ textAlign: 'center', padding: '20px' }}>Sem historico gerado.</td></tr>
                                              )}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============ OUTRAS TELAS ============ */}
        {ctrl.telaAtiva === 'vendas' && <GestaoVendas isAdmin={isAdmin} />}
        {ctrl.telaAtiva === 'financeiro' && <LancamentoFinanceiro mesFiltro={ctrl.mesAtual} isAdmin={isAdmin} />}
        {ctrl.telaAtiva === 'festas' && <GestaoFestas isAdmin={isAdmin} />}
        {ctrl.telaAtiva === 'perfil' && <PerfilUsuario session={ctrl.session} />}
        {ctrl.telaAtiva === 'relatorios' && <Relatorios />}
      </main>
    </div>
  )
}