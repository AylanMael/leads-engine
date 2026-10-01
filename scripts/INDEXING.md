# Soumission des pages locales

Node.js 22, dépendances installées par `npm ci`. Le script se lance manuellement ou
depuis un job après déploiement ; il n'est pas exécuté pendant `next build`.

## Entrée et préparation

Créer un fichier `urls.json` contenant les URLs **publiées et canoniques** d'un seul
vertical et d'une seule origine HTTPS, par exemple :

```json
[
  "https://demenagement-local.fr/demenagement/versailles-78000",
  "https://demenagement-local.fr/demenagement/sartrouville-78500"
]
```

```sh
node scripts/submit-indexing.mjs urls.json --vertical demenagement --prepare
```

Cette commande n'effectue aucun appel réseau. Elle génère une clé aléatoire stable
par origine (32 caractères hexadécimaux), `public/<clé>.txt` et
`public/sitemap-priority-demenagement.xml`. Le fichier local `.indexnow-key.json`
conserve les clés entre exécutions et est ignoré par Git. `INDEXNOW_KEY` permet de
fournir une clé existante, notamment dans un job CI. Sauvegarder cette valeur pour
ne pas changer de clé à chaque exécution sur une machine éphémère.

Déployer les deux fichiers générés, puis lancer avec **la même liste et la même clé** :

```sh
node scripts/submit-indexing.mjs urls.json --vertical demenagement
```

Le script vérifie le contenu exact du fichier de clé sur le site avant d'envoyer
`host`, `key`, `keyLocation`, `urlList` à `https://api.indexnow.org/indexnow`.
Les doublons sont retirés ; chaque lot contient au maximum 10 000 URLs.
Pour `renovation`, utiliser des URLs `/renovation/<slug>` effectivement déployées :
le projet ne possède pas encore de gabarit local rénovation. Le script ne crée pas
les pages et ne vérifie pas leur contenu ou leur indexabilité.

## Google Search Console

L'Indexing API Google est réservée aux pages `JobPosting` ou
`BroadcastEvent` dans un `VideoObject`. Il n'existe pas d'API Search Console de
demande d'indexation individuelle pour nos pages commerciales. Le script soumet
donc le sitemap prioritaire via **Sitemaps.submit**, sans utiliser l'ancien endpoint
de ping ni détourner l'Indexing API.

1. Activer l'API Google Search Console dans le projet Google Cloud.
2. Créer un compte de service, puis ajouter son adresse e-mail à la propriété
   Search Console vérifiée avec les droits permettant la soumission des sitemaps
   (utilisateur complet ou propriétaire).
3. Utiliser son identité via ADC sur Google Cloud ou définir
   `GOOGLE_APPLICATION_CREDENTIALS` vers son fichier JSON situé **hors du dépôt**.
4. Définir éventuellement `GSC_SITE_URL` : `sc-domain:demenagement-local.fr` ou
   `https://demenagement-local.fr/`. Par défaut, le script utilise l'origine suivie de `/`.
5. Déployer le sitemap généré, puis lancer :

```sh
node scripts/submit-indexing.mjs urls.json --vertical demenagement --google
```

L'authentification utilise `google-auth-library` et le scope `webmasters`. Aucun
jeton ni contenu de clé privée n'est écrit dans le rapport. L'option `--google`
active Google en plus d'IndexNow ; sans elle, Google est signalé comme désactivé.
Les variables peuvent être chargées sous Node 22 avec
`node --env-file=.env.local scripts/submit-indexing.mjs ...` ; le script ne charge
pas automatiquement les fichiers `.env`.

## Quotas et rapport

Les appels métier sont séquentiels, espacés de deux secondes, avec un délai réseau
de 15 secondes. Une erreur réseau ou HTTP 5xx autorise deux reprises avec recul
exponentiel. `Retry-After` est respecté ; une attente supérieure à une minute est
reportée à une exécution ultérieure. HTTP 429 arrête les lots restants, avec une
reprise au plus tôt après dix minutes ou le délai supérieur indiqué par le serveur.
Les limites effectives dépendent du moteur/projet : cette cadence ne remplace pas
la consultation des quotas dans leurs consoles.

`indexing-report.json` conserve l'historique : URL, vertical, moteur, étape, date UTC,
statut HTTP, tentative, résultat et date de reprise éventuelle. Les écritures sont
atomiques et un verrou empêche deux scripts locaux concurrents. Conserver le rapport
entre exécutions CI ; il évite les soumissions répétées pendant dix minutes et
mémorise les quotas. Un verrou restant après arrêt brutal peut être supprimé après
vérification qu'aucun script n'est actif. Plusieurs machines doivent être sérialisées
par le système CI et partager ce rapport.

HTTP 200/202 IndexNow signifie réception (202 : clé en cours de validation).
Pour Google, le statut HTTP est celui de la soumission du **sitemap entier**, recopié
sur chaque URL incluse ; ce n'est pas une réponse d'indexation de cette URL.
`httpStatus: null` signifie qu'aucune réponse HTTP de soumission n'a été reçue
(préparation, étape bloquée, désactivation, délai ou erreur réseau). Une erreur
de soumission donne un code de sortie 1 ; une préparation ou un report par cooldown
donne 0. Aucune soumission ne garantit l'exploration ou l'indexation.

Tests hors réseau : `node scripts/submit-indexing.test.mjs`.

Références : [IndexNow](https://www.indexnow.org/documentation),
[Search Console Sitemaps.submit](https://developers.google.com/webmaster-tools/v1/sitemaps/submit),
[éligibilité de l'Indexing API](https://developers.google.com/search/apis/indexing-api/v3/quickstart).
