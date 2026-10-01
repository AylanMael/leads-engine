# Administration Firestore

`/admin` utilise Google Sign-In puis `/api/admin/leads` avec un jeton Firebase ID.
Le serveur vérifie le jeton (y compris sa révocation), l’adresse e-mail vérifiée et
sa présence exacte dans `ADMIN_EMAILS`. Une variable absente refuse tout accès.
La session de la console Firebase ne remplace pas la connexion à l’application.

Sur App Hosting, les identifiants par défaut (ADC) du serveur accèdent à Firestore.
Le compte de service doit avoir les permissions de lecture Firestore et Firebase Auth.
Ne jamais ouvrir la lecture publique de `leads` pour contourner une erreur d’accès.
Les réponses contenant les prospects sont privées et ne sont pas mises en cache.

Google doit être activé dans Firebase Authentication et le domaine exact du site
doit figurer dans Authentication → Paramètres → Domaines autorisés.
`ADMIN_EMAILS` est une variable serveur, sans préfixe `NEXT_PUBLIC_`.

Le tableau affiche les demandes et partenaires Firestore. La valeur commerciale
est indicative (25 €/déménagement, 40 €/rénovation), pas une comptabilité Stripe.
L’attribution manuelle par fichiers JSON reste réservée au mode démo local ; en
production le tableau présente les attributions Firestore effectuées côté serveur.

Le mode local sans connexion est disponible uniquement avec `NODE_ENV=development`
et sans configuration Firebase valide. Pour utiliser Firestore en local, configurer
`ADMIN_EMAILS` et les identifiants serveur ADC ou un compte de service hors Git.

Vérification de l’autorisation et du refus des appels anonymes : `npm run test:admin`.
