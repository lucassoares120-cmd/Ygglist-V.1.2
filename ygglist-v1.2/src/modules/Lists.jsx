  const allCartUnfiltered = day.items
    .filter((i) => i.inCart)
    .sort(stableSort);

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

  const toBuy = allToBuyUnfiltered.filter((i) => matches(listQuery, i));
  const cart = allCartUnfiltered.filter((i) => matches(cartQuery, i));

  /* ===== CRUD ===== */
  const addItem = (toCart = false) => {
    const nm = (name || '').trim();
    if (!nm) return;

    const catalogEntry = findCatalog(nm);
    const cat = catalogEntry?.category ?? 'Outros';
    const kcal = catalogEntry?.kcalPer100;
    const icon = catalogEntry?.icon;

    const item = {
      id: uid(),
      name: nm,
      qty: toLocaleNumber(qtyStr) || 1,
      unit,
      price: toLocaleNumber(priceStr),
      weight: obs || '',
      note: curiosity || catalogEntry?.curiosity || '',
      icon,
      kcalPer100: kcal,
      category: cat,
      store: store || '',
      inCart: toCart,
      createdAt: Date.now(),
    };

    setDay((prev) => ({ ...prev, items: [item, ...prev.items] }));

    // reset form
    setName('');
    setQtyStr('1');
    setUnit('un');
    setPriceStr('');
    setObs('');
    setCuriosity('');
    setShowSuggest(false);
  };

  const updateItem = (id, patch) =>
    withScrollLock(() =>
      setDay((prev) => ({
        ...prev,
        items: prev.items.map((i) =>
          i.id === id ? { ...i, ...patch } : i
        ),
      }))
    );

  const toggleCartItem = (id, val) =>
    withScrollLock(() =>
      setDay((prev) => ({
        ...prev,
        items: prev.items.map((i) =>
          i.id === id ? { ...i, inCart: val } : i
        ),
      }))
    );

  const removeItem = (id) =>
    withScrollLock(() =>
      setDay((prev) => ({
        ...prev,
        items: prev.items.filter((i) => i.id !== id),
      }))
    );

  /* ===== RENDER ===== */

  return (
    <section className="space-y-4">
      {/* ... aqui em cima continua o que você já tinha antes do trecho de Observação/Curiosidade ... */}

      <div className="grid md:grid-cols-2 gap-4 mb-4">
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

          <div className="flex gap-2 flex-wrap">
            {/* Botão padrão: adiciona à LISTA */}
            <button
              type="button"
              onClick={() => addItem(false)}
              className="px-4 py-2 rounded-lg bg-ygg-700 text-white hover:bg-ygg-800 transition-colors"
            >
              ✓ Adicionar
            </button>

            {/* Novo botão: adiciona DIRETO AO CARRINHO */}
            <button
              type="button"
              onClick={() => addItem(true)}
              className="px-4 py-2 rounded-lg border bg-white text-ygg-700 hover:bg-ygg-50 transition-colors"
            >
              🛒 Adicionar ao carrinho
            </button>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* LISTA */}
        <div className="bg-white rounded-2xl border shadow-sm p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <button
              type="button"
              onClick={() => setListOpen((v) => !v)}
              className="flex items-center gap-2"
            >
              <span>📝</span>
              <h3 className="font-semibold">
                Lista{' '}
                <span className="text-slate-500 font-normal">
                  ({allToBuyUnfiltered.length})
                </span>
              </h3>
              <span
                className={`inline-block transition-transform duration-200 ${
                  listOpen ? 'rotate-90' : ''
                }`}
              >
                ▶
              </span>
            </button>

            <button
              onClick={moveAllToCart}
              disabled={allToBuyUnfiltered.length === 0}
              className={`px-3 py-1 rounded-lg text-sm border ${
                allToBuyUnfiltered.length === 0
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-ygg-100'
              }`}
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

          <div className="mb-2 text-right text-lg font-semibold text-slate-700">
            Total: {fmtBRL(total(toBuy))}
          </div>

          {listOpen && (
            <div className="space-y-2">
              {toBuy.map((i) => (
                <ItemRow key={i.id} i={i} inCartView={false} />
              ))}
              {toBuy.length === 0 && (
                <p className="text-sm text-slate-500">
                  Nada aqui por enquanto.
                </p>
              )}
            </div>
          )}
        </div>

        {/* CARRINHO */}
        <div className="bg-white rounded-2xl border shadow-sm p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <button
              type="button"
              onClick={() => setCartOpen((v) => !v)}
              className="flex items-center gap-2"
            >
              <span>🛒</span>
              <h3 className="font-semibold">
                Carrinho{' '}
                <span className="text-slate-500 font-normal">
                  ({allCartUnfiltered.length})
                </span>
              </h3>
              <span
                className={`inline-block transition-transform duration-200 ${
                  cartOpen ? 'rotate-90' : ''
                }`}
              >
                ▶
              </span>
            </button>

            <button
              onClick={moveAllToList}
              disabled={allCartUnfiltered.length === 0}
              className={`px-3 py-1 rounded-lg text-sm border ${
                allCartUnfiltered.length === 0
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-ygg-100'
              }`}
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

          <div className="mb-2 text-right text-lg font-semibold text-slate-700">
            Total: {fmtBRL(total(cart))}
          </div>

          {cartOpen && (
            <div className="space-y-2">
              {cart.map((i) => (
                <ItemRow key={i.id} i={i} inCartView={true} />
              ))}
              {cart.length === 0 && (
                <p className="text-sm text-slate-500">
                  Nenhum item no carrinho.
                </p>
              )}
            </div>
          )}

          <div className="mt-3">
            <button
              onClick={() => finalizePurchase()}
              className="px-4 py-3 rounded-xl bg-emerald-600 text-white w-full"
            >
              ✅ Compra finalizada (salvar)
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
