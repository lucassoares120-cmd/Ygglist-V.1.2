import React, { useEffect, useMemo, useState } from "react";

// Data "YYYY-MM-DD" usando horário LOCAL (sem UTC)
const getTodayLocalISO = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/* ===== CONSTANTES / CHAVES DE STORAGE ===== */

const LISTS_KEY = "YGG_LISTS_IMPORT";
const DRAFT_KEY = "YGG_LIST_DRAFT";
const FAVORITES_KEY = "YGG_FAVORITE_LISTS";
const WEATHER_CITY_KEY = "YGG_WEATHER_CITY";

/* Frutas / legumes da estação (simples, estático) */
const SEASONAL_BY_MONTH = {
  1: ["Manga", "Uva", "Abacaxi", "Melancia"],
  2: ["Manga", "Pêssego", "Figo", "Tomate"],
  3: ["Abacaxi", "Banana", "Melão", "Cenoura"],
  4: ["Laranja", "Mamão", "Beterraba", "Brócolis"],
  5: ["Laranja", "Mexerica", "Couve", "Cenoura"],
  6: ["Mexerica", "Batata-doce", "Abóbora", "Repolho"],
  7: ["Mexerica", "Abóbora", "Chuchu", "Couve-flor"],
  8: ["Morango", "Alface", "Tomate", "Pepino"],
  9: ["Morango", "Abobrinha", "Alface", "Banana"],
  10: ["Abacaxi", "Melancia", "Couve", "Tomate"],
  11: ["Melancia", "Manga", "Couve", "Pepino"],
  12: ["Melancia", "Manga", "Cereja", "Tomate"]
};

/* Dicas de uso do app */
const TIPS = [
  "Use locais diferentes para separar Casa, Trabalho e Chácara.",
  "Adicione preços para acompanhar seus gastos do mês.",
  "Use curiosidades para salvar dicas de preparo das receitas.",
  "Crie listas por loja para comparar rapidamente os preços.",
  "Finalize as compras para construir seu histórico financeiro."
];

/* Mapa simples de códigos de clima do Open-Meteo */
const WEATHER_MAP = {
  0: { label: "Céu limpo", icon: "☀️" },
  1: { label: "Predomínio de sol", icon: "🌤" },
  2: { label: "Parcialmente nublado", icon: "⛅" },
  3: { label: "Tempo nublado", icon: "☁️" },
  45: { label: "Nevoeiro", icon: "🌫" },
  48: { label: "Nevoeiro com gelo", icon: "🌫" },
  51: { label: "Chuvisco fraco", icon: "🌦" },
  53: { label: "Chuvisco", icon: "🌦" },
  55: { label: "Chuvisco forte", icon: "🌧" },
  61: { label: "Chuva fraca", icon: "🌧" },
  63: { label: "Chuva", icon: "🌧" },
  65: { label: "Chuva forte", icon: "🌧" },
  71: { label: "Neve fraca", icon: "🌨" },
  73: { label: "Neve", icon: "🌨" },
  75: { label: "Neve intensa", icon: "🌨" },
  80: { label: "Pancadas isoladas", icon: "🌦" },
  81: { label: "Pancadas de chuva", icon: "🌧" },
  82: { label: "Temporal", icon: "⛈" }
};

/* ===== HELPERS ===== */

const safeParseJSON = (value, fallback) => {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

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
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      normalized = s.replace(/\./g, "").replace(",", ".");
    } else {
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

const itemTotal = (i) => {
  if (!i) return 0;
  const price = typeof i.price === "number" ? i.price : 0;
  const qty =
    typeof i.qty === "number"
      ? i.qty
      : i.qty == null
      ? 1
      : toLocaleNumber(i.qty) || 1;
  return price * qty;
};

const listTotal = (list) =>
  Array.isArray(list?.items)
    ? list.items.reduce((sum, it) => sum + itemTotal(it), 0)
    : 0;

const formatBRL = (v) =>
  (Number(v) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2
  });

const isoToReadable = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
};

const getMonthKey = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const daysBetween = (isoA, isoB) => {
  const a = new Date(isoA);
  const b = new Date(isoB);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return Infinity;
  const diff = b.setHours(0, 0, 0, 0) - a.setHours(0, 0, 0, 0);
  return Math.round(diff / (1000 * 60 * 60 * 24));
};

