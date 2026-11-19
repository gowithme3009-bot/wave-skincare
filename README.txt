WAVE SKINCARE — SITE E-COMMERCE (VERSION DE DÉPART)
====================================================

CONTENU
- index.html       : accueil
- boutique.html    : catalogue et recherche
- apropos.html     : présentation de la marque
- contact.html     : formulaire de contact (ouvre l'application e-mail)
- commande.html    : récapitulatif du panier et demande de commande
- styles.css       : design responsive crème / or pêche
- products.js      : catalogue modifiable
- app.js           : panier, recherche, menu mobile
- contact.js       : préparation d'un e-mail
- checkout.js      : préparation d'une demande de commande
- assets/          : visuels créés pour l'identité Wave

OUVRIR LE SITE
Ouvrez index.html dans un navigateur. Pour un déploiement, importez le dossier
dans un dépôt GitHub puis créez un projet Cloudflare Pages avec :
- Framework preset : None
- Build command : (laisser vide)
- Build output directory : /
Le dépôt doit contenir directement index.html à sa racine.

PERSONNALISER AVANT VENTE
1. Ouvrez products.js et remplacez les produits, prix indicatifs, tailles et images.
2. Les prix actuels sont des exemples en ariary (Ar), uniquement pour tester le panier.
3. Ajoutez les coordonnées réelles, l'adresse e-mail, le téléphone, les frais et zones
   de livraison, les conditions de retour et la politique de confidentialité.
4. Vérifiez les formulations, ingrédients, preuves, conformité et étiquetage des
   produits cosmétiques. Les ingrédients et bénéfices de la maquette ne sont pas
   des validations dermatologiques ou des certifications.
5. Les formulaires ouvrent un e-mail prérempli ; ils ne sauvegardent pas les commandes
   sur un serveur et n'envoient pas automatiquement de notification.
6. Aucun paiement en ligne n'est intégré. Pour recevoir et gérer les commandes,
   il faudra connecter un backend ou un service de commande, puis un prestataire
   de paiement réellement disponible dans votre pays.

IMAGES
Les visuels sont des concepts graphiques générés pour la marque Wave. Ils servent
à illustrer le site et ne constituent pas des photos certifiées des produits réels.

Le site utilise Google Fonts si la connexion Internet est disponible ; sinon,
les polices système prennent le relais.

CONNEXION SUPABASE (VERSION DE BASE AJOUTÉE)
- supabase-config.js contient l'URL du projet et la clé Publishable (publique).
- compte.html / auth.js : inscription, connexion et déconnexion Supabase Auth.
- admin.html / admin.js : vérification du rôle admin depuis public.profiles.
- La clé Publishable est prévue pour le navigateur. Ne jamais ajouter de clé sb_secret_
  ou service_role dans un fichier public ou dans GitHub.
- Le compte doit exister dans Authentication et avoir role='admin' dans public.profiles.
- La gestion des produits et l'enregistrement des commandes ne sont pas encore activés :
  il faut confirmer les colonnes réelles et préparer une procédure serveur sécurisée
  pour calculer les prix et créer les commandes sans faire confiance au navigateur.
- La confirmation e-mail peut être activée dans Supabase Authentication > Providers > Email.
