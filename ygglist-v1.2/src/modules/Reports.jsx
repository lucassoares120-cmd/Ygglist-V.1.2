
import React, {useEffect, useMemo, useState} from 'react';
import { PURCHASES_KEY, load, fmtBRL } from '../lib.js';
export default function Reports(){
  const [purchases, setPurchases] = useState(()=> load(PURCHASES_KEY, []));
  useEffect(()=>{ setPurchases(load(PURCHASES_KEY, [])); },[]);
  const byCategory = useMemo(()=>{ const m={}; for(const p of purchases){ for(const i of p.items){ const c=i.category||'Outros'; m[c]=(m[c]||0)+(i.price||0)*(i.qty||1); } } return Object.entries(m).sort((a,b)=> b[1]-a[1]); },[purchases]);
  const byMonth = useMemo(()=>{ const m={}; for(const p of purchases){ const k=p.dateISO.slice(0,7); m[k]=(m[k]||0)+(p.total||0); } return Object.entries(m).sort(); },[purchases]);
  const total = purchases.reduce((a,p)=> a+(p.total||0),0);
  return (
    <section className="space-y-4">
      <div className="bg-white rounded-2xl border shadow-sm p-4"><h3 className="font-semibold mb-2">Resumo Geral</h3><div className="text-sm text-slate-600">Total acumulado salvo: <strong>{fmtBRL(total)}</strong></div><p className="text-xs text-slate-500">Finalize compras na aba Listas para gerar estes dados.</p></div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border shadow-sm p-4"><h4 className="font-semibold mb-2">Por Categoria</h4><div className="space-y-1">{byCategory.map(([cat,val])=> <div key={cat} className="flex items-center justify-between text-sm"><span>{cat}</span><span>{fmtBRL(val)}</span></div>)}{byCategory.length===0 && <p className="text-sm text-slate-500">Sem dados ainda.</p>}</div></div>
        <div className="bg-white rounded-2xl border shadow-sm p-4"><h4 className="font-semibold mb-2">Por Mês</h4><div className="space-y-1">{byMonth.map(([m,val])=> <div key={m} className="flex items-center justify-between text-sm"><span>{m}</span><span>{fmtBRL(val)}</span></div>)}{byMonth.length===0 && <p className="text-sm text-slate-500">Sem dados ainda.</p>}</div></div>
      </div>
    </section>
  );
}
