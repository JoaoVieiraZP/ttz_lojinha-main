import React, { useState } from 'react';
import { supabase } from '../config/supabase';
import { ShoppingCart, Save, Tag } from 'lucide-react';

export function GestaoVendas({ isAdmin }: { isAdmin: boolean }) {
  const [produto, setProduto] = useState('');
  const [valor, setValor] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const [salvando, setSalvando] = useState(false);

  // Sugestões de categorias rápidas
  const categoriasProdutos = ['Vela de 7 Dias', 'Vela Palito', 'Banho de Descarrego', 'Banho de Atração', 'Defumação', 'Ervas', 'Guia', 'Outros'];

  const registrarVenda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!produto || !valor) return alert('Por favor, preencha os dados do produto e valor.');
    
    setSalvando(true);
    
    const valorTotal = parseFloat(valor) * quantidade;
    const mesAtual = `${String(new Date().getMonth() + 1).padStart(2, '0')}/${new Date().getFullYear()}`;

    // Lança a venda como uma ENTRADA na tabela financeira existente
    const { error } = await supabase.from('financeiro').insert([{
      tipo: 'ENTRADA',
      valor: valorTotal,
      categoria: 'VENDAS',
      descricao: `Lojinha: ${quantidade}x ${produto}`,
      data_pagamento: new Date().toISOString(),
      mes_referencia: mesAtual
    }]);

    if (error) {
      console.error(error);
      alert('Erro ao registar a venda no sistema.');
    } else {
      alert('Venda registada no caixa com sucesso!');
      setProduto('');
      setValor('');
      setQuantidade(1);
    }
    
    setSalvando(false);
  };

  return (
    <div className="table-container" style={{ maxWidth: '850px', margin: '0 auto', padding: '30px' }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '25px' }}>
        <ShoppingCart size={28} color="var(--primary)" />
        Lojinha do Terreiro - Registar Venda
      </h3>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {categoriasProdutos.map(cat => (
          <button 
            key={cat}
            type="button"
            onClick={() => setProduto(cat)}
            style={{
              background: produto === cat ? 'var(--primary)' : 'var(--bg-sub)',
              color: produto === cat ? 'white' : 'var(--text-main)',
              border: '1px solid var(--border)',
              padding: '8px 12px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <Tag size={14} /> {cat}
          </button>
        ))}
      </div>

      <form onSubmit={registrarVenda} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        <div style={{ display: 'flex', gap: '15px', flexDirection: 'column' }}>
          <div>
            <label style={{ fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>Produto Vendido</label>
            <input 
              type="text" 
              value={produto} 
              onChange={e => setProduto(e.target.value)} 
              placeholder="Ex: Banho de Descarrego, Vela Branca..."
              required
              className="form-input"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>Quantidade</label>
            <input 
              type="number" 
              min="1"
              value={quantidade} 
              onChange={e => setQuantidade(parseInt(e.target.value))} 
              required
              className="form-input"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }}
            />
          </div>

          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>Valor Unitário (R$)</label>
            <input 
              type="number" 
              step="0.01" 
              min="0"
              value={valor} 
              onChange={e => setValor(e.target.value)} 
              placeholder="0.00"
              required
              className="form-input"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }}
            />
          </div>
        </div>

        <div style={{ background: 'var(--bg-sub)', padding: '20px', borderRadius: '8px', textAlign: 'right', borderLeft: '4px solid var(--success)' }}>
          <strong style={{ fontSize: '1.1rem' }}>Total da Venda: </strong>
          <span style={{ fontSize: '1.5rem', color: 'var(--success)', fontWeight: 'bold', marginLeft: '10px' }}>
            R$ {((parseFloat(valor) || 0) * quantidade).toFixed(2)}
          </span>
        </div>

        {isAdmin ? (
          <button type="submit" disabled={salvando} className="btn-primary" style={{ alignSelf: 'flex-start', padding: '12px 24px', fontSize: '1rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
            {salvando ? 'A Registar...' : <><Save size={20}/> Concluir Venda</>}
          </button>
        ) : (
          <div style={{ padding: '15px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold' }}>
            Apenas administradores podem registar vendas no sistema.
          </div>
        )}
      </form>
    </div>
  );
}