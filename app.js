window.WAVE_APP_READY = (async () => {
  await (window.WAVE_PRODUCTS_READY || Promise.resolve());

  const $ = selector => document.querySelector(selector);
  const money = value => new Intl.NumberFormat("fr-FR").format(Number(value || 0)) + " Ar";
  const fallbackImage = "assets/wave-boutique.webp";

  function safeImage(source) {
    const value = String(source || "").trim();
    if (/^assets\/[a-z0-9_./-]+$/i.test(value) && !value.includes("..")) return value;
    try {
      const url = new URL(value, location.origin);
      if (url.protocol === "https:") return url.href;
    } catch (_) {}
    return fallbackImage;
  }

  function readCart() {
    try {
      const saved = JSON.parse(localStorage.getItem("waveCart") || "[]");
      if (!Array.isArray(saved)) return [];
      const normalized = [];
      for (const line of saved) {
        if (!line || typeof line.id !== "string") continue;
        const product = window.WAVE_PRODUCTS.find(item => item.id === line.id);
        const quantity = Number(line.qty);
        if (!product || !Number.isInteger(quantity) || quantity < 1) continue;
        const stock = product.stock == null ? null : Number(product.stock);
        const safeQuantity = Number.isFinite(stock) ? Math.min(quantity, Math.max(0, stock)) : Math.min(quantity, 99);
        if (safeQuantity < 1) continue;
        const existing = normalized.find(item => item.id === line.id);
        if (existing) existing.qty = Math.min(existing.qty + safeQuantity, Number.isFinite(stock) ? stock : 99);
        else normalized.push({ id: line.id, qty: safeQuantity });
      }
      return normalized;
    } catch (_) {
      return [];
    }
  }

  let cart = readCart();
  const product = id => window.WAVE_PRODUCTS.find(item => item.id === id);
  const count = () => cart.reduce((sum, line) => sum + line.qty, 0);
  const total = () => cart.reduce((sum, line) => sum + (Number(product(line.id)?.price) || 0) * line.qty, 0);

  function toast(message) {
    const node = $("#toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    window.setTimeout(() => node.classList.remove("show"), 2600);
  }

  function save() {
    try {
      localStorage.setItem("waveCart", JSON.stringify(cart));
    } catch (_) {
      toast("Le panier ne peut pas être sauvegardé sur cet appareil.");
    }
    updateCart();
  }

  function makeProductCard(item) {
    const article = document.createElement("article");
    article.className = "product-card";

    const visual = document.createElement("div");
    visual.className = "product-image";
    const image = document.createElement("img");
    image.src = safeImage(item.image);
    image.alt = item.name ? "Visuel de " + item.name : "Produit Wave Skincare";
    image.loading = "lazy";
    image.decoding = "async";
    image.onerror = () => { image.onerror = null; image.src = fallbackImage; };
    const tag = document.createElement("span");
    tag.textContent = item.tag || "SOIN WAVE";
    visual.append(image, tag);

    const copy = document.createElement("div");
    copy.className = "product-card-copy";
    const meta = document.createElement("small");
    meta.textContent = [item.category, item.size].filter(Boolean).join(" · ");
    const title = document.createElement("h3");
    title.textContent = item.name || "Soin Wave";
    const description = document.createElement("p");
    description.textContent = item.desc || "";
    const bottom = document.createElement("div");
    bottom.className = "product-card-bottom";
    const price = document.createElement("b");
    price.textContent = money(item.price);
    const button = document.createElement("button");
    button.className = "add-button";
    button.type = "button";
    button.dataset.add = item.id;
    const stock = item.stock == null ? null : Number(item.stock);
    button.disabled = Number.isFinite(stock) && stock < 1;
    button.textContent = button.disabled ? "Indisponible" : "+ Ajouter";
    button.setAttribute("aria-label", button.disabled ? item.name + " indisponible" : "Ajouter " + item.name + " au panier");
    bottom.append(price, button);
    copy.append(meta, title, description, bottom);
    article.append(visual, copy);
    return article;
  }

  function updateCart() {
    const counter = $("#cartCount");
    if (counter) counter.textContent = String(count());

    const items = $("#cartItems");
    if (items) {
      items.replaceChildren();
      if (!cart.length) {
        const empty = document.createElement("p");
        empty.className = "empty-cart";
        empty.textContent = "Votre panier est encore vide.";
        items.append(empty);
      } else {
        for (const line of cart) {
          const item = product(line.id);
          if (!item) continue;
          const row = document.createElement("div");
          row.className = "cart-row";
          const image = document.createElement("img");
          image.src = safeImage(item.image);
          image.alt = "";
          image.loading = "lazy";
          image.onerror = () => { image.onerror = null; image.src = fallbackImage; };
          const info = document.createElement("div");
          const name = document.createElement("b");
          name.textContent = item.name;
          const price = document.createElement("small");
          price.textContent = money(item.price);
          const controls = document.createElement("div");
          controls.className = "qty";
          const minus = document.createElement("button");
          minus.type = "button";
          minus.dataset.qty = item.id;
          minus.dataset.step = "-1";
          minus.setAttribute("aria-label", "Diminuer la quantité de " + item.name);
          minus.textContent = "−";
          const quantity = document.createElement("span");
          quantity.textContent = String(line.qty);
          const plus = document.createElement("button");
          plus.type = "button";
          plus.dataset.qty = item.id;
          plus.dataset.step = "1";
          plus.setAttribute("aria-label", "Augmenter la quantité de " + item.name);
          const stock = item.stock == null ? null : Number(item.stock);
          plus.disabled = Number.isFinite(stock) && line.qty >= stock;
          plus.textContent = "+";
          const remove = document.createElement("button");
          remove.type = "button";
          remove.className = "remove";
          remove.dataset.remove = item.id;
          remove.textContent = "Retirer";
          controls.append(minus, quantity, plus, remove);
          info.append(name, price, controls);
          row.append(image, info);
          items.append(row);
        }
      }
    }

    const cartTotal = $("#cartTotal");
    if (cartTotal) cartTotal.textContent = money(total());
  }

  function add(id) {
    const item = product(id);
    if (!item) return;
    const stock = item.stock == null ? null : Number(item.stock);
    const line = cart.find(entry => entry.id === id);
    if (Number.isFinite(stock) && (!stock || (line?.qty || 0) >= stock)) {
      toast(stock ? "La quantité maximale disponible est déjà dans votre panier." : "Ce produit est momentanément indisponible.");
      return;
    }
    if (line) line.qty += 1;
    else cart.push({ id, qty: 1 });
    save();
    toast("Produit ajouté au panier.");
  }

  function drawer(open) {
    $("#cartDrawer")?.classList.toggle("open", open);
    $("#cartBackdrop")?.classList.toggle("show", open);
    $("#cartDrawer")?.setAttribute("aria-hidden", String(!open));
    document.body.classList.toggle("cart-open", open);
    if (open) $("#cartClose")?.focus();
    else $("#cartToggle")?.focus();
  }

  document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const addButton = target.closest("[data-add]");
    if (addButton) add(addButton.dataset.add);

    const quantityButton = target.closest("[data-qty]");
    if (quantityButton) {
      const line = cart.find(entry => entry.id === quantityButton.dataset.qty);
      if (line) {
        const item = product(line.id);
        const next = line.qty + Number(quantityButton.dataset.step);
        const stock = item?.stock == null ? null : Number(item.stock);
        if (next > 0 && Number.isFinite(stock) && next > stock) {
          toast("Stock disponible : " + stock + " unité(s).");
          return;
        }
        line.qty = next;
        if (line.qty <= 0) cart = cart.filter(entry => entry.id !== line.id);
        save();
      }
    }

    const removeButton = target.closest("[data-remove]");
    if (removeButton) {
      cart = cart.filter(entry => entry.id !== removeButton.dataset.remove);
      save();
    }

    if (target.closest("#cartToggle")) drawer(true);
    if (target.closest("#cartClose") || target.closest("#cartBackdrop")) drawer(false);

    const menuToggle = target.closest("#menuToggle");
    if (menuToggle) {
      const nav = $("#mainNav");
      const expanded = nav?.classList.toggle("show") || false;
      menuToggle.setAttribute("aria-expanded", String(expanded));
    }

    if (target.closest("#searchToggle")) {
      const panel = $("#searchPanel");
      panel?.classList.toggle("show");
      if (panel?.classList.contains("show")) $("#searchInput")?.focus();
    }

    if (target.closest("#searchSubmit")) submitSearch();
    const navLink = target.closest("#mainNav a");
    if (navLink) {
      $("#mainNav")?.classList.remove("show");
      $("#menuToggle")?.setAttribute("aria-expanded", "false");
    }
  });

  function submitSearch() {
    const query = $("#searchInput")?.value.trim();
    if (query) location.href = "boutique.html?q=" + encodeURIComponent(query);
  }

  $("#searchInput")?.addEventListener("keydown", event => {
    if (event.key === "Enter") submitSearch();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      if ($("#cartDrawer")?.classList.contains("open")) drawer(false);
      $("#mainNav")?.classList.remove("show");
      $("#menuToggle")?.setAttribute("aria-expanded", "false");
    }
  });

  const featured = $("#featuredProducts");
  if (featured) {
    featured.replaceChildren(...window.WAVE_PRODUCTS.slice(0, 3).map(makeProductCard));
  }

  const allProducts = $("#allProducts");
  if (allProducts) {
    const params = new URLSearchParams(location.search);
    const query = (params.get("q") || "").trim().toLocaleLowerCase("fr");
    const filtered = window.WAVE_PRODUCTS.filter(item =>
      [item.name, item.desc, item.category].join(" ").toLocaleLowerCase("fr").includes(query)
    );
    const sort = $("#sortProducts");
    const resultCount = $("#resultCount");

    const renderProducts = () => {
      const sorted = [...filtered];
      if (sort?.value === "price-asc") sorted.sort((a, b) => Number(a.price) - Number(b.price));
      if (sort?.value === "price-desc") sorted.sort((a, b) => Number(b.price) - Number(a.price));
      allProducts.replaceChildren();
      if (sorted.length) {
        allProducts.append(...sorted.map(makeProductCard));
      } else {
        const empty = document.createElement("p");
        empty.className = "empty-cart";
        empty.textContent = "Aucun produit ne correspond à votre recherche.";
        allProducts.append(empty);
      }
      if (resultCount) resultCount.textContent = sorted.length + " produit(s)";
    };
    sort?.addEventListener("change", renderProducts);
    renderProducts();
  }

  const year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());

  updateCart();

  window.WaveStore = {
    cart: () => cart.map(line => ({ ...line })),
    product,
    money,
    total,
    save,
    clear: () => { cart = []; save(); },
    toast
  };
  return window.WaveStore;
})();