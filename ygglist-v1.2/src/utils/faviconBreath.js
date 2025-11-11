// src/utils/faviconBreath.js
export function startFaviconBreath(src = "/ygglist_banner.svg", periodMs = 2000) {
  const link = (() => {
    let el = document.querySelector('link[rel="icon"]');
    if (!el) {
      el = document.createElement("link");
      el.rel = "icon";
      document.head.appendChild(el);
    }
    return el;
  })();

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;

  img.onload = () => {
    const size = 32; // fica nítido na aba
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");

    let t0 = performance.now();
    function frame(now) {
      const t = (now - t0) % periodMs;
      // curva senoidal leve (0.6–1.0 de opacidade)
      const alpha = 0.6 + 0.4 * Math.sin((t / periodMs) * Math.PI * 2);

      ctx.clearRect(0, 0, size, size);
      // fundo transparente
      ctx.globalAlpha = alpha;
      // desenha a imagem centralizada
      ctx.drawImage(img, 0, 0, size, size);
      ctx.globalAlpha = 1;

      const url = c.toDataURL("image/png");
      link.href = url;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };
}
