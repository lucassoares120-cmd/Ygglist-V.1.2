// ygglist-v1.2/src/modules/Lists.jsx
import React, { useState, useMemo } from "react";
import yggItems from "../data/ygg_items.json";

/* ===== HELPERS ===== */

const uid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : String(Date.now() + Math.random());

const toLocaleNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;

  const s = String(value).trim();
  if (!s) return null;

  // aceita vírgula como separador decimal
  const normalized = s.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isNaN(n) ? null : n;
};

const fmtBRL = (v) => {
  const n = Number(v) || 0;
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });
};

const stableSort = (a, b) => {
  const an = (a.name || "").toLowerCase();
  const bn = (b.name || "").toLowerCase();
  if (an < bn) return -1;
  if (an > bn) return 1;
  return 0;
};

// wrapper simples pra manter API antiga
const withScrollLock = (fn) => fn();

/* ===== CATÁLOGO YGG (ygg_items.json) ===== */

const normalize = (s) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const findCatalog = (nm) => {
  const key = normalize(nm);
  return yggItems.find((it) => normalize(it.name) === key);
};

/* ===== ITEM ROW ===== */

function ItemRow({ i, inCartView, toggleCartItem, removeItem }) {
  const handleToggle = () => toggleCartItem(i.id, !i.inCart);

  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggle}
            className="text-lg"
            title={inCartView ? "Devolver para a lista" : "Mover para o carrinho"}
          >
            {i.inCart ? "✅" : "⬜"}
          </button>

          <div className="min-w-0">
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
      </div>

      <div className="flex flex-col items-end gap-1">
        {typeof i.price === "number" && (
          <div className="text-xs font-semibold text-slate-700">
            {fmtBRL(i.price)}
          </div>
        )}

        <div className="flex items-center gap-1">
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
    </div>
  );
}

/* ===== LISTS MAIN COMPONENT ===== */

export default function Lists() {
  // formulário
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

  // adaptador para manter API day / setDay
  const day = { items };
  const setDay = (updater) => {
    setItems((prev) => {
      const nextDay = updater({ items: prev });
      return nextDay.items;
    });
  };

  const allToBuyUnfiltered = useMemo(
    () => day.item
