# Expurgation mensuelle des leads

`rgpdAnonymization` est exportée dans `src/index.ts`. Son calendrier est
`every 1 of month 02:00`, avec `Europe/Paris` : premier jour de chaque mois à 02 h,
heure française. La date planifiée de l'événement sert de référence même lors
d'une nouvelle tentative. Le seuil correspond à treize mois calendaires UTC avant
cette date, avec plafonnement en fin de mois ; seuls les `createdAt` strictement
antérieurs sont retenus.

La fonction parcourt les leads par pages de 200, triées sur `createdAt` puis ID.
Chaque page est traitée dans une transaction. Elle remplace uniquement les quatre
champs `customer.firstName`, `lastName`, `phone`, `email` par `***`, et ajoute
`anonymizedAt`. Géographie, projet, statut, identifiants et transactions sont conservés.
Un lead déjà entièrement masqué n'est pas réécrit. Une erreur interrompt l'exécution
et permet une reprise ; les pages déjà validées restent acquises. Le compteur est
incrémenté après commit et ne double pas lors d'une relance du callback transactionnel.

Les journaux contiennent les nombres de documents examinés/expurgés et le seuil,
sans coordonnées. Les documents sans `createdAt` Timestamp doivent être régularisés
séparément ; ils ne peuvent pas être datés par cette requête. La cadence mensuelle
signifie qu'un lead peut rester identifiable jusqu'au passage suivant après ses
treize mois, soit presque quatorze mois.

## Vérification et déploiement

```sh
npm --prefix functions ci
npm --prefix functions run test:rgpd
firebase deploy --only functions:rgpdAnonymization --project PROJECT_ID
```

Le fichier `firebase.json` prépare le build du codebase Functions. La tâche n'est
active qu'après déploiement sur le projet voulu (facturation/API Cloud Scheduler
et autorisations du compte de service configurées). Aucun déploiement ni traitement
de données réelles n'est effectué par les tests : ils utilisent un double Firestore.
Le ciblage `--only` évite de déployer les autres fonctions préparées dans ce dépôt.
L'index automatique ascendant de `createdAt` doit être actif ; ne pas ajouter
d'exemption d'indexation sur ce champ.

## Portée de la mesure

Le délai de treize mois est la politique demandée pour ce produit, pas une durée
universelle imposée par le RGPD. Le masquage des coordonnées ne garantit pas, à lui
seul, une anonymisation irréversible : les détails conservés et les liens avec
d'autres données peuvent permettre une identification indirecte. Voir la
[distinction expliquée par la CNIL](https://www.cnil.fr/fr/technologies/lanonymisation-de-donnees-personnelles).

Cette tâche ne purge pas les commentaires libres des contestations, les notifications,
les e-mails/SMS chez les prestataires, les exports ni les sauvegardes. Leur politique
de conservation reste à traiter séparément. Elle ne modifie pas les champs métier
que la spécification demande de préserver.
