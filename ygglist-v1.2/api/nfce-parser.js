// Serverless function para Vercel
// Lê a página pública da NFC-e e extrai itens básicos.
//
// IMPORTANTE: instale as dependências:
//   npm install node-fetch cheerio
//
// Isso é um parser genérico — pode precisar
// de ajustes conforme o layout da SEFAZ do seu estado.

const fetch = require("node-fetch");
const cheerio = require("cheerio");

/**
 * Normaliza string de dinheiro brasileiro "9,90" -> 9.9
 */
function parseBRL(str) {
  if (!str) return 0;
  const s = String(str).replace(/\./g, "").replace(",", ".");
  const n = Number(s.replace(/[^\d.-]/g, ""));
  return isFinite(n) ? n : 0;
}

/**
 * Normaliza quantidade "0,754" -> 0.754
 */
function parseQty(str) {
  if (!str) return 1;
  const s = String(str).replace(",", ".");
  const n = Number(s.replace(/[^\d.-]/g, ""));
  return isFinite(n) && n > 0 ? n : 1;
}

module.exports = async (req, res) => {
  try {
    const body =
      req.method === "POST"
        ? JSON.parse(req.body || "{}")
        : req.query || {};

    let { url } = body;
    url = (url || "").trim();

    if (!url || !url.startsWith("http")) {
      res.statusCode = 400;
      res.json({ error: "URL da NFC-e inválida ou ausente." });
      return;
    }

    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      },
    });

    if (!resp.ok) {
      res.statusCode = 500;
      res.json({
        error: `Falha ao acessar a página da NFC-e (status ${resp.status}).`,
      });
      return;
    }

    const html = await resp.text();
    const $ = cheerio.load(html);

    // ===== tentar extrair nome da loja =====
    const store =
      $("h1, h2, .txtTopo, .nomeEmpresa, .txtNome")
        .first()
        .text()
        .trim() || "Loja";

    // ===== tentar extrair uma data no formato dd/mm/aaaa =====
    const bodyText = $("body").text();
    const dateMatch = bodyText.match(/(\d{2}\/\d{2}\/\d{4})/);
    let dateISO = null;
    if (dateMatch) {
      const [d, m, y] = dateMatch[1].split("/");
      dateISO = `${y}-${m}-${d}`;
    }

    // ===== procurar uma tabela de itens =====
    const items = [];

    $("table").each((_, table) => {
      $(table)
        .find("tr")
        .each((__, tr) => {
          const tds = $(tr).find("td");
          if (tds.length < 3) return;

          const cols = tds
            .map((i, el) => $(el).text().trim())
            .get();

          // heurística: normalmente temos algo como:
          // [DESCRIÇÃO, QTD, UN, VALOR UNIT, VALOR TOTAL]
          const desc = cols[0];
          if (!desc || desc.length < 2) return;

          // tenta detectar colunas numéricas
          const numbers = cols.map((c) => c.replace(/\./g, "").replace(",", "."));

          const qty = parseQty(numbers.find((n) => /[\d]/.test(n)));
          const totalStr =
            cols[cols.length - 1] || cols[cols.length - 2] || "0";
          const total = parseBRL(totalStr);
          const unitPrice = total && qty ? total / qty : 0;

          items.push({
            name: desc,
            qty,
            unit: "un", // não é trivial extrair em todos os layouts
            price: unitPrice || total, // se não acharmos unitário, usamos o total
          });
        });
    });

    if (!items.length) {
      res.statusCode = 500;
      res.json({
        error:
          "Não foi possível identificar a tabela de itens nessa NFC-e. O layout pode ser diferente e precisar de ajustes no parser.",
      });
      return;
    }

    const totalRaw = items.reduce(
      (s, it) => s + (Number(it.qty || 1) * Number(it.price || 0)),
      0
    );

    res.statusCode = 200;
    res.json({
      store,
      dateISO,
      items,
      rawTotal: totalRaw,
    });
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.json({
      error: "Erro inesperado ao processar a NFC-e.",
    });
  }
};
