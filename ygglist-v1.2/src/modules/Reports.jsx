import React, { useEffect, useMemo, useState } from "react";

/** ---------- helpers de data ---------- */
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const startOfMonth = (d = new Date()) => iso(new Date(d.getFullYear(), d.getMonth(), 1));
const endOfMonth = (d = new Date()) => iso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
const addDays = (d, n) => iso(new Date(new Date(d).setDate(new Date(d).getDate() + n)));

/** ---------- loader robusto (pega onde estiver) ---------- */
function loadLists() {
  try {
    // tenta chaves conhecidas
    const known =
      JSON.parse(localStorage.getItem("YGG_LISTS") || "null") ||
      JSON.parse(localStorage.getItem("lists") || "null") ||
      JSON.parse(localStorage.getItem("ygg_lists") || "null");

    if (Array.isArray(known)) return known;

    // varre todas as chaves procurando uma coleção com items
    for (const k in localStorage) {
      if (!Object.prototype.hasOwnProperty.call(localStorage, k)) continue;
      const v = JSON.parse(localStorage.getItem(k) || "null");
      if (Array.isArray(v) && v.length && v[0]?.items) return v;
    }
  } catch (_) {}
  return [];
}

/** ---------- agrega dados ---------- */
function aggregate(lists, dtStart, dtEnd) {
  const from = new Date(dtStart + "T00:00:00");
  const to = new Date(dtEnd + "T23:59:59");

  const rows = [];

  for (const list of lists) {
    const when = new Date(list?.date || list?.createdAt || list?.dia || Date.now());
    if (when < from || when > to) continue;

    const items = list.items || [];
    for (const it of items) {
      // considera itens marcados/comprados; ajuste se quiser incluir todos
      const done = it?.done ?? true;
      if (!done) continue;

      const qty = Number(it?.qty || it?.qtd || 1);
      const price = Number(
        ("" + (it?.price ?? it?.preco ?? 0)).replace(",", ".")
      );
      const cat = (it?.category || it?.categoria || "Outros").trim();

      const total = qty * price;
      if (!isFinite(total) || total <= 0) continue;

      rows.push({ cat, total });
    }
  }

  const byCat = rows.reduce((acc, r) => {
    acc[r.cat] = (acc[r.cat] || 0) + r.total;
    return acc;
  }, {});
  const grand = rows.reduce((s, r) => s + r.total, 0);

  const catRows = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, val]) => ({
      cat,
      val,
      pct: grand ? (val / grand) * 100 : 0,
    }));

  return { grand, catRows };
}

export default function Reports() {
  const allLists = useMemo(loadLists, []);

  // presets
  const today = iso(new Date());
  const [preset, setPreset] = useState("month"); // 'range' | '7d' | 'month' | 'lastMonth' | 'week'
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(endOfMonth());

  // aplica preset
  useEffect(() => {
    const now = new Date();
    if (preset === "7d") {
      const end = iso(now);
      setFrom(addDays(end, -6));
      setTo(end);
    } else if (preset === "week") {
      const dow = now.getDay(); // 0..6 (dom=0)
      const start = addDays(iso(now), -(dow === 0 ? 6 : dow - 1)); // segunda
      setFrom(start);
      setTo(addDays(start, 6));
    } else if (preset === "month") {
      setFrom(startOfMonth(now));
      setTo(endOfMonth(now));
    } else if (preset === "lastMonth") {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      setFrom(startOfMonth(lm));
      setTo(endOfMonth(lm));
    }
    // 'range' não altera datas
  }, [preset]);

  const { grand, catRows } = useMemo(() => aggregate(allLists, from, to), [allLists, from, to]);

  return (
    <section className="space-y-4">
      {/* FILTROS */}
      <div className="bg-white rounded-2xl border p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-wrap gap-2">
            {[
              ["7d", "Últimos 7 dias"],
              ["week", "Semana atual"],
              ["month", "Este mês"],
              ["lastMonth", "Mês passado"],
              ["range", "Período livre"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPreset(key)}
                className={
                  "px-3 py-2 rounded-lg border " +
                  (preset === key
                    ? "bg-ygg-700 text-white"
                    : "bg-white hover:bg-emerald-50")
                }
              >
                {label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-end gap-3">
            <div>
              <label className="text-sm">De</label>
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPreset("range");
                }}
                max={to}
                className="border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="text-sm">Até</label>
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPreset("range");
                }}
                min={from}
                max={today}
                className="border rounded-lg px-3 py-2"
              />
            </div>
          </div>
        </div>
      </div>

      {/* RESUMO GERAL */}
      <div className="bg-white rounded-2xl border p-4">
        <h3 className="text-lg font-semibold">Resumo</h3>
        <p className="text-slate-600">
          Período: <span className="font-medium">{from}</span> a{" "}
          <span className="font-medium">{to}</span>
        </p>
        <div className="mt-3 text-2xl font-semibold">
          Total:{" "}
          <span className="text-emerald-800">
            {grand.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
        </div>
      </div>

      {/* POR CATEGORIA (valores + %) */}
      <div className="bg-white rounded-2xl border p-4">
        <h3 className="text-lg font-semibold mb-3">Por categoria</h3>
        {catRows.length === 0 ? (
          <p className="text-slate-600">Sem compras concluídas no período.</p>
        ) : (
          <div className="space-y-2">
            {catRows.map((r) => (
              <div key={r.cat}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{r.cat}</span>
                  <span className="tabular-nums">
                    {r.pct.toFixed(1)}% •{" "}
                    {r.val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-emerald-100 overflow-hidden">
                  <div
                    className="h-full bg-emerald-600"
                    style={{ width: `${Math.min(100, r.pct).toFixed(2)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
