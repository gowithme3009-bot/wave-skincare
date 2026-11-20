import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const supabase = createClient(window.WAVE_SUPABASE_URL, window.WAVE_SUPABASE_PUBLISHABLE_KEY);
const $ = id => document.getElementById(id);
const message = (s) => { $("authMessage").textContent = s; };
const credentials = () => ({ email: $("email").value.trim(), password: $("password").value });
async function refreshSession(){
  const {data,error}=await supabase.auth.getSession();
  if(error){message("Erreur de session : "+error.message);return;}
  if(data.session){
    $("logoutBtn").hidden=false;
    $("email").value=data.session.user.email||"";
    message("Connecté : "+(data.session.user.email||"")+". Vérification de votre profil…");
    const {data:profile,error:pErr}=await supabase.from("profiles").select("role, full_name").eq("id",data.session.user.id).maybeSingle();
    if(pErr){message("Connecté, mais lecture du profil impossible : "+pErr.message+". Vérifiez les règles RLS de profiles.");return;}
    message("Connecté en tant que "+(profile?.full_name||data.session.user.email)+". Rôle : "+(profile?.role||"customer")+".");
    if(profile?.role==="admin"){
      const link=document.createElement("a");link.href="admin.html";link.className="btn btn-gold";link.textContent="Ouvrir l’administration";
      $("authMessage").append(document.createTextNode(" "),link);
    }
  } else { $("logoutBtn").hidden=true; message("Vous n’êtes pas connecté. Vous pouvez créer un compte ou vous connecter."); }
}
$("loginBtn").addEventListener("click",async()=>{
 const c=credentials(); if(!c.email||!c.password){message("Saisissez votre e-mail et votre mot de passe.");return;}
 message("Connexion en cours…"); const {data,error}=await supabase.auth.signInWithPassword(c);
 if(error){message("Connexion impossible : "+error.message+(error.code?" ( "+error.code+" )":""));return;}
 if(!data?.session){message("La connexion n’a pas créé de session. Vérifiez que le compte existe et que l’adresse e-mail est confirmée.");return;}
 message("Connexion réussie. Chargement de votre espace…"); await refreshSession();
});
$("signupBtn").addEventListener("click",async()=>{
 const c=credentials(); if(!c.email||!c.password){message("Saisissez votre e-mail et un mot de passe d’au moins 6 caractères.");return;}
 message("Création du compte…"); const {data,error}=await supabase.auth.signUp(c);
 if(error){message("Inscription impossible : "+error.message);return;}
 message(data.session?"Compte créé et connecté.":"Compte créé. Vérifiez votre boîte e-mail si la confirmation est activée, puis connectez-vous.");
 await refreshSession();
});
$("logoutBtn").addEventListener("click",async()=>{const {error}=await supabase.auth.signOut();message(error?"Déconnexion impossible : "+error.message:"Vous êtes déconnecté.");await refreshSession();});
supabase.auth.onAuthStateChange((event)=>{ window.setTimeout(()=>{ if(event==="SIGNED_OUT"||event==="SIGNED_IN"||event==="INITIAL_SESSION"||event==="TOKEN_REFRESHED") refreshSession(); },0); });
refreshSession();
