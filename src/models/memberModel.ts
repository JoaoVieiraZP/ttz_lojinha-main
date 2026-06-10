// ============================================================
// Model - Operações de Membros
// Funções de acesso aos dados dos filhos/espiritais no Supabase
// ============================================================

import { supabase } from '../config/supabase'
import type { Filho } from './types'

// Busca todos os membros, ordenados por nome
async function buscarTodos(): Promise<Filho[]> {
  const { data, error } = await supabase
    .from('filhos')
    .select('*')
    .order('nome')

  if (error) throw error
  return data || []
}

// Atualiza o status (ativo/inativo) de um membro
async function atualizarStatus(id: number, ativo: boolean): Promise<void> {
  const { error } = await supabase
    .from('filhos')
    .update({ ativo })
    .eq('id', id)

  if (error) throw error
}

// Exclui permanentemente um membro do banco
async function excluirPermanentemente(id: number): Promise<void> {
  const { error } = await supabase
    .from('filhos')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export const MemberModel = {
  buscarTodos,
  atualizarStatus,
  excluirPermanentemente
}