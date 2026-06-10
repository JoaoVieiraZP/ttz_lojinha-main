// ============================================================
// Model - Operações de E-mails (Destinatários)
// Funções de acesso aos destinatários de relatório no Supabase
// ============================================================

import { supabase } from '../config/supabase'
import type { Destinatario } from './types'

// Busca todos os destinatários de e-mail
async function buscarTodos(): Promise<Destinatario[]> {
  const { data, error } = await supabase
    .from('destinatarios_relatorio')
    .select('*')
    .order('nome')

  if (error) throw error
  return data || []
}

// Adiciona um novo destinatário
async function adicionar(nome: string, email: string): Promise<void> {
  const { error } = await supabase
    .from('destinatarios_relatorio')
    .insert([{ nome, email, ativo: true }])

  if (error) throw error
}

// Alterna o status (ativo/inativo) de um destinatário
async function alternarStatus(id: string, statusAtual: boolean): Promise<void> {
  const { error } = await supabase
    .from('destinatarios_relatorio')
    .update({ ativo: !statusAtual })
    .eq('id', id)

  if (error) throw error
}

// Remove um destinatário permanentemente
async function remover(id: string): Promise<void> {
  const { error } = await supabase
    .from('destinatarios_relatorio')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export const EmailModel = {
  buscarTodos,
  adicionar,
  alternarStatus,
  remover
}