export default function Home({ onNewList }) {
  const [greeting, setGreeting] = useState("Bem-vindo!");
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState(null); // previsão 3 dias
  const [weatherLabel, setWeatherLabel] = useState("Perto de você");
  const [placeQuery, setPlaceQuery] = useState("");
  const [isSearchingWeather, setIsSearchingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState("");

  const [holidays, setHolidays] = useState([]);
  const [date, setDate] = useState(() => getTodayLocalISO());

  const [completedLists, setCompletedLists] = useState([]);
  const [draft, setDraft] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [selectedTips, setSelectedTips] = useState([]);

  // "today" também baseado na data local
const today = getTodayLocalISO();

  /* ===== GREETING / TIPS ===== */

  useEffect(() => {
    const frases = [
      "Que sua compra renda e economize 💚",
      "Hoje é um ótimo dia para planejar bem 🤝",
      "Pequenas escolhas, grande economia 🌿",
      "Organização é liberdade ✨"
    ];
    setGreeting(frases[Math.floor(Math.random() * frases.length)]);

    const shuffled = [...TIPS].sort(() => Math.random() - 0.5);
    setSelectedTips(shuffled.slice(0, 3));
  }, []);

  /* ===== FUNÇÕES DE CLIMA (coords / cidade) ===== */

  function applyWeatherResult(label, current, daily, extra) {
    setWeather(current || null);
    setForecast(daily || null);
    if (label) setWeatherLabel(label);
    if (extra?.save) {
      try {
        localStorage.setItem(
          WEATHER_CITY_KEY,
          JSON.stringify({
            label,
            lat: extra.lat,
            lon: extra.lon
          })
        );
      } catch {
        // ignore
      }
    }
  }

  function fetchWeatherByCoords(lat, lon, label = "Perto de você", opts = {}) {
    if (lat == null || lon == null) return;
    setIsSearchingWeather(true);
    setWeatherError("");

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3`;

    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        applyWeatherResult(label, j.current, j.daily, {
          save: opts.save,
          lat,
          lon
        });
      })
      .catch(() => {
        setWeather(null);
        setForecast(null);
        setWeatherError("Não foi possível carregar o clima.");
      })
      .finally(() => setIsSearchingWeather(false));
  }

  function fetchWeatherForCity(name) {
    const city = name.trim();
    if (!city) return;
    setIsSearchingWeather(true);
    setWeatherError("");

    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      city
    )}&count=1&language=pt&format=json`;

    fetch(geoUrl)
      .then((r) => r.json())
      .then((geo) => {
        const res = geo?.results?.[0];
        if (!res) {
          setWeatherError("Cidade não encontrada. Tente ser mais específico.");
          setIsSearchingWeather(false);
          return;
        }
        const label = `${res.name}${
          res.country_code ? `, ${res.country_code}` : ""
        }`;
        fetchWeatherByCoords(res.latitude, res.longitude, label, {
          save: true
        });
      })
      .catch(() => {
        setWeatherError("Erro ao buscar cidade.");
        setIsSearchingWeather(false);
      });
  }

  /* ===== GEO (AUTO) + FERIADOS ===== */

  useEffect(() => {
    // 1) tenta carregar última cidade salva
    const savedCity = safeParseJSON(
      localStorage.getItem(WEATHER_CITY_KEY),
      null
    );
    if (savedCity && savedCity.lat && savedCity.lon) {
      fetchWeatherByCoords(
        savedCity.lat,
        savedCity.lon,
        savedCity.label || "Sua cidade"
      );
    }

    // 2) tenta geolocalização para "perto de você"
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          fetchWeatherByCoords(latitude, longitude, "Perto de você");
        },
        () => {
          // usuário negou; tudo bem, o campo de cidade resolve
        }
      );
    }

    const year = new Date().getFullYear();
    fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/BR`)
      .then((r) => r.json())
      .then((j) => setHolidays(j))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ===== CARREGAR DADOS LOCAIS (listas & rascunho & favoritos) ===== */

  useEffect(() => {
    const rawLists = localStorage.getItem(LISTS_KEY);
    const rawDraft = localStorage.getItem(DRAFT_KEY);
    const rawFavs = localStorage.getItem(FAVORITES_KEY);

    setCompletedLists(safeParseJSON(rawLists, []));
    setDraft(safeParseJSON(rawDraft, null));
    setFavorites(safeParseJSON(rawFavs, []));
  }, []);

  const updateFavorites = (next) => {
    setFavorites(next);
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const toggleFavoriteList = (id) => {
    updateFavorites(
      favorites.includes(id)
        ? favorites.filter((f) => f !== id)
        : [...favorites, id]
    );
  };

  /* ===== DERIVADOS: LISTAS / DIA / MÊS ===== */

  const listsForSelectedDay = useMemo(
    () =>
      completedLists.filter((l) => {
        const d = (l.date || "").slice(0, 10);
        return d === date;
      }),
    [completedLists, date]
  );

  const draftForSelectedDay = useMemo(() => {
    if (!draft || !draft.date) return null;
    const d = (draft.date || "").slice(0, 10);
    if (d !== date) return null;
    return draft;
  }, [draft, date]);

  const totalDay = useMemo(
    () => listsForSelectedDay.reduce((sum, l) => sum + listTotal(l), 0),
    [listsForSelectedDay]
  );

  const itemsDayCount = useMemo(
    () =>
      listsForSelectedDay.reduce(
        (sum, l) => sum + (Array.isArray(l.items) ? l.items.length : 0),
        0
      ),
    [listsForSelectedDay]
  );

  const monthKey = getMonthKey(date);
  const listsThisMonth = useMemo(() => {
    if (!monthKey) return [];
    return completedLists.filter((l) => getMonthKey(l.date) === monthKey);
  }, [completedLists, monthKey]);

  const monthTotal = useMemo(
    () => listsThisMonth.reduce((sum, l) => sum + listTotal(l), 0),
    [listsThisMonth]
  );

  const avgPerPurchase =
    listsThisMonth.length > 0 ? monthTotal / listsThisMonth.length : 0;

  /* ===== LISTAS RECENTES / FAVORITAS ===== */

  const recentLists = useMemo(() => {
    const sorted = [...completedLists].sort((a, b) => {
      const ca = a.createdAt || new Date(a.date || 0).getTime();
      const cb = b.createdAt || new Date(b.date || 0).getTime();
      return cb - ca;
    });
    return sorted.slice(0, 5);
  }, [completedLists]);

  const favoriteObjects = useMemo(
    () => completedLists.filter((l) => favorites.includes(l.id)),
    [completedLists, favorites]
  );

  const handleOpenListShortcut = (list) => {
    if (!list?.date) return;
    setDate((prev) => (prev === list.date ? prev : list.date.slice(0, 10)));
    if (typeof onNewList === "function") {
      onNewList();
    }
  };

  /* ===== TOP ITENS & CATEGORIAS ===== */

  const topStats = useMemo(() => {
    const itemCount = {};
    const catCount = {};

    listsThisMonth.forEach((l) => {
      (l.items || []).forEach((it) => {
        const nameKey = (it.name || "").trim();
        if (nameKey) {
          itemCount[nameKey] = (itemCount[nameKey] || 0) + 1;
        }
        const catKey = (it.category || "Outros").trim();
        catCount[catKey] = (catCount[catKey] || 0) + 1;
      });
    });

    const topItems = Object.entries(itemCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    const topCats = Object.entries(catCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([name, count]) => ({ name, count }));

    return { topItems, topCats };
  }, [listsThisMonth]);

  /* ===== STREAKS / GAMIFICAÇÃO ===== */

  const streakInfo = useMemo(() => {
    const uniqueDates = Array.from(
      new Set(
        completedLists
          .map((l) => (l.date || "").slice(0, 10))
          .filter(Boolean)
      )
    ).sort();

    if (uniqueDates.length === 0)
      return { daysWithLists: 0, bestStreak: 0, currentStreak: 0 };

    let best = 1;
    let cur = 1;

    for (let i = 1; i < uniqueDates.length; i++) {
      const diff = daysBetween(uniqueDates[i - 1], uniqueDates[i]);
      if (diff === 1) {
        cur += 1;
        if (cur > best) best = cur;
      } else {
        cur = 1;
      }
    }

    const lastDay = uniqueDates[uniqueDates.length - 1];
    const currentStreak =
      daysBetween(lastDay, today) === 0 || daysBetween(lastDay, today) === 1
        ? cur
        : 0;

    return {
      daysWithLists: uniqueDates.length,
      bestStreak: best,
      currentStreak
    };
  }, [completedLists, today]);

  /* ===== FRUTAS DA ESTAÇÃO ===== */

  const seasonalList = useMemo(() => {
    const m = new Date(date).getMonth() + 1;
    return SEASONAL_BY_MONTH[m] || [];
  }, [date]);

  /* ===== PRÓXIMOS FERIADOS ===== */

  const nextHolidays = useMemo(() => {
    if (!Array.isArray(holidays) || holidays.length === 0) return [];
    const todayDate = new Date(today);
    return holidays
      .filter((h) => {
        const d = new Date(h.date);
        return d >= todayDate;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 3);
  }, [holidays, today]);

  /* ===== RENDER ===== */

  return (
    <section className="space-y-4">
      {/* HERO / RESUMO DO DIA */}
      <div className="rounded-3xl border shadow-sm p-4 md:p-6 bg-gradient-to-r from-emerald-50 via-emerald-100 to-emerald-50">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              Olá! 👋
            </h2>
            <p className="text-slate-700">{greeting}</p>
            <p className="mt-2 text-xs text-slate-500">
              Você está planejando para{" "}
              <span className="font-semibold">
                {isoToReadable(date)}
              </span>
              .
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 text-sm">
            {/* Widget de clima com busca de cidade */}
            <div className="bg-white/70 rounded-xl px-3 py-2 border text-right min-w-[210px]">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">
                Clima — {weatherLabel}
              </div>

              {weather ? (
                <>
                  <div className="mt-1 flex items-baseline gap-1 justify-end">
                    {(() => {
                      const info =
                        WEATHER_MAP[weather.weather_code] || {
                          label: "Condição desconhecida",
                          icon: "🌡️"
                        };
                      return (
                        <>
                          <span className="text-lg">{info.icon}</span>
                          <span className="font-semibold">
                            {weather.temperature_2m.toFixed(0)}°C
                          </span>
                          <span className="text-xs text-slate-500">
                            · {info.label}
                          </span>
                        </>
                      );
                    })()}
                  </div>

                  {forecast && forecast.time && (
                    <div className="mt-2 flex flex-col items-end gap-0.5 text-[11px] text-slate-500">
                      {[0, 1, 2].map((idx) => {
                        const dateStr = forecast.time[idx];
                        if (!dateStr) return null;
                        const code = forecast.weather_code[idx];
                        const info = WEATHER_MAP[code] || { icon: "🌡️" };
                        const max = forecast.temperature_2m_max[idx];
                        const min = forecast.temperature_2m_min[idx];

                        const label =
                          idx === 0
                            ? "Hoje"
                            : idx === 1
                            ? "Amanhã"
                            : "Depois de amanhã";

                        return (
                          <div
                            key={dateStr}
                            className="flex items-center gap-1"
                          >
                            <span>{info.icon}</span>
                            <span>{label}:</span>
                            <span className="font-medium">
                              {Math.round(max)}° / {Math.round(min)}°
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="mt-1 text-sm">Temperatura indisponível</div>
                  <div className="text-xs text-slate-500">
                    {isSearchingWeather
                      ? "Buscando dados de clima..."
                      : "Ative a localização do navegador ou digite sua cidade abaixo."}
                  </div>
                </>
              )}

              {/* Busca de cidade */}
              <div className="mt-2 flex items-center gap-1 justify-end">
                <input
                  type="text"
                  value={placeQuery}
                  onChange={(e) => setPlaceQuery(e.target.value)}
                  placeholder="Cidade (ex.: Contagem)"
                  className="border rounded-lg px-2 py-1 text-[11px] w-32 bg-white"
                />
                <button
                  type="button"
                  onClick={() => fetchWeatherForCity(placeQuery)}
                  disabled={isSearchingWeather}
                  className="px-2 py-1 rounded-lg bg-ygg-700 text-white text-[11px] hover:bg-ygg-800 disabled:opacity-60"
                >
                  OK
                </button>
              </div>
              {weatherError && (
                <div className="mt-1 text-[10px] text-red-500">
                  {weatherError}
                </div>
              )}
            </div>

            {/* Resumo do dia */}
            <div className="bg-white/80 rounded-xl px-3 py-2 border text-right min-w-[190px]">
              <div className="text-[11px] uppercase tracking-wide text-emerald-700 font-semibold">
                Resumo do dia
              </div>
              <div className="mt-1 text-xs text-slate-700">
                {listsForSelectedDay.length > 0 ? (
                  <>
                    <div>
                      Listas planejadas:{" "}
                      <span className="font-semibold">
                        {listsForSelectedDay.length}
                      </span>
                    </div>
                    <div>
                      Itens finalizados:{" "}
                      <span className="font-semibold">
                        {itemsDayCount}
                      </span>
                    </div>
                    <div>
                      Total estimado:{" "}
                      <span className="font-semibold">
                        {formatBRL(totalDay)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-slate-500">
                    Nenhuma compra finalizada para este dia ainda.
                  </div>
                )}
                {draftForSelectedDay && (
                  <div className="mt-1 text-[11px] text-amber-600">
                    Há uma lista em andamento ainda não finalizada.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CALENDÁRIO & FERIADOS */}
      <div className="bg-white rounded-2xl border shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 mb-1">
            <span>📅</span>
            <h3 className="font-semibold">Calendário & Feriados</h3>
          </div>

          {nextHolidays.length > 0 && (
            <div className="hidden md:flex items-center gap-1 text-[11px] text-slate-600">
              <span className="font-semibold text-emerald-700">
                Próximos feriados:
              </span>
              {nextHolidays.map((h, idx) => (
                <span key={h.date} className="flex items-center gap-1">
                  {idx > 0 && <span>·</span>}
                  <span>
                    {isoToReadable(h.date)} {h.localName}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div>
            <label className="text-sm">Escolha a data</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border rounded-lg px-3 py-2"
            />
          </div>
          <button
            onClick={onNewList}
            className="px-4 py-2 rounded-lg bg-ygg-700 text-white hover:bg-ygg-800 transition-colors text-sm"
          >
            Criar lista para o dia
          </button>
        </div>

        <div className="mt-3 grid md:grid-cols-2 gap-2 max-h-48 overflow-auto pr-2">
          {holidays?.map((h) => (
            <div
              key={h.date + h.localName}
              className="text-sm text-slate-600 flex items-center gap-2"
            >
              <span>🎉</span>
              <span>
                {isoToReadable(h.date)}: {h.localName}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* VISÃO FINANCEIRA MENSAL */}
      <div className="bg-white rounded-2xl border shadow-sm p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span>📊</span>
            <h3 className="font-semibold">Visão financeira do mês</h3>
          </div>
          <span className="text-[11px] text-slate-500">
            Referência: {monthKey}
          </span>
        </div>

        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl border px-3 py-2">
            <div className="text-[11px] text-slate-500 uppercase tracking-wide">
              Total das compras
            </div>
            <div className="text-lg font-semibold text-slate-800">
              {formatBRL(monthTotal)}
            </div>
          </div>
          <div className="rounded-xl border px-3 py-2">
            <div className="text-[11px] text-slate-500 uppercase tracking-wide">
              Número de listas
            </div>
            <div className="text-lg font-semibold text-slate-800">
              {listsThisMonth.length}
            </div>
          </div>
          <div className="rounded-xl border px-3 py-2">
            <div className="text-[11px] text-slate-500 uppercase tracking-wide">
              Média por compra
            </div>
            <div className="text-lg font-semibold text-slate-800">
              {formatBRL(avgPerPurchase)}
            </div>
          </div>
        </div>
      </div>

      {/* LISTAS RECENTES & FAVORITAS */}
      <div className="bg-white rounded-2xl border shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span>🧾</span>
            <h3 className="font-semibold">Suas listas recentes</h3>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-2">
          {recentLists.length === 0 && (
            <p className="text-sm text-slate-500">
              Nenhuma lista finalizada ainda. Que tal criar a primeira?
            </p>
          )}
          {recentLists.map((l) => {
            const isFav = favorites.includes(l.id);
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => handleOpenListShortcut(l)}
                className="flex items-center gap-2 border rounded-full px-3 py-1.5 text-xs bg-slate-50 hover:bg-emerald-50 transition-colors"
              >
                <span>
                  {l.location ? "📍" : "🛒"}{" "}
                  {l.location || "Lista sem local"}
                </span>
                <span className="text-slate-500">
                  {isoToReadable(l.date)}
                </span>
                {l.store && (
                  <span className="text-slate-400">· {l.store}</span>
                )}
                <span className="text-slate-700 font-semibold">
                  {formatBRL(listTotal(l))}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavoriteList(l.id);
                  }}
                  className="ml-1 text-[11px]"
                  title={
                    isFav ? "Remover dos favoritos" : "Fixar como favorita"
                  }
                >
                  {isFav ? "⭐" : "☆"}
                </button>
              </button>
            );
          })}
        </div>

        {favoriteObjects.length > 0 && (
          <div className="border-t pt-2">
            <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide mb-1">
              Favoritas fixadas
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {favoriteObjects.map((l) => (
                <span
                  key={l.id}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200"
                >
                  ⭐ {l.location || "Lista"} — {isoToReadable(l.date)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* TOP ITENS & CATEGORIAS */}
      <div className="bg-white rounded-2xl border shadow-sm p-4">
        <div className="flex items-center gap-2 mb-2">
          <span>🥦</span>
          <h3 className="font-semibold">Seus queridinhos do mês</h3>
        </div>
        {topStats.topItems.length === 0 ? (
          <p className="text-sm text-slate-500">
            Ainda não há dados suficientes neste mês. Finalize algumas
            compras para ver seus itens mais frequentes.
          </p>
        ) : (
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div className="border rounded-xl px-3 py-2">
              <div className="text-[11px] text-slate-500 uppercase tracking-wide mb-1">
                Itens mais presentes
              </div>
              <ul className="space-y-1">
                {topStats.topItems.map((it) => (
                  <li
                    key={it.name}
                    className="flex items-center justify-between"
                  >
                    <span>{it.name}</span>
                    <span className="text-slate-500 text-xs">
                      {it.count}x
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border rounded-xl px-3 py-2">
              <div className="text-[11px] text-slate-500 uppercase tracking-wide mb-1">
                Categorias em destaque
              </div>
              <ul className="space-y-1">
                {topStats.topCats.map((it) => (
                  <li
                    key={it.name}
                    className="flex items-center justify-between"
                  >
                    <span>{it.name}</span>
                    <span className="text-slate-500 text-xs">
                      {it.count} listas
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* GAMIFICAÇÃO / STREAKS */}
      <div className="bg-white rounded-2xl border shadow-sm p-4">
        <div className="flex items-center gap-2 mb-2">
          <span>🔥</span>
          <h3 className="font-semibold">Ritmo de planejamento</h3>
        </div>
        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <div className="border rounded-xl px-3 py-2">
            <div className="text-[11px] text-slate-500 uppercase tracking-wide">
              Dias com listas
            </div>
            <div className="text-lg font-semibold text-slate-800">
              {streakInfo.daysWithLists}
            </div>
          </div>
          <div className="border rounded-xl px-3 py-2">
            <div className="text-[11px] text-slate-500 uppercase tracking-wide">
              Melhor sequência
            </div>
            <div className="text-lg font-semibold text-slate-800">
              {streakInfo.bestStreak} dia
              {streakInfo.bestStreak === 1 ? "" : "s"}
            </div>
          </div>
          <div className="border rounded-xl px-3 py-2">
            <div className="text-[11px] text-slate-500 uppercase tracking-wide">
              Sequência atual
            </div>
            <div className="text-lg font-semibold text-slate-800">
              {streakInfo.currentStreak} dia
              {streakInfo.currentStreak === 1 ? "" : "s"}
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Cada dia em que você planeja ou finaliza uma lista aproxima você
          da sua próxima sequência. 💪
        </p>
      </div>

      {/* DICAS + ESTAÇÃO */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Dicas */}
        <div className="bg-white rounded-2xl border shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <span>💡</span>
            <h3 className="font-semibold">Dicas do YggList</h3>
          </div>
          <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
            {selectedTips.map((tip, idx) => (
              <li key={idx}>{tip}</li>
            ))}
          </ul>
        </div>

        {/* Frutas / Legumes da estação */}
        <div className="bg-white rounded-2xl border shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <span>🍊</span>
            <h3 className="font-semibold">Na estação agora</h3>
          </div>
          {seasonalList.length === 0 ? (
            <p className="text-sm text-slate-500">
              Não foi possível carregar as sugestões de estação.
            </p>
          ) : (
            <div className="text-sm text-slate-700">
              <p className="mb-1">
                Este período é ótimo para aproveitar:
              </p>
              <div className="flex flex-wrap gap-1">
                {seasonalList.map((item) => (
                  <span
                    key={item}
                    className="px-2 py-1 rounded-full border text-xs bg-emerald-50 border-emerald-100"
                  >
                    {item}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Itens da estação costumam ser mais frescos, saborosos e
                econômicos. 🌱
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
