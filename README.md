# Wave Skincare

Boutique mobile-first de soins, en français, déployée sur Cloudflare Pages et connectée à Supabase.

## Pages
- `index.html` : accueil et sélection mise en avant.
- `boutique.html` : catalogue synchronisé depuis Supabase, recherche et tri.
- `commande.html` : panier, coordonnées de livraison et commande sans création de compte.
- `compte.html` : inscription, connexion, déconnexion et changement de mot de passe lorsqu'une session est active.
- `admin.html` : espace administrateur protégé par Supabase Auth et le rôle `admin`.
- `apropos.html` et `contact.html` : présentation et contact.

## Fonctionnement des commandes
- Paiement à la livraison uniquement ; aucun paiement en ligne n'est activé.
- La fonction SQL `create_guest_cod_order` valide les informations, vérifie le stock, verrouille les lignes produit, calcule les prix depuis la base et enregistre la commande et ses articles dans une transaction.
- Les commandes sont créées au statut `pending` et paiement `unpaid`.
- L'administration affiche les 50 commandes les plus récentes, actualise la liste périodiquement et permet de modifier leur statut.
- L'annulation d'une commande ne restaure pas automatiquement le stock : le stock doit être corrigé manuellement après vérification.
- Les notifications de commande utilisent les notifications du navigateur après autorisation explicite. WhatsApp est seulement préparé ; l'administrateur envoie lui-même le message.

## Catalogue
- Les produits actifs sont chargés depuis `public.products`.
- Un catalogue local de secours permet d'afficher le site si Supabase est momentanément indisponible.
- Les images déjà présentes dans `assets/` sont conservées.
- Les prix, stocks, noms et descriptions doivent être vérifiés avant toute vente réelle.

## Sécurité
- `supabase-config.js` ne contient que l'URL et la clé Publishable du projet.
- Ne jamais placer une clé Supabase Secret ou `service_role`, un mot de passe ou un secret de récupération dans le dépôt, le navigateur ou les journaux.
- Les tables publiques utilisent RLS. Ne pas désactiver RLS ni élargir les politiques sans audit.
- La page d'administration vérifie la session et le rôle dans `public.profiles`. Les autorisations effectives restent appliquées par Supabase.
- Les données saisies par les administrateurs et les produits sont rendus comme du texte ; ne pas réintroduire d'injection HTML directe à partir de données Supabase.
- La fonction de commande invité est volontairement exécutable par `anon` pour permettre le paiement à la livraison sans compte. Elle doit rester strictement validée côté serveur.

## Déploiement
Dépôt GitHub : `gowithme3009-bot/wave-skincare`  
Branche de production : `main`  
Projet Cloudflare Pages : `wave-skincare`  
Site : https://wave-skincare.pages.dev

Le workflow GitHub Actions prépare `dist/` puis déploie sur Cloudflare Pages. Les secrets `CLOUDFLARE_ACCOUNT_ID` et `CLOUDFLARE_API_TOKEN` restent dans les secrets GitHub Actions ; ne jamais les copier dans le code.

## À vérifier avant commercialisation
- Confirmer les produits réels, leurs compositions, étiquetages, photos, prix et stocks.
- Ajouter les coordonnées officielles, les zones et frais de livraison, les conditions de vente, de retour et la politique de confidentialité.
- Tester les parcours sur Android et ordinateur, y compris une commande réelle contrôlée et les alertes de stock.
- Les visuels présents sont des concepts graphiques et ne remplacent pas les photos certifiées des produits réels.
