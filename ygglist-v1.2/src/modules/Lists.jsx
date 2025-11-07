import React, { useEffect, useMemo, useState } from 'react';
import catalog from '../data/ygg_items.json';
import { STORAGE_KEY, PURCHASES_KEY, fmtBRL, uid, todayISO, load, save, catIcon, toNumber } from '../lib.js';

function FallbackBadge({ name }) {
  return (
    <div className="w-8 h-8 rounded-full bg-ygg-700 text-white flex items-center justify-center text-sm">
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}
const iconFor = (it) => it.icon || catIcon[it.category] || null;
const findCatalog = (name) => catalog.find(x => x.name.toLowerCase() === name.toLowerCase());

export default function Lists() {
  const [data, setData] = useState(() => load(STORAGE_KEY, {}));
  const [dateISO, setDateISO] = useState(todayISO());
  const [store, setStore] = useState('');

  // helper para escrever o "dia" atual dentro do STORAGE_KEY
  const setDay = (up) =>
    setData(p => ({
      ...p,
      [dateISO]: up(p[dateISO] ?? { dateISO, items: [], store: '' })
    }));

  // snapshot do dia atual (sempre com chave store)
  const day = useMemo(
    () => data[dateISO] ?? { dateISO, items: [], store: '' },
    [data, dateISO]
  );

  // persiste o STORAGE sempre que "data" muda
  useEffect(() => { save(STORAGE_KEY, data); }, [data]);

  // ao trocar a data, carregue a loja salva naquele dia
  useEffect(() => {
    setStore(day.store || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateISO]);

  // quando usuário trocar a loja, reflita no dia atual
  useEffect(() => {
    setDay(prev => ({ ...prev, store }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  const [name, setName] = useState('');
  const [qty, setQty] = useState(1);
  const [unit, setUnit] = useState('un');
  const [price, setPrice] = useState('');
  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');
  const [showSuggest, setShowSuggest] = useState(false);
  const [draft, setDraft] = useState({});

  const toBuy = day.items
    .filter(i => !i.inCart)
    .sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name));

  const cart = day.items
    .filter(i => i.inCart)
    .sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name));

  const lastPriceFor = (n) => {
    const all = Object.values(data)
      .flatMap(d => d.items)
      .filter(i => i.name.toLowerCase() === n.toLowerCase() && typeof i.price === 'number');
    const s = all.sort((a, b) => b.createdAt - a.createdAt)[0];
    return s?.price;
  };

  function addItem() {
    const nm = (name || '').trim(); if (!nm) return;
    const cat = findCatalog(nm)?.category ?? 'Outros';
    const kcal = findCatalog(nm)?.kcalPer100;
    const icon = findCatalog(nm)?.icon;
    const cur = findCatalog(nm)?.curiosity;

    const item = {
      id: uid(),
      name: nm,
      qty: qty || 1,
      unit,
      price: toNumber(price),
      weight: toNumber(weight),
      note: note || cur || undefined,
      icon,
      kcalPer100: kcal,
      category: cat,
      store: store || '',      // <<< herda a loja do dia
      inCart: false,
      createdAt: Date.now()
    };

    setDay(prev => ({ ...prev, items: [item, ...prev.items] }));
    setName(''); setQty(1); setUnit('un'); setPrice(''); setWeight(''); setNote(''); setShowSuggest(false);
  }

  const toggleCart = (id, val) =>
    setDay(prev => ({ ...prev, items: prev.items.map(i => i.id === id ? { ...i, inCart: val } : i) }));

  const updateItem = (id, patch) =>
    setDay(prev => ({ ...prev, items: prev.items.map(i => i.id === id ? { ...i, ...patch } : i) }));

  const removeItem = (id) =>
    setDay(prev => ({ ...prev, items: prev.items.filter(i => i.id !== id) }));

  const total = (list) => list.reduce((a, i) => a + (i.price || 0) * (i.qty || 1), 0);

  const suggestions = name.length > 0
    ? catalog.filter(x => x.name.toLowerCase().includes(name.toLowerCase())).slice(0, 10)
    : [];

  const pickSuggestion = (s) => {
    setName(s.name);
    setUnit('un');
    setNote(s.curiosity || '');
    setShowSuggest(false);
  };

  const setDraftField = (id, field, val) =>
    setDraft(d => ({ ...d, [id]: { ...(d[id] || {}), [field]: val } }));

  const commitDraft = (id) => {
    const d = draft[id] || {};
    const patch = {};
    if (d.qty != null) patch.qty = Number(d.qty);
    if (d.unit) patch.unit = d.unit;
    if (d.price != null) patch.price = toNumber(d.price);
    if (d.weight != null) patch.weight = toNumber(d.weight);
    if (d.note != null) patch.note = d.note;
    updateItem(id, patch);
  };

  const ItemRow = ({ i, inCartView }) => {
    const icon = iconFor(i);
    const d = draft[i.id] || {};
    return (
      <div className="border rounded-xl p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon ? <div className="text-2xl">{icon}</div> : <FallbackBadge name={i.name} />}
            <div>
              <div className="font-medium">{i.name}</div>
              <div className="text-xs text-slate-500">
                {i.category}{i.store ? ` • ${i.store}` : ''}
              </div>
            </div>
          </div>
          <div className="text-sm">
            {typeof i.price === 'number' ? fmtBRL(i.price * (i.qty || 1)) : '—'}
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 md:grid-cols-6 gap-2 text-sm">
          <input type="number" value={d.qty ?? i.qty} onChange={e => setDraftField(i.id, 'qty', e.target.value)} className="border rounded-lg px-2 py-1" />
          <select value={d.unit ?? i.unit} onChange={e => setDraftField(i.id, 'unit', e.target.value)} className="border rounded-lg px-2 py-1">
            <option>un</option><option>kg</option><option>g</option><option>L</option><option>mL</option>
            <option>pacote</option><option>caixa</option><option>saco</option><option>bandeja</option>
            <option>garrafa</option><option>lata</option><option>outro</option>
          </select>
          <input value={d.price ?? (i.price ?? '')} onChange={e => setDraftField(i.id, 'price', e.target.value)} placeholder="Preço" className="border rounded-lg px-2 py-1" />
          <input value={d.weight ?? (i.weight ?? '')} onChange={e => setDraftField(i.id, 'weight', e.target.value)} placeholder="Peso" className="border rounded-lg px-2 py-1" />
          <input value={d.note ?? (i.note ?? '')} onChange={e => setDraftField(i.id, 'note', e.target.value)} placeholder="Obs." className="border rounded-lg px-2 py-1" />
          <button onClick={() => commitDraft(i.id)} className="px-3 py-1 rounded-lg bg-ygg-700 text-white">✓</button>
        </div>

        <div className="mt-2 text-xs text-slate-500">
          {i.kcalPer100
            ? `${i.kcalPer100} kcal/100g`
            : (lastPriceFor(i.name)
              ? `Último: ${fmtBRL(lastPriceFor(i.name))}`
              : (findCatalog(i.name)?.curiosity || ''))}
        </div>

        <div className="mt-2 flex items-center gap-2">
          {inCartView
            ? <button onClick={() => toggleCart(i.id, false)} className="px-3 py-2 rounded-lg bg-slate-200 text-sm">Voltar p/ Lista</button>
            : <button onClick={() => toggleCart(i.id, true)} className="px-3 py-2 rounded-lg bg-ygg-700 text-white text-sm">Adicionar ao Carrinho</button>}
          <button onClick={() => removeItem(i.id)} className="px-3 py-2 rounded-lg border text-sm">Remover</button>
        </div>
      </div>
    );
  };

  const finalizePurchase = () => {
    if (cart.length === 0) return;

    const purchases = load(PURCHASES_KEY, []);
    const dayStore = day.store || store || '';

    // garante store em cada item salvo
    const cartWithStore = cart.map(i => ({ ...i, store: i.store || dayStore }));

    purchases.push({
      id: uid(),
      dateISO,
      store: dayStore,                 // <<< loja/mercado desta compra
      items: cartWithStore,
      total: total(cartWithStore),
      createdAt: Date.now()
    });

    save(PURCHASES_KEY, purchases);

    // limpa só o inCart dos itens finalizados
    setDay(prev => ({
      ...prev,
      items: prev.items.map(i => cart.find(c => c.id === i.id) ? { ...i, inCart: false } : i)
    }));

    alert('Compra finalizada e salva!');
  };

  return (
    <section className="space-y-4">
      <div className="bg-white rounded-2xl border shadow-sm p-4 flex items-end gap-3 flex-wrap">
        <div>
          <label className="text-sm">Dia</label>
          <input type="date" value={dateISO} onChange={e => setDateISO(e.target.value)} className="border rounded-lg px-3 py-2" />
        </div>

        <div>
          <label className="text-sm">Loja / Mercado</label>
          <input
            type="text"
            value={store}
            onChange={(e) => setStore(e.target.value)}
            placeholder="Ex.: Supermercado X, Atacado Y"
            className="border rounded-lg px-3 py-2"
          />
        </div>

        <div className="flex-1 min-w-[200px] relative">
          <label className="text-sm">Item</label>
          <input
            value={name}
            onChange={e => { setName(e.target.value); setShowSuggest(true); }}
            onFocus={() => setShowSuggest(true)}
            placeholder="Digite o item..."
            className="w-full border rounded-lg px-3 py-2"
          />
          {showSuggest && suggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 border rounded-lg bg-white shadow-sm p-2 text-sm max-h-56 overflow-auto">
              {suggestions.map(s => (
                <button
                  key={s.name}
                  onClick={() => pickSuggestion(s)}
                  className="block w-full text-left p-1 rounded hover:bg-ygg-100"
                >
                  {s.name} • <span className="text-xs text-slate-500">{s.category}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-sm">Qtd</label>
          <input type="number" min={0} step={1} value={qty} onChange={e => setQty(Number(e.target.value))} className="w-20 border rounded-lg px-3 py-2" />
        </div>

        <div>
          <label className="text-sm">Tipo</label>
          <select value={unit} onChange={e => setUnit(e.target.value)} className="border rounded-lg px-3 py-2">
            <option>un</option><option>kg</option><option>g</option><option>L</option><option>mL</option>
            <option>pacote</option><option>caixa</option><option>saco</option><option>bandeja</option>
            <option>garrafa</option><option>lata</option><option>outro</option>
          </select>
        </div>

        <div>
          <label className="text-sm">Preço (R$)</label>
          <input value={price} onChange={e => setPrice(e.target.value)} inputMode="decimal" placeholder="5,99" className="w-28 border rounded-lg px-3 py-2" />
        </div>

        <div>
          <label className="text-sm">Peso</label>
          <input value={weight} onChange={e => setWeight(e.target.value)} inputMode="decimal" placeholder="Opcional" className="w-28 border rounded-lg px-3 py-2" />
        </div>

        <div className="flex-1 min-w-[160px]">
          <label className="text-sm">Observação</label>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Marca X, maturação, etc." className="w-full border rounded-lg px-3 py-2" />
        </div>

        <div>
          <label className="text-sm invisible">.</label>
          <button onClick={() => addItem()} className="px-4 py-2 rounded-lg bg-ygg-700 text-white">✓ Adicionar</button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2"><span>📝</span><h3 className="font-semibold">Lista</h3></div>
          <div className="text-sm text-slate-600 mb-2">Total: {fmtBRL(total(toBuy))}</div>
          <div className="space-y-2">
            {toBuy.map(i => <ItemRow key={i.id} i={i} inCartView={false} />)}
            {toBuy.length === 0 && <p className="text-sm text-slate-500">Nada aqui por enquanto.</p>}
          </div>
        </div>

        <div className="bg-white rounded-2xl border shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2"><span>🛒</span><h3 className="font-semibold">Carrinho</h3></div>
          <div className="text-sm text-slate-600 mb-2">Total: {fmtBRL(total(cart))}</div>
          <div className="space-y-2">
            {cart.map(i => <ItemRow key={i.id} i={i} inCartView={true} />)}
            {cart.length === 0 && <p className="text-sm text-slate-500">Nenhum item no carrinho.</p>}
          </div>
          <div className="mt-3">
            <button onClick={() => finalizePurchase()} className="px-4 py-3 rounded-xl bg-emerald-600 text-white w-full">
              ✅ Compra finalizada (salvar)
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
