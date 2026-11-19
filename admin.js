import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(window.WAVE_SUPABASE_URL, window.WAVE_SUPABASE_PUBLISHABLE_KEY);
const status = document.getElementById("adminStatus");
const logout = document.getElementById("adminLogout");
const ordersMessage = document.getElementById("ordersMessage");
const ordersList = document.getElementById("ordersList");
const productsMessage = document.getElementById("productsMessage");
const productsList = document.getElementById("productsList");
const refreshOrders = document.getElementById("refreshOrders");
const money = value => new Intl.NumberFormat("fr-FR").format(Number(value || 0)) + " Ar";
const labels = {
  pending: "À confirmer",
  confirmed: "Confirmée",
  preparing: "En préparation",
  shipped: "En livraison",
  delivered: "Livrée",
  cancelled: "Annulée"
};
const allowedStatuses = Object.keys(labels);

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

async function loadProducts() {
  productsMessage.textContent = "Chargement du stock…";
  productsList.replaceChildren();
  const { data, error } = await supabase
    .from("products")
    .select("id,name,price,stock,active")
    .order("name", { ascending: true });

  if (error) {
    productsMessage.textContent = "Impossible de charger le stock : " + error.message;
    return;
  }
  productsMessage.textContent = data.length + " produit(s) dans le catalogue.";
  for (const product of data) {
    const row = element("div", undefined, "stock-row");
    const info = element("div");
    info.append(element("strong", product.name));
    info.append(element("div", money(product.price) + " · " + (product.active ? "En vente" : "Masqué"), "stock-meta"));

    const quantity = document.createElement("input");
    quantity.type = "number";
    quantity.min = "0";
    quantity.step = "1";
    quantity.value = String(product.stock ?? 0);
    quantity.setAttribute("aria-label", "Stock de " + product.name);

    const save = element("button", "Enregistrer", "btn btn-gold");
    save.type = "button";
    save.addEventListener("click", async () => {
      const nextStock = Number(quantity.value);
      if (!Number.isInteger(nextStock) || nextStock < 0) {
        productsMessage.textContent = "Saisissez un stock entier supérieur ou égal à zéro.";
        return;
      }
      save.disabled = true;
      const { error: updateError } = await supabase
        .from("products")
        .update({ stock: nextStock })
        .eq("id", product.id);
      if (updateError) {
        productsMessage.textContent = "Mise à jour impossible : " + updateError.message;
      } else {
        product.stock = nextStock;
        productsMessage.textContent = "Stock enregistré pour " + product.name + ".";
      }
      save.disabled = false;
    });
    row.append(info, quantity, save);
    productsList.append(row);
  }
}

async function loadOrders() {
  ordersMessage.textContent = "Chargement des commandes…";
  ordersList.replaceChildren();
  const { data, error } = await supabase
    .from("orders")
    .select("id,order_number,status,payment_method,payment_status,total,delivery_address,created_at,order_items(product_name,quantity,unit_price)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    ordersMessage.textContent = "Impossible de charger les commandes : " + error.message;
    return;
  }
  if (!data?.length) {
    ordersMessage.textContent = "Aucune commande pour le moment.";
    return;
  }
  ordersMessage.textContent = data.length + " commande(s) récente(s).";

  for (const order of data) {
    const card = element("article", undefined, "order-card");
    card.append(element("h3", order.order_number));
    card.append(element("p", "Reçue le " + new Date(order.created_at).toLocaleString("fr-FR")));
    const customer = order.delivery_address || {};
    card.append(element("p", "Client : " + (customer.name || "—")));
    card.append(element("p", "Téléphone : " + (customer.phone || "—")));
    card.append(element("p", "Adresse : " + [customer.address, customer.city].filter(Boolean).join(", ")));
    const items = element("ul", undefined, "order-items");
    for (const item of (order.order_items || [])) {
      items.append(element("li", item.quantity + " × " + item.product_name + " — " + money(item.unit_price) + " / unité"));
    }
    card.append(items);
    card.append(element("p", "Total à encaisser : " + money(order.total)));
    card.append(element("p", "Paiement : à la livraison — " + (order.payment_status === "paid" ? "payé" : "non payé")));
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Statut de la commande " + order.order_number);
    for (const key of allowedStatuses) {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = labels[key];
      option.selected = key === order.status;
      select.append(option);
    }
    select.addEventListener("change", async () => {
      select.disabled = true;
      const previous = order.status;
      const { error: updateError } = await supabase.from("orders").update({ status: select.value }).eq("id", order.id);
      if (updateError) {
        ordersMessage.textContent = "Mise à jour impossible : " + updateError.message;
        select.value = previous;
      } else {
        order.status = select.value;
        ordersMessage.textContent = "Statut mis à jour pour " + order.order_number + ".";
      }
      select.disabled = false;
    });
    card.append(element("p", "Statut de la commande :"), select);
    ordersList.append(card);
  }
}

async function verify() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) { status.textContent = "Erreur : " + error.message; return; }
  if (!session) { status.textContent = "Accès refusé : connectez-vous avec le compte administrateur."; return; }
  const { data: profile, error: profileError } = await supabase
    .from("profiles").select("role").eq("id", session.user.id).maybeSingle();
  if (profileError) { status.textContent = "Impossible de vérifier le rôle : " + profileError.message; return; }
  if (profile?.role !== "admin") { status.textContent = "Accès refusé. Ce compte n’a pas le rôle admin."; return; }
  status.textContent = "Accès autorisé. Compte administrateur vérifié.";
  logout.hidden = false;
  await Promise.all([loadProducts(), loadOrders()]);
}

logout.addEventListener("click", async () => {
  await supabase.auth.signOut();
  location.href = "compte.html";
});
refreshOrders?.addEventListener("click", () => { loadOrders(); });
supabase.auth.onAuthStateChange(() => { verify(); });
verify();
