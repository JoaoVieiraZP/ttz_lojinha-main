// ============================================================
// Controller - Hook de Controle Principal
// Toda a logica de negocio e estado da aplicacao
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../config/supabase'
import { FinancialModel } from '../models/financialModel'
import { MemberModel } from '../models/memberModel'
import type { TelaAtiva, MesDisponivel, Filho, Financeiro } from '../models/types'

interface MembroPagante {
  id: number
  nome: string
  data_pagamento: string
  is_isencao: boolean
}

interface DevedorPendente {
  id: number
  nome?: string
  statusCalc?: 'VENCIDA' | 'PENDENTE'
}

interface DashboardData {
  totalBruto: number
  gastos: number
  lucro: number
  saldoAcumulado: number
  pagantes: MembroPagante[]
  devedores: DevedorPendente[]
  valores: MembroPagante[]
  valorRecebido: Record<number, number>
  totalMensalidades: number
  totalMembros: number
  totalIsentos: number
  totalNaoPagaram: number
}

export function useAppController() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [telaAtiva, setTelaAtiva] = useState<TelaAtiva>('dashboard')
  const [mesAtual, setMesAtual] = useState('')
  const [mesesDisponiveis, setMesesDisponiveis] = useState<MesDisponivel[]>([])
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [carregandoDashboard, setCarregandoDashboard] = useState(false)
  const [listaFilhos, setListaFilhos] = useState<Filho[]>([])
  const [listaFinanceiro, setListaFinanceiro] = useState<Financeiro[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    async function carregarDadosIniciais() {
      try {
        const meses = await FinancialModel.buscarMesesDisponiveis()
        setMesesDisponiveis(meses)
        if (meses.length > 0) setMesAtual(meses[0].valor)
        const filhos = await MemberModel.buscarTodos()
        setListaFilhos(filhos)
      } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error)
      }
    }
    carregarDadosIniciais()
  }, [session])

  useEffect(() => {
    if (!mesAtual || !session) return
    async function carregarDashboard() {
      setCarregandoDashboard(true)
      try {
        const financeiro = await FinancialModel.carregarTodos()
        setListaFinanceiro(financeiro)
        const pagantes = await FinancialModel.buscarPagantesMes(mesAtual)
        const devedores = await FinancialModel.buscarDevedoresMes(mesAtual, listaFilhos)
        const valorRecebido = await FinancialModel.buscarValoresRecebidos(mesAtual, listaFilhos)
        const movMes = financeiro.filter((m: any) => m.mes_referencia === mesAtual)
        const entradas = movMes.filter((m: any) => m.tipo === 'ENTRADA')
        const saidas = movMes.filter((m: any) => m.tipo === 'SAIDA')
        const totalBruto = entradas.reduce((acc: number, m: any) => acc + m.valor, 0)
        const gastos = saidas.reduce((acc: number, m: any) => acc + m.valor, 0)
        const lucro = totalBruto - gastos
        const saldoAcumulado = financeiro.reduce((acc: number, m: any) => {
          return m.tipo === 'ENTRADA' ? acc + m.valor : acc - m.valor
        }, 0)
        const totalMensalidades = entradas
          .filter((m: any) => m.categoria === 'MENSALIDADE')
          .reduce((acc: number, m: any) => acc + m.valor, 0)
        const totalMembros = listaFilhos.length
        const totalIsentos = listaFilhos.filter((f: any) => f.isento).length
        const totalNaoPagaram = devedores.length
        setDashboardData({
          totalBruto, gastos, lucro, saldoAcumulado, pagantes, devedores,
          valores: pagantes, valorRecebido, totalMensalidades,
          totalMembros, totalIsentos, totalNaoPagaram
        })
      } catch (error) {
        console.error('Erro ao carregar dashboard:', error)
      } finally {
        setCarregandoDashboard(false)
      }
    }
    carregarDashboard()
  }, [mesAtual, session, listaFilhos])

  const toggleFilhoStatus = useCallback(async (id: number, ativo: boolean) => {
    try {
      await MemberModel.atualizarStatus(id, !ativo)
      setListaFilhos(prev => prev.map(f => f.id === id ? { ...f, ativo: !ativo } : f))
    } catch (error) {
      console.error('Erro ao alterar status:', error)
    }
  }, [])

  const excluirFilho = useCallback(async (id: number) => {
    if (!window.confirm('Tem certeza que deseja excluir este registro? Essa acao nao pode ser desfeita.')) return
    try {
      await MemberModel.excluirPermanentemente(id)
      setListaFilhos(prev => prev.filter(f => f.id !== id))
    } catch (error) {
      console.error('Erro ao excluir:', error)
    }
  }, [])

  const handleLogin = useCallback(async (email: string, password: string) => {
    setLoading(true)
    await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
  }, [])

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setTelaAtiva('dashboard')
  }, [])

  const alternarAtivo = useCallback(async (id: number, ativo: boolean, nome: string) => {
    const acao = ativo ? 'reativar' : 'desligar'
    if (!window.confirm(`Deseja ${acao} ${nome} da corrente?`)) return
    try {
      await MemberModel.atualizarStatus(id, ativo)
      setListaFilhos((prev: Filho[]) => prev.map((f: Filho) => f.id === id ? { ...f, ativo } : f))
    } catch (error) {
      console.error(`Erro ao ${acao} membro:`, error)
    }
  }, [])

  const excluirFilhoDefinitivo = useCallback(async (id: number, nome: string) => {
    if (!window.confirm(`ATENCAO! Deseja EXCLUIR DEFINITIVAMENTE "${nome}"? Esta acao nao pode ser desfeita.`)) return
    try {
      await MemberModel.excluirPermanentemente(id)
      setListaFilhos((prev: Filho[]) => prev.filter((f: Filho) => f.id !== id))
    } catch (error) {
      alert('EXCLUSAO BLOQUEADA! O membro possui lancamentos vinculados. Mantenha-o como INATIVO.')
    }
  }, [])

  return {
    session,
    loading,
    telaAtiva,
    setTelaAtiva,
    mesAtual,
    setMesAtual,
    mesesDisponiveis,
    dashboardData,
    carregandoDashboard,
    listaFilhos,
    listaFinanceiro,
    toggleFilhoStatus,
    excluirFilho,
    excluirFilhoDefinitivo,
    alternarAtivo,
    handleLogin,
    handleLogout
  }
}
