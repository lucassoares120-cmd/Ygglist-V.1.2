import React, { useState, useMemo, useEffect } from "react";
import yggItems from "../data/ygg_items.json";

/* ===== CONSTANTES ===== */

const UNIT_OPTIONS = ["un", "kg", "g", "L", "mL", "caixa", "pacote", "bandeja"];

// chave de rascunho no localStorage
const DRAFT_KEY = "YGG_LIST_DRAFT";

// ordem de categorias vinda do próprio catálogo
const CATEGORY_ORDER = Array.from(
  new Set(yggItems.map((it) => it.category).filter(Boolean))
);

const categoryRank = (cat) => {
  if (!cat) return CATEGORY_ORDER.length + 1;
  const idx = CATEGORY_ORDER.indexOf(cat);
  return idx === -1 ? CATEGORY_ORDER.length + 1 : idx;
};

/* ===== HELPERS ===== */

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now() + Math.random());

/**
 * Converte string para número aceitando:
 *  - "1,5"  -> 1.5
 *  - "1.5"  -> 1.5
 *  - "1.234,56" -> 1234.56
 *  - "1,234.56" -> 1234.56
 */
const toLocaleNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;

  const raw = String(value).trim();
  if (!raw) return null;

  const s = raw.replace(/\s/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  let normalized = s;

  if (hasComma && hasDot) {
    // considera o ÚLTIMO separador como decimal
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      // vírgula decimal: remove pontos (milhar) e troca última vírgula por ponto
      normalized = s.replace(/\./g, "").replace(",", ".");
    } else {
      // ponto decimal: remove vírgulas (milhar)
      normalized = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    normalized = s.replace(",", ".");
  } else {
    normalized = s;
  }

  const n = Number(normalized);
  return Number.isNaN(n) ? null : n;
};

const numberToField = (value, decimals = 2) => {
  const n = Number(value);
  if (Number.isNaN(n)) return "";
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

const fmtBRL = (v) => {
  const n = Number(v) || 0;
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });
};

const normalize = (s) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const locationKey = (s) => normalize(s) || "__default__";

// ordena por categoria (grupo) e depois por nome
const stableSort = (a, b) => {
  const ra = categoryRank(a.category);
  const rb = categoryRank(b.category);
  if (ra !== rb) return ra - rb;

  const an = (a.name || "").toLowerCase();
  const bn = (b.name || "").toLowerCase();
  if (an < bn) return -1;
  if (an > bn) return 1;
  return 0;
};

// wrapper simples pra manter API antiga
const withScrollLock = (fn) => fn();

/* ===== CATÁLOGO YGG (ygg_items.json) ===== */

const findCatalog = (nm) => {
  const key = normalize(nm);
  return yggItems.find((it) => normalize(it.name) === key);
};

/* ===== ITEM ROW ===== */

