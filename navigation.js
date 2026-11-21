/* Navigation Wave — gestion unique du menu mobile sur toutes les pages */
(() => {
  const pairs = [
    ["menuToggle", "mainNav"],
    ["adminMenuToggle", "adminMainNav"]
  ];
  for (const [buttonId, navId] of pairs) {
    const button = document.getElementById(buttonId);
    const nav = document.getElementById(navId);
    if (!button || !nav || button.dataset.waveNavigationReady === "1") continue;
    button.dataset.waveNavigationReady = "1";
    const setOpen = open => {
      nav.classList.toggle("show", open);
      button.setAttribute("aria-expanded", String(open));
      button.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
      button.textContent = open ? "×" : "☰";
    };
    button.addEventListener("click", event => {
      event.preventDefault();
      setOpen(!nav.classList.contains("show"));
    });
    nav.addEventListener("click", event => {
      if (event.target instanceof Element && event.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && nav.classList.contains("show")) setOpen(false);
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth > 680) setOpen(false);
    });
  }
})();