// ============================================================
// Model - Definições de Tipos TypeScript
// Centraliza todas as interfaces e tipagens usadas no projeto
// ============================================================

export interface Filho {
  id: number
  nome: string
  data_nascimento: string
  data_entrada: string
  data_saida?: string
  dia_vencimento: number
  isento: boolean
  ativo: boolean
  cargo?: string
  foto_url?: string
}

export interface Financeiro {
  id: number
  tipo: 'ENTRADA' | 'SAIDA'
  valor: number
  mes_referencia: string
  filho_id: number | null
  festa_id: number | null
  categoria: string
  data_pagamento: string
  descricao?: string
  is_isencao?: boolean
}

export interface Festa {
  id: number
  nome: string
  data_evento: string
  meta_valor: number
  ativa: boolean
}

export interface ResumoFinanceiro {
  totalBruto: number
  gastos: number
  lucro: number
  saldoAcumulado: number
}

export interface MembroPagante {
  id: number
  nome: string
  data_pagamento: string
  is_isencao: boolean
}

export interface DevedorPendente {
  id: number
  nome?: string
  statusCalc?: 'VENCIDA' | 'PENDENTE'
}

export interface MesDisponivel {
  valor: string
  label: string
  ordem: number
}

export interface HistoricoMensalidade {
  ref: string
  status: 'PAGO' | 'PENDENTE' | 'VENCIDA' | 'ADIANTADO' | 'ISENTO' | 'INCONSISTENTE'
  dt: string | null
}

export interface Destinatario {
  id: string
  nome: string
  email: string
  ativo: boolean
}

export type TelaAtiva = 'dashboard' | 'filhos' | 'financeiro' | 'perfil' | 'festas' | 'relatorios' | 'vendas'