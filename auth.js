import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const supabase = createClient(window.WAVE_SUPABASE_URL, window.WAVE_SUPABASE_PUBLISHABLE_KEY);
const $ = id => document.getElementById(id);
const message = (s) => { $("authMessage").textContent = s; };
const credentials = () => ({ email: $("email").value.trim(), password: $("password").value });
let resetMode = new URLSearchParams(location.search).get("mode") === "reset";
function setBusy(busy, label){
  ["loginBtn","signupBtn","forgotPasswordBtn","updatePasswordBtn","logoutBtn"].forEach(id=>{const el=$(id);if(el)el.disabled=busy;});
  if(busy && label) message(label);
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
    $("logoutBtn").hidden=false;
    $("email").value=data.session.user.email||"";
    message("Connecté : "+(data.session.user.email||"")+". Vérification de votre profil…");
    const {data:profile,error:pErr}=await supabase.from("profiles").select("role, full_name").eq("id",data.session.user.id).maybeSingle();
    if(pErr){message("Connecté, mais lecture du profil impossible : "+pErr.message+".");return;}
    message("Connecté en tant que "+(profile?.full_name||data.session.user.email)+". Rôle : "+(profile?.role||"customer")+".");
    if(profile?.role==="admin"){
      const link=document.createElement("a");link.href="admin.html";link.className="btn btn-gold";link.textContent="Ouvrir l’administration";
      $("authMessage").append(document.createTextNode(" "),link);
    }
  } else { $("logoutBtn").hidden=true; message("Vous n’êtes pas connecté. Connectez-vous ou créez votre compte."); }
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
  message(data.session?"Compte créé et connecté.":"Compte créé. Consultez votre boîte e-mail pour confirmer l’adresse, puis connectez-vous.");
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
$("updatePasswordBtn").addEventListener("click",async()=>{
 const password=$("password").value, confirm=$("passwordConfirm").value;
 if(password.length<8){message("Le nouveau mot de passe doit contenir au moins 8 caractères.");return;}
 if(password!==confirm){message("Les deux mots de passe ne correspondent pas.");return;}
 setBusy(true,"Mise à jour du mot de passe…");
 try{
  const {error}=await supabase.auth.updateUser({password});
  if(error){message("Mise à jour impossible : "+error.message);return;}
  history.replaceState({},document.title,location.pathname);
  resetMode=false;
  $("confirmLabel").hidden=true;$("passwordConfirm").hidden=true;$("updatePasswordBtn").hidden=true;
  $("loginBtn").hidden=false;$("signupBtn").hidden=false;$("forgotPasswordBtn").hidden=false;
  $("passwordLabelText").textContent="Mot de passe";$("password").value="";$("password").minLength=6;$("password").autocomplete="current-password";
  $("accountTitle").textContent="Mot de passe modifié";
  $("accountIntro").textContent="Votre nouveau mot de passe est enregistré. Vous pouvez maintenant vous connecter.";
  message("Mot de passe mis à jour avec succès. Connectez-vous avec votre nouveau mot de passe.");
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
