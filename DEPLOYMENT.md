# Déploiement Firebase App Hosting

## Configuration et ressources

Utiliser Node.js 22 et un projet Firebase avec facturation Blaze. Le fichier
`apphosting.yaml` configure le serveur Cloud Run : 1 vCPU, 2 048 MiB de mémoire,
80 requêtes simultanées par instance, entre 0 et 5 instances. Ces limites ne
dimensionnent pas la machine de compilation et ne garantissent pas un build SSG
plus rapide. Le minimum à zéro permet des démarrages à froid.

## Variables de production

Remplacer toutes les valeurs `REPLACE_WITH_*` dans `apphosting.yaml` avant de
déployer. Les valeurs publiques Firebase proviennent des paramètres de l'application
Web dans la console Firebase. Une valeur fictive non vide active le client Firebase :
ne pas conserver les placeholders en production.

| Variable | Source / usage | Disponibilité |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Origine HTTPS canonique, sans slash final | Build et serveur |
| `NEXT_PUBLIC_VERTICAL` | `demenagement` ou `renovation`, marque de repli | Build et serveur |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Clé publique de configuration Firebase Web | Build et serveur |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Domaine Auth Firebase, à autoriser dans Auth | Build et serveur |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Identifiant du projet Firebase | Build et serveur |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Identifiant de l'application Web | Build et serveur |
| `FIREBASE_ADMIN_PROJECT_ID` | Même projet que le client Web | Serveur |
| `STRIPE_SECRET_KEY` | Secret `stripe-secret-key` | Serveur |
| `STRIPE_WEBHOOK_SECRET` | Secret `stripe-webhook-secret`, propre à l'endpoint de production | Serveur |
| `ADMIN_DISPUTE_WEBHOOK_URL` | Secret `admin-dispute-webhook-url`, URL HTTPS privée des alertes de contestation | Serveur |
| `TWILIO_ACCOUNT_SID` | Secret `twilio-account-sid` | Serveur |
| `TWILIO_AUTH_TOKEN` | Secret `twilio-auth-token` | Serveur |
| `TWILIO_FROM_NUMBER` | Numéro expéditeur Twilio au format E.164 | Serveur |
| `RESEND_API_KEY` | Secret `resend-api-key` | Serveur |
| `RESEND_FROM_EMAIL` | Adresse d'un domaine vérifié chez Resend | Serveur |

Les variables `NEXT_PUBLIC_*` sont intégrées au JavaScript client lors du build :
une modification nécessite un nouveau rollout. Ne jamais y placer de secret.
La clé Web Firebase n'est pas une clé Admin ; les règles Firestore et Firebase Auth
assurent la protection des données.

Le middleware choisit la marque selon le domaine. L'URL de site reste actuellement
unique pour le sitemap et les retours Stripe : la définir sur le domaine principal
et valider les parcours sur les deux domaines avant de les ouvrir au public.

## Provisionner les secrets

Avec Firebase CLI authentifiée, créer chaque secret via une saisie interactive
(ne pas écrire sa valeur dans le dépôt ou dans une commande conservée en historique) :

```sh
firebase apphosting:secrets:set stripe-secret-key --project PROJECT_ID
firebase apphosting:secrets:set stripe-webhook-secret --project PROJECT_ID
firebase apphosting:secrets:set admin-dispute-webhook-url --project PROJECT_ID
firebase apphosting:secrets:set twilio-account-sid --project PROJECT_ID
firebase apphosting:secrets:set twilio-auth-token --project PROJECT_ID
firebase apphosting:secrets:set resend-api-key --project PROJECT_ID
```

Accorder ensuite l'accès au backend App Hosting concerné, pour chacun des six
secrets, en sélectionnant le backend demandé par la commande :

```sh
firebase apphosting:secrets:grantaccess stripe-secret-key --project PROJECT_ID
```

