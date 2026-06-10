// ============================================================
// Model - Operações Financeiras
// Funções de acesso aos dados financeiros no Supabase
// ============================================================

import { supabase } from '../config/supabase'
import type { Financeiro, MembroPagante, DevedorPendente, MesDisponivel } from './types'

// Normaliza datas para YYYY-MM-DD (trata formato DD/MM/YYYY)
function normalizarData(dataStr: string): string {
  if (dataStr.includes('/')) {
    const [d, m, a] = dataStr.split('/')
    return `${a}-${m}-${d}`
  }
  return dataStr.split('T')[0]
}

// Formata data para DD/MM/YYYY para exibição
function formatarData(dataStr: string): string {
  if (!dataStr) return ''
  const limpa = dataStr.split('T')[0]
  if (limpa.includes('/')) {
    const [d, m, a] = limpa.split('/')
    return `${d}/${m}/${a}`
  }
  const [a, m, d] = limpa.split('-')
  return `${d}/${m}/${a}`
}

// Carrega todos os registros financeiros
async function carregarTodos(): Promise<Financeiro[]> {
  const { data, error } = await supabase
    .from('financeiro')
    .select('*')
    .order('data_pagamento', { ascending: true })

  if (error) throw error
  return data || []
}

// Busca membros que pagaram no mês corrente
async function buscarPagantesMes(mesAtual: string): Promise<MembroPagante[]> {
  const { data: pagamentos } = await supabase
    .from('financeiro')
    .select('filho_id, data_pagamento, valor, is_isencao')
    .eq('mes_referencia', mesAtual)
    .eq('tipo', 'ENTRADA')

  return (pagamentos || []).map((p: any) => ({
    id: p.filho_id,
    nome: '',
    data_pagamento: p.data_pagamento,
    is_isencao: p.is_isencao
  }))
}

// Busca membros que NÃO pagaram no mês corrente
async function buscarDevedoresMes(
  mesAtual: string,
  listaFilhos: any[]
): Promise<DevedorPendente[]> {
  const { data: pagamentos } = await supabase
    .from('financeiro')
    .select('filho_id, data_pagamento, valor')
    .eq('mes_referencia', mesAtual)
    .eq('tipo', 'ENTRADA')

  const pagaramIds = new Set((pagamentos || []).map((p: any) => p.filho_id))

  const [mesRef, anoRef] = mesAtual.split('/')
  const mesRefNum = parseInt(anoRef) * 100 + parseInt(mesRef)
  const hoje = new Date()
  const diaAtual = hoje.getDate()
  const mesAtualNum = (hoje.getFullYear()) * 100 + (hoje.getMonth() + 1)

  const devedores = listaFilhos
    .filter((f: any) => {
      if (f.isento || pagaramIds.has(f.id)) return false
      if (f.data_entrada) {
        const dataLimpa = f.data_entrada.split('T')[0]
        const partesE = dataLimpa.includes('/') ? dataLimpa.split('/') : dataLimpa.split('-')
        const entradaNum = parseInt(dataLimpa.includes('/') ? partesE[2] : partesE[0]) * 100 + parseInt(partesE[1])
        if (entradaNum > mesRefNum) return false
      }
      if (f.ativo === false && f.data_saida) {
        const dataLimpaS = f.data_saida.split('T')[0]
        const partesS = dataLimpaS.includes('/') ? dataLimpaS.split('/') : dataLimpaS.split('-')
        const saidaNum = parseInt(dataLimpaS.includes('/') ? partesS[2] : partesS[0]) * 100 + parseInt(partesS[1])
        if (saidaNum < mesRefNum) return false
      }
      return true
    })
    .map((f: any) => {
      let status: 'VENCIDA' | 'PENDENTE' = 'PENDENTE'
      if (mesAtualNum <= mesRefNum) {
        if (diaAtual > (f.dia_vencimento || 10)) {
          status = 'VENCIDA'
        }
      }
      return { id: f.id, nome: f.nome, statusCalc: status }
    })

  return devedores
}

// Busca os valores recebidos no mês corrente de cada filho
async function buscarValoresRecebidos(
  mesAtual: string,
  listaFilhos: any[]
): Promise<Record<number, number>> {
  const { data: recibos } = await supabase
    .from('financeiro')
    .select('filho_id, valor')
    .eq('mes_referencia', mesAtual)
    .eq('tipo', 'ENTRADA')
    .not('filho_id', 'is', null)

  const mapaValores: Record<number, number> = {}
  const pagaram = new Set<number>()

  ;(recibos || []).forEach((r: any) => {
    if (r.filho_id) {
      if (!mapaValores[r.filho_id]) {
        mapaValores[r.filho_id] = r.valor
        pagaram.add(r.filho_id)
      } else {
        mapaValores[r.filho_id] += r.valor
      }
    }
  })

  listaFilhos.forEach((f: any) => {
    if (!mapaValores[f.id] && !f.isento) {
      mapaValores[f.id] = 50
    }
  })

  return mapaValores
}

// Busca os totais mensais (entradas e saídas) de cada mês
async function buscarTotaisMensais(
  mesesDisponiveis: MesDisponivel[]
): Promise<Record<string, { entradas: number; saidas: number }>> {
  const totais: Record<string, { entradas: number; saidas: number }> = {}
  const mesesComDados = new Set<string>()

  for (const mes of mesesDisponiveis) {
    const { data } = await supabase
      .from('financeiro')
      .select('valor, tipo')
      .eq('mes_referencia', mes.valor)

    if (data && data.length > 0) {
      mesesComDados.add(mes.valor)
      let entradas = 0
      let saidas = 0
      data.forEach((m: any) => {
        if (m.tipo === 'ENTRADA') entradas += m.valor
        else saidas += m.valor
      })
      totais[mes.valor] = { entradas, saidas }
    }
  }

  return totais
}

// Busca os meses disponíveis que possuem dados no Supabase
async function buscarMesesDisponiveis(): Promise<MesDisponivel[]> {
  const { data } = await supabase
    .from('financeiro')
    .select('mes_referencia')

  const meses = new Set<string>()
  const hoje = new Date()
  meses.add(`${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`)

  ;(data || []).forEach((item: any) => {
    if (item.mes_referencia) meses.add(item.mes_referencia)
  })

  return Array.from(meses)
    .map((v: string) => {
      const [m, a] = v.split('/')
      return { valor: v, label: `${m}/${a}`, ordem: parseInt(`${a}${m}`) }
    })
    .sort((a, b) => b.ordem - a.ordem)
}

export const FinancialModel = {
  normalizarData,
  formatarData,
  carregarTodos,
  buscarPagantesMes,
  buscarDevedoresMes,
  buscarValoresRecebidos,
  buscarTotaisMensais,
  buscarMesesDisponiveis
}