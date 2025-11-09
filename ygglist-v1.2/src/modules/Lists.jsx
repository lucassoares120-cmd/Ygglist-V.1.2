import React, { useEffect, useMemo, useRef, useState } from 'react';
import catalog from '../data/ygg_items.json';
import { STORAGE_KEY, PURCHASES_KEY, fmtBRL, uid, todayISO, load, save, catIcon } from '../lib.js';

/* ===== Helpers ===== */
const iconFor = (it) => it.icon || catIcon[it.category] || null;
const findCatalog = (name) =>
  catalog.find((x) => x.name.toLowerCase() === name.toLowerCase());

/** Converte string numérica aceitando vírgula/ponto como separador decimal. */
const toLocaleNumber = (v) => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  let s = String(v).trim();
  if (!s) return 0;
  s = s.replace(/[^\d.,\-]/g, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma === -1 && lastDot === -1) return Number(s) || 0;
  const decimalSep = (lastComma === -1) ? '.' : (lastDot === -1) ? ',' : (lastComma > lastDot ? ',' : '.');
  const thousandSep = decimalSep === ',' ? '.' : ',';
  s = s.replace(new RegExp('\\' + thousandSep, 'g'), '');
  s = s.replace(decimalSep, '.');
  const n = Number(s);
  return isFinite(n) ? n : 0;
};

const withScrollLock = (fn) => {
  const y = typeof window !== 'undefined' ? window.scrollY : 0;
  fn();
  if (typeof window !== 'undefined') setTimeout(() => window.scrollTo(0, y), 0);
};

function FallbackBadge({ name }) {
  return (
    <div className="w-8 h-8 rounded-full bg-ygg-700 text-white flex items-center justify-center text-sm">
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

/* ===== Tela ===== */
export default function Lists() {
  const [data, setData] = useState(() => load(STORAGE_KEY, {}));
  const [dateISO, setDateISO] = useState(todayISO());
  const [store, setStore] = useState('');

  // form de adição
  const [name, setName] = useState('');
  const [qtyStr, setQtyStr] = useState('1'); // texto livre
  const [unit, setUnit] = useState('un');
  const [priceStr, setPriceStr] = useState('');
  const [obs, setObs] = useState('');              // Observação (texto)
  const [curiosity, setCuriosity] = useState('');  // Curiosidade (texto)
  const [showSuggest, setShowSuggest] = useState(false);

  // expand/collapse por item e por coluna
  const [open, setOpen] = useState({});
  const toggleExpand = (id) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  const [listOpen, setListOpen] = useState(true);
  const [cartOpen, setCartOpen] = useState(true);

  // busca
  const [listQuery, setListQuery] = useState('');
  const [cartQuery, setCartQuery] = useState('');

  // grava “dia”
  const setDay = (updater) =>
    setData((p) => ({
      ...p,
      [dateISO]: updater(p[dateISO] ?? { dateISO, items: [], store: '' }),
    }));

  const day = useMemo(
    () => data[dateISO] ?? { dateISO, items: [], store: '' },
    [data, dateISO]
  );

  useEffect(() => { save(STORAGE_KEY, data); }, [data]);
  useEffect(() => { setStore(day.store || ''); /* eslint-disable-next-line */ }, [dateISO]);
  useEffect(() => { setDay((prev) => ({ ...prev, store })); /* eslint-disable-next-line */ }, [store]);

  /* ===== listas filtradas ===== */
  const stableSort = (a, b) =>
    (a.category || '').localeCompare(b.category || '') ||
    a.name.localeCompare(b.name) ||
    (a.createdAt || 0) - (b.createdAt || 0);

  const allToBuyUnfiltered = day.items.filter(i => !i.inCart).sort(stableSort);
  const allCartUnfiltered  = day.items.filter(i =>  i.inCart).sort(stableSort);

  const matches = (q, i) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      (i.name || '').toLowerCase().includes(s) ||
      (i.category || '').toLowerCase().includes(s) ||
      (i.weight || '').toLowerCase().includes(s) ||
      (i.note || '').toLowerCase().includes(s)
    );
  };

  const toBuy = allToBuyUnfiltered.filter(i => matches(listQuery, i));
  const cart  = allCartUnfiltered.filter(i => matches(cartQuery, i));

  const lastPriceFor = (n) => {
    const all = Object.values(data)
      .flatMap(d => d.items)
      .filter(i => i.name.toLowerCase() === n.toLowerCase() && typeof i.price === 'number');
    const s = all.sort((a, b) => b.createdAt - a.createdAt)[0];
    return s?.price;
  };

  /* ===== CRUD ===== */
  function addItem() {
    const nm = (name || '').trim();
    if (!nm) return;
    const cat  = findCatalog(nm)?.category ?? 'Outros';
    const kcal = findCatalog(nm)?.kcalPer100;
    const icon = findCatalog(nm)?.icon;

    const item = {
      id: uid(),
      name: nm,
      qty: toLocaleNumber(qtyStr) || 1,
      unit,
      price: toLocaleNumber(priceStr),
      weight: obs || '',
      note: curiosity || findCatalog(nm)?.curiosity || '',
      icon,
      kcalPer100: kcal,
      category: cat,
      store: store || '',
      inCart: false,
      createdAt: Date.now(),
    };

    setDay(prev => ({ ...prev, items: [item, ...prev.items] }));
    // reset form
    setName(''); setQtyStr('1'); setUnit('un'); setPriceStr(''); setObs(''); setCuriosity(''); setShowSuggest(false);
  }

  const updateItem = (id, patch) =>
    withScrollLock(() =>
      setDay(prev => ({
        ...prev,
        items: prev.items.map(i => i.id === id ? { ...i, ...patch } : i)
      }))
    );

  const toggleCartItem = (id, val) =>
    withScrollLock(() =>
      setDay(prev => ({
        ...prev,
        items: prev.items.map(i => i.id === id ? { ...i, inCart: val } : i)
      }))
    );

  const removeItem = (id) =>
    withScrollLock(() =>
      setDay(prev => ({ ...prev, items: prev.items.filter(i => i.id !== id) }))
    );

  const moveAllToCart = () =>
    withScrollLock(() =>
      setDay(prev => ({ ...prev, items: prev.items.map(i => ({ ...i, inCart: true })) }))
    );

  const moveAllToList = () =>
    withScrollLock(() =>
      setDay(prev => ({ ...prev, items: prev.items.map(i => ({ ...i, inCart: false })) }))
    );

  const total = (list) =>
    list.reduce((a, i) => a + (toLocaleNumber(i.price) || 0) * (toLocaleNumber(i.qty) || 1), 0);

  const suggestions =
    name.length > 0
      ? catalog.filter(x => x.name.toLowerCase().includes(name.toLowerCase())).slice(0, 10)
      : [];

  const pickSuggestion = (s) => {
    setName(s.name);
    setUnit('un');
    setCuriosity(s.curiosity || '');
    setShowSuggest(false);
  };

  /* ===== Linha do item ===== */
  const ItemRow = React.memo(({ i, inCartView }) => {
    const icon = iconFor(i);
    const isOpen = !!open[i.id];

    // estado local (não perde foco)
    const [local, setLocal] = useState({
      qty: (i.qty ?? 1) + '',
      unit: i.unit ?? 'un',
      price: (i.price ?? '') + '',
      weight: (i.weight ?? ''),
    });

    // re-sincroniza apenas quando trocar o item
    useEffect(() => {
      setLocal({
        qty: (i.qty ?? 1) + '',
        unit: i.unit ?? 'un',
        price: (i.price ?? '') + '',
        weight: (i.weight ?? ''),
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [i.id]);

    const setField = (field) => (e) => {
      const v = e?.target?.value ?? e;
      setLocal(p => ({ ...p, [field]: v }));
    };

    const commit = () => {
      updateItem(i.id, {
        qty: toLocaleNumber(local.qty) || 0,
        unit: local.unit,
        price: toLocaleNumber(local.price),
        weight: local.weight,
      });
    };

    const onBlurCommit = () => commit();
    const onEnterCommit = (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } };

    // total mostrado usa o que está digitando
    const headerTotal =
      local.price !== ''
        ? fmtBRL(toLocaleNumber(local.price) * (toLocaleNumber(local.qty) || 1))
        : (typeof i.price === 'number'
            ? fmtBRL(toLocaleNumber(i.price) * (toLocaleNumber(i.qty) || 1))
            : '—');

    return (
      <div className="border rounded-xl p-3">
        {/* Cabeçalho compacto */}
        <button
          type="button"
          onClick={() => toggleExpand(i.id)}
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
            <span className={`inline-block transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>▶</span>
          </div>
        </button>

        {/* Painel editável */}
        {isOpen && (
          <>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-6 gap-2 text-sm">
              {/* Qtd (texto, aceita , .) */}
            {/* === dentro do bloco {isOpen && ( <> ... </> )} === */}

{/* 1) GRID mantém Qtd / Tipo / Preço (REMOVA o Observação daqui) */}
<div className="mt-3 grid grid-cols-2 md:grid-cols-6 gap-2 text-sm">
  {/* Qtd */}
  <input
    type="text"
    inputMode="decimal"
    autoComplete="off"
    value={local.qty}
    onChange={setField('qty')}
    onBlur={onBlurCommit}
    onKeyDown={onEnterCommit}
    className="border rounded-lg px-2 py-1"
    placeholder="Qtd"
  />

  {/* Tipo */}
  <select
    value={local.unit}
    onChange={(e) => { setField('unit')(e); commit(); }}
    className="border rounded-lg px-2 py-1"
  >
    <option>un</option><option>kg</option><option>g</option>
    <option>L</option><option>mL</option>
    <option>pacote</option><option>caixa</option><option>saco</option>
    <option>bandeja</option><option>garrafa</option><option>lata</option>
    <option>outro</option>
  </select>

  {/* Preço */}
  <input
    type="text"
    inputMode="decimal"
    autoComplete="off"
    value={local.price}
    onChange={setField('price')}
    onBlur={onBlurCommit}
    onKeyDown={onEnterCommit}
    placeholder="Preço"
    className="border rounded-lg px-2 py-1"
  />
</div>

{/* 2) NOVA LINHA: Observação em largura total, ANTES de kcal/curiosidade */}
<div className="mt-2">
  <input
    type="text"
    autoComplete="off"
    value={local.weight}
    onChange={setField('weight')}
    onBlur={onBlurCommit}
    onKeyDown={onEnterCommit}
    placeholder="Observação"
    className="w-full border rounded-lg px-3 py-2"
  />
</div>

{/* (mantém) kcal + curiosidade logo abaixo */}
<div className="mt-2 text-xs text-slate-500 flex flex-wrap items-center gap-2">
  {i.kcalPer100 && <span>{i.kcalPer100} kcal/100g</span>}
  {i.note && (
    <>
      {i.kcalPer100 ? <span>•</span> : null}
      <span className="truncate">{i.note}</span>
    </>
  )}
  {!i.kcalPer100 && !i.note && lastPriceFor(i.name) && (
    <span>Último: {fmtBRL(lastPriceFor(i.name))}</span>
  )}
</div>


            {/* kcal + curiosidade (apenas exibição) */}
            <div className="mt-2 text-xs text-slate-500 flex flex-wrap items-center gap-2">
              {i.kcalPer100 && <span>{i.kcalPer100} kcal/100g</span>}
              {i.note && (
                <>
                  {i.kcalPer100 ? <span>•</span> : null}
                  <span className="truncate">{i.note}</span>
                </>
              )}
              {!i.kcalPer100 && !i.note && lastPriceFor(i.name) && (
                <span>Último: {fmtBRL(lastPriceFor(i.name))}</span>
              )}
            </div>

            {/* Ações */}
            <div className="mt-2 flex items-center gap-2">
              {inCartView ? (
                <button onClick={() => toggleCartItem(i.id, false)} className="px-3 py-2 rounded-lg bg-slate-200 text-sm">
                  Voltar p/ Lista
                </button>
              ) : (
                <button onClick={() => toggleCartItem(i.id, true)} className="px-3 py-2 rounded-lg bg-ygg-700 text-white text-sm">
                  Adicionar ao Carrinho
                </button>
              )}
              <button onClick={() => removeItem(i.id)} className="px-3 py-2 rounded-lg border text-sm">
                Remover
              </button>
            </div>
          </>
        )}
      </div>
    );
  });

  /* ===== Finalizar compra ===== */
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
      createdAt: Date.now(),
    });

    save(PURCHASES_KEY, purchases);

    // Limpa lista do dia e a loja
    setData(prev => ({ ...prev, [dateISO]: { dateISO, items: [], store: '' } }));
    setStore('');
    setName(''); setQtyStr('1'); setUnit('un'); setPriceStr(''); setObs(''); setCuriosity(''); setShowSuggest(false);
    alert('Compra finalizada e salva!');
  };

  /* ===== Render ===== */
  const suggestionsList =
    name.length > 0 && suggestions.length > 0 ? (
      <div className="absolute z-10 w-full mt-1 border rounded-lg bg-white shadow-sm p-2 text-sm max-h-56 overflow-auto">
        {suggestions.map((s) => (
          <button
            key={s.name}
            onClick={() => pickSuggestion(s)}
            className="block w-full text-left p-1 rounded hover:bg-ygg-100"
          >
            {s.name} • <span className="text-xs text-slate-500">{s.category}</span>
          </button>
        ))}
      </div>
    ) : null;

  return (
    <section className="space-y-4">
      {/* Formulário de adição */}
      <div className="bg-white rounded-2xl border shadow-sm p-4 flex flex-wrap items-end gap-3">
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

        <div>
          <label className="text-sm">Dia</label>
          <input
            type="date"
            value={dateISO}
            onChange={(e) => setDateISO(e.target.value)}
            className="border rounded-lg px-3 py-2"
          />
        </div>

        <div className="flex-1 min-w-[200px] relative">
          <label className="text-sm">Item</label>
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setShowSuggest(true); }}
            onFocus={() => setShowSuggest(true)}
            placeholder="Digite o item..."
            className="w-full border rounded-lg px-3 py-2"
          />
          {suggestionsList}
        </div>

        <div>
          <label className="text-sm">Qtd</label>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={qtyStr}
            onChange={(e) => setQtyStr(e.target.value)}
            className="w-24 border rounded-lg px-3 py-2"
            placeholder="1"
          />
        </div>

        <div>
          <label className="text-sm">Tipo</label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="border rounded-lg px-3 py-2"
          >
            <option>un</option><option>kg</option><option>g</option>
            <option>L</option><option>mL</option>
            <option>pacote</option><option>caixa</option><option>saco</option>
            <option>bandeja</option><option>garrafa</option><option>lata</option>
            <option>outro</option>
          </select>
        </div>

        <div>
          <label className="text-sm">Preço (R$)</label>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={priceStr}
            onChange={(e) => setPriceStr(e.target.value)}
            placeholder="5,99"
            className="w-28 border rounded-lg px-3 py-2"
          />
        </div>

        <div className="basis-full md:basis-[48%]">
          <label className="text-sm">Observação</label>
          <input
            type="text"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Observações (marca, maturação, etc.)"
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        <div className="basis-full md:basis-[48%]">
          <label className="text-sm">Curiosidade</label>
          <input
            type="text"
            value={curiosity}
            onChange={(e) => setCuriosity(e.target.value)}
            placeholder="Curiosidade do item"
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

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
            <button type="button" onClick={() => setListOpen(v => !v)} className="flex items-center gap-2">
              <span>📝</span>
              <h3 className="font-semibold">Lista <span className="text-slate-500 font-normal">({allToBuyUnfiltered.length})</span></h3>
              <span className={`inline-block transition-transform duration-200 ${listOpen ? 'rotate-90' : ''}`}>▶</span>
            </button>

            <button
              onClick={moveAllToCart}
              disabled={allToBuyUnfiltered.length === 0}
              className={`px-3 py-1 rounded-lg text-sm border ${allToBuyUnfiltered.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-ygg-100'}`}
              title="Enviar todos para o carrinho"
            >
              ➕ Adicionar tudo ao carrinho
            </button>
          </div>

          <div className="mb-2">
            <input
              type="text"
              value={listQuery}
              onChange={(e) => setListQuery(e.target.value)}
              placeholder="🔎 Pesquisar na lista..."
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
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
            <button type="button" onClick={() => setCartOpen(v => !v)} className="flex items-center gap-2">
              <span>🛒</span>
              <h3 className="font-semibold">Carrinho <span className="text-slate-500 font-normal">({allCartUnfiltered.length})</span></h3>
              <span className={`inline-block transition-transform duration-200 ${cartOpen ? 'rotate-90' : ''}`}>▶</span>
            </button>

            <button
              onClick={moveAllToList}
              disabled={allCartUnfiltered.length === 0}
              className={`px-3 py-1 rounded-lg text-sm border ${allCartUnfiltered.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-ygg-100'}`}
              title="Devolver todos para a lista"
            >
              ↩ Voltar tudo p/ lista
            </button>
          </div>

          <div className="mb-2">
            <input
              type="text"
              value={cartQuery}
              onChange={(e) => setCartQuery(e.target.value)}
              placeholder="🔎 Pesquisar no carrinho..."
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
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
