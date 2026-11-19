import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const supabase=createClient(window.WAVE_SUPABASE_URL,window.WAVE_SUPABASE_PUBLISHABLE_KEY);
const status=document.getElementById("adminStatus"), logout=document.getElementById("adminLogout");
async function verify(){
 const {data:{session},error}=await supabase.auth.getSession();
 if(error){status.textContent="Erreur : "+error.message;return;}
 if(!session){status.textContent="Accès refusé : connectez-vous avec le compte administrateur.";return;}
 const {data:profile,error:pErr}=await supabase.from("profiles").select("role").eq("id",session.user.id).maybeSingle();
 if(pErr){status.textContent="Impossible de vérifier le rôle : "+pErr.message;return;}
 if(profile?.role!=="admin"){status.textContent="Accès refusé. Ce compte n’a pas le rôle admin.";return;}
 status.textContent="Accès autorisé. Compte : "+session.user.email+" — rôle : admin.";
 logout.hidden=false;
}
logout.addEventListener("click",async()=>{await supabase.auth.signOut();location.href="compte.html";});
supabase.auth.onAuthStateChange(()=>verify());verify();