Remplacer `stripe-secret-key` par chaque autre nom du tableau et répéter.
Les références sans version utilisent la dernière version lors du rollout.
Pour figer une version, utiliser par exemple `secret: stripe-secret-key@3`.
Une rotation nécessite un nouveau rollout.

Firebase Admin utilise les Application Default Credentials du compte de service
App Hosting. Lui attribuer les droits nécessaires à Firestore et aux opérations Auth
utilisées par l'application. Ne pas injecter de clé privée Admin dans App Hosting.
Les variables `FIREBASE_ADMIN_CLIENT_EMAIL` et `FIREBASE_ADMIN_PRIVATE_KEY` du fichier
`.env.example` sont réservées aux environnements sans identité Google Cloud.

### Cloud Functions de notification

`functions/src/services/notifications.ts` s'exécute dans une Cloud Function séparée.
Les variables d'App Hosting ne lui sont **pas** transmises. Les entrées Twilio/Resend
du YAML préparent uniquement l'environnement App Hosting.

Avant de déployer les notifications, configurer les mêmes secrets dans le projet
Functions et les lier explicitement au trigger v2 via son option `secrets`, avec les
noms exposés attendus (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `RESEND_API_KEY`).
Configurer aussi `TWILIO_FROM_NUMBER`, `RESEND_FROM_EMAIL` et les noms de marque
documentés dans `functions/.env.example`. Le codebase Functions nécessite sa propre
configuration de build/déploiement ; le build Next.js l'exclut volontairement.

## Build et connexion GitHub

```sh
npm ci
npm run check:build
```

`check:build` exécute exactement `tsc --noEmit && next build`. Le script `build`
appelle `check:build`, donc le build standard d'App Hosting échoue aussi en cas
d'erreur TypeScript ou de compilation Next.js. Aucun `scripts.buildCommand` n'est
défini dans le YAML afin de conserver l'adaptateur Next.js d'App Hosting.

Dans la console Firebase App Hosting :

1. Créer un backend et connecter le dépôt GitHub avec les permissions requises.
2. Choisir la racine du projet (`/`) et la branche de production.
3. Activer les déploiements automatiques sur cette branche.
4. Configurer les variables publiques, provisionner les secrets et leurs accès.
5. Lancer le premier rollout, vérifier ses logs, puis associer les domaines.

Le YAML seul ne connecte pas GitHub et ne crée pas le backend. Les règles et index
Firestore, les Cloud Functions et la configuration Auth se déploient séparément.
Configurer Stripe Tax et l'endpoint `/api/stripe/webhook` avec les événements
`checkout.session.completed` et `checkout.session.async_payment_succeeded`.

Le build valide les imports et la génération des routes ; il ne visite pas les liens
HTML et ne garantit pas l'absence de liens cassés. Un contrôle HTTP ou des tests de
navigation sur une préproduction sont nécessaires pour cette garantie. Vérifier
notamment les pages locales, la connexion partenaire et les retours Checkout.

Le build actuel produit un rendu mixte : les routes d'accueil et partenaire sont
dynamiques, le sitemap et robots sont statiques. Le bilan Next.js liste les communes
issues de `generateStaticParams`, mais elles ne figurent pas dans le manifeste de
pré-rendu effectif : la résolution de marque par les en-têtes conserve un rendu
dynamique. Les contenus JSON restent préparés hors build. Ne pas
exécuter les scripts LLM payants pendant le déploiement ni exposer leur clé API au client.

