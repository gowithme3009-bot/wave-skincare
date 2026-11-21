/* Le menu mobile est géré par navigation.js sur toutes les pages. */
window.WAVE_APP_READY = (async () => {
  await (window.WAVE_PRODUCTS_READY || Promise.resolve());
  const $ = selector => document.querySelector(selector);
  const money = value => new Intl.NumberFormat("fr-FR").format(Number(value) || 0) + " Ar";
  const readCart = () => {
    try {
      const value = JSON.parse(localStorage.getItem("waveCart") || "[]");
      if (!Array.isArray(value)) return [];
      return value.filter(line => line && typeof line.id === "string" &&
        Number.isSafeInteger(Number(line.qty)) && Number(line.qty) > 0)
        .map(line => ({ id: line.id, qty: Math.min(99, Number(line.qty)) }));
    } catch { return []; }
  };
  let cart = readCart();
  const product = id => (window.WAVE_PRODUCTS || []).find(item => item.id === id);
  const knownStock = item => item && item.stock !== null && item.stock !== undefined && item.stock !== "" && Number.isFinite(Number(item.stock));
  const count = () => cart.reduce((sum, line) => sum + line.qty, 0);
  const total = () => cart.reduce((sum, line) => sum + (Number(product(line.id)?.price) || 0) * line.qty, 0);
  const save = () => {
    cart = cart.filter(line => product(line.id));
    try { localStorage.setItem("waveCart", JSON.stringify(cart)); } catch {}
    updateCart();
  };
  const clear = () => { cart = []; save(); };
  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined && text !== null) node.textContent = String(text);
    if (className) node.className = className;
    return node;
  }
  function toast(message) {
    const node = $("#toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => node.classList.remove("show"), 2400);
  }
  function updateCart() {
    const badge = $("#cartCount");
    if (badge) badge.textContent = String(count());
    const items = $("#cartItems");
    if (items) {
      items.replaceChildren();
      if (!cart.length) items.append(el("p", "Votre panier est encore vide.", "empty-cart"));
      for (const line of cart) {
        const item = product(line.id);
        if (!item) continue;
        const row = el("div", undefined, "cart-row");
        const image = el("img"); image.src = item.image || "assets/wave-boutique.webp"; image.alt = item.name || "Produit Wave";
        const details = el("div");
        details.append(el("b", item.name), el("small", money(item.price)));
        const controls = el("div", undefined, "qty");
        const minus = el("button", "−"); minus.type = "button"; minus.dataset.qty = line.id; minus.dataset.step = "-1"; minus.setAttribute("aria-label", "Diminuer la quantité");
        const amount = el("span", line.qty);
        const plus = el("button", "+"); plus.type = "button"; plus.dataset.qty = line.id; plus.dataset.step = "1"; plus.setAttribute("aria-label", "Augmenter la quantité");
        const stock = Number(item.stock);
        if (knownStock(item) && stock >= 0 && line.qty >= stock) plus.disabled = true;
        const remove = el("button", "Retirer", "remove"); remove.type = "button"; remove.dataset.remove = line.id;
        controls.append(minus, amount, plus, remove);
        details.append(controls); row.append(image, details); items.append(row);
      }
    }
    const sum = $("#cartTotal");
    if (sum) sum.textContent = money(total());
  }
  function add(id) {
    const item = product(id);
    if (!item) return toast("Ce produit n'est plus disponible.");
    const existing = cart.find(line => line.id === id);
    const next = (existing?.qty || 0) + 1;
    const stock = Number(item.stock);
    if (knownStock(item) && stock >= 0 && next > stock) return toast(stock === 0 ? "Ce produit est momentanément indisponible." : "Stock disponible insuffisant.");
    if (existing) existing.qty = next;
    else cart.push({ id, qty: 1 });
    save(); toast("Produit ajouté au panier.");
  }
  function makeProductCard(item) {
    const article = el("article", undefined, "product-card");
    const anchor = el("a", undefined, "product-image"); anchor.href = "commande.html";
    const image = el("img"); image.src = item.image || "assets/wave-boutique.webp"; image.alt = item.name || "Produit Wave"; image.loading = "lazy";
    anchor.append(image, el("span", item.tag || "SOIN WAVE"));
    const copy = el("div", undefined, "product-card-copy");
    copy.append(el("small", [item.category, item.size].filter(Boolean).join(" · ")), el("h3", item.name), el("p", item.desc || ""));
    const bottom = el("div", undefined, "product-card-bottom");
    bottom.append(el("b", money(item.price)));
    const button = el("button", "＋ Ajouter", "add-button"); button.type = "button"; button.dataset.add = item.id;
    const stock = Number(item.stock);
    if (knownStock(item) && stock <= 0) { button.disabled = true; button.textContent = "Indisponible"; }
    bottom.append(button); copy.append(bottom); article.append(anchor, copy);
    return article;
  }
  function renderProducts(target, items) {
    if (!target) return;
    target.replaceChildren();
    if (!items.length) { target.append(el("p", "Aucun produit ne correspond à votre recherche.")); return; }
    for (const item of items) target.append(makeProductCard(item));
  }
  function drawer(open) {
    const panel = $("#cartDrawer"), backdrop = $("#cartBackdrop");
    panel?.classList.toggle("open", open);
    backdrop?.classList.toggle("show", open);
    panel?.setAttribute("aria-hidden", String(!open));
    document.body.classList.toggle("cart-open", open);
    if (open) $("#cartClose")?.focus();
    else $("#cartToggle")?.focus();
  }
  document.addEventListener("click", event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const addButton = target.closest("[data-add]");
    if (addButton) add(addButton.dataset.add);
    const quantityButton = target.closest("[data-qty]");
    if (quantityButton) {
      const line = cart.find(entry => entry.id === quantityButton.dataset.qty);
      if (line) {
        const next = line.qty + Number(quantityButton.dataset.step);
        const item = product(line.id);
        const stock = Number(item?.stock);
        if (next > 0 && knownStock(item) && stock >= 0 && next > stock) return toast("Stock disponible insuffisant.");
        if (next <= 0) cart = cart.filter(entry => entry.id !== line.id);
        else line.qty = Math.min(99, next);
        save();
      }
    }
    const remove = target.closest("[data-remove]");
    if (remove) { cart = cart.filter(entry => entry.id !== remove.dataset.remove); save(); }
  });
  $("#cartToggle")?.addEventListener("click", () => drawer(true));
  $("#cartClose")?.addEventListener("click", () => drawer(false));
  $("#cartBackdrop")?.addEventListener("click", () => drawer(false));
  document.addEventListener("keydown", event => { if (event.key === "Escape") drawer(false); });
  $("#searchToggle")?.addEventListener("click", () => $("#searchPanel")?.classList.toggle("show"));
  const runSearch = () => {
    const query = $("#searchInput")?.value.trim();
    if (query) location.href = "boutique.html?q=" + encodeURIComponent(query);
  };
  $("#searchSubmit")?.addEventListener("click", runSearch);
  $("#searchInput")?.addEventListener("keydown", event => { if (event.key === "Enter") runSearch(); });
  window.addEventListener("storage", event => {
    if (event.key === "waveCart") { cart = readCart(); updateCart(); }
  });
  const featured = $("#featuredProducts");
  renderProducts(featured, (window.WAVE_PRODUCTS || []).slice(0, 3));
  const all = $("#allProducts");
  if (all) {
    const params = new URLSearchParams(location.search);
    const query = (params.get("q") || "").toLocaleLowerCase("fr");
    let list = (window.WAVE_PRODUCTS || []).filter(item => !query ||
      [item.name, item.desc, item.category].join(" ").toLocaleLowerCase("fr").includes(query));
    const original = [...list];
    const sort = $("#sortProducts");
    const categoryFilter = $("#filterCategory");
    const stockFilter = $("#filterStock");
    if (categoryFilter) {
      const categories = [...new Set(original.map(item => item.category || "Soin"))].sort((a,b) => a.localeCompare(b,"fr"));
      for (const category of categories) {
        const option = document.createElement("option");
        option.value = category; option.textContent = category; categoryFilter.append(option);
      }
    }
    const render = () => {
      list = original.filter(item => {
        const categoryMatch = !categoryFilter || categoryFilter.value === "all" || (item.category || "Soin") === categoryFilter.value;
        const hasStock = !knownStock(item) || Number(item.stock) > 0;
        const stockMatch = !stockFilter || stockFilter.value === "all" ||
          (stockFilter.value === "available" ? hasStock : !hasStock);
        return categoryMatch && stockMatch;
      });
      if (sort?.value === "price-asc") list.sort((a, b) => Number(a.price) - Number(b.price));
      if (sort?.value === "price-desc") list.sort((a, b) => Number(b.price) - Number(a.price));
      renderProducts(all, list);
      const resultCount = $("#resultCount");
      if (resultCount) resultCount.textContent = list.length + " produit(s) affiché(s)";
    };
    sort?.addEventListener("change", render);
    categoryFilter?.addEventListener("change", render);
    stockFilter?.addEventListener("change", render);
    render();
  }
  const year = $("#year"); if (year) year.textContent = String(new Date().getFullYear());
  updateCart();
  const welcomeParams = new URLSearchParams(location.search);
  if (welcomeParams.get("welcome") === "1") {
    toast("Bienvenue chez Wave Skincare ! Votre compte est prêt.");
    welcomeParams.delete("welcome");
    const remaining = welcomeParams.toString();
    history.replaceState({}, document.title, location.pathname + (remaining ? "?" + remaining : "") + location.hash);
  }
  window.WaveStore = { cart: () => cart.map(line => ({ ...line })), product, money, total, save, clear, toast, refresh: updateCart };
  window.dispatchEvent(new Event("wave:ready"));
  return window.WaveStore;
})();
