import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

await (window.WAVE_APP_READY || Promise.resolve());
const supabase = createClient(window.WAVE_SUPABASE_URL, window.WAVE_SUPABASE_PUBLISHABLE_KEY);
const form = document.getElementById("orderForm");
const list = document.getElementById("orderItems");
const submitButton = form?.querySelector('button[type="submit"]');
const paymentDetails = document.getElementById("airtelPaymentDetails");
const paymentReferenceInput = document.getElementById("paymentReference");
const airtelTestMode = document.getElementById("airtelTestMode");
const airtelReferenceGroup = document.getElementById("airtelReferenceGroup");
const airtelTestHint = document.getElementById("airtelTestHint");
const paymentMethodHint = document.getElementById("paymentMethodHint");
const paymentRadios = [...(form?.querySelectorAll('input[name="payment_method"]') || [])];

function selectedPaymentMethod() {
  return paymentRadios.find(radio => radio.checked)?.value || "cash_on_delivery";
}

function updatePaymentFields() {
  const airtel = selectedPaymentMethod() === "airtel_money";
  if (paymentDetails) paymentDetails.hidden = !airtel;
  const testMode = airtel && Boolean(airtelTestMode?.checked);
  if (paymentReferenceInput) {
    paymentReferenceInput.disabled = !airtel || testMode;
    paymentReferenceInput.required = airtel && !testMode;
    if (testMode) paymentReferenceInput.value = "";
  }
  if (airtelReferenceGroup) airtelReferenceGroup.hidden = testMode;
  if (airtelTestHint) airtelTestHint.hidden = !testMode;
  if (paymentMethodHint) {
    paymentMethodHint.textContent = airtel
      ? "Votre commande sera enregistrée en attente de vérification du transfert. Elle ne sera pas marquée comme payée automatiquement."
      : "Vous réglerez votre commande au moment de la réception, après confirmation de notre équipe.";
  }
  if (submitButton && !submitButton.disabled) {
    submitButton.textContent = airtel
      ? "Confirmer — Airtel Money (paiement à vérifier)"
      : "Confirmer ma commande — paiement à la livraison";
  }
}
paymentRadios.forEach(radio => radio.addEventListener("change", updatePaymentFields));
airtelTestMode?.addEventListener("change", updatePaymentFields);
if (airtelTestMode) airtelTestMode.disabled = false;

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

const accountHint = document.getElementById("checkoutAccountHint");

const saveAddressCheckbox = document.getElementById("saveAddress");
const saveAddressHint = document.getElementById("saveAddressHint");

function configureAddressSaving(session) {
  if (!saveAddressCheckbox) return;
  const signedIn = Boolean(session?.user?.id);
  saveAddressCheckbox.disabled = !signedIn;
  if (saveAddressHint) {
    saveAddressHint.textContent = signedIn
      ? "Votre adresse sera enregistrée de façon privée dans votre compte."
      : "Connectez-vous pour enregistrer votre adresse. Vous pouvez toujours commander sans compte.";
  }
}

function setAccountHint(session) {
  if (accountHint) {
    accountHint.textContent = session?.user?.id
      ? "Vous êtes connecté : votre commande sera automatiquement associée à votre compte et visible dans « Mes commandes »."
      : "Vous pouvez commander sans compte. Si vous êtes connecté, votre commande sera automatiquement associée à votre compte.";
  }
  configureAddressSaving(session);
}

async function loadSavedAddress(session) {
  if (!session?.user?.id || !form) return;
  const { data, error } = await supabase
    .from("addresses")
    .select("full_name,phone,address,city")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("Wave Skincare saved address:", error.message);
    if (saveAddressHint) saveAddressHint.textContent = "Votre adresse enregistrée n'a pas pu être chargée.";
    return;
  }
  if (!data) return;

  const fields = {
    name: data.full_name,
    phone: data.phone,
    address: data.address,
    city: data.city
  };
  for (const [name, value] of Object.entries(fields)) {
    const field = form.elements.namedItem(name);
    if (field && !field.value && value) field.value = value;
  }
  if (saveAddressHint) saveAddressHint.textContent = "Votre dernière adresse enregistrée a été retrouvée. Vous pouvez la modifier.";
}

async function saveCustomerAddress(userId, customer) {
  const { data: existing, error: lookupError } = await supabase
    .from("addresses")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupError) throw lookupError;

  const addressData = {
    user_id: userId,
    full_name: customer.name,
    phone: customer.phone,
    address: customer.address,
    city: customer.city,
    country: "Madagascar"
  };

  if (existing?.id) {
    const { error } = await supabase.from("addresses").update(addressData).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("addresses").insert(addressData);
    if (error) throw error;
  }
}

