# Configuration Resend — Rénovizo et Déménizo

Destinataire administrateur commun : `contact@vsw-digital.fr`.

Expéditeurs des marques vérifiées :

- `Rénovizo <notifications@renovizo.fr>` (`EMAIL_FROM_RENOVATION`).
- `Déménizo <notifications@demenizo.fr>` (`EMAIL_FROM_DEMENAGEMENT`).

Les deux domaines ont été ajoutés dans Resend le 3 octobre 2026 en région
Irlande (`eu-west-1`). Les six enregistrements DNS sont publiés chez OVH. Les deux domaines sont
vérifiés (« Verified ») dans Resend.
Le domaine `notifications.vsw-digital.fr`, ajouté auparavant, est abandonné
pour cet usage : il ne doit pas servir d'expéditeur.

## DNS autoritatifs

Les serveurs publics de renovizo.fr et demenizo.fr sont `dns111.ovh.net` et
`ns111.ovh.net`. Les enregistrements doivent être ajoutés chez OVH.
Les zones homonymes dans Google Cloud ne sont pas actuellement déléguées.

Pour chaque domaine, Resend demande les enregistrements suivants (noms relatifs
à la zone ; TTL proposé : 300 secondes) :

| Type | Nom | Valeur |
| --- | --- | --- |
| TXT | `resend._domainkey` | Copier la clé publique DKIM propre au domaine depuis Resend |
| CNAME | `rsend` | `rsend-euw1.forge.rmta.net.` |
| CNAME | `send` | `send.forge.rmta.net.` |

Les clés DKIM sont distinctes pour chaque domaine. Inspecter la zone existante
avant ajout et conserver ses MX, SPF et DMARC. Aucun changement de délégation
n'est nécessaire. La réception dans Resend reste désactivée.

## Activation restante

1. Enregistrements publiés chez OVH le 3 octobre 2026 (terminé).
2. Domaines vérifiés dans Resend (terminé).
3. Stocker les clés Resend par marque dans Secret Manager et attribuer les accès aux backends.
4. Variables publiques enregistrées dans les deux backends (terminé) :
   `EMAIL_FROM`, `ADMIN_NOTIFICATION_EMAIL` et `NEXT_PUBLIC_SITE_URL`.
   Elles prendront effet au prochain déploiement.
5. Déployer puis vérifier un envoi de test.

En attendant, `EMAIL_FROM` vide utilise l'expéditeur de test
`Notification Lead <onboarding@resend.dev>`. Les expéditeurs par marque restent
commentés dans le modèle local. Aucune alerte réelle n'a encore été envoyée.

## État de la configuration

Les deux domaines sont désormais Verified dans Resend. Deux clés Sending access,
limitées respectivement à renovizo.fr et demenizo.fr, ont été créées.
La valeur de la première clé Rénovizo n’a pas pu être récupérée : cette clé
inutilisée doit être révoquée et remplacée. La clé Déménizo a été récupérée.
Le stockage dans Secret Manager reste bloqué par la reconnexion Google Cloud.
Aucun secret Resend n’est encore référencé dans apphosting.yaml afin de ne pas
bloquer les builds. Les variables publiques d’expéditeur et de destinataire
sont prêtes. Aucune alerte réelle n’a encore été envoyée.