Documentation officielle : [configuration App Hosting](https://firebase.google.com/docs/app-hosting/configure)
et [adaptateurs de frameworks](https://firebase.google.com/docs/app-hosting/frameworks-tooling).

## Contestations et remboursement de crédits

`POST /api/leads/dispute` exige un jeton Firebase Auth Bearer non révoqué et un JSON
`{ leadId, reason, comment }`. Motifs : `fake_phone`, `outside_zone`,
`tenant_no_permission`. Le commentaire est obligatoire (2 000 caractères maximum).
Le serveur vérifie l'attribution, le délai strictement inférieur à 48 heures et
l'audit `debit_lead` de l'attribution avant de recréditer. Les leads historiques
attribués sans cet audit demandent une régularisation par un administrateur.

Le remboursement de 1 crédit est immédiat, sur déclaration, sans vérification
automatique de la véracité du motif. Un contrôle humain suit via l'alerte. Il s'agit
d'un crédit interne, pas d'un remboursement de paiement Stripe. Une transaction
stable `refund_dispute_<empreinte>` garantit un seul recrédit par lead/partenaire.
Le second partenaire assigné conserve son propre droit à contestation. Seuls les
IDs des partenaires contestataires figurent sur le lead partagé ; le commentaire
reste dans l'audit privé du partenaire et la file administrateur.

Configurer `ADMIN_DISPUTE_WEBHOOK_URL` dans Secret Manager puis lui accorder l'accès
App Hosting comme aux autres secrets. Le webhook reçoit un POST JSON avec `eventId`,
`type: lead_disputed`, `leadId`, `partnerId`, `reason`, `comment`. Traiter le commentaire
comme du texte non fiable et l'échapper si affiché en HTML. L'URL privée doit inclure
le mécanisme d'authentification du récepteur et ne doit pas être publiée.

L'envoi est effectué après commit, avec délai de 5 secondes. Le récepteur doit
dédupliquer sur `eventId` ou `Idempotency-Key` (une panne après réception mais avant
confirmation peut entraîner une nouvelle livraison). `adminNotifications/{refundId}`
conserve l'état `pending`, `sending` avec bail de 30 secondes, ou `sent`. Cette
collection est interdite aux clients par les règles existantes. Une panne d'alerte
ne bloque jamais le recrédit. Un nouvel appel identique à la route reprend un envoi
en attente sans ajouter de crédit ; un administrateur peut aussi relancer
`notifyDisputeAdmin` côté serveur. Aucun worker périodique de reprise n'est déployé
par cette modification : surveiller les notifications en attente.

Vérification locale : `npm run test:disputes` (double transactionnel, sans accès
production), puis `npm run check:build`. Les tests locaux ne remplacent pas les
tests Firestore/Auth en préproduction avec les identités et règles déployées.

## Modèle de contrat partenaire

`src/components/ContractTemplate.tsx` produit un aperçu HTML imprimable, sans
JavaScript client ni collecte de signature. Exemple sur une page dédiée :

```tsx
<ContractTemplate
  companyName="Entreprise Exemple"
  siret="12345678901234"
  legalAddress="1 rue Exemple, 78000 Versailles"
  vertical="demenagement"
  creditPrice={35}
  date="2026-10-01"
/>
```

L'identité passée en props est celle de l'artisan. `creditPrice` est exprimé en euros
HT ; `date` est une date civile ISO, sans décalage de fuseau horaire. Le contrôle du
SIRET vérifie son format, pas son existence. La marque et la raison sociale de
l'apporteur proviennent de `getTenantConfig(vertical)`.

Avant signature, renseigner la raison sociale réelle dans `src/config/tenant.ts`,
compléter le SIRET, l'adresse de la plateforme et les départements convenus dans
le document. Faire valider ce modèle juridique pour les conditions commerciales
réellement proposées. La clause de douze mois est contractuelle : le stockage actuel
du solde global ne gère pas encore l'expiration de lots de crédits. Le présent
composant n'ajoute ni cette gestion, ni une preuve d'acceptation ou une signature
électronique. Le remplacement est défini comme le recrédit permettant une nouvelle
attribution, conformément au mécanisme de contestation.

Références utilisées pour la rédaction :
[Code civil, article 1170](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032041115)
pour préserver les obligations propres de chaque partie et
[CNIL, transmission aux partenaires](https://www.cnil.fr/fr/la-prospection-b-to-c-quelles-regles-pour-transmettre-des-donnees-des-partenaires)
pour la finalité, l'information et la protection des données. Le contrat entre
professionnels ne remplace pas l'information du prospect ni la base légale du transfert.
