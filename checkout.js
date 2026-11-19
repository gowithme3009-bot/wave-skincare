import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(window.WAVE_SUPABASE_URL, window.WAVE_SUPABASE_PUBLISHABLE_KEY);
const form = document.getElementById("orderForm");
const list = document.getElementById("orderItems");
const submitButton = form?.querySelector('button[type="submit"]');

function renderSummary() {
  if (!list || !window.WaveStore) return;
  const cart = WaveStore.cart();
  list.innerHTML = cart.length
    ? cart.map(line => {
        const product = WaveStore.product(line.id);
        return product ? `<div class="summary-row"><span>${line.qty} × ${product.name}</span><b>${WaveStore.money(product.price * line.qty)}</b></div>` : "";
      }).join("")
    : "<p>Votre panier est vide.</p>";
  const total = document.getElementById("orderTotal");
  if (total) total.textContent = WaveStore.money(WaveStore.total());
}

renderSummary();

form?.addEventListener("submit", async event => {
  event.preventDefault();
  const cart = WaveStore.cart();
  if (!cart.length) {
    WaveStore.toast("Votre panier est vide.");
    return;
  }

  const data = new FormData(form);
  const customer = {
    name: String(data.get("name") || "").trim(),
    phone: String(data.get("phone") || "").trim(),
    address: String(data.get("address") || "").trim(),
    city: String(data.get("city") || "").trim(),
    note: String(data.get("note") || "").trim()
  };
  const items = cart.map(line => {
    const product = WaveStore.product(line.id);
    return product ? { name: product.name, quantity: line.qty } : null;
  }).filter(Boolean);

  if (items.length !== cart.length) {
    WaveStore.toast("Un produit du panier n'est plus reconnu. Actualisez la page.");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Enregistrement de votre commande…";

  try {
    const { data: result, error } = await supabase.rpc("create_guest_cod_order", {
      p_customer: customer,
      p_items: items
    });
    if (error) throw error;
    if (!result?.success || !result?.order_number) {
      throw new Error("La commande n'a pas pu être confirmée.");
    }

    localStorage.removeItem("waveCart");
    form.innerHTML = `
      <div role="status" style="text-align:center;padding:22px 4px">
        <p class="eyebrow">COMMANDE ENREGISTRÉE</p>
        <h2>Merci pour votre commande !</h2>
        <p>Votre référence :</p>
        <p style="font-size:22px;font-weight:700;color:#a66c0c">${result.order_number}</p>
        <p>Montant : <strong>${WaveStore.money(Number(result.total))}</strong></p>
        <p>Mode de paiement : <strong>Paiement à la livraison</strong>.</p>
        <p>Votre commande est en attente de confirmation. Notre équipe vous contactera au numéro indiqué pour confirmer la disponibilité et la livraison.</p>
        <a class="btn btn-gold full" href="boutique.html">Retour à la boutique</a>
      </div>`;
    renderSummary();
    const orderItems = document.getElementById("orderItems");
    if (orderItems) orderItems.innerHTML = "<p>Commande enregistrée.</p>";
    const orderTotal = document.getElementById("orderTotal");
    if (orderTotal) orderTotal.textContent = WaveStore.money(0);
  } catch (error) {
    console.error("Wave Skincare order error:", error);
    WaveStore.toast(error?.message || "Impossible d'enregistrer la commande. Réessayez.");
    submitButton.disabled = false;
    submitButton.textContent = "Confirmer ma commande — paiement à la livraison";
  }
});
