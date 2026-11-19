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

  // Conserver une copie du panier pour afficher le reçu après vidage du panier.
  const orderedLines = cart.map(line => {
    const product = WaveStore.product(line.id);
    return product ? {
      name: product.name,
      quantity: line.qty,
      lineTotal: product.price * line.qty
    } : null;
  }).filter(Boolean);

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

    // Vider le panier persistant, mais conserver le reçu visible sur cette page.
    localStorage.removeItem("waveCart");

    form.innerHTML = `
      <div role="status" style="text-align:center;padding:22px 4px">
        <p class="eyebrow">COMMANDE ENREGISTRÉE</p>
        <h2>Merci pour votre commande !</h2>
        <p>Votre référence :</p>
        <p style="font-size:22px;font-weight:700;color:#a66c0c"></p>
        <p>Montant : <strong></strong></p>
        <p>Mode de paiement : <strong>Paiement à la livraison</strong>.</p>
        <p>Votre commande est en attente de confirmation. Notre équipe vous contactera au numéro indiqué pour confirmer la disponibilité et la livraison.</p>
        <a class="btn btn-gold full" href="boutique.html">Retour à la boutique</a>
      </div>`;

    const receipt = form.querySelector('[role="status"]');
    const paragraphs = receipt.querySelectorAll("p");
    paragraphs[2].textContent = result.order_number;
    paragraphs[3].querySelector("strong").textContent = WaveStore.money(Number(result.total));

    // Afficher le contenu réel de la commande, pas le panier désormais vide.
    if (list) {
      list.replaceChildren();
      orderedLines.forEach(line => {
        const row = document.createElement("div");
        row.className = "summary-row";
        const label = document.createElement("span");
        label.textContent = `${line.quantity} × ${line.name}`;
        const amount = document.createElement("b");
        amount.textContent = WaveStore.money(line.lineTotal);
        row.append(label, amount);
        list.append(row);
      });
      const note = document.createElement("p");
      note.textContent = "Commande enregistrée.";
      list.append(note);
    }

    const orderTotal = document.getElementById("orderTotal");
    if (orderTotal) orderTotal.textContent = WaveStore.money(Number(result.total));
  } catch (error) {
    console.error("Wave Skincare order error:", error);
    WaveStore.toast(error?.message || "Impossible d'enregistrer la commande. Réessayez.");
    submitButton.disabled = false;
    submitButton.textContent = "Confirmer ma commande — paiement à la livraison";
  }
});
