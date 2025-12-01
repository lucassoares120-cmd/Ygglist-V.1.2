import React, { useEffect, useMemo, useRef, useState } from "react";
import { PURCHASES_KEY, load } from "../lib.js";
import yggCatalog from "../data/ygg_items.json";

// normaliza número tipo "1.234,56" -> 1234.56
function normNum(str) {
  if (!str) return 0;
  const s = String(str)
    .replace(/\./g, "") // remove ponto para tratar milhares
    .replace(",", ".")  // substitui a vírgula por ponto decimal
    .replace(/[^\d.-]/g, ""); // remove qualquer outro caractere
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

// normaliza string para comparação (sem acento, minúscula, sem espaços múltiplos)
function normalizeName(str) {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// tenta achar categoria no catálogo + heurísticas
function findCatalogCategory(name) {
  const norm = normalizeName(name);
  if (!norm) return "Outros";

  // 1) tenta bater com o catálogo (ygg_items.json)
  if (Array.isArray(yggCatalog)) {
    for (const entry of yggCatalog) {
      const entryName = normalizeName(entry.name || entry.item || "");
      if (!entryName) continue;

      if (
        norm === entryName ||
        norm.includes(entryName) ||
        entryName.includes(norm)
      ) {
        return entry.category || entry.categoria || "Outros";
      }
    }
  }

  // 2) heurísticas simples por palavras-chave
  if (
    /(maca|mamao|melao|banana|uva|caju|abacaxi|hortifruti|kg)/.test(norm) ||
    /(cebola|alho|salsa|cebolinha|tomate|alface|verdura)/.test(norm)
  ) {
    return "Hortifruti";
  }

  if (
    /(detergente|lava roupa|amaciante|sabao|limp ceramica|agua sanit|cloro|desinfetante|saco lixo|esponja|flanela|vassoura|pedra sanit)/.test(
      norm
    )
  ) {
    return "Limpeza";
  }

  if (
    /(leite|arroz|feijao|cafe|massa|macarr|biscoito|gelat|acucar|ovo)/.test(
      norm
    )
  ) {
    return "Alimentos";
  }

  return "Outros";
}

// tenta achar data dd/mm/aaaa no texto e converte pra ISO (aaaa-mm-dd)
function detectDateISO(text) {
  const m = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return iso(new Date());
  const [, d, mo, y] = m;
  return `${y}-${mo}-${d}`;
}

// tenta achar nome da loja nas primeiras linhas
function detectStoreFromLines(lines) {
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const l = lines[i];
    if (!l) continue;
    if (/NFC[- ]e|NOTA FISCAL|DANFE/i.test(l)) continue;
    if (/CNPJ|CPF|INSCRIÇÃO|INSCRICAO/i.test(l)) continue;
    if (/^\d{2}\/\d{2}\/\d{4}/.test(l)) continue;
    if (/^\d{2}:\d{2}/.test(l)) continue;
    if (/^\d+$/.test(l)) continue;
    return l.trim();
  }
  return "Nota fiscal";
}


/* ====== helpers de data ====== */
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const startOfMonth = (d) => iso(new Date(d.getFullYear(), d.getMonth(), 1));
const endOfMonth = (d) => iso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
const addDays = (dateISO, n) =>
  iso(new Date(new Date(dateISO).setDate(new Date(dateISO).getDate() + n)));

/* ====== CSV safe ====== */
const csvEscape = (v) => {
  if (v == null) return "";
  const s = String(v).replace(/"/g, '""');
  return /[",\n;]/.test(s) ? `"${s}"` : s;
};

/* ====== CSV builder (resumo + detalhe por dia) ====== */
function buildCSV({ summaryByCat, purchasesInRange, fromISO, toISO }) {
  const lines = [];

  // Cabeçalho
  lines.push(`Relatório YggList;Período;${fromISO};${toISO}`);
  lines.push("");

  // 1) RESUMO POR CATEGORIA
  lines.push("Resumo por categoria");
  lines.push("Categoria;Percentual;Valor (R$)");
  summaryByCat.forEach((row) => {
    lines.push(
      [
        csvEscape(row.category),
        `${row.percent.toFixed(1)}%`,
        row.amount.toFixed(2).replace(".", ","),
      ].join(";")
    );
  });
  lines.push("");

  // 2) DETALHE POR DIA (todas as listas do período)
  lines.push("Detalhe por dia (todas as listas)");
  lines.push("Data;Loja;Item;Qtd;Un;Preço;Subtotal;Categoria;Observação");

  purchasesInRange.forEach((p) => {
    const store = p.store || "";
    const date = p.dateISO || "";
    (p.items || []).forEach((it) => {
      const qty = Number(it?.qty ?? 1);
      const price = Number(it?.price ?? 0);
      const subtotal = qty * price;
      lines.push(
        [
          csvEscape(date),
          csvEscape(store),
          csvEscape(it.name),
          String(qty).replace(".", ","),
          csvEscape(it.unit || "un"),
          String(price).replace(".", ","),
          subtotal.toFixed(2).replace(".", ","),
          csvEscape(it.category || ""),
          csvEscape(it.note || ""),
        ].join(";")
      );
    });
  });

  return lines.join("\n");
}

/* ====== helpers para ler "listas" locais (pra gráficos) ====== */
function parseListDate(list) {
  const raw = list?.date || list?.createdAt || list?.dia;
  return new Date(raw || Date.now());
}
function listInRange(list, fromISO, toISO) {
  const when = parseListDate(list);
  return (
    when >= new Date(fromISO + "T00:00:00") &&
    when <= new Date(toISO + "T23:59:59")
  );
}

/**
 * Lê listas salvas localmente:
 * - estrutura original do app
 * - listas importadas de notas (texto colado) em YGG_LISTS_IMPORT
 * - se ainda existir, também YGG_LISTS_NFCE (versão antiga)
 */
function loadLists() {
  function loadLists() {
  try {
    const base =
      JSON.parse(localStorage.getItem("YGG_LISTS") || "null") ||
      JSON.parse(localStorage.getItem("lists") || "null") ||
      JSON.parse(localStorage.getItem("ygg_lists") || "null");

    let main = Array.isArray(base) ? base : [];

    // ⚠️ Não deixar o fallback pegar YGG_LISTS_IMPORT / YGG_LISTS_NFCE
    if (!main.length) {
      for (const k in localStorage) {
        if (!Object.prototype.hasOwnProperty.call(localStorage, k)) continue;
        if (k === "YGG_LISTS_IMPORT" || k === "YGG_LISTS_NFCE") continue; // <-- linha chave

        const v = JSON.parse(localStorage.getItem(k) || "null");
        if (Array.isArray(v) && v.length && v[0]?.items) {
          main = v;
          break;
        }
      }
    }

    const nfceLists =
      JSON.parse(localStorage.getItem("YGG_LISTS_NFCE") || "[]") || [];
    const importedLists =
      JSON.parse(localStorage.getItem("YGG_LISTS_IMPORT") || "[]") || [];

    const arr1 = Array.isArray(nfceLists) ? nfceLists : [];
    const arr2 = Array.isArray(importedLists) ? importedLists : [];

    // Agora cada lista aparece só uma vez
    return [...main, ...arr1, ...arr2];
  } catch {
    return [];
  }
}


function extractMonths(lists) {
  const set = new Set();
  for (const l of lists) {
    const d = parseListDate(l);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
    set.add(ym);
  }
  return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
}

/* ====== agregador (por categoria / por loja / série diária) ====== */
function aggregate(lists, fromISO, toISO) {
  const rows = [];
  const perDay = {};
  const perStore = {};

  for (const list of lists) {
    if (!listInRange(list, fromISO, toISO)) continue;

    const day = iso(parseListDate(list));
    let listDayTotal = 0;
    const listStore = (list?.store || "").trim();

    const items = list.items || [];
    for (const it of items) {
      const done = it?.done ?? true;
      if (!done) continue;

      const qty = Number(it?.qty || it?.qtd || 1);
      const price = Number(
        String(it?.price ?? it?.preco ?? 0).replace(",", ".")
      );
      const cat = (it?.category || it?.categoria || "Outros").trim();
      const store = (it?.store || listStore || "—").trim();

      const total = qty * price;
      if (!isFinite(total) || total <= 0) continue;

      rows.push({ cat, total });
      listDayTotal += total;

      perStore[store] = (perStore[store] || 0) + total;
    }

    if (listDayTotal > 0) perDay[day] = (perDay[day] || 0) + listDayTotal;
  }

  const byCat = rows.reduce(
    (acc, r) => ((acc[r.cat] = (acc[r.cat] || 0) + r.total), acc),
    {}
  );
  const grand = rows.reduce((s, r) => s + r.total, 0);

  const catRows = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, val]) => ({ cat, val, pct: grand ? (val / grand) * 100 : 0 }));

  const storeRows = Object.entries(perStore)
    .sort((a, b) => b[1] - a[1])
    .map(([store, val]) => ({
      store,
      val,
      pct: grand ? (val / grand) * 100 : 0,
    }));

  const series = [];
  for (
    let d = new Date(fromISO);
    d <= new Date(toISO);
    d.setDate(d.getDate() + 1)
  ) {
    const key = iso(d);
    series.push({ day: key, val: perDay[key] || 0 });
  }

  return { grand, catRows, storeRows, series };
}

/* ====== Mini gráfico SVG + download PNG ====== */
function MiniChart({ series, svgRef }) {
  const w = 560,
    h = 120,
    pad = 10;
  const vals = series.map((s) => s.val);
  const min = 0;
  const max = Math.max(...vals, 1);
  const sx = (i) =>
    pad + (i * (w - 2 * pad)) / Math.max(series.length - 1, 1);
  const sy = (v) => h - pad - ((v - min) * (h - 2 * pad)) / (max - min);

  const path = series
    .map((s, i) => `${i === 0 ? "M" : "L"} ${sx(i)} ${sy(s.val)}`)
    .join(" ");
  const area = `M ${sx(0)} ${sy(series[0]?.val || 0)} ${series
    .map((s, i) => `L ${sx(i)} ${sy(s.val)}`)
    .join(" ")} L ${sx(series.length - 1)} ${h - pad} L ${sx(0)} ${
    h - pad
  } Z`;
  const last = series[series.length - 1] || { val: 0 };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${w} ${h}`}
      className="w-full h-32 bg-transparent"
    >
      <defs>
        <linearGradient id="ygga" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#10b981" stopOpacity="0.35" />
          <stop offset="1" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#ygga)" />
      <path d={path} fill="none" stroke="#059669" strokeWidth="2.5" />
      <circle
        cx={sx(series.length - 1)}
        cy={sy(last.val)}
        r="3.5"
        fill="#047857"
      />
    </svg>
  );
}

function downloadSvgAsPng(svgEl, filename = "grafico.png", scale = 2) {
  if (!svgEl) return;
  const xml = new XMLSerializer().serializeToString(svgEl);
  const svg64 = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    const bbox = svgEl.viewBox.baseVal;
    canvas.width = bbox.width * scale;
    canvas.height = bbox.height * scale;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  img.src = svg64;
}

/* ====== PARSER DE TEXTO DA NOTA ====== */

// parser de itens a partir do TEXTO da nota
function parseItemsFromText(text) {
  const rawLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const items = [];

  // Padrão específico desse layout de MG:
  // DESCRIÇÃO ... Qtde total de ítens: 3.0000 UN: KG Valor total R$: R$ 12,34
  const mgPattern =
    /^(.+?)\s+Qtde total de ítens:\s*([\d.,]+)\s+UN:\s*([A-Z]+)\s+Valor total R\$:\s*R\$\s*([\d.,]+)/i;

  for (const raw of rawLines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;

    const m = line.match(mgPattern);
    if (m) {
      const [, namePart, qtyStr, unitRaw, totalStr] = m;
      const qty = normNum(qtyStr) || 1;
      const total = normNum(totalStr);
      if (!total) continue;

      const unitPrice = total / qty;

      items.push({
        name: namePart.trim(),
        qty,
        unit: unitRaw.toLowerCase(), // un, kg, bd, pc, etc.
        price: unitPrice,
      });
    }
  }

  // Se conseguiu extrair via padrão MG, retorna
  if (items.length) return items;

  // ===== Fallback genérico para outras notas =====
  const moneyRe = /\d+,\d{2}/g;
  const genericItems = [];

  for (const raw of rawLines) {
    const line = raw.replace(/\s+/g, " ");

    if (/TOTAL\s|VALOR A PAGAR|VALOR A PAGAMENTO|SUBTOTAL|TROCO/i.test(line)) {
      continue;
    }

    const moneyMatches = [...line.matchAll(moneyRe)].map((m) => m[0]);
    if (moneyMatches.length === 0) continue;

    const totalStr = moneyMatches[moneyMatches.length - 1];
    const total = normNum(totalStr);
    if (!total) continue;

    const idxTotal = line.lastIndexOf(totalStr);
    let descPart = line.slice(0, idxTotal).trim();
    if (!descPart) continue;

    descPart = descPart.replace(/^\d+\s+/, "").trim();

    let qty = 1;
    let unit = "un";
    const qtyUnitMatch =
      descPart.match(
        /(\d+[.,]?\d*)\s*(kg|g|un|und|unid|pc|pct|lt|l|cx|caixa|pacote)/i
      ) || null;

    if (qtyUnitMatch) {
      qty = normNum(qtyUnitMatch[1]);
      unit = qtyUnitMatch[2];
      if (!qty || qty <= 0) qty = 1;
    }

    const unitPrice = total / qty;

    genericItems.push({
      name: descPart,
      qty,
      unit,
      price: unitPrice,
    });
  }

  if (!genericItems.length) {
    for (const raw of rawLines) {
      const line = raw.replace(/\s+/g, " ");

      if (/TOTAL\s|VALOR A PAGAR|VALOR A PAGAMENTO|SUBTOTAL|TROCO/i.test(line)) {
        continue;
      }

      const moneyMatches = [...line.matchAll(moneyRe)].map((m) => m[0]);
      if (moneyMatches.length !== 1) continue;

      const totalStr = moneyMatches[0];
      const total = normNum(totalStr);
      if (!total) continue;

      const idxTotal = line.lastIndexOf(totalStr);
      let descPart = line.slice(0, idxTotal).trim();
      descPart = descPart.replace(/^\d+\s+/, "").trim();
      if (!descPart) continue;

      genericItems.push({
        name: descPart,
        qty: 1,
        unit: "un",
        price: total,
      });
    }
  }

  return genericItems;
}
// Fim parser

/* ====== UI ====== */
export default function Reports() {
  const [listsVersion, setListsVersion] = useState(0);
  const allLists = useMemo(loadLists, [listsVersion]);
  const months = useMemo(() => extractMonths(allLists), [allLists]);

  const today = new Date();
  const [preset, setPreset] = useState("month"); // '7d' | 'week' | 'month' | 'lastMonth' | 'monthSelect' | 'free'
  const [from, setFrom] = useState(startOfMonth(today));
  const [to, setTo] = useState(endOfMonth(today));
  const [monthSel, setMonthSel] = useState(
    months[0] ||
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
        2,
        "0"
      )}`
  );
  const [comparePrevMonth, setComparePrevMonth] = useState(true);

  // estado da importação por TEXTO
  const [showImportModal, setShowImportModal] = useState(false);
  const [nfText, setNfText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSummary, setImportSummary] = useState(null);

  // presets
  const setLast7 = () => setPreset("7d");
  const setWeek = () => setPreset("week");
  const setThisMonth = () => setPreset("month");
  const setPrevMonth = () => setPreset("lastMonth");
  const setFree = () => setPreset("free");

  const chip = (k) =>
    `px-3 py-2 rounded-lg border text-sm ${
      preset === k
        ? "bg-emerald-600 text-white border-emerald-600"
        : "hover:bg-emerald-50"
    }`;

  // aplica preset -> from/to
  useEffect(() => {
    const now = new Date();
    if (preset === "7d") {
      const end = iso(now);
      setFrom(addDays(end, -6));
      setTo(end);
    } else if (preset === "week") {
      const dow = now.getDay();
      const start = addDays(iso(now), -(dow === 0 ? 6 : dow - 1));
      setFrom(start);
      setTo(addDays(start, 6));
    } else if (preset === "month") {
      setFrom(startOfMonth(now));
      setTo(endOfMonth(now));
    } else if (preset === "lastMonth") {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      setFrom(startOfMonth(lm));
      setTo(endOfMonth(lm));
    } else if (preset === "monthSelect") {
      const [y, m] = monthSel.split("-").map((n) => parseInt(n, 10));
      const base = new Date(y, m - 1, 1);
      setFrom(startOfMonth(base));
      setTo(endOfMonth(base));
    }
  }, [preset, monthSel]);

  const { grand, catRows, storeRows, series } = useMemo(
    () => aggregate(allLists, from, to),
    [allLists, from, to]
  );

  const prevAgg = useMemo(() => {
    if (!comparePrevMonth) return null;
    if (
      !(
        preset === "month" ||
        preset === "monthSelect" ||
        preset === "lastMonth"
      )
    )
      return null;
    const base = new Date(from);
    const prevStart = startOfMonth(
      new Date(base.getFullYear(), base.getMonth() - 1, 1)
    );
    const prevEnd = endOfMonth(
      new Date(base.getFullYear(), base.getMonth() - 1, 1)
    );
    return aggregate(allLists, prevStart, prevEnd);
  }, [comparePrevMonth, preset, from, allLists]);

  const svgRef = useRef(null);

  const handleExportPNG = () =>
    downloadSvgAsPng(svgRef.current, `YggList_${from}_a_${to}.png`, 3);

  const handleExportCSV = () => {
    const allPurchases = load(PURCHASES_KEY, []);
    const purchasesInRange = allPurchases.filter(
      (p) => p.dateISO >= from && p.dateISO <= to
    );

    const catMap = {};
    purchasesInRange.forEach((p) => {
      (p.items || []).forEach((it) => {
        const qty = Number(it?.qty ?? 1);
        const price = Number(it?.price ?? 0);
        const cat = (it?.category || "Outros").trim();
        const subtotal = qty * price;
        if (subtotal > 0) {
          catMap[cat] = (catMap[cat] || 0) + subtotal;
        }
      });
    });
    const total = Object.values(catMap).reduce((a, b) => a + b, 0);
    const summaryByCat = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => ({
        category,
        amount,
        percent: total ? (amount / total) * 100 : 0,
      }));

    const csvText = buildCSV({
      summaryByCat,
      purchasesInRange,
      fromISO: from,
      toISO: to,
    });

    const blob = new Blob([csvText], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ygglist_${from}_a_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* === Importar nota via TEXTO colado === */
  const handleImportFromText = () => {
    setImportError("");
    setImportSummary(null);

    const raw = nfText.trim();
    if (!raw) {
      setImportError("Cole o texto da nota fiscal aqui antes de importar.");
      return;
    }

    setIsImporting(true);
    try {
      const lines = raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      const items = parseItemsFromText(raw);
      if (!items.length) {
        throw new Error(
          "Não consegui identificar itens na nota. Tente copiar a nota inteira (texto completo)."
        );
      }

      const dateISO = detectDateISO(raw);
      const store = detectStoreFromLines(lines);

      const now = Date.now();
   const list = {
  id: `import-${now}`,
  store,
  date: dateISO,
  items: items.map((it, idx) => {
    const cat = findCatalogCategory(it.name);
    return {
      id: `import-${now}-${idx}`,
      name: it.name,
      qty: it.qty,
      unit: it.unit,
      price: it.price,
      category: cat,
      note: "",
      store,
      done: true,
    };
  }),
};


        const key = "YGG_LISTS_IMPORT";
      const prev = JSON.parse(localStorage.getItem(key) || "[]") || [];
      const arr = Array.isArray(prev) ? prev : [];

      // assinatura da nota: loja + data + nº de itens
      const signature = `${store}__${dateISO}__${items.length}`;

      // remove qualquer nota antiga com a mesma assinatura
      const filtered = arr.filter((l) => {
        const s = `${l.store}__${l.date}__${(l.items || []).length}`;
        return s !== signature;
      });

      const merged = [...filtered, list];
      localStorage.setItem(key, JSON.stringify(merged));


      const totalValue = list.items.reduce(
        (s, it) => s + (Number(it.qty || 1) * Number(it.price || 0)),
        0
      );

      setImportSummary({
        store,
        dateISO,
        totalItems: list.items.length,
        totalValue,
      });

      setListsVersion((v) => v + 1);
    } catch (err) {
      console.error(err);
      setImportError(
        err.message ||
          "Erro ao interpretar o texto da nota. Tente colar o conteúdo completo."
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleCloseModal = () => {
    setShowImportModal(false);
    setNfText("");
    setImportError("");
    setImportSummary(null);
  };

  return (
    <section className="space-y-4">
      {/* === FILTROS / PERÍODO (3 linhas) === */}
      <div className="bg-white rounded-2xl border shadow-sm p-4 space-y-3">
        {/* 1ª linha: botões de período rápido */}
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={setLast7} className={chip("7d")}>
            Últimos 7 dias
          </button>
          <button onClick={setWeek} className={chip("week")}>
            Semana atual
          </button>
          <button onClick={setThisMonth} className={chip("month")}>
            Este mês
          </button>
          <button onClick={setPrevMonth} className={chip("lastMonth")}>
            Mês passado
          </button>
          <button onClick={setFree} className={chip("free")}>
            Período livre
          </button>
        </div>

        {/* 2ª linha: mês, de, até */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label className="text-sm">Mês</label>
            <select
              value={monthSel}
              onChange={(e) => {
                setMonthSel(e.target.value);
                setPreset("monthSelect");
              }}
              className="w-full border rounded-lg px-3 py-2"
            >
              {(months.length ? months : [monthSel]).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm">De</label>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPreset("free");
              }}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm">Até</label>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPreset("free");
              }}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
        </div>

        {/* 3ª linha: Exportações + Importar nota (texto) */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-2 rounded-lg border text-sm"
            >
              Exportar CSV
            </button>
            <button
              onClick={handleExportPNG}
              className="px-3 py-2 rounded-lg border text-sm"
            >
              Baixar PNG
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700"
          >
            📄 Importar nota (texto)
          </button>
        </div>
      </div>

      {/* RESUMO + MINI-GRÁFICO + COMPARAÇÃO */}
      <div className="bg-white rounded-2xl border p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="min-w-[260px]">
            <h3 className="text-lg font-semibold">Resumo</h3>
            <p className="text-slate-600">
              Período: <span className="font-medium">{from}</span> a{" "}
              <span className="font-medium">{to}</span>
            </p>
            <div className="mt-3 text-2xl font-semibold">
              Total:{" "}
              <span className="text-emerald-800">
                {grand.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </span>
            </div>

            {prevAgg && prevAgg.grand >= 0 && (
              <div className="mt-3 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={comparePrevMonth}
                    onChange={(e) =>
                      setComparePrevMonth(e.target.checked)
                    }
                  />
                  Comparar com mês anterior
                </label>
                {comparePrevMonth && (
                  <div className="mt-2">
                    <div className="text-slate-600">
                      Mês anterior:{" "}
                      <span className="font-medium">
                        {prevAgg.grand.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </span>
                    </div>
                    <div className="font-medium">
                      Variação:{" "}
                      <span
                        className={
                          grand - prevAgg.grand >= 0
                            ? "text-emerald-700"
                            : "text-red-600"
                        }
                      >
                        {(
                          ((grand - prevAgg.grand) /
                            (prevAgg.grand || 1)) *
                          100
                        ).toFixed(1)}
                        %
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="w-full md:w-[60%]">
            <MiniChart series={series} svgRef={svgRef} />
          </div>
        </div>
      </div>

      {/* POR CATEGORIA */}
      <div className="bg-white rounded-2xl border p-4">
        <h3 className="text-lg font-semibold mb-3">Por categoria</h3>
        {catRows.length === 0 ? (
          <p className="text-slate-600">
            Sem compras concluídas no período.
          </p>
        ) : (
          <div className="space-y-2">
            {catRows.map((r) => (
              <div key={r.cat}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{r.cat}</span>
                  <span className="tabular-nums">
                    {r.pct.toFixed(1)}% •{" "}
                    {r.val.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-emerald-100 overflow-hidden">
                  <div
                    className="h-full bg-emerald-600"
                    style={{
                      width: `${Math.min(100, r.pct).toFixed(2)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* POR LOJA / MERCADO */}
      <div className="bg-white rounded-2xl border p-4">
        <h3 className="text-lg font-semibold mb-3">
          Por loja / mercado
        </h3>
        {storeRows.length === 0 ? (
          <p className="text-slate-600">
            Sem dados de loja para o período.
          </p>
        ) : (
          <div className="space-y-2">
            {storeRows.map((r) => (
              <div key={r.store}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{r.store}</span>
                  <span className="tabular-nums">
                    {r.pct.toFixed(1)}% •{" "}
                    {r.val.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-emerald-100 overflow-hidden">
                  <div
                    className="h-full bg-emerald-700"
                    style={{
                      width: `${Math.min(100, r.pct).toFixed(2)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL DE IMPORTAÇÃO (TEXTO) */}
      {showImportModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-lg max-w-lg w-full p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">
                Importar nota fiscal (texto)
              </h3>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-slate-500 hover:text-slate-800 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <p className="text-sm text-slate-600">
              Abra a nota fiscal (site da NFC-e, PDF em texto, etc),{" "}
              <strong>selecione todo o texto</strong>, copie e cole
              aqui. O YggList vai tentar identificar os itens e os
              valores automaticamente.
            </p>

            <textarea
              rows={6}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Cole aqui o texto completo da nota..."
              value={nfText}
              onChange={(e) => setNfText(e.target.value)}
            />

            {importError && (
              <p className="text-sm text-red-600">{importError}</p>
            )}

            {importSummary && (
              <div className="text-sm bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <div>
                  <strong>Loja:</strong> {importSummary.store}
                </div>
                <div>
                  <strong>Data:</strong> {importSummary.dateISO}
                </div>
                <div>
                  <strong>Itens:</strong> {importSummary.totalItems}
                </div>
                <div>
                  <strong>Total importado:</strong>{" "}
                  {importSummary.totalValue.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </div>
                <div className="mt-1 text-emerald-700">
                  Nota importada com sucesso. Esses dados já entram
                  nos relatórios do período selecionado.
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-3 py-2 rounded-lg border text-sm"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleImportFromText}
                disabled={isImporting}
                className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm disabled:opacity-60"
              >
                {isImporting ? "Interpretando…" : "Importar e salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
