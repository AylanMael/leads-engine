# Contenus locaux

Le catalogue `src/data/cities-78.json` contient actuellement **90 communes**.
Les deux générations couvrent donc 180 pages, sans réduire silencieusement la liste à 40.

## Configuration

Renseigner dans `.env.local` (jamais dans une variable `NEXT_PUBLIC_*`) :

```ini
OPENAI_API_KEY=
OPENAI_MODEL=
```

Le modèle choisi doit accepter Chat Completions, `response_format` JSON Schema strict
et `temperature`. Le connecteur conserve le modèle configuré, sans substitution.
Référence : [Structured Outputs, documentation OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs).

Le script charge automatiquement `.env.local` ; les variables déjà définies dans
l’environnement restent prioritaires. Il ne lit ni ne transmet les leads ou partenaires.

## Commandes

```sh
node scripts/generate-city-content.mjs demenagement
node scripts/generate-city-content.mjs renovation
npm run build
```

Autre fichier d’entrée :

```sh
node scripts/generate-city-content.mjs renovation src/data/cities-78.json
```

L’ancien ordre `<communes.json> <vertical>` reste accepté.
Les sorties finales sont `src/data/content-demenagement-78.json` et
`src/data/content-renovation-78.json`, importées directement par les pages Next.js.
Chaque entrée contient `slug`, `vertical`, `departmentCode`, `headline`,
`accessNotice`, trois FAQ et les métadonnées de génération.

## Contrôle et reprise

- Normalisation des accents, minuscules et ponctuation ; ensembles de trigrammes de mots.
- Jaccard = taille de l’intersection / taille de l’union, sur titre, accès et FAQ combinés.
- Comparaison avec tous les textes déjà validés du département et du vertical.
- Au-dessus de 0,25 : changement d’angle, température et texte de référence à éviter.
- Trois tentatives rédactionnelles maximum ; rejet et code de sortie 1 si elles échouent.
- Les erreurs 429/502/503/504 font l’objet de reprises réseau bornées.
- Un fichier `.checkpoint.json` conserve les entrées validées après chaque commune.
- La sortie finale précédente est conservée tant que le catalogue n’est pas complet.
- Une empreinte des données d’entrée invalide les entrées devenues obsolètes.
- Un `.report.json` donne les rejets, communes restantes et scores recalculés pour toutes les paires.
- Un verrou empêche deux générations simultanées du même catalogue. Après un arrêt brutal,
  ne retirer le fichier `.lock` qu’après avoir vérifié qu’aucun générateur ne tourne encore.

Tests sans appel payant : `node scripts/generate-city-content.test.mjs`.
Le build valide de nouveau le schéma et les similarités des fichiers importés.

## Sources et limites éditoriales

Les champs « À enrichir » du fichier d’extraction ne constituent pas des faits.
Pour fournir des repères réels et des prescriptions locales, enrichir les contextes
et/ou ajouter à chaque commune un tableau `localFacts` :

```json
{"localFacts": [{"fact": "Fait vérifié et précisément délimité", "source": "https://site-officiel.example/page-source"}]}
```

Ces URL servent de provenance éditoriale ; le script ne les consulte pas automatiquement.
Sans fait local documenté, le prompt impose un cas de maison ou d’appartement,
sans inventer de quartier ou présenter une typologie comme prédominante. Les
mentions PLU, ABF, copropriété et stationnement restent des vérifications à effectuer
pour l’adresse concernée, jamais des obligations locales inventées.

Le seuil lexical ne prouve ni l’originalité sémantique, ni l’exactitude factuelle,
ni un résultat SEO. Une relecture des faits reste nécessaire avant publication.
Les catalogues vides initiaux ne sont pas des contenus générés : les pages utilisent
un texte d’attente avec `noindex`, sans FAQ inventée ni `FAQPage` vide. Une génération
complète remplace ce texte ; la page et le JSON-LD utilisent alors le même tableau FAQ.

Le layout multi-domaines lit toujours les en-têtes : `generateStaticParams()` expose
les communes, mais le rendu peut rester dynamique selon cette configuration existante.
