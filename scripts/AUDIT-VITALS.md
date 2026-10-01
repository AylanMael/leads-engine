# Audit mobile de production

```sh
npm ci
npm run audit:vitals
# Alias destiné à un pipeline de déploiement :
npm run check:deploy
```

Prérequis : Node.js 22 compatible avec les versions verrouillées dans le lockfile,
Chrome/Chromium installé. Si la détection automatique échoue, définir `CHROME_PATH`
vers son exécutable. Aucun service PageSpeed ni clé API n'est nécessaire.

## Build et sélection des pages

Le script exécute `npm run build`, puis `npm run start` sur un port local libre.
`NEXT_AUDIT_BUILD=1` sélectionne `.next-audit` via `next.config.mjs` pour préserver
le build du serveur de développement. Il ne lance pas `next dev` et n'impose pas
`output: export` : les routes API et les pages dynamiques de cette application
nécessitent un serveur Next.js. Les pages locales générées statiquement sont
identifiées dans le manifeste de pré-rendu du build, complété par le sitemap servi
localement. Une réponse HTTP correcte est ensuite vérifiée pour chaque page auditée.
La liste n'est pas inventée à partir d'un fichier de communes non intégré aux routes.
Dans le projet actuel, les en-têtes de marque entraînent un rendu dynamique des
pages locales : elles apparaissent dans le sitemap, mais pas dans le manifeste des
pages effectivement pré-rendues. `prerenderedLocalPaths` consigne cette distinction.

Un tirage aléatoire sans doublons sélectionne cinq URLs : au moins une par vertical,
puis trois autres parmi les pages restantes. Le tirage est consigné dans le rapport.
Les domaines locaux `demenagement.localhost` et `renovation.localhost` sont résolus
vers le serveur local par Chromium afin d'exercer le middleware de marque.

Le catalogue actuel contient trois pages locales déménagement et aucune page locale
rénovation. Le script analyse les trois pages disponibles pour diagnostic, puis
**sort avec le code 1** : il faut générer au moins cinq pages au total couvrant les
deux métiers avant de pouvoir valider l'audit. Les doublons ou les pages d'accueil
ne servent pas à remplir artificiellement l'échantillon.

## Mesures

- **LCP (ms) et CLS** : audits de navigation Lighthouse, configuration mobile,
  réseau Slow 4G simulé (RTT 150 ms, débit 1 638,4 Kbit/s), ralentissement CPU ×4.
- **INP de laboratoire (ms)** : `web-vitals.onINP` dans une session distincte,
  avec ouverture/fermeture d'une FAQ et saisie dans un champ texte, lorsqu'ils existent.
  Ce scénario utilise une émulation réseau réelle via DevTools (150 ms,
  1,6 Mbit/s descendant, 750 Kbit/s montant), CPU ×4. Il ne soumet pas de formulaire
  et bloque les requêtes d'écriture. Adapter le scénario si les composants changent.
- **TBT (ms)** : conservé séparément comme diagnostic Lighthouse ; il n'est jamais
  renommé INP. L'INP synthétique n'est pas un INP terrain au 75e percentile et ne
  valide pas les Core Web Vitals réels. Ceux-ci exigent des interactions réelles
  via RUM/CrUX sur le site déployé.

Une navigation Lighthouse seule ne mesure pas correctement l'INP : la session
d'interactions complète donc l'audit sans modifier les scores Lighthouse.
Si une mesure n'est pas disponible, elle reste `null` et bloque la validation.

## Rapport et blocage du déploiement

Chaque exécution écrit `reports/vitals/<date-UTC>/audit-vitals.json`, ainsi que les
rapports Lighthouse JSON et HTML de chaque page. Les métriques, URLs, versions
Lighthouse, scores et causes d'échec sont conservés. Les fichiers sont ignorés par
Git ; les publier comme artefacts CI, y compris lors d'un échec.

Le code de sortie est **1** dès qu'une page obtient un score Performance **ou** SEO
strictement inférieur à 90, qu'une mesure manque, qu'une page échoue ou que la
couverture des deux verticaux n'est pas satisfaite. Il n'y a ni arrondi avant
comparaison, ni moyenne masquant une page lente, ni répétition jusqu'à obtenir un
score favorable. Chrome et le serveur créés par le script sont arrêtés à la fin.

Pour bloquer réellement une mise en production, placer `npm run check:deploy`
comme étape obligatoire **avant** la commande de déploiement, avec les variables
publiques du futur build. Ne pas ajouter cet audit dans `build` : il appelle déjà
`build` et créerait une récursion. Ne pas charger cet audit dans le runtime Next.js.

Les rollouts GitHub automatiques d'App Hosting configurés indépendamment ne sont
pas bloqués par un script npm local. Pour un verrou de déploiement, désactiver ce
chemin automatique indépendant et déclencher le rollout depuis le pipeline seulement
après réussite de l'audit. La création de ce script ne change aucun backend distant.

Les mesures locales dépendent de la machine ; elles ne remplacent pas un contrôle
du site réellement hébergé. Un score élevé ne garantit pas une indexation ou un
classement prioritaire dans les résultats de recherche.

Tests hors navigateur : `node scripts/audit-vitals.test.mjs`.
Pour diagnostiquer un build déjà terminé : `npm run audit:vitals -- --reuse-build`.
Cette option conserve toujours un code de sortie 1 et ne peut pas valider un
déploiement sur un build potentiellement périmé.
Références : [Lighthouse programmatique](https://github.com/GoogleChrome/lighthouse/blob/main/docs/readme.md),
[simulation réseau](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md),
[mesure INP avec web-vitals](https://github.com/GoogleChrome/web-vitals).
