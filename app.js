(async () => {\n await (window.WAVE_PRODUCTS_READY || Promise.resolve());
 const $ = s => document.querySelector(s);
 const money = n => new Intl.NumberFormat("fr-FR").format(n) + " Ar";
 let cart = JSON.parse(localStorage.getItem("waveCart") || "[]");
 const save = () => { localStorage.setItem("waveCart", JSON.stringify(cart)); updateCart(); };
 const product = id => WAVE_PRODUCTS.find(p => p.id === id);
 const count = () => cart.reduce((a,x)=>a+x.qty,0);
 const total = () => cart.reduce((a,x)=>a+(product(x.id)?.price||0)*x.qty,0);
 function card(p){return `<article class="product-card"><a class="product-image" href="commande.html"><img src="${p.image}" alt="${p.name}"><span>${p.tag}</span></a><div class="product-card-copy"><small>${p.category} · ${p.size}</small><h3>${p.name}</h3><p>${p.desc}</p><div class="product-card-bottom"><b>${money(p.price)}</b><button class="add-button" data-add="${p.id}" aria-label="Ajouter ${p.name} au panier">+ Ajouter</button></div></div></article>`}
 function updateCart(){
   const c=$("#cartCount"); if(c)c.textContent=count();
   const items=$("#cartItems"); if(items){items.innerHTML=cart.length?cart.map(x=>{const p=product(x.id);return p?`<div class="cart-row"><img src="${p.image}" alt=""><div><b>${p.name}</b><small>${money(p.price)}</small><div class="qty"><button data-qty="${p.id}" data-step="-1">−</button><span>${x.qty}</span><button data-qty="${p.id}" data-step="1">+</button><button class="remove" data-remove="${p.id}">Retirer</button></div></div></div>`:""}).join(""):'<p class="empty-cart">Votre panier est encore vide.</p>';}
   const t=$("#cartTotal");if(t)t.textContent=money(total());
 }
 function add(id){const line=cart.find(x=>x.id===id);if(line)line.qty++;else cart.push({id,qty:1});save();toast("Produit ajouté au panier.");}
 function toast(msg){const el=$("#toast");if(!el)return;el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2300);}
 function drawer(open){$("#cartDrawer")?.classList.toggle("open",open);$("#cartBackdrop")?.classList.toggle("show",open);$("#cartDrawer")?.setAttribute("aria-hidden",String(!open));}
 document.addEventListener("click",e=>{
   const addBtn=e.target.closest("[data-add]");if(addBtn)add(addBtn.dataset.add);
   const qty=e.target.closest("[data-qty]");if(qty){const line=cart.find(x=>x.id===qty.dataset.qty);if(line){line.qty+=Number(qty.dataset.step);if(line.qty<=0)cart=cart.filter(x=>x.id!==line.id);save();}}
   const rem=e.target.closest("[data-remove]");if(rem){cart=cart.filter(x=>x.id!==rem.dataset.remove);save();}
 });
 $("#cartToggle")?.addEventListener("click",()=>drawer(true));$("#cartClose")?.addEventListener("click",()=>drawer(false));$("#cartBackdrop")?.addEventListener("click",()=>drawer(false));
 $("#menuToggle")?.addEventListener("click",()=>$("#mainNav")?.classList.toggle("show"));
 $("#searchToggle")?.addEventListener("click",()=>$("#searchPanel")?.classList.toggle("show"));
 $("#searchSubmit")?.addEventListener("click",()=>{const q=$("#searchInput")?.value.trim();if(q)location.href="boutique.html?q="+encodeURIComponent(q);});
 const featured=$("#featuredProducts");if(featured)featured.innerHTML=WAVE_PRODUCTS.slice(0,3).map(card).join("");
 const all=$("#allProducts");if(all){let list=[...WAVE_PRODUCTS];const params=new URLSearchParams(location.search);const q=(params.get("q")||"").toLowerCase();if(q)list=list.filter(p=>(p.name+" "+p.desc+" "+p.category).toLowerCase().includes(q));const sort=$("#sortProducts");const render=()=>{const mode=sort?.value;if(mode==="price-asc")list.sort((a,b)=>a.price-b.price);if(mode==="price-desc")list.sort((a,b)=>b.price-a.price);all.innerHTML=list.length?list.map(card).join():'<p>Aucun produit ne correspond à votre recherche.</p>';$("#resultCount").textContent=list.length+" produit(s)";};sort?.addEventListener("change",render);render();}
 $("#year")&&($("#year").textContent=new Date().getFullYear());
 updateCart();
 window.WaveStore={cart:()=>cart,product,money,total,save,toast};
})();