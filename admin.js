import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const supabase = createClient(window.WAVE_SUPABASE_URL, window.WAVE_SUPABASE_PUBLISHABLE_KEY);
const $ = id => document.getElementById(id);
const status = $("adminStatus"), logout = $("adminLogout");
const ordersMessage = $("ordersMessage"), ordersList = $("ordersList");
const productsMessage = $("productsMessage"), productsList = $("productsList");
const refreshOrders = $("refreshOrders"), productForm = $("productForm");
const money = value => new Intl.NumberFormat("fr-FR").format(Number(value || 0)) + " Ar";
const labels = {pending:"À confirmer",confirmed:"Confirmée",preparing:"En préparation",shipped:"En livraison",delivered:"Livrée",cancelled:"Annulée"};
const allowedStatuses = Object.keys(labels);
let ordersCache = [];
let knownOrderIds = null;
let adminReady = false;
let pollingTimer = null;
let loadingOrders = false;
function el(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
function setStat(id,value){const node=$(id);if(node)node.textContent=value;}

function resetProductForm(){
 productForm.reset(); $("productId").value=""; $("productStock").value="0"; $("productActive").checked=true;
 $("saveProduct").textContent="Ajouter le produit"; $("cancelProductEdit").hidden=true;
}
$("cancelProductEdit")?.addEventListener("click",resetProductForm);
productForm?.addEventListener("submit",async event=>{
 event.preventDefault();
 const id=$("productId").value;
 const payload={
  name:$("productName").value.trim(),
  description:$("productDescription").value.trim() || null,
  price:Number($("productPrice").value),
  stock:Number($("productStock").value),
  image_url:$("productImage").value.trim() || null,
  active:$("productActive").checked
 };
 if(!payload.name || !Number.isFinite(payload.price) || payload.price<0 || !Number.isInteger(payload.stock) || payload.stock<0){
  productsMessage.textContent="Vérifiez le nom, le prix et le stock (nombre entier positif ou nul).";return;
 }
 const button=$("saveProduct");button.disabled=true;productsMessage.textContent="Enregistrement du produit…";
 try{
  const result=id
   ? await supabase.from("products").update(payload).eq("id",id)
   : await supabase.from("products").insert(payload);
  if(result.error)throw result.error;
  productsMessage.textContent=id?"Produit modifié avec succès.":"Nouveau produit ajouté au catalogue.";
  resetProductForm();await loadProducts();
 }catch(error){productsMessage.textContent="Enregistrement impossible : "+error.message;}
 finally{button.disabled=false;}
});

async function loadProducts(){
 productsMessage.textContent="Chargement du catalogue…";productsList.replaceChildren();
 const {data,error}=await supabase.from("products").select("id,name,description,price,image_url,stock,active").order("name");
 if(error){productsMessage.textContent="Impossible de charger les produits : "+error.message;return;}
 productsMessage.textContent=data.length+" produit(s) enregistré(s).";
 for(const product of data){
  const row=el("div",undefined,"product-row");
  const image=el("img");image.src=product.image_url||"assets/wave-boutique.webp";image.alt="";
  const info=el("div",undefined,"product-row-info");
  info.append(el("strong",product.name));
  info.append(el("small",money(product.price)+" · Stock : "+product.stock+" · "+(product.active?"Visible":"Masqué")));
  const actions=el("div",undefined,"product-row-actions");
  const edit=el("button","Modifier","btn btn-dark");edit.type="button";
  edit.addEventListener("click",()=>{
   $("productId").value=product.id;$("productName").value=product.name;
   $("productDescription").value=product.description||"";$("productPrice").value=product.price;
   $("productStock").value=product.stock;$("productImage").value=product.image_url||"";
   $("productActive").checked=product.active;$("saveProduct").textContent="Enregistrer les modifications";
   $("cancelProductEdit").hidden=false;productForm.scrollIntoView({behavior:"smooth",block:"start"});
  });
  const toggle=el("button",product.active?"Masquer":"Réactiver","btn btn-gold");toggle.type="button";
  toggle.addEventListener("click",async()=>{
   toggle.disabled=true;const {error:updateError}=await supabase.from("products").update({active:!product.active}).eq("id",product.id);
   if(updateError){productsMessage.textContent="Modification impossible : "+updateError.message;toggle.disabled=false;return;}
   productsMessage.textContent=product.name+(product.active?" masqué.":" réactivé.");await loadProducts();
  });
  actions.append(edit,toggle);row.append(image,info,actions);productsList.append(row);
 }
}

function updateOrderStats(){
 const total=ordersCache.length;
 setStat("statTotal",String(total));
 setStat("statPending",String(ordersCache.filter(o=>o.status==="pending").length));
 setStat("statActive",String(ordersCache.filter(o=>["confirmed","preparing","shipped"].includes(o.status)).length));
 setStat("statDelivered",String(ordersCache.filter(o=>o.status==="delivered").length));
 setStat("statRevenue",money(ordersCache.reduce((sum,o)=>sum+Number(o.total||0),0)));
}
function waNumber(phone){
 let digits=String(phone||"").replace(/[^0-9]/g,"");
 if(digits.startsWith("00"))digits=digits.slice(2);
 if(digits.startsWith("0"))digits="261"+digits.slice(1);
 return digits;
}
function renderOrders(){
 ordersList.replaceChildren();
 const filter=$("orderStatusFilter")?.value||"all";
 const search=($("orderSearch")?.value||"").trim().toLocaleLowerCase("fr");
 const visible=ordersCache.filter(order=>{
  const customer=order.delivery_address||{};
  const haystack=[order.order_number,customer.name,customer.phone].join(" ").toLocaleLowerCase("fr");
  return (filter==="all"||order.status===filter)&&(!search||haystack.includes(search));
 });
 if(!visible.length){ordersList.append(el("p",ordersCache.length?"Aucune commande ne correspond à ce filtre.":"Aucune commande pour le moment."));return;}
 for(const order of visible){
  const card=el("article",undefined,"order-card");
  const top=el("div",undefined,"order-card-top");
  top.append(el("h3",order.order_number));
  top.append(el("span",labels[order.status]||order.status,"order-pill"));
  card.append(top);
  card.append(el("p","Reçue le "+new Date(order.created_at).toLocaleString("fr-FR")));
  const customer=order.delivery_address||{};
  card.append(el("p","Client : "+(customer.name||"—")));
  card.append(el("p","Téléphone : "+(customer.phone||"—")));
  card.append(el("p","Adresse : "+[customer.address,customer.city].filter(Boolean).join(", ")));
  const items=el("ul",undefined,"order-items");
  for(const item of(order.order_items||[]))items.append(el("li",item.quantity+" × "+item.product_name+" — "+money(item.unit_price)+" / unité"));
  card.append(items);
  card.append(el("p","Total à encaisser : "+money(order.total)));
  card.append(el("p","Paiement : à la livraison — "+(order.payment_status==="paid"?"payé":"non payé")));
  const actions=el("div",undefined,"order-actions");
  const select=document.createElement("select");select.setAttribute("aria-label","Statut de la commande "+order.order_number);
  for(const key of allowedStatuses){const option=el("option",labels[key]);option.value=key;option.selected=key===order.status;select.append(option);}
  select.addEventListener("change",async()=>{
   select.disabled=true;const previous=order.status;
   const {error:updateError}=await supabase.from("orders").update({status:select.value}).eq("id",order.id);
   if(updateError){ordersMessage.textContent="Mise à jour impossible : "+updateError.message;select.value=previous;}
   else{order.status=select.value;ordersMessage.textContent="Statut mis à jour pour "+order.order_number+".";updateOrderStats();renderOrders();}
   select.disabled=false;
  });
  actions.append(select);
  const phone=waNumber(customer.phone);
  if(phone){
   const message="Bonjour "+(customer.name||"")+" , nous vous contactons au sujet de votre commande "+order.order_number+" chez Wave Skincare. Montant à régler à la livraison : "+money(order.total)+". Merci de confirmer votre disponibilité.";
   const link=el("a","Préparer WhatsApp","btn btn-gold");
   link.href="https://wa.me/"+phone+"?text="+encodeURIComponent(message);link.target="_blank";link.rel="noopener";
   actions.append(link);
  }
  card.append(actions);ordersList.append(card);
 }
}
function notifyNewOrders(newOrders){
 if(!newOrders.length)return;
 ordersMessage.textContent=newOrders.length+" nouvelle(s) commande(s) détectée(s). Vérifiez les détails avant confirmation.";
 if("Notification" in window && Notification.permission==="granted"){
  new Notification("Wave Skincare — nouvelle commande",{body:newOrders.length===1?newOrders[0].order_number:newOrders.length+" nouvelles commandes reçues.",tag:"wave-new-orders"});
 }
}
async function loadOrders({silent=false}={}){
 if(loadingOrders)return;
 loadingOrders=true;
 if(!silent)ordersMessage.textContent="Chargement des commandes…";
 try{
  const {data,error}=await supabase.from("orders").select("id,order_number,status,payment_method,payment_status,total,delivery_address,created_at,order_items(product_name,quantity,unit_price)").order("created_at",{ascending:false}).limit(50);
  if(error)throw error;
  const fresh=data||[];
  const freshIds=new Set(fresh.map(o=>o.id));
  const newOrders=knownOrderIds===null?[]:fresh.filter(o=>!knownOrderIds.has(o.id));
  knownOrderIds=freshIds;
  ordersCache=fresh;
  updateOrderStats();renderOrders();
  if(newOrders.length)notifyNewOrders(newOrders);
  else if(!silent)ordersMessage.textContent=fresh.length+" commande(s) récente(s).";
  const stamp=$("lastOrdersRefresh");
  if(stamp)stamp.textContent="Dernière actualisation : "+new Date().toLocaleTimeString("fr-FR")+" · Actualisation automatique toutes les 30 secondes.";
 }catch(error){
  ordersMessage.textContent="Impossible de charger les commandes : "+error.message;
 }finally{loadingOrders=false;}
}
$("orderStatusFilter")?.addEventListener("change",renderOrders);
$("orderSearch")?.addEventListener("input",renderOrders);
$("enableOrderAlerts")?.addEventListener("click",async()=>{
 if(!("Notification" in window)){ordersMessage.textContent="Les notifications ne sont pas prises en charge par ce navigateur.";return;}
 const permission=await Notification.requestPermission();
 ordersMessage.textContent=permission==="granted"?"Alertes activées sur cet appareil.":"Autorisation des notifications non accordée.";
 $("enableOrderAlerts").textContent=permission==="granted"?"Alertes activées":"Réessayer les alertes";
});
function startOrderPolling(){
 if(pollingTimer)return;
 pollingTimer=setInterval(()=>{
  if(adminReady && document.visibilityState==="visible")loadOrders({silent:true});
 },30000);
}

async function verify(){
 const {data:{session},error}=await supabase.auth.getSession();
 if(error){status.textContent="Erreur : "+error.message;adminReady=false;return;}
 if(!session){status.textContent="Accès refusé : connectez-vous avec le compte administrateur.";adminReady=false;return;}
 const {data:profile,error:profileError}=await supabase.from("profiles").select("role").eq("id",session.user.id).maybeSingle();
 if(profileError){status.textContent="Impossible de vérifier le rôle : "+profileError.message;adminReady=false;return;}
 if(profile?.role!=="admin"){status.textContent="Accès refusé. Ce compte n’a pas le rôle admin.";adminReady=false;return;}
 status.textContent="Accès autorisé. Compte administrateur vérifié.";logout.hidden=false;adminReady=true;
 await Promise.all([loadProducts(),loadOrders()]);
 startOrderPolling();
}
logout.addEventListener("click",async()=>{if(pollingTimer)clearInterval(pollingTimer);await supabase.auth.signOut();location.href="compte.html";});
refreshOrders?.addEventListener("click",()=>loadOrders());
supabase.auth.onAuthStateChange(()=>verify());verify();
