# Administration Firestore

`/admin` utilise Google Sign-In puis `/api/admin/leads` avec un jeton Firebase ID.
Le serveur vérifie le jeton (y compris sa révocation), l’adresse e-mail vérifiée et
sa présence exacte dans `ADMIN_EMAILS`. Une variable absente refuse tout accès.
La session de la console Firebase ne remplace pas la connexion à l’application.

Sur App Hosting, les identifiants par défaut (ADC) du serveur accèdent à Firestore.
Le compte de service doit pouvoir lire et écrire Firestore et gérer les utilisateurs
Firebase Auth (création des comptes partenaires).
Ne jamais ouvrir la lecture publique de `leads` pour contourner une erreur d’accès.
Les réponses contenant les prospects sont privées et ne sont pas mises en cache.

Google doit être activé dans Firebase Authentication et le domaine exact du site
doit figurer dans Authentication → Paramètres → Domaines autorisés.
`ADMIN_EMAILS` est une variable serveur, sans préfixe `NEXT_PUBLIC_`.

Le tableau affiche les demandes et partenaires Firestore. La valeur commerciale
est indicative (25 €/déménagement, 40 €/rénovation), pas une comptabilité Stripe.
Dans « Partenaires Firebase », créer un profil avec une adresse réelle, le métier,
les départements couverts et les crédits initiaux offerts (0 par défaut). L'identifiant
du document partenaire est l'UID Firebase Auth. Un compte existant est réutilisé ;
une répétition ne modifie pas son profil et ne lui accorde pas de crédits supplémentaires.
Chaque compte correspond à un seul profil/métier. Aucun e-mail n'est envoyé à la création.
Pour la première connexion : `/partenaire/login`, Google avec l'adresse exacte ou
« Première connexion / mot de passe oublié » pour recevoir un lien Firebase.

L'admin choisit un partenaire éligible sur chaque demande puis « Attribuer · 1 crédit ».
La transaction vérifie le métier, le département, l'activité et le solde, limite à
deux partenaires et crée un audit `debit_lead`. Les reprises et doubles clics sont
sans double débit. Les règles interdisent toute modification client des crédits.
L'attribution manuelle n'envoie pas de notification (prestataires encore désactivés).
L'espace partenaire reçoit automatiquement les mises à jour des leads et crédits.
Le délai de contestation commence à la date propre à chaque attribution ; les
anciennes attributions utilisent `assignedAt` comme auparavant.

Le mode local sans connexion est disponible uniquement avec `NODE_ENV=development`
et sans configuration Firebase valide. Pour utiliser Firestore en local, configurer
`ADMIN_EMAILS` et les identifiants serveur ADC ou un compte de service hors Git.

Vérification de l’autorisation et du refus des appels anonymes : `npm run test:admin`.
Tests de concurrence : lancer l'émulateur Firestore sur `127.0.0.1:8085` avec le
projet `demo-leads-engine`, puis `npm run test:assignment`. Ces tests n'utilisent
jamais la base de production. `node scripts/firestore-leads.test.mjs` vérifie les
lectures privées et la protection des crédits dans le même émulateur.