function ItemRow({
  i,
  inCartView,
  isOpen,
  onToggleOpen,
  toggleCartItem,
  removeItem,
  updateItem,
}) {
  const handleToggleCart = () => toggleCartItem(i.id, !i.inCart);

  const qtyField = i.qty != null ? String(i.qty).replace(".", ",") : "";

  // Campo de preço: usa texto bruto enquanto edita
  const priceField =
    i.priceInput ??
    (typeof i.price === "number" ? numberToField(i.price) : "");

  return (
    <div className="rounded-xl border px-3 py-2 text-sm bg-white">
      {/* Linha principal */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleCart}
            className="text-lg shrink-0"
            title={inCartView ? "Devolver para a lista" : "Mover para o carrinho"}
          >
            {i.inCart ? "✅" : "⬜"}
          </button>

          <div
            className="min-w-0 cursor-pointer"
            onClick={onToggleOpen}
            title="Clique para ver detalhes"
          >
            <div className="font-semibold truncate">
              {i.icon && <span className="mr-1">{i.icon}</span>}
              {i.name}
              {i.qty ? (
                <span className="font-normal text-slate-600">
                  {" "}
                  — {i.qty} {i.unit || "un"}
                </span>
              ) : null}
            </div>
            {i.weight && (
              <div className="text-xs text-slate-500 truncate">{i.weight}</div>
            )}
            {i.note && (
              <div className="text-xs text-emerald-700 truncate">{i.note}</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {typeof i.price === "number" && !isOpen && (
            <div className="text-xs font-semibold text-slate-700">
              {fmtBRL(i.price)}
            </div>
          )}

          <button
            type="button"
            onClick={onToggleOpen}
            className="rounded-md border px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
            title={isOpen ? "Recolher" : "Editar"}
          >
            {isOpen ? "▲" : "▼"}
          </button>

          <button
            type="button"
            onClick={() => removeItem(i.id)}
            className="rounded-md border px-2 py-1 text-[11px] text-slate-600 hover:bg-red-50 hover:text-red-600"
            title="Remover"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Área de edição retrátil */}
      {isOpen && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[11px] text-slate-500">Quantidade</label>
              <input
                type="text"
                value={qtyField}
                onChange={(e) =>
                  updateItem(i.id, {
                    qty: toLocaleNumber(e.target.value) || 0,
                  })
                }
                className="w-full border rounded-lg px-2 py-1 text-sm"
              />
            </div>
            <div className="w-28">
              <label className="text-[11px] text-slate-500">Unidade</label>
              <select
                value={i.unit || "un"}
                onChange={(e) =>
                  updateItem(i.id, {
                    unit: e.target.value,
                  })
                }
                className="w-full border rounded-lg px-2 py-1 text-sm bg-white"
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] text-slate-500">Preço</label>
            <input
              type="text"
              value={priceField}
              onChange={(e) =>
                updateItem(i.id, {
                  priceInput: e.target.value,
                  price: toLocaleNumber(e.target.value),
                })
              }
              placeholder="Ex.: 9,90"
              className="w-full border rounded-lg px-2 py-1 text-sm"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-500">Observação</label>
            <input
              type="text"
              value={i.weight || ""}
              onChange={(e) =>
                updateItem(i.id, {
                  weight: e.target.value,
                })
              }
              placeholder="Marca, maturação, tipo, etc."
              className="w-full border rounded-lg px-2 py-1 text-sm"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-500">Curiosidade</label>
            <input
              type="text"
              value={i.note || ""}
              onChange={(e) =>
                updateItem(i.id, {
                  note: e.target.value,
                })
              }
              placeholder="Curiosidade do item"
              className="w-full border rounded-lg px-2 py-1 text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== LISTS MAIN COMPONENT ===== */

export default function Lists() {
  // formulário
  const [location, setLocation] = useState("");
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [name, setName] = useState("");
  const [qtyStr, setQtyStr] = useState("1");
  const [unit, setUnit] = useState("un");
  const [priceStr, setPriceStr] = useState("");
  const [obs, setObs] = useState("");
  const [curiosity, setCuriosity] = useState("");
  const [store, setStore] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);

  // dados principais
  const [items, setItems] = useState([]);

  // filtros e UI
  const [listQuery, setListQuery] = useState("");
  const [cartQuery, setCartQuery] = useState("");
  const [listOpen, setListOpen] = useState(true);
  const [cartOpen, setCartOpen] = useState(true);
  const [openItemId, setOpenItemId] = useState(null); // item expandido

  const currentLocKey = locationKey(location);
  const currentDateKey = date || "";

  // adaptador para manter API day / setDay
  const day = { items };
  const setDay = (updater) => {
    setItems((prev) => {
      const nextDay = updater({ items: prev });
      return nextDay.items;
    });
  };

  /* ===== RASCUNHO: CARREGAR AO MONTAR ===== */

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);

      if (typeof draft.location === "string") setLocation(draft.location);
      if (typeof draft.date === "string") setDate(draft.date);
      if (typeof draft.store === "string") setStore(draft.store);

      if (typeof draft.name === "string") setName(draft.name);
      if (typeof draft.qtyStr === "string") setQtyStr(draft.qtyStr);
      if (typeof draft.unit === "string") setUnit(draft.unit);
      if (typeof draft.priceStr === "string") setPriceStr(draft.priceStr);
      if (typeof draft.obs === "string") setObs(draft.obs);
      if (typeof draft.curiosity === "string") setCuriosity(draft.curiosity);

      if (Array.isArray(draft.items)) setItems(draft.items);
    } catch (e) {
      console.error("Erro ao ler rascunho da lista:", e);
    }
  }, []);

  /* ===== RASCUNHO: SALVAR AUTOMATICAMENTE ===== */

  useEffect(() => {
    const hasItems = items && items.length > 0;
    const hasFormFields =
      location ||
      store ||
      name ||
      priceStr ||
      obs ||
      curiosity ||
      (qtyStr && qtyStr !== "1");

    if (!hasItems && !hasFormFields) {
      // nada relevante -> apaga rascunho
      localStorage.removeItem(DRAFT_KEY);
      return;
    }

    const draft = {
      location,
      date,
      store,
      name,
      qtyStr,
      unit,
      priceStr,
      obs,
      curiosity,
      items,
    };

    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch (e) {
      console.error("Erro ao salvar rascunho da lista:", e);
    }
  }, [
    location,
    date,
    store,
    name,
    qtyStr,
    unit,
    priceStr,
    obs,
    curiosity,
    items,
  ]);

  const allToBuyUnfiltered = useMemo(
    () =>
      day.items
        .filter(
          (i) =>
            locationKey(i.location) === currentLocKey &&
            (i.date || "") === currentDateKey &&
            !i.inCart
        )
        .sort(stableSort),
    [day.items, currentLocKey, currentDateKey]
  );

  const allCartUnfiltered = useMemo(
    () =>
      day.items
        .filter(
          (i) =>
            locationKey(i.location) === currentLocKey &&
            (i.date || "") === currentDateKey &&
            i.inCart
        )
        .sort(stableSort),
    [day.items, currentLocKey, currentDateKey]
  );

  const matches = (q, i) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      (i.name || "").toLowerCase().includes(s) ||
      (i.category || "").toLowerCase().includes(s) ||
      (i.weight || "").toLowerCase().includes(s) ||
      (i.note || "").toLowerCase().includes(s)
    );
  };

  const toBuy = allToBuyUnfiltered.filter((i) => matches(listQuery, i));
  const cart = allCartUnfiltered.filter((i) => matches(cartQuery, i));

  const total = (arr) =>
    arr.reduce(
      (sum, i) =>
        sum +
        (typeof i.price === "number"
          ? i.price * (Number(i.qty) || 1)
          : 0),
      0
    );

  /* ===== AGRUPAR POR CATEGORIA (para Lista e Carrinho) ===== */
  const groupByCategory = (arr) => {
    const groups = [];
    let currentCat = null;
    let currentGroup = null;

    arr.forEach((item) => {
      const cat = item.category || "Outros";
      if (cat !== currentCat) {
        currentCat = cat;
        currentGroup = {
          key: cat || "Outros",
          label: cat || "Outros",
          items: [],
        };
        groups.push(currentGroup);
      }
      currentGroup.items.push(item);
    });

    return groups;
  };

  const groupedToBuy = groupByCategory(toBuy);
  const groupedCart = groupByCategory(cart);

  /* ===== HISTÓRICO DE PREÇOS ===== */

  const lastPriceFor = (nm) => {
    const key = normalize(nm);
    const history = items
      .filter(
        (it) =>
          normalize(it.name) === key && typeof it.price === "number"
      )
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return history[history.length - 1]?.price ?? null;
  };

  /* ===== SUGESTÕES DO CATÁLOGO ===== */

  const suggestions = useMemo(() => {
    if (!showSuggest) return [];
    const nm = name.trim();
    if (!nm) return [];
    const key = normalize(nm);
    return yggItems
      .filter((it) => normalize(it.name).includes(key))
      .slice(0, 8);
  }, [name, showSuggest]);

  const handleSelectSuggestion = (item) => {
    setName(item.name);
    if (!curiosity) {
      setCuriosity(item.curiosity || "");
    }

    // tenta trazer preço do histórico
    const last = lastPriceFor(item.name);
    if (last != null && !priceStr) {
      setPriceStr(numberToField(last));
    }

    setShowSuggest(false);
  };

  /* ===== CRUD ===== */

  const addItem = (toCart = false) => {
    const nm = (name || "").trim();
    if (!nm) return;

    const catalogEntry = findCatalog(nm);

    let price = toLocaleNumber(priceStr);
    if (price == null) {
      const fromHistory = lastPriceFor(nm);
      if (fromHistory != null) price = fromHistory;
    }

    const item = {
      id: uid(),
      name: nm,
      qty: toLocaleNumber(qtyStr) || 1,
      unit,
      price,
      weight: obs || "",
      note: curiosity || catalogEntry?.curiosity || "",
      icon: catalogEntry?.icon ?? null,
      kcalPer100: catalogEntry?.kcalPer100 ?? null,
      category: catalogEntry?.category ?? "Outros",
      store: store || "",
      location: location || "",
      date: date || new Date().toISOString().slice(0, 10),
      inCart: toCart,
      createdAt: Date.now(),
    };

    setDay((prev) => ({ ...prev, items: [item, ...prev.items] }));

    // reset form do item
    setName("");
    setQtyStr("1");
    setUnit("un");
    setPriceStr("");
    setObs("");
    setCuriosity("");
    setShowSuggest(false);
    setOpenItemId(null);
  };

  const updateItem = (id, patch) =>
    withScrollLock(() => {
      setDay((prev) => ({
        ...prev,
        items: prev.items.map((i) =>
          i.id === id ? { ...i, ...patch } : i
        ),
      }));
    });

  const toggleCartItem = (id, val) =>
    withScrollLock(() => {
      setDay((prev) => ({
        ...prev,
        items: prev.items.map((i) =>
          i.id === id ? { ...i, inCart: val } : i
        ),
      }));
      setOpenItemId(null); // sempre recolhe ao mover
    });

  const removeItem = (id) =>
    withScrollLock(() => {
      setDay((prev) => ({
        ...prev,
        items: prev.items.filter((i) => i.id !== id),
      }));
      setOpenItemId(null);
    });

  const moveAllToCart = () =>
    withScrollLock(() => {
      setDay((prev) => ({
        ...prev,
        items: prev.items.map((i) => {
          if (
            !i.inCart &&
            locationKey(i.location) === currentLocKey &&
            (i.date || "") === currentDateKey
          ) {
            return { ...i, inCart: true };
          }
          return i;
        }),
      }));
      setOpenItemId(null);
    });

  const moveAllToList = () =>
    withScrollLock(() => {
      setDay((prev) => ({
        ...prev,
        items: prev.items.map((i) => {
          if (
            i.inCart &&
            locationKey(i.location) === currentLocKey &&
            (i.date || "") === currentDateKey
          ) {
            return { ...i, inCart: false };
          }
          return i;
        }),
      }));
      setOpenItemId(null);
    });

  // >>> salvar nos Reports + limpar a lista atual
  const finalizePurchase = () =>
    withScrollLock(() => {
      setDay((prev) => {
        const allItems = prev.items;

        // itens da lista atual (mesmo local + mesma data)
        const currentItems = allItems.filter(
          (i) =>
            locationKey(i.location) === currentLocKey &&
            (i.date || "") === currentDateKey
        );

        // 1) joga essa lista para a base de relatórios
        if (currentItems.length > 0) {
          const completedList = {
            id: uid(),
            createdAt: Date.now(),
            date: currentDateKey,
            location: location || "",
            store: store || "",
            items: currentItems,
          };

          try {
            const key = "YGG_LISTS_IMPORT";
            const raw = localStorage.getItem(key) || "[]";
            let prevLists;
            try {
              const parsed = JSON.parse(raw);
              prevLists = Array.isArray(parsed) ? parsed : [];
            } catch {
              prevLists = [];
            }
            const merged = [...prevLists, completedList];
            localStorage.setItem(key, JSON.stringify(merged));
          } catch (e) {
            console.error(
              "Erro ao salvar lista concluída nos relatórios:",
              e
            );
          }
        }

        // 2) remove todos os itens dessa lista da área de listas
        const remaining = allItems.filter(
          (i) =>
            !(
              locationKey(i.location) === currentLocKey &&
              (i.date || "") === currentDateKey
            )
        );

        return { ...prev, items: remaining };
      });

      // 3) limpa o formulário do item (mantém Local/Data/Loja)
      setName("");
      setQtyStr("1");
      setUnit("un");
      setPriceStr("");
      setObs("");
      setCuriosity("");
      setOpenItemId(null);
    });

  /* ===== RENDER ===== */

  return (
    <section className="space-y-4">
      {/* FORMULÁRIO DE NOVO ITEM */}
      <div className="bg-white rounded-2xl border shadow-sm p-4 space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">
          Novo item
        </h2>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Local */}
          <div className="basis-full md:basis-[48%]">
            <label className="text-sm">Local</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ex.: Casa, Trabalho, Chácara..."
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          {/* Data */}
          <div className="basis-full md:basis-[48%]">
            <label className="text-sm">Data</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          {/* Item */}
          <div className="basis-full md:col-span-2">
            <label className="text-sm">Item</label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setShowSuggest(true);
                }}
                onFocus={() => setShowSuggest(true)}
                placeholder="Ex.: Tomate, Arroz, Frango..."
                className="w-full border rounded-lg px-3 py-2"
              />

              {suggestions.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-xl border bg-white shadow-lg text-sm">
                  {suggestions.map((sug) => (
                    <button
                      key={sug.name}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault(); // evita perder o foco antes do clique
                        handleSelectSuggestion(sug);
                      }}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-emerald-50"
                    >
                      <span>{sug.icon || "🛒"}</span>
                      <span className="flex-1">
                        <span className="font-medium">{sug.name}</span>
                        {sug.category && (
                          <span className="ml-1 text-[11px] text-slate-500">
                            • {sug.category}
                          </span>
                        )}
                        {sug.curiosity && (
                          <div className="text-[11px] text-slate-500 line-clamp-2">
                            {sug.curiosity}
                          </div>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quantidade + Unidade */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-sm">Quantidade</label>
              <input
                type="text"
                value={qtyStr}
                onChange={(e) => setQtyStr(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div className="w-28">
              <label className="text-sm">Unidade</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 bg-white"
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Preço + Mercado */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-sm">Preço</label>
              <input
                type="text"
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
                placeholder="Ex.: 9,90"
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div className="flex-1">
              <label className="text-sm">Mercado / Loja</label>
              <input
                type="text"
                value={store}
                onChange={(e) => setStore(e.target.value)}
                placeholder="Opcional"
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>

          {/* Observação */}
          <div className="basis-full md:basis-[48%]">
            <label className="text-sm">Observação</label>
            <input
              type="text"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Marca, maturação, tipo, etc."
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          {/* Curiosidade */}
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

          {/* Botões */}
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
      </div>

      {/* LISTA + CARRINHO */}
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
                Lista{" "}
                <span className="text-slate-500 font-normal">
                  ({allToBuyUnfiltered.length})
                </span>
              </h3>
              <span
                className={`inline-block transition-transform duration-200 ${
                  listOpen ? "rotate-90" : ""
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
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-ygg-100"
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
            <div className="space-y-4">
              {groupedToBuy.map((group) => (
                <div key={group.key}>
                  <div className="flex items-baseline justify-between mb-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                      {group.label}
                    </div>
                    {total(group.items) > 0 && (
                      <div className="text-[11px] text-slate-500">
                        {fmtBRL(total(group.items))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    {group.items.map((i) => (
                      <ItemRow
                        key={i.id}
                        i={i}
                        inCartView={false}
                        isOpen={openItemId === i.id}
                        onToggleOpen={() =>
                          setOpenItemId((cur) =>
                            cur === i.id ? null : i.id
                          )
                        }
                        toggleCartItem={toggleCartItem}
                        removeItem={removeItem}
                        updateItem={updateItem}
                      />
                    ))}
                  </div>
                </div>
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
                Carrinho{" "}
                <span className="text-slate-500 font-normal">
                  ({allCartUnfiltered.length})
                </span>
              </h3>
              <span
                className={`inline-block transition-transform duration-200 ${
                  cartOpen ? "rotate-90" : ""
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
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-ygg-100"
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
            <div className="space-y-4">
              {groupedCart.map((group) => (
                <div key={group.key}>
                  <div className="flex items-baseline justify-between mb-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                      {group.label}
                    </div>
                    {total(group.items) > 0 && (
                      <div className="text-[11px] text-slate-500">
                        {fmtBRL(total(group.items))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    {group.items.map((i) => (
                      <ItemRow
                        key={i.id}
                        i={i}
                        inCartView={true}
                        isOpen={openItemId === i.id}
                        onToggleOpen={() =>
                          setOpenItemId((cur) =>
                            cur === i.id ? null : i.id
                          )
                        }
                        toggleCartItem={toggleCartItem}
                        removeItem={removeItem}
                        updateItem={updateItem}
                      />
                    ))}
                  </div>
                </div>
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
              onClick={finalizePurchase}
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
