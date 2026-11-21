import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const supabase = createClient(window.WAVE_SUPABASE_URL, window.WAVE_SUPABASE_PUBLISHABLE_KEY);
const $ = id => document.getElementById(id);
const message = (s) => { $("authMessage").textContent = s; };
const credentials = () => ({ email: $("email").value.trim(), password: $("password").value });

const orderLabels = {pending:"À confirmer",confirmed:"Confirmée",preparing:"En préparation",shipped:"En livraison",delivered:"Livrée",cancelled:"Annulée"};
let currentCustomerId = null;
let customerOrdersLoading = false;
const money = value => new Intl.NumberFormat("fr-FR").format(Number(value || 0)) + " Ar";
function orderNode(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
async function loadCustomerOrders(){
  const section=$("customerOrdersSection"), target=$("customerOrders");
  if(!section||!target||!currentCustomerId||customerOrdersLoading)return;
  customerOrdersLoading=true;section.hidden=false;target.replaceChildren(orderNode("p","Chargement de vos commandes…","muted"));
  try{
    const {data:orders,error}=await supabase.from("orders")
      .select("id,order_number,status,payment_method,payment_status,total,created_at")
      .eq("user_id",currentCustomerId).order("created_at",{ascending:false}).limit(20);
    if(error)throw error;
    if(!orders?.length){target.replaceChildren(orderNode("p","Vous n’avez pas encore de commande associée à ce compte. Vos prochaines commandes passées après connexion apparaîtront ici.","muted"));return;}
    const ids=orders.map(order=>order.id);
    const {data:lines,error:linesError}=await supabase.from("order_items")
      .select("order_id,product_name,quantity,unit_price").in("order_id",ids);
    if(linesError)throw linesError;
    const grouped=new Map();
    for(const line of(lines||[])){if(!grouped.has(line.order_id))grouped.set(line.order_id,[]);grouped.get(line.order_id).push(line);}
    target.replaceChildren();
    for(const order of orders){
      const card=orderNode("article",undefined,"customer-order");
      const head=orderNode("div",undefined,"customer-order-head");
      head.append(orderNode("strong",order.order_number),orderNode("span",orderLabels[order.status]||"Statut en cours"));
      card.append(head,orderNode("small",new Date(order.created_at).toLocaleString("fr-FR")));
      const list=orderNode("ul");
      for(const line of(grouped.get(order.id)||[]))list.append(orderNode("li",line.quantity+" × "+line.product_name+" — "+money(line.unit_price)+" / unité"));
      card.append(list,orderNode("p","Total : "+money(order.total),"customer-order-total"));
      card.append(orderNode("p","Paiement à la livraison · "+(order.payment_status==="paid"?"Payé":"Non payé"),"muted"));
      target.append(card);
    }
  }catch(error){target.replaceChildren(orderNode("p","Impossible de charger vos commandes : "+(error?.message||"erreur inconnue"),"muted"));}
  finally{customerOrdersLoading=false;}
}
$("refreshCustomerOrders")?.addEventListener("click",loadCustomerOrders);

let resetMode = new URLSearchParams(location.search).get("mode") === "reset";
let sessionPasswordMode = false;
function setBusy(busy, label){
  ["loginBtn","signupBtn","forgotPasswordBtn","updatePasswordBtn","changePasswordBtn","logoutBtn"].forEach(id=>{const el=$(id);if(el)el.disabled=busy;});
  if(busy && label) message(label);
}
function showAccountSessionMode(){
  sessionPasswordMode=false;
  $("accountTitle").textContent="Mon espace Wave";
  $("accountIntro").textContent="Votre espace personnel est prêt. Retrouvez vos commandes et gérez votre compte.";
  $("email").closest("label").hidden=true;
  $("passwordLabel").hidden=true; $("confirmLabel").hidden=true; $("passwordConfirm").hidden=true;
  $("loginBtn").hidden=true; $("signupBtn").hidden=true; $("forgotPasswordBtn").hidden=true;
  $("updatePasswordBtn").hidden=true; $("changePasswordBtn").hidden=false;
}
function showSessionPasswordMode(){
  sessionPasswordMode=true;
  $("accountTitle").textContent="Sécurisez votre compte";
  $("accountIntro").textContent="Choisissez un nouveau mot de passe pour votre compte Wave.";
  $("email").closest("label").hidden=true;
  $("passwordLabel").hidden=false;
  $("passwordLabelText").textContent="Nouveau mot de passe";
  $("password").value=""; $("password").autocomplete="new-password"; $("password").placeholder="8 caractères minimum"; $("password").minLength=8;
  $("confirmLabel").hidden=false; $("passwordConfirm").hidden=false;
  $("loginBtn").hidden=true; $("signupBtn").hidden=true; $("forgotPasswordBtn").hidden=true;
  $("changePasswordBtn").hidden=true; $("updatePasswordBtn").hidden=false;
  message("Vous pouvez maintenant modifier votre mot de passe.");
}
function showResetMode(){
  resetMode=true;
  $("accountTitle").textContent="Choisissez un nouveau mot de passe";
  $("accountIntro").textContent="Créez un mot de passe personnel d’au moins 8 caractères.";
  $("passwordLabelText").textContent="Nouveau mot de passe";
  $("password").value=""; $("password").autocomplete="new-password"; $("password").placeholder="8 caractères minimum"; $("password").minLength=8;
  $("confirmLabel").hidden=false; $("passwordConfirm").hidden=false;
  $("loginBtn").hidden=true; $("signupBtn").hidden=true; $("forgotPasswordBtn").hidden=true; $("updatePasswordBtn").hidden=false;
  message("Lien de réinitialisation reconnu. Choisissez votre nouveau mot de passe.");
}
async function refreshSession(){
  const {data,error}=await supabase.auth.getSession();
  if(error){message("Erreur de session : "+error.message);return;}
  if(resetMode)return;
  if(data.session){
    if(sessionPasswordMode) showSessionPasswordMode(); else showAccountSessionMode();
    $("logoutBtn").hidden=false;
    $("email").value=data.session.user.email||"";
    message("Connecté : "+(data.session.user.email||"")+". Vérification de votre profil…");
    const {data:profile,error:pErr}=await supabase.from("profiles").select("role, full_name").eq("id",data.session.user.id).maybeSingle();
    if(pErr){message("Connecté, mais lecture du profil impossible : "+pErr.message+".");return;}
    message("Connecté en tant que "+(profile?.full_name||data.session.user.email)+". Rôle : "+(profile?.role||"customer")+".");
    if(profile?.role==="customer"){
      currentCustomerId=data.session.user.id;await loadCustomerOrders();
      if(new URLSearchParams(location.search).get("view")==="orders") $("customerOrdersSection").scrollIntoView({behavior:"smooth",block:"start"});
    }else{currentCustomerId=null;$("customerOrdersSection").hidden=true;}
    if(profile?.role==="admin"){
      const link=document.createElement("a");link.href="admin.html";link.className="btn btn-gold";link.textContent="Ouvrir l’administration";
      $("authMessage").append(document.createTextNode(" "),link);
    }
  } else {
    currentCustomerId=null;$("customerOrdersSection").hidden=true;$("logoutBtn").hidden=true;
    $("email").closest("label").hidden=false;$("passwordLabel").hidden=false;$("confirmLabel").hidden=true;$("passwordConfirm").hidden=true;
    $("loginBtn").hidden=false;$("signupBtn").hidden=false;$("forgotPasswordBtn").hidden=false;$("updatePasswordBtn").hidden=true;$("changePasswordBtn").hidden=true;
    $("accountTitle").textContent="Bienvenue chez Wave.";
    $("accountIntro").textContent="Connectez-vous pour retrouver votre espace client et suivre vos commandes.";
    message("Vous n’êtes pas connecté. Connectez-vous ou créez votre compte.");
  }
}
$("loginBtn").addEventListener("click",async()=>{
 const c=credentials(); if(!c.email||!c.password){message("Saisissez votre adresse e-mail et votre mot de passe.");return;}
 setBusy(true,"Connexion en cours…");
 try{
  const {data,error}=await supabase.auth.signInWithPassword(c);
  if(error){
    message(error.code==="invalid_credentials"?"Adresse e-mail ou mot de passe incorrect. Vérifiez votre saisie ou utilisez « Mot de passe oublié ? ».":"Connexion impossible : "+error.message);
    return;
  }
  if(!data?.session){message("Aucune session reçue. Réessayez.");return;}
  message("Connexion réussie. Chargement de votre espace…"); await refreshSession();
 }catch(e){message("Erreur réseau pendant la connexion. Vérifiez Internet puis réessayez.");}
 finally{setBusy(false);}
});
$("signupBtn").addEventListener("click",async()=>{
 const c=credentials(); if(!c.email||!c.password){message("Saisissez votre adresse e-mail et un mot de passe.");return;}
 if(c.password.length<8){message("Choisissez un mot de passe d’au moins 8 caractères.");return;}
 setBusy(true,"Création du compte…");
 try{
  const {data,error}=await supabase.auth.signUp(c);
  if(error){message("Inscription impossible : "+error.message);return;}
  if(data.session){
    message("Compte créé. Ouverture de la boutique…");
    location.replace("boutique.html?welcome=1");
    return;
  }
  message("Compte créé. Consultez votre boîte e-mail pour confirmer l’adresse, puis connectez-vous.");
  await refreshSession();
 }catch(e){message("Erreur réseau pendant la création du compte.");}
 finally{setBusy(false);}
});
$("forgotPasswordBtn").addEventListener("click",async()=>{
 const email=$("email").value.trim();
 if(!email){message("Saisissez votre adresse e-mail, puis appuyez sur « Mot de passe oublié ? ».");$("email").focus();return;}
 setBusy(true,"Envoi de l’e-mail de réinitialisation…");
 try{
  const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname+"?mode=reset"});
  message(error?"Envoi impossible : "+error.message:"Si cette adresse correspond à un compte, un e-mail de réinitialisation vient d’être envoyé. Vérifiez aussi les courriers indésirables.");
 }catch(e){message("Erreur réseau. Impossible d’envoyer l’e-mail pour le moment.");}
 finally{setBusy(false);}
});
$("changePasswordBtn").addEventListener("click",()=>showSessionPasswordMode());
$("updatePasswordBtn").addEventListener("click",async()=>{
 const password=$("password").value, confirm=$("passwordConfirm").value;
 if(password.length<8){message("Le nouveau mot de passe doit contenir au moins 8 caractères.");return;}
 if(password!==confirm){message("Les deux mots de passe ne correspondent pas.");return;}
 setBusy(true,"Mise à jour du mot de passe…");
 try{
  const {error}=await supabase.auth.updateUser({password});
  if(error){message("Mise à jour impossible : "+error.message);return;}
  if(sessionPasswordMode){
    $("password").value=""; $("passwordConfirm").value="";
    $("accountTitle").textContent="Mot de passe modifié";
    $("accountIntro").textContent="Votre nouveau mot de passe est enregistré. Votre session reste active.";
    sessionPasswordMode=false;
    await refreshSession();
    message("Mot de passe mis à jour avec succès. Votre session reste active.");
  } else {
    history.replaceState({},document.title,location.pathname);
    resetMode=false;
    $("confirmLabel").hidden=true;$("passwordConfirm").hidden=true;$("updatePasswordBtn").hidden=true;
    $("loginBtn").hidden=false;$("signupBtn").hidden=false;$("forgotPasswordBtn").hidden=false;
    $("passwordLabelText").textContent="Mot de passe";$("password").value="";$("password").minLength=6;$("password").autocomplete="current-password";
    $("accountTitle").textContent="Mot de passe modifié";
    $("accountIntro").textContent="Votre nouveau mot de passe est enregistré. Vous pouvez maintenant vous connecter.";
    message("Mot de passe mis à jour avec succès. Connectez-vous avec votre nouveau mot de passe.");
  }
 }catch(e){message("Erreur réseau pendant la mise à jour.");}
 finally{setBusy(false);}
});
$("logoutBtn").addEventListener("click",async()=>{const {error}=await supabase.auth.signOut();message(error?"Déconnexion impossible : "+error.message:"Vous êtes déconnecté.");await refreshSession();});
supabase.auth.onAuthStateChange((event)=>{
 if(event==="PASSWORD_RECOVERY"){showResetMode();return;}
 if(["SIGNED_OUT","SIGNED_IN","INITIAL_SESSION","TOKEN_REFRESHED"].includes(event)) window.setTimeout(()=>refreshSession(),0);
});
if(resetMode) showResetMode();
refreshSession();
