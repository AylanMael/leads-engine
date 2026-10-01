# Prospection et accueil des partenaires locaux

À personnaliser : `[Prénom commercial]`, `[NomMarque]`, `[Département cible]`,
`[Ville cible]`, `[Prénom partenaire]`, `[Métier]`, `[Téléphone commercial]`.
Choisir une seule ville et un seul département par prise de contact.

## 1. Appel de prospection — 90 secondes maximum

Environ 150 mots à prononcer. Garder les détails pour un second échange si la
conversation se prolonge ; ne pas enchaîner les objections au-delà de 90 secondes.

### Accueil / secrétariat — 0 à 15 secondes

« Bonjour, [Prénom commercial] de [NomMarque]. Qui s’occupe des nouvelles demandes
de devis en [Métier] chez vous ? Je propose un essai gratuit sur [Ville cible],
dans le [Département cible]. »

Si la personne demande le motif : « C’est une proposition de partenariat commercial,
pour recevoir des demandes locales. » Ne pas se présenter comme un client.

### Décideur — 15 à 50 secondes

« Bonjour, je vous prends trente secondes. Vous acceptez de nouveaux chantiers
sur [Ville cible] ?

Nous transmettons des demandes de devis dans le [Département cible]. Chaque
demande est transmise à deux professionnels maximum, vous compris. Vous ne payez
donc pas pour un contact vendu à dix entreprises. »

### Offre et prochaine étape — 50 à 90 secondes

« Je vous envoie les 3 prochains leads gratuitement sur [Ville cible] pour que
vous jugiez la qualité. Si vous les transformez, on discute d’un pack régulier.

Il n’y a aucun achat obligatoire après cet essai. Les demandes arrivent selon les
projets reçus, sans date garantie. À quelle adresse professionnelle puis-je vous
envoyer le récapitulatif et les modalités d’accès ? »

### Réponses courtes — à substituer, pas à ajouter au script

- **« Les plateformes vendent le même contact à tout le monde. »** — « Chez nous,
  c’est deux professionnels maximum par demande, vous compris. L’essai vous permet
  de juger sur trois demandes sans payer. »
- **« Et si le numéro est faux ? »** — « Vous le signalez dans les 48 heures depuis
  votre espace, avec une explication. Une contestation recevable vous rend un crédit. »
- **« Combien après l’essai ? »** — « Le premier pack est de 5 crédits à 175 € HT,
  soit 35 € HT par demande. Vous choisissez de poursuivre ou non. »
- **« Je n’ai pas le temps. »** — « Compris. Préférez-vous un court récapitulatif par
  e-mail ou que je vous laisse ? »
- **« Cela ne m’intéresse pas. »** — « Bien reçu, je note votre refus. Bonne journée. »

## 2. E-mail de suivi / onboarding

**Objet :** [Ville cible] : vos 3 premières demandes de devis offertes

Bonjour [Prénom partenaire],

Merci pour notre échange. Comme convenu, nous vous proposons **les 3 prochaines
demandes de devis disponibles sur [Ville cible], dans le [Département cible],
gratuitement** pour votre activité de [Métier]. Chaque demande est transmise à
**deux professionnels maximum, vous compris**.

Vous pourrez ainsi juger la qualité des projets. Si vous les transformez, nous
discuterons d’un pack régulier. **Aucun achat n’est obligatoire à l’issue de l’essai.**
Le rythme de réception dépend des demandes disponibles dans votre ville.

Votre compte partenaire est prêt. Connectez-vous avec votre adresse professionnelle
et le mot de passe défini lors de l’activation :

**[Accéder à mon espace partenaire](https://demenagement-local.fr/partenaire/login)**

Le fonctionnement des crédits est simple :

- **Pour commencer :** votre compte dispose de 3 crédits offerts, soit 3 demandes
  de devis sans paiement.
- **À chaque attribution :** 1 crédit est débité ; vous retrouvez les détails du
  projet et le bouton « Appeler le client » dans votre espace.
- **Pour continuer :** vous rechargez uniquement si vous le souhaitez, à partir
  de 175 € HT pour 5 crédits. Lorsque votre solde est épuisé, les nouvelles
  attributions s’arrêtent jusqu’à une recharge.

Un problème avec une demande ? Cliquez sur « Signaler un problème » dans les
48 heures suivant son attribution et précisez le motif : faux numéro, projet hors
du département convenu ou locataire sans accord du propriétaire. Une contestation
recevable donne lieu à un recrédit ; un devis refusé pour son prix n’y ouvre pas droit.

Répondez simplement à cet e-mail si vous avez besoin d’aide pour votre première
connexion.

À bientôt,

[Prénom commercial]  
[NomMarque]  
[Téléphone commercial]

Si vous ne souhaitez plus être contacté au sujet de cette offre, indiquez-le en
réponse à cet e-mail.

## Notes internes avant utilisation — ne pas envoyer au partenaire

- Vérifier les coordonnées professionnelles : l’export Sirene réalisé pour le
  `78 / 4942Z` contient 62 établissements, mais **aucun téléphone publié**. Ne pas
  supposer que la colonne téléphone est renseignée.
- Avant de promettre l’essai, confirmer sa disponibilité et organiser réellement
  les trois attributions sur la ville convenue. Le routage actuel filtre par
  département, pas par ville : ajouter trois crédits seuls ne garantit pas un essai
  ciblé sur `[Ville cible]`. Réserver ou traiter ces attributions manuellement tant
  qu’un ciblage par ville n’est pas implémenté.
- Envoyer l’e-mail d’onboarding ci-dessus seulement après création du compte
  Firebase Auth, mise en place sécurisée du mot de passe, validation du profil et
  du contrat, puis attribution effective des trois crédits offerts. Le projet ne
  possède pas encore de parcours automatisé d’inscription et d’offre d’essai.
  Ne pas envoyer de mot de passe en clair. Si le compte n’est pas prêt, remplacer
  le paragraphe d’accès par : « Je reviens vers vous avec vos modalités d’activation
  dès que votre compte est prêt. » et retirer le lien ainsi que l’affirmation que
  les trois crédits sont déjà disponibles.
- Utiliser le domaine de production réellement configuré. Pour la marque rénovation,
  remplacer le lien par `https://renovation-habitat.fr/partenaire/login`. La connexion
  est gérée par Firebase Auth derrière cette page ; aucun lien vers sa console
  d’administration ne doit être envoyé.
- Les tarifs cités correspondent au catalogue actuel : 5 crédits à 175 € HT,
  10 à 320 € HT, 20 à 600 € HT. Les confirmer avant chaque campagne.
- Noter la ville, le département, l’adresse e-mail confirmée, l’accord sur l’essai
  et toute opposition à de nouvelles sollicitations. Ne pas promettre de nombre
  de chantiers signés ni de délai d’arrivée des trois demandes.
