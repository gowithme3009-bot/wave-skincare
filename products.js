/* Catalogue local de secours + synchronisation du catalogue Supabase. */
window.WAVE_PRODUCTS = [
 {id:"serum",name:"Sérum Illuminateur",tag:"LE PRODUIT SIGNATURE",desc:"Un soin sérum au cœur de l'univers Wave.",size:"30 ml",price:89000,image:"assets/wave-serum-packaging.webp",category:"Visage"},
 {id:"creme",name:"Crème Éclat Jeunesse",tag:"SOIN VISAGE",desc:"Une crème pour compléter votre rituel quotidien.",size:"50 g",price:75000,image:"assets/wave-brand-board.webp",category:"Visage"},
 {id:"lait",name:"Lait Corps Nourrissant",tag:"SOIN CORPS",desc:"Un geste de douceur pour le corps.",size:"200 ml",price:68000,image:"assets/wave-boutique.webp",category:"Corps"},
 {id:"protection",name:"Crème Protectrice SPF 30",tag:"PROTECTION",desc:"Concept de soin protecteur à faire valider.",size:"75 ml",price:72000,image:"assets/wave-homepage-concept.webp",category:"Visage"}
];
window.WAVE_PRODUCTS_READY = (async () => {
 try {
  if (!window.WAVE_SUPABASE_URL || !window.WAVE_SUPABASE_PUBLISHABLE_KEY) return window.WAVE_PRODUCTS;
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const client = createClient(window.WAVE_SUPABASE_URL, window.WAVE_SUPABASE_PUBLISHABLE_KEY);
  const { data, error } = await client.from("products").select("id,name,description,price,image_url,stock,active").eq("active", true).order("created_at", { ascending: true });
  if (error || !data?.length) return window.WAVE_PRODUCTS;
  const fallback = window.WAVE_PRODUCTS;
  window.WAVE_PRODUCTS = data.map((row, index) => {
   const prior = fallback.find(p => p.name.toLocaleLowerCase("fr") === row.name.toLocaleLowerCase("fr")) || fallback[index] || {};
   return { id: prior.id || row.id, dbId: row.id, name: row.name, tag: prior.tag || "SOIN WAVE", desc: row.description || prior.desc || "", size: prior.size || "", price: Number(row.price), image: row.image_url || prior.image || "assets/wave-boutique.webp", category: prior.category || "Soin", stock: row.stock };
  });
 } catch (error) { console.warn("Catalogue Supabase indisponible, catalogue local utilisé.", error); }
 return window.WAVE_PRODUCTS;
})();