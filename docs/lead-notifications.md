# Alertes administrateur

Les deux formulaires appellent désormais `POST /api/leads`. Le serveur valide le
contrat, écrit dans Firestore via Admin SDK, puis programme les alertes avec
`after()` de Next.js. Le succès HTTP 201 signifie que le lead est enregistré ; il
ne dépend pas des prestataires. Les deux canaux sont envoyés en parallèle avec
un délai maximal de huit secondes chacun. Aucun envoi n'est effectué en stockage
local simulé.

## Configuration serveur

- `RESEND_API_KEY` : clé Resend autorisée à envoyer des e-mails.
- `RESEND_API_KEY_RENOVATION` et `RESEND_API_KEY_DEMENAGEMENT` : clés limitées
  à chaque domaine, prioritaires sur la clé commune pour le métier concerné.
- `ADMIN_NOTIFICATION_EMAIL` : destinataire administrateur réel.
- Destinataire retenu : `contact@vsw-digital.fr`. Cette adresse est uniquement
  destinataire, pas l'expéditeur de marque.
- `EMAIL_FROM_RENOVATION` : `Rénovizo <notifications@renovizo.fr>`.
- `EMAIL_FROM_DEMENAGEMENT` : `Déménizo <notifications@demenizo.fr>`.
  Ces valeurs sont prioritaires pour le métier concerné ; les activer après
  vérification des domaines dans Resend.
- `EMAIL_FROM` : expéditeur dont le domaine est vérifié chez Resend. Si vide,
  le défaut est `Notification Lead <onboarding@resend.dev>`, réservé aux tests
  vers l’adresse du compte Resend. Exemple de production :
  `Rénovizo <notifications@renovizo.fr>`. L’ancienne variable `RESEND_FROM_EMAIL`
  doit être renommée en `EMAIL_FROM` dans les environnements déjà configurés.
- `TELEGRAM_BOT_TOKEN` et `TELEGRAM_CHAT_ID` : facultatifs ; le bot doit pouvoir
  publier dans le chat choisi. Les clés restent exclusivement côté serveur.

Sans clé Resend ou sans destinataire, le canal e-mail est désactivé. Sur Firebase App
Hosting, provisionner les secrets dans Secret Manager et les déclarer pour le
runtime avant le rollout. Le fichier `.env.local` n'est pas déployé. Ne pas ajouter
de références à des secrets inexistants dans `apphosting.yaml`.

Firestore utilise les identifiants ADC du serveur sur App Hosting. En local,
avec un projet Firebase réel, configurer ADC ou le compte de service via les
variables `FIREBASE_ADMIN_*` déjà documentées dans `.env.example` ; une erreur
Firestore ne déclenche jamais de repli silencieux vers le stockage local.

Le contenu inclut la surface réellement collectée, pas un volume estimé inventé.
Telegram reçoit le numéro international en texte et un bouton vers `/admin`,
car ses boutons URL n'acceptent pas `tel:`. L'e-mail contient le lien d'appel direct.

## Vérification

`node --conditions=react-server --import tsx --test scripts/notifications.test.ts`
teste les canaux avec des appels réseau simulés, sans envoyer de message réel.
`npm run build` vérifie les types et la compilation de production.

En production, les erreurs ne journalisent que le canal et l'identifiant du lead, jamais les
coordonnées, tokens ou réponses brutes des prestataires. Resend utilise une clé
d'idempotence par lead. `after()` conserve le travail après la réponse mais n'est
pas une file durable : il n'y a pas de reprise automatique après un arrêt du
processus ou un échec réseau. Les leads restent disponibles dans `/admin`.

Références : [Next.js after](https://nextjs.org/docs/app/api-reference/functions/after),
[Resend Node.js](https://resend.com/docs/send-with-nodejs),
[Telegram Bot API](https://core.telegram.org/bots/api#inlinekeyboardbutton).
