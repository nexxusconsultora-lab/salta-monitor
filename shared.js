/**
 * Destacados — se guardan en localStorage del navegador actual.
 * No hay backend: esto NO se comparte entre dispositivos ni se sube al
 * repositorio. Es una libreta personal de "esto me interesa", nada más.
 */
(function () {
  const KEY = "radar_destacados_v1";

  function getStars() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch (e) {
      return [];
    }
  }

  function saveStars(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (e) {
      // localStorage puede fallar (modo privado, cuota llena, etc.):
      // fallamos en silencio, el resto de la página sigue funcionando.
    }
  }

  function isStarred(id) {
    return getStars().some((s) => s.id === id);
  }

  function toggleStar(meta) {
    const list = getStars();
    const idx = list.findIndex((s) => s.id === meta.id);
    if (idx >= 0) {
      list.splice(idx, 1);
      saveStars(list);
      return false;
    }
    list.push(Object.assign({}, meta, { starred_at: new Date().toISOString() }));
    saveStars(list);
    return true;
  }

  function starButtonHtml(meta) {
    const starred = isStarred(meta.id);
    const dataStr = encodeURIComponent(JSON.stringify(meta));
    return (
      '<button class="star-btn' + (starred ? " is-starred" : "") +
      '" data-meta="' + dataStr + '" title="Destacar (solo en este navegador)">' +
      (starred ? "★" : "☆") + "</button>"
    );
  }

  document.addEventListener("click", function (e) {
    const btn = e.target.closest(".star-btn");
    if (!btn) return;
    let meta;
    try {
      meta = JSON.parse(decodeURIComponent(btn.dataset.meta));
    } catch (err) {
      return;
    }
    const nowStarred = toggleStar(meta);
    btn.textContent = nowStarred ? "★" : "☆";
    btn.classList.toggle("is-starred", nowStarred);
    document.dispatchEvent(new CustomEvent("radar-star-changed", { detail: meta }));
  });

  window.RadarDestacados = { getStars, isStarred, toggleStar, starButtonHtml };
})();
