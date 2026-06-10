// ============================================================
// Model - Operações de Festas/Eventos
// Funções de acesso aos dados de festas no Supabase
// ============================================================

import { supabase } from '../config/supabase'
import type { Festa } from './types'

// Busca todas as festas, ordenadas por data (mais recente primeiro)
async function buscarTodas(): Promise<Festa[]> {
  const { data, error } = await supabase
    .from('festas')
    .select('*')
    .order('data_evento', { ascending: false })

  if (error) throw error
  return data || []
}

// Busca apenas festas ativas
async function buscarAtivas(): Promise<Festa[]> {
  const { data, error } = await supabase
    .from('festas')
    .select('*')
    .eq('ativa', true)
    .order('data_evento', { ascending: false })

  if (error) throw error
  return data || []
}

// Busca festas que possuem movimentações financeiras no mês
async function buscarFestasComMovimentacao(mesReferencia: string): Promise<Festa[]> {
  const { data: movs } = await supabase
    .from('financeiro')
    .select('festa_id')
    .eq('mes_referencia', mesReferencia)
    .not('festa_id', 'is', null)

  const ids = [...new Set((movs || []).map((m: any) => m.festa_id))]
  if (ids.length === 0) return []

  const { data: festas } = await supabase
    .from('festas')
    .select('id, nome')
    .in('id', ids)

  return (festas || []) as Festa[]
}

export const EventModel = {
  buscarTodas,
  buscarAtivas,
  buscarFestasComMovimentacao
}