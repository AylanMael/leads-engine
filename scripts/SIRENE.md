# Extraction des partenaires locaux

```sh
node scripts/extract-pros-sirene.mjs 78 4942Z
node scripts/extract-pros-sirene.mjs 78 4334Z
node scripts/extract-pros-sirene.mjs 78 4322A
```

Node.js 22, aucune clé API ni dépendance supplémentaire. `49.42Z` et `4942Z`
sont acceptés. Le CSV est enregistré à la racine sous
`partners-to-contact-78-4942Z.csv` ; il est ignoré par Git et remplacé uniquement
après une extraction complète réussie.

Une ligne représente un établissement actif et diffusible du département.
Une même entreprise peut donc apparaître plusieurs fois avec des SIRET différents.
Le filtre NAF et l'effectif s'appliquent à l'entreprise, conformément à l'API :
les entreprises dont la tranche est `00`, `NN` ou inconnue sont exclues. Un salarié
au minimum est attesté pour l'année d'effectif publiée, pas nécessairement à ce jour
ni dans chaque établissement local. La catégorie INSEE « microentreprise » n'est
pas exclue en tant que telle : une petite entreprise avec salariés reste éligible.

Les sièges situés ailleurs ne remplacent jamais les établissements locaux.
Le département est déterminé par le code INSEE de la commune ou le champ département,
ce qui distingue correctement Corse et DOM. Entreprises et établissements sont
paginés séparément ; les SIRET sont dédupliqués. Si l'API tronque les résultats,
répète une page ou dépasse le périmètre de 10 000 entreprises, le script s'arrête
sans publier un export partiel. Pour les volumes supérieurs, utiliser les fichiers
de stock Sirene plutôt que l'API de recherche.

Colonnes : raison sociale, nom(s) du dirigeant, commune, code postal, téléphone,
SIRET, SIREN, NAF de l'entreprise, tranche et année d'effectif, lien source.
Les dirigeants absents restent vides ; les commissaires aux comptes ne sont pas
retenus comme contacts dirigeants. Le schéma public actuel ne fournit pas de
téléphone : cette colonne est normalement vide, sans numéro inventé ni collecte
complémentaire. Elle ne rend donc pas à elle seule la liste immédiatement appelable.

CSV UTF-8 avec BOM, séparateur `;`, guillemets échappés et lignes CRLF. Importer les
colonnes SIRET, SIREN, code postal et téléphone comme **texte** dans le tableur ou CRM
pour conserver les zéros initiaux. Les cellules textuelles commençant par un opérateur
de formule sont préfixées d'une apostrophe.

Cadence : une requête par seconde, trois tentatives maximum, timeout de 20 secondes,
respect de `Retry-After` et arrêt si l'attente demandée dépasse une minute.
Le script extrait uniquement le fichier ; il ne contacte aucune entreprise.

Tests : `node scripts/extract-pros-sirene.test.mjs`.
Sources : [API officielle](https://recherche-entreprises.api.gouv.fr/docs/),
[schéma OpenAPI](https://recherche-entreprises.api.gouv.fr/openapi.json),
[tranches d'effectif](https://github.com/annuaire-entreprises-data-gouv-fr/search-api/blob/main/app/labels/tranches-effectifs.json).
