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
const paymentStatusLabels = {unpaid:"Non payé",pending_verification:"À vérifier",paid:"Payé — vérifié",refunded:"Remboursé"};
let ordersCache = [];
let knownOrderIds = null;
let adminReady = false;
let pollingTimer = null;
let loadingOrders = false;
let loadingProducts = false;
let savingProduct = false;
function el(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
function setStat(id,value){const node=$(id);if(node)node.textContent=value;}

function setImagePreview(url){
 const preview=$("productImagePreview");
 if(!preview)return;
 if(url){preview.src=url;preview.hidden=false;}else{preview.removeAttribute("src");preview.hidden=true;}
}
function resetProductForm(){
 productForm.reset(); $("productId").value=""; $("productStock").value="0"; $("productActive").checked=true;
 $("saveProduct").textContent="Ajouter le produit"; $("cancelProductEdit").hidden=true;
 $("productImageFile").value=""; setImagePreview("");
}
$("productImageFile")?.addEventListener("change",()=>{
 const file=$("productImageFile").files?.[0];
 if(!file){setImagePreview($("productImage").value.trim());return;}
 if(!["image/jpeg","image/png","image/webp","image/avif"].includes(file.type)||file.size>5*1024*1024){
  $("productImageFile").value="";setImagePreview($("productImage").value.trim());
  productsMessage.textContent="Image non acceptée : choisissez JPG, PNG, WebP ou AVIF de 5 Mo maximum.";return;
 }
 setImagePreview(URL.createObjectURL(file));
 productsMessage.textContent="Photo sélectionnée. Elle sera envoyée lors de l’enregistrement.";
});
$("productImage")?.addEventListener("input",()=>{if(!$("productImageFile")?.files?.length)setImagePreview($("productImage").value.trim());});
$("cancelProductEdit")?.addEventListener("click",resetProductForm);
productForm?.addEventListener("submit",async event=>{
 event.preventDefault();
 if(savingProduct)return;
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
 const button=$("saveProduct");
 savingProduct=true;button.disabled=true;
 productsMessage.textContent="Enregistrement du produit…";
 try{
  const selectedImage=$("productImageFile").files?.[0];
  if(selectedImage){
   if(!["image/jpeg","image/png","image/webp","image/avif"].includes(selectedImage.type)||selectedImage.size>5*1024*1024)throw new Error("Choisissez une image JPG, PNG, WebP ou AVIF de 5 Mo maximum.");
   const extension=({ "image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/avif":"avif" })[selectedImage.type];
   const unique=globalThis.crypto?.randomUUID?.()||Date.now()+"-"+Math.random().toString(36).slice(2);
   const imagePath="products/"+unique+"."+extension;
   const {error:uploadError}=await supabase.storage.from("product-images").upload(imagePath,selectedImage,{cacheControl:"3600",upsert:false,contentType:selectedImage.type});
   if(uploadError)throw new Error("Envoi de la photo impossible : "+uploadError.message);
   payload.image_url=supabase.storage.from("product-images").getPublicUrl(imagePath).data.publicUrl;
  }
  const result=id
   ? await supabase.from("products").update(payload).eq("id",id).select("id").single()
   : await supabase.from("products").insert(payload).select("id").single();
  if(result.error)throw result.error;
  if(!result.data?.id)throw new Error("Supabase n’a confirmé aucun enregistrement.");
  productsMessage.textContent=id?"Produit modifié et enregistré avec succès.":"Nouveau produit ajouté et enregistré dans le catalogue.";
  resetProductForm();
  await loadProducts();
 }catch(error){
  productsMessage.textContent="Enregistrement impossible : "+(error?.message||"erreur inconnue")+". Vérifiez votre connexion et vos droits administrateur.";
 }finally{
  savingProduct=false;button.disabled=false;
 }
});

async function loadProducts(){
 if(loadingProducts)return;
 loadingProducts=true;
 productsMessage.textContent="Chargement du catalogue…";
 productsList.replaceChildren();
 try{
  const {data,error}=await supabase.from("products").select("id,name,description,price,image_url,stock,active").order("name");
  if(error)throw error;
  productsMessage.textContent=(data||[]).length+" produit(s) enregistré(s).";
  for(const product of(data||[])){
   const row=el("div",undefined,"product-row");
   const image=el("img");image.src=product.image_url||"assets/wave-boutique.webp";image.alt="";
   const info=el("div",undefined,"product-row-info");
   info.append(el("strong",product.name));
   info.append(el("small",money(product.price)+" · Stock : "+product.stock+" · "+(product.active?"Visible":"Masqué")));
   const actions=el("div",undefined,"product-row-actions");
   const edit=el("button","Modifier","btn btn-dark");edit.type="button";
   edit.addEventListener("click",async()=>{
    edit.disabled=true;
    productsMessage.textContent="Vérification des informations actuelles de "+product.name+"…";
    try{
     const {data:current,error:currentError}=await supabase.from("products")
      .select("id,name,description,price,image_url,stock,active").eq("id",product.id).single();
     if(currentError)throw currentError;
     $("productId").value=current.id;
     $("productName").value=current.name;
     $("productDescription").value=current.description||"";
     $("productPrice").value=String(Number(current.price));
     $("productStock").value=String(current.stock);
     $("productImage").value=current.image_url||"";
     $("productImageFile").value="";
     setImagePreview(current.image_url||"");
     $("productActive").checked=Boolean(current.active);
     $("saveProduct").textContent="Enregistrer les modifications";
     $("cancelProductEdit").hidden=false;
     productsMessage.textContent="Fiche chargée depuis Supabase. Prix actuel : "+money(current.price)+". Vérifiez avant d’enregistrer.";
     productForm.scrollIntoView({behavior:"smooth",block:"start"});
    }catch(error){
     productsMessage.textContent="Impossible de vérifier la fiche : "+error.message;
    }finally{edit.disabled=false;}
   });
   const toggle=el("button",product.active?"Masquer":"Réactiver","btn btn-gold");toggle.type="button";
   toggle.addEventListener("click",async()=>{
    toggle.disabled=true;
    try{
     const {data,error:updateError}=await supabase.from("products").update({active:!product.active}).eq("id",product.id).select("id").single();
     if(updateError)throw updateError;
     if(!data?.id)throw new Error("Aucune modification confirmée par Supabase.");
     productsMessage.textContent=product.name+(product.active?" masqué.":" réactivé.");
     await loadProducts();
    }catch(error){productsMessage.textContent="Modification impossible : "+error.message;toggle.disabled=false;}
   });
   const remove=el("button","Supprimer","btn btn-dark");remove.type="button";
   remove.addEventListener("click",async()=>{
    if(!window.confirm("Supprimer définitivement « "+product.name+" » ? Cette action est irréversible. Un produit lié à une commande sera protégé."))return;
    remove.disabled=true;productsMessage.textContent="Vérification de l’historique des commandes…";
    try{
     const {count,error:countError}=await supabase.from("order_items").select("id",{count:"exact",head:true}).eq("product_id",product.id);
     if(countError)throw countError;
     if((count||0)>0){
      productsMessage.textContent="Suppression refusée : ce produit figure dans "+count+" ligne(s) de commande. Utilisez « Masquer » pour le retirer de la boutique sans perdre l’historique.";
      remove.disabled=false;return;
     }
     const {data,error:deleteError}=await supabase.from("products").delete().eq("id",product.id).select("id").single();
     if(deleteError)throw deleteError;
     if(!data?.id)throw new Error("Supabase n’a confirmé aucune suppression.");
     if($("productId").value===product.id)resetProductForm();
     productsMessage.textContent="Produit supprimé définitivement.";
     await loadProducts();
    }catch(error){
     productsMessage.textContent="Suppression impossible : "+(error?.message||"erreur inconnue");
     remove.disabled=false;
    }
   });
   actions.append(edit,toggle,remove);row.append(image,info,actions);productsList.append(row);
  }
 }catch(error){
  productsMessage.textContent="Impossible de charger les produits : "+error.message;
 }finally{
  loadingProducts=false;
 }
}

function updateOrderStats(){
 const realOrders=ordersCache.filter(order=>!order.is_test);
 setStat("statTotal",String(realOrders.length));
 setStat("statPending",String(realOrders.filter(o=>o.status==="pending").length));
 setStat("statActive",String(realOrders.filter(o=>["confirmed","preparing","shipped"].includes(o.status)).length));
 setStat("statDelivered",String(realOrders.filter(o=>o.status==="delivered").length));
 setStat("statRevenue",money(realOrders.reduce((sum,o)=>sum+Number(o.total||0),0)));
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
  const haystack=[order.order_number,customer.name,customer.phone,order.payment_reference].join(" ").toLocaleLowerCase("fr");
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
  const isAirtel = order.payment_method === "airtel_money";
  const isTest = Boolean(order.is_test);
  card.append(el("p", "Paiement : " + (isAirtel ? "Airtel Money — +261 33 82 03 366" : "Paiement à la livraison") + " · " + (paymentStatusLabels[order.payment_status] || order.payment_status)));
  if (isTest) {
   const testWarning=el("p","MODE TEST — aucun transfert effectué, aucun paiement reçu. Ne pas marquer cette commande comme payée.");
   testWarning.style.fontWeight="700";
   card.append(testWarning);
  }
  if (isAirtel && !isTest && order.payment_reference) {
   const referenceLine=el("p","Référence Airtel Money : "+order.payment_reference);
   referenceLine.style.fontWeight="700";
   card.append(referenceLine);
  }
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
  if (isAirtel) {
   const paymentSelect=document.createElement("select");
   paymentSelect.setAttribute("aria-label","Vérification du paiement "+order.order_number);
   for(const key of ["pending_verification","paid","unpaid","refunded"]){
    const option=el("option",paymentStatusLabels[key]);option.value=key;option.selected=key===order.payment_status;
    if(isTest && key==="paid")option.disabled=true;
    paymentSelect.append(option);
   }
   if(isTest)paymentSelect.disabled=true;
   paymentSelect.addEventListener("change",async()=>{
    const previous=order.payment_status;
    paymentSelect.disabled=true;
    const {error:paymentError}=await supabase.from("orders").update({payment_status:paymentSelect.value}).eq("id",order.id);
    if(paymentError){ordersMessage.textContent="Mise à jour du paiement impossible : "+paymentError.message;paymentSelect.value=previous;}
    else{order.payment_status=paymentSelect.value;ordersMessage.textContent=paymentSelect.value==="paid"?"Paiement marqué comme vérifié et reçu pour "+order.order_number+".":"Statut du paiement mis à jour pour "+order.order_number+".";renderOrders();}
    paymentSelect.disabled=false;
   });
   actions.append(paymentSelect);
  }
  const phone=waNumber(customer.phone);
  if(phone){
   const message = isAirtel
    ? (isTest
      ? "Bonjour " + (customer.name || "") + ", votre commande " + order.order_number + " chez Wave Skincare a été créée en MODE TEST. Aucun transfert Airtel Money n'a été effectué et aucun paiement n'est dû au titre de ce test."
      : "Bonjour " + (customer.name || "") + ", nous vous contactons au sujet de votre commande " + order.order_number + " chez Wave Skincare. Votre transfert Airtel Money (référence " + (order.payment_reference || "non renseignée") + ") est en cours de vérification. Nous vous confirmerons dès que la réception sera contrôlée.")
    : "Bonjour " + (customer.name || "") + ", nous vous contactons au sujet de votre commande " + order.order_number + " chez Wave Skincare. Montant à régler à la livraison : " + money(order.total) + ". Merci de confirmer votre disponibilité.";
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
  // Charger les commandes et leurs lignes séparément pour éviter qu'une
  // relation imbriquée PostgREST bloque toute la liste.
  const {data,error}=await supabase.from("orders")
   .select("id,order_number,status,payment_method,payment_status,payment_reference,is_test,total,delivery_address,created_at")
   .order("created_at",{ascending:false}).limit(50);
  if(error)throw error;
  const fresh=data||[];
  const orderIds=fresh.map(order=>order.id);
  if(orderIds.length){
   const {data:lines,error:linesError}=await supabase.from("order_items")
    .select("order_id,product_name,quantity,unit_price")
    .in("order_id",orderIds);
   if(linesError)throw linesError;
   const grouped=new Map();
   for(const line of(lines||[])){
    if(!grouped.has(line.order_id))grouped.set(line.order_id,[]);
    grouped.get(line.order_id).push(line);
   }
   for(const order of fresh)order.order_items=grouped.get(order.id)||[];
  }else{
   for(const order of fresh)order.order_items=[];
  }
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
supabase.auth.onAuthStateChange(()=>{setTimeout(()=>verify(),0);});verify();
