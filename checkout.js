import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

await (window.WAVE_APP_READY || Promise.resolve());
const supabase = createClient(window.WAVE_SUPABASE_URL, window.WAVE_SUPABASE_PUBLISHABLE_KEY);
const form = document.getElementById("orderForm");
const list = document.getElementById("orderItems");
const submitButton = form?.querySelector('button[type="submit"]');

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

const accountHint = document.getElementById("checkoutAccountHint");

function setAccountHint(session) {
  if (!accountHint) return;
  accountHint.textContent = session?.user?.id
    ? "Vous êtes connecté : votre commande sera automatiquement associée à votre compte et visible dans « Mes commandes »."
    : "Vous pouvez commander sans compte. Si vous êtes connecté, votre commande sera automatiquement associée à votre compte.";
}

async function refreshCheckoutAccountHint() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    if (accountHint) accountHint.textContent = "La vérification de votre compte est momentanément indisponible.";
    return;
  }
  setAccountHint(data.session);
}

supabase.auth.onAuthStateChange((_event, session) => {
  setAccountHint(session);
});

function renderSummary() {
  if (!list || !window.WaveStore) return;
  const cart = window.WaveStore.cart();
  list.replaceChildren();
  if (!cart.length) {
    list.append(node("p", "Votre panier est vide."));
  } else {
    for (const line of cart) {
      const product = window.WaveStore.product(line.id);
      if (!product) continue;
      const row = node("div", undefined, "summary-row");
      row.append(
        node("span", line.qty + " × " + product.name),
        node("b", window.WaveStore.money(product.price * line.qty))
      );
      list.append(row);
    }
  }
  const total = document.getElementById("orderTotal");
  if (total) total.textContent = window.WaveStore.money(window.WaveStore.total());
}

function showReceipt(orderNumber, serverTotal, orderedLines) {
  form.replaceChildren();
  const receipt = node("div", undefined, "order-receipt");
  receipt.setAttribute("role", "status");
  receipt.setAttribute("aria-live", "polite");
  const eyebrow = node("p", "COMMANDE ENREGISTRÉE", "eyebrow");
  const heading = node("h2", "Merci pour votre commande !");
  const intro = node("p", "Votre référence :");
  const reference = node("p", orderNumber, "receipt-reference");
  const total = node("p", undefined, "receipt-total");
  total.append(document.createTextNode("Montant enregistré : "), node("strong", window.WaveStore.money(Number(serverTotal))));
  const payment = node("p", "Mode de paiement : paiement à la livraison.");
  const message = node("p", "Votre commande est en attente de confirmation. Notre équipe vous contactera au numéro indiqué pour confirmer la disponibilité et la livraison.");
  const back = node("a", "Retour à la boutique", "btn btn-gold full");
  back.href = "boutique.html";
  receipt.append(eyebrow, heading, intro, reference, total, payment, message, back);
  form.append(receipt);

  if (list) {
    list.replaceChildren();
    for (const line of orderedLines) {
      const row = node("div", undefined, "summary-row");
      row.append(node("span", line.quantity + " × " + line.name));
      list.append(row);
    }
    list.append(node("p", "Commande enregistrée. Le montant final ci-dessus est calculé par le serveur."));
  }
  const orderTotal = document.getElementById("orderTotal");
  if (orderTotal) orderTotal.textContent = window.WaveStore.money(Number(serverTotal));
}

renderSummary();
refreshCheckoutAccountHint();

form?.addEventListener("submit", async event => {
  event.preventDefault();
  const cart = window.WaveStore?.cart() || [];
  if (!cart.length) {
    window.WaveStore?.toast("Votre panier est vide.");
    renderSummary();\nrefreshCheckoutAccountHint();
    return;
  }

  const orderedLines = cart.map(line => {
    const product = window.WaveStore.product(line.id);
    return product ? {
      name: product.name,
      quantity: line.qty
    } : null;
  }).filter(Boolean);

  if (orderedLines.length !== cart.length) {
    window.WaveStore.toast("Un produit du panier n'est plus reconnu. Actualisez la page.");
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
  const items = orderedLines.map(line => ({ name: line.name, quantity: line.quantity }));

  if (!customer.name || !customer.phone || !customer.address || !customer.city) {
    window.WaveStore.toast("Veuillez remplir les informations de livraison obligatoires.");
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Enregistrement de votre commande…";
  }

  try {
    // Vérifier la session : la fonction SQL utilise auth.uid() pour rattacher
    // automatiquement la commande au compte authentifié, sans faire confiance au navigateur.
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (sessionData.session) {
      const { data: verifiedUser, error: userError } = await supabase.auth.getUser();
      if (userError) throw new Error("Votre session client doit être vérifiée. Actualisez la page ou reconnectez-vous avant de commander.");
      if (!verifiedUser.user || verifiedUser.user.id !== sessionData.session.user.id) {
        throw new Error("La session client n’est pas valide. Reconnectez-vous avant de commander.");
      }
    }

    const { data: result, error } = await supabase.rpc("create_guest_cod_order", {
      p_customer: customer,
      p_items: items
    });
    if (error) throw error;
    if (!result?.success || !result?.order_number || !Number.isFinite(Number(result.total))) {
      throw new Error("La commande n'a pas pu être enregistrée correctement.");
    }

    // Le serveur valide le stock et recalcule le montant avant d'enregistrer.
    window.WaveStore.clear();
    showReceipt(result.order_number, result.total, orderedLines);
  } catch (error) {
    console.error("Wave Skincare order error:", error);
    window.WaveStore.toast(error?.message || "Impossible d'enregistrer la commande. Réessayez.");
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Confirmer ma commande — paiement à la livraison";
    }
  }
});