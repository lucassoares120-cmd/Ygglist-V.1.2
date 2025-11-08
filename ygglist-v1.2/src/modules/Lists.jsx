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

  // Escreve o "dia" atual dentro do STORAGE_KEY
  const setDay = (up) =>
    setData(p => ({
      ...p,
      [dateISO]: up(p[dateISO] ?? { dateISO, items: [], store: '' })
    }));

  // Snapshot do dia atual (sempre com chave store)
  const day = useMemo(
    () => data[dateISO] ?? { dateISO, items: [], store: '' },
    [data, dateISO]
  );

  // Persiste sempre que "data" muda
  useEffect(() => { save(STORAGE_KEY, data); }, [data]);

  // Ao trocar a data, carrega a loja salva naquele dia
  useEffect(() => {
    setStore(day.store || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateISO]);

  // Quando trocar a loja, reflete no dia atual
  useEffect(() => {
    setDay(prev => ({ ...prev, store }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  // Form de adição
  const [name, setName] = useState('');
  const [qty, setQty] = useState(1);
  const [unit, setUnit] = useState('un');
  const [price, setPrice] = useState('');     // texto enquanto digita
  const [weight, setWeight] = useState('');   // texto enquanto digita
  const [note, setNote] = useState('');
  const [showSuggest, setShowSuggest] = useState(false);

  // Abertura/fechamento por item (acordeão)
  const [open, setOpen] = useState({});
  const toggleExpand = (id) => setOpen(o => ({ ...o, [id]: !o[id] }));

  // Abertura/fechamento das colunas Lista / Carrinho
  const [listOpen, setListOpen] = useState(true);
  const [cartOpen, setCartOpen] = useState(true);

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
      store: store || '',
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

  // Mover todos os itens para o carrinho
  const moveAllToCart = () => {
    setDay(prev => ({
      ...prev,
      items: prev.items.map(i => ({ ...i, inCart: true }))
    }));
  };

  // Voltar todos os itens para a lista
  const moveAllToList = () => {
    setDay(prev => ({
      ...prev,
      items: prev.items.map(i => ({ ...i, inCart: false }))
    }));
  };

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

  // ==== ITEM (acordeão + editor com estado local para evitar "travadas") ====
  const ItemRow = React.memo(({ i, inCartView }) => {
    const icon = iconFor(i);
    const isOpen = !!open[i.id];

    // estado local do editor (não depende do pai enquanto digita)
    const [local, setLocal] = useState({
      qty: i.qty ?? 1,
      unit: i.unit ?? 'un',
      price: (i.price ?? '') + '',
      weight: (i.weight ?? '') + '',
      note: i.note ?? ''
    });

    // ressincroniza quando mudar o item
    useEffect(() => {
      setLocal({
        qty: i.qty ?? 1,
        unit: i.unit ?? 'un',
        price: (i.price ?? '') + '',
        weight: (i.weight ?? '') + '',
        note: i.note ?? ''
      });
    }, [i.id]);

    const setField = (field) => (e) => {
      const v = e?.target?.value ?? e;
      setLocal(prev => ({ ...prev, [field]: v }));
    };

    const commit = () => {
      updateItem(i.id, {
        qty: Number(local.qty) || 0,
        unit: local.unit,
        price: toNumber(local.price),
        weight: toNumber(local.weight),
        note: local.note
      });
    };

    const onEnterCommit = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
    };

    // total visível no cabeçalho (se não houver preço, mostra "—")
    const headerTotal = (typeof i.price === 'number')
      ? fmtBRL(i.price * (i.qty || 1))
      : '—';

    return (
      <div className="border rounded-xl p-3">
        {/* Cabeçalho compacto */}
        <button
          type="button"
          onClick={() => toggleExpand(i.id)}
          onKeyDown={(e) => ((e.key === 'Enter' || e.key === ' ') && toggleExpand(i.id))}
          className="w-full flex items-center justify-between gap-3 text-left"
        >
          <div className="flex items-center gap-2">
            {icon ? <div className="text-2xl">{icon}</div> : <FallbackBadge name={i.name} />}
            <div>
              <div className="font-medium">{i.name}</div>
              <div className="text-xs text-slate-500">
                {i.category}{i.store ? ` • ${i.store}` : ''}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm font-medium">{headerTotal}</div>
            <span
              className={`inline-block transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
              aria-hidden
            >
              ▶
            </span>
          </div>
        </button>

        {/* Painel dobrável */}
        {isOpen && (
          <>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-6 gap-2 text-sm">
              {/* Qtd */}
              <input
                type="number"
                value={local.qty}
                onChange={setField('qty')}
                onKeyDown={onEnterCommit}
                className="border rounded-lg px-2 py-1"
              />

              {/* Tipo */}
              <select
                value={local.unit}
                onChange={setField('unit')}
                onKeyDown={onEnterCommit}
                className="border rounded-lg px-2 py-1"
              >
                <option>un</option><option>kg</option><option>g</option>
                <option>L</option><option>mL</option>
                <option>pacote</option><option>caixa</option><option>saco</option>
                <option>bandeja</option><option>garrafa</option><option>lata</option>
                <option>outro</option>
              </select>

              {/* Preço (texto/decimal – livre para digitar) */}
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={local.price}
                onChange={setField('price')}
                onKeyDown={onEnterCommit}
                placeholder="Preço"
                className="border rounded-lg px-2 py-1"
              />

              {/* Peso */}
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={local.weight}
                onChange={setField('weight')}
                onKeyDown={onEnterCommit}
                placeholder="Peso"
                className="border rounded-lg px-2 py-1"
              />

              {/* Obs */}
              <input
                value={local.note}
                onChange={setField('note')}
                onKeyDown={onEnterCommit}
                placeholder="Obs."
                className="border rounded-lg px-2 py-1"
              />

              {/* Confirmar */}
              <button
                onClick={() => { commit(); /* opcional: toggleExpand(i.id); */ }}
                className="px-3 py-1 rounded-lg bg-ygg-700 text-white"
                title="Aplicar alterações"
              >
                ✓
              </button>
            </div>

            {/* Dica / info */}
            <div className="mt-2 text-xs text-slate-500">
              {i.kcalPer100
                ? `${i.kcalPer100} kcal/100g`
                : (lastPriceFor(i.name)
                    ? `Último: ${fmtBRL(lastPriceFor(i.name))}`
                    : (findCatalog(i.name)?.curiosity || ''))}
            </div>

            {/* Ações */}
            <div className="mt-2 flex items-center gap-2">
              {inCartView ? (
                <button
                  onClick={() => toggleCart(i.id, false)}
                  className="px-3 py-2 rounded-lg bg-slate-200 text-sm"
                >
                  Voltar p/ Lista
                </button>
              ) : (
                <button
                  onClick={() => toggleCart(i.id, true)}
                  className="px-3 py-2 rounded-lg bg-ygg-700 text-white text-sm"
                >
                  Adicionar ao Carrinho
                </button>
              )}

              <button
                onClick={() => removeItem(i.id)}
                className="px-3 py-2 rounded-lg border text-sm"
              >
                Remover
              </button>
            </div>
          </>
        )}
      </div>
    );
  });

  const finalizePurchase = () => {
    if (cart.length === 0) return;

    const purchases = load(PURCHASES_KEY, []);
    const dayStore = day.store || store || '';

    const cartWithStore = cart.map(i => ({ ...i, store: i.store || dayStore }));

    purchases.push({
      id: uid(),
      dateISO,
      store: dayStore,
      items: cartWithStore,
      total: total(cartWithStore),
      createdAt: Date.now()
    });

    save(PURCHASES_KEY, purchases);

    setDay(prev => ({
      ...prev,
      items: prev.items.map(i => cart.find(c => c.id === i.id) ? { ...i, inCart: false } : i)
    }));

    alert('Compra finalizada e salva!');
  };

  return (
    <section className="space-y-4">
      <div className="bg-white rounded-2xl border shadow-sm p-4 flex flex-wrap items-end gap-3">
        {/* Loja / Mercado */}
        <div className="basis-full">
          <label className="text-sm">Loja / Mercado</label>
          <input
            type="text"
            value={store}
            onChange={(e) => setStore(e.target.value)}
            placeholder="Ex.: Supermercado X, Atacado Y"
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        {/* Dia */}
        <div>
          <label className="text-sm">Dia</label>
          <input
            type="date"
            value={dateISO}
            onChange={(e) => setDateISO(e.target.value)}
            className="border rounded-lg px-3 py-2"
          />
        </div>

        {/* Item */}
        <div className="flex-1 min-w-[200px] relative">
          <label className="text-sm">Item</label>
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setShowSuggest(true); }}
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

        {/* Qtd */}
        <div>
          <label className="text-sm">Qtd</label>
          <input
            type="number"
            min={0}
            step={1}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            className="w-20 border rounded-lg px-3 py-2"
          />
        </div>

        {/* Tipo */}
        <div>
          <label className="text-sm">Tipo</label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="border rounded-lg px-3 py-2"
          >
            <option>un</option><option>kg</option><option>g</option><option>L</option><option>mL</option>
            <option>pacote</option><option>caixa</option><option>saco</option><option>bandeja</option>
            <option>garrafa</option><option>lata</option><option>outro</option>
          </select>
        </div>

        {/* Preço (form de adição) */}
        <div>
          <label className="text-sm">Preço (R$)</label>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="5,99"
            className="w-28 border rounded-lg px-3 py-2"
          />
        </div>

        {/* Peso (form de adição) */}
        <div>
          <label className="text-sm">Peso</label>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="Opcional"
            className="w-28 border rounded-lg px-3 py-2"
          />
        </div>

        {/* Observação */}
        <div className="flex-1 min-w-[160px]">
          <label className="text-sm">Observação</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Marca X, maturação, etc."
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        {/* Botão adicionar */}
        <div>
          <label className="text-sm invisible">.</label>
          <button onClick={() => addItem()} className="px-4 py-2 rounded-lg bg-ygg-700 text-white">
            ✓ Adicionar
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* LISTA */}
        <div className="bg-white rounded-2xl border shadow-sm p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <button
              type="button"
              onClick={() => setListOpen(v => !v)}
              className="flex items-center gap-2"
              title="Expandir/contrair lista"
            >
              <span>📝</span>
              <h3 className="font-semibold">
                Lista <span className="text-slate-500 font-normal">({toBuy.length})</span>
              </h3>
              <span className={`inline-block transition-transform duration-200 ${listOpen ? 'rotate-90' : ''}`}>▶</span>
            </button>

            <button
              onClick={moveAllToCart}
              disabled={toBuy.length === 0}
              className={`px-3 py-1 rounded-lg text-sm border ${
                toBuy.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-ygg-100'
              }`}
              title="Enviar todos os itens da lista para o carrinho"
            >
              ➕ Adicionar tudo ao carrinho
            </button>
          </div>

          <div className="text-sm text-slate-600 mb-2">Total: {fmtBRL(total(toBuy))}</div>

          {listOpen && (
            <div className="space-y-2">
              {toBuy.map(i => <ItemRow key={i.id} i={i} inCartView={false} />)}
              {toBuy.length === 0 && <p className="text-sm text-slate-500">Nada aqui por enquanto.</p>}
            </div>
          )}
        </div>

        {/* CARRINHO */}
        <div className="bg-white rounded-2xl border shadow-sm p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <button
              type="button"
              onClick={() => setCartOpen(v => !v)}
              className="flex items-center gap-2"
              title="Expandir/contrair carrinho"
            >
              <span>🛒</span>
              <h3 className="font-semibold">
                Carrinho <span className="text-slate-500 font-normal">({cart.length})</span>
              </h3>
              <span className={`inline-block transition-transform duration-200 ${cartOpen ? 'rotate-90' : ''}`}>▶</span>
            </button>

            <button
              onClick={moveAllToList}
              disabled={cart.length === 0}
              className={`px-3 py-1 rounded-lg text-sm border ${
                cart.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-ygg-100'
              }`}
              title="Devolver todos os itens do carrinho para a lista"
            >
              ↩ Voltar tudo p/ lista
            </button>
          </div>

          <div className="text-sm text-slate-600 mb-2">Total: {fmtBRL(total(cart))}</div>

          {cartOpen && (
            <div className="space-y-2">
              {cart.map(i => <ItemRow key={i.id} i={i} inCartView={true} />)}
              {cart.length === 0 && <p className="text-sm text-slate-500">Nenhum item no carrinho.</p>}
            </div>
          )}

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
