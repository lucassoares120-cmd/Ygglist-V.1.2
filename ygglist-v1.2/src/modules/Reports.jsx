import React, { useEffect, useMemo, useRef, useState } from "react";
import { PURCHASES_KEY, load } from "../lib.js";

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
 * Lê listas salvas localmente (fluxo antigo) + listas importadas de NFC-e
 * (armazenadas em YGG_LISTS_NFCE).
 */
function loadLists() {
  try {
    // fonte principal (estrutura original do app)
    const base =
      JSON.parse(localStorage.getItem("YGG_LISTS") || "null") ||
      JSON.parse(localStorage.getItem("lists") || "null") ||
      JSON.parse(localStorage.getItem("ygg_lists") || "null");

    let main = Array.isArray(base) ? base : [];

    // fallback: qualquer chave que tenha um array de listas com "items"
    if (!main.length) {
      for (const k in localStorage) {
        if (!Object.prototype.hasOwnProperty.call(localStorage, k)) continue;
        const v = JSON.parse(localStorage.getItem(k) || "null");
        if (Array.isArray(v) && v.length && v[0]?.items) {
          main = v;
          break;
        }
      }
    }

    // listas extras vindas de notas fiscais (NFC-e)
    const nfceLists =
      JSON.parse(localStorage.getItem("YGG_LISTS_NFCE") || "[]") || [];
    const nfceArr = Array.isArray(nfceLists) ? nfceLists : [];

    return [...main, ...nfceArr];
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
      const done = it?.done ?? true; // se sua estrutura tiver "done/inCart"
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

/* ====== UI ====== */
export default function Reports() {
  // para recarregar listas quando uma NFC-e nova é salva
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

  // estado da importação de NFC-e
  const [showImportModal, setShowImportModal] = useState(false);
  const [nfceText, setNfceText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSummary, setImportSummary] = useState(null);

  // presets
  const setLast7 = () => setPreset("7d");
  const setWeek = () => setPreset("week");
  const setThisMonth = () => setPreset("month");
  const setPrevMonth = () => setPreset("lastMonth");
  const setFree = () => setPreset("free");

  // classe dos chips
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
    // 'free' não altera from/to
  }, [preset, monthSel]);

  const { grand, catRows, storeRows, series } = useMemo(
    () => aggregate(allLists, from, to),
    [allLists, from, to]
  );

  // comparação com mês anterior (só em presets de mês)
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

  // Exportar PNG
  const handleExportPNG = () =>
    downloadSvgAsPng(svgRef.current, `YggList_${from}_a_${to}.png`, 3);

  // Exportar CSV (compras finalizadas em PURCHASES_KEY)
  const handleExportCSV = () => {
    const allPurchases = load(PURCHASES_KEY, []);
    const purchasesInRange = allPurchases.filter(
      (p) => p.dateISO >= from && p.dateISO <= to
    );

    // resumo por categoria a partir das compras
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

  /* === Importar NFC-e via QR/URL === */
  const handleImportNfce = async () => {
    setImportError("");
    setImportSummary(null);

    const raw = nfceText.trim();
    if (!raw) {
      setImportError("Cole o link ou conteúdo do QR code da NFC-e.");
      return;
    }

    // Se o usuário colar o texto inteiro do QR, tentamos extrair a parte do "http"
    const httpIdx = raw.indexOf("http");
    const url = httpIdx >= 0 ? raw.slice(httpIdx).trim() : raw;

    try {
      setIsImporting(true);
      const res = await fetch("/api/nfce-parser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Falha ao consultar a nota fiscal.");
      }

      const data = await res.json();

      const store = (data.store || data.emitter || "Nota fiscal").trim();
      const dateISO =
        data.dateISO ||
        data.date ||
        new Date().toISOString().slice(0, 10);

      const items = Array.isArray(data.items) ? data.items : [];
      if (!items.length) {
        throw new Error("Nenhum item foi encontrado na página da NFC-e.");
      }

      const listKey = "YGG_LISTS_NFCE";
      const prev =
        JSON.parse(localStorage.getItem(listKey) || "[]") || [];

      const now = Date.now();
      const list = {
        id: data.id || `nfce-${now}`,
        store,
        date: dateISO,
        items: items.map((it, idx) => ({
          id: it.id || `nfce-${now}-${idx}`,
          name: it.name || "Item",
          qty: Number(it.qty ?? 1),
          unit: it.unit || "un",
          price: Number(it.price ?? 0),
          category: it.category || "Outros",
          note: it.note || "",
          store,
          done: true,
        })),
      };

      const merged = [...prev, list];
      localStorage.setItem(listKey, JSON.stringify(merged));

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

      // força recálculo dos relatórios
      setListsVersion((v) => v + 1);
    } catch (err) {
      console.error(err);
      setImportError(err.message || "Erro ao importar NFC-e.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleCloseModal = () => {
    setShowImportModal(false);
    setNfceText("");
    setImportError("");
    setImport