async function refreshCheckoutAccountHint() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    if (accountHint) accountHint.textContent = "La vérification de votre compte est momentanément indisponible.";
    return;
  }
  setAccountHint(data.session);
  if (data.session?.user?.id) await loadSavedAddress(data.session);
}

supabase.auth.onAuthStateChange((_event, session) => {
  setAccountHint(session);
  if (session?.user?.id) loadSavedAddress(session);
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

function showReceipt(orderNumber, serverTotal, orderedLines, paymentMethod, paymentReference, isTest = false) {
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
  const isAirtel = paymentMethod === "airtel_money";
  const payment = node("p", isAirtel
    ? "Mode de paiement : Airtel Money — +261 33 82 03 366."
    : "Mode de paiement : paiement à la livraison.");
  const paymentState = node("p", isAirtel
    ? (isTest
      ? "MODE TEST : aucun transfert Airtel Money effectué. Aucun paiement reçu ni validé. Cette commande sert uniquement à vérifier le site."
      : "Statut : transfert en attente de vérification. Notre équipe vérifiera la réception avant de confirmer le paiement.")
    : "Statut : paiement à la livraison, en attente de confirmation de la commande.");
  const paymentReferenceLine = isAirtel && !isTest
    ? node("p", "Référence de transfert enregistrée : " + paymentReference)
    : null;
  const message = node("p", "Votre commande est en attente de confirmation. Notre équipe vous contactera au numéro indiqué pour confirmer la disponibilité et la livraison.");
  const back = node("a", "Retour à la boutique", "btn btn-gold full");
  back.href = "boutique.html";
  receipt.append(eyebrow, heading, intro, reference, total, payment, paymentState);
  if (paymentReferenceLine) receipt.append(paymentReferenceLine);
  receipt.append(message, back);
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
updatePaymentFields();
refreshCheckoutAccountHint();

form?.addEventListener("submit", async event => {
  event.preventDefault();
  const cart = window.WaveStore?.cart() || [];
  if (!cart.length) {
    window.WaveStore?.toast("Votre panier est vide.");
    renderSummary();
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
  const paymentMethod = selectedPaymentMethod();
  const paymentReference = String(data.get("payment_reference") || "").trim();
  const isTest = paymentMethod === "airtel_money" && Boolean(airtelTestMode?.checked);

  if (paymentMethod === "airtel_money" && !isTest &&
      (!/^[A-Za-z0-9._/-]{3,80}$/.test(paymentReference))) {
    window.WaveStore.toast("Saisissez la référence de transaction Airtel Money (3 à 80 caractères).");
    paymentReferenceInput?.focus();
    return;
  }

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

    const { data: result, error } = await supabase.rpc("create_guest_order_with_payment", {
      p_customer: customer,
      p_items: items,
      p_payment_method: paymentMethod,
      p_payment_reference: paymentMethod === "airtel_money" && !isTest ? paymentReference : null,
      p_is_test: isTest
    });
    if (error) throw error;
    if (!result?.success || !result?.order_number || !Number.isFinite(Number(result.total))) {
      throw new Error("La commande n'a pas pu être enregistrée correctement.");
    }

    // La commande est déjà enregistrée. La sauvegarde d'adresse est facultative
    // et ne doit jamais provoquer une seconde soumission de commande.
    let addressSaveFailed = false;
    if (saveAddressCheckbox?.checked && sessionData.session?.user?.id) {
      try {
        await saveCustomerAddress(sessionData.session.user.id, customer);
      } catch (addressError) {
        addressSaveFailed = true;
        console.warn("Wave Skincare address save:", addressError);
      }
    }

    // Le serveur valide le stock et recalcule le montant avant d'enregistrer.
    window.WaveStore.clear();
    showReceipt(result.order_number, result.total, orderedLines, paymentMethod, paymentReference, isTest);
    if (addressSaveFailed) {
      window.WaveStore.toast("Commande enregistrée, mais adresse non sauvegardée.");
    } else if (saveAddressCheckbox?.checked) {
      window.WaveStore.toast("Adresse enregistrée pour vos prochaines commandes.");
    }
  } catch (error) {
    console.error("Wave Skincare order error:", error);
    window.WaveStore.toast(error?.message || "Impossible d'enregistrer la commande. Réessayez.");
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = paymentMethod === "airtel_money" ? "Confirmer — Airtel Money (paiement à vérifier)" : "Confirmer ma commande — paiement à la livraison";
    }
  }
});