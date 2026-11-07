# Aperçu et captures de la refonte

La vitrine présente les écrans de la version Android TV en développement. La mise en mouvement s’applique aux éléments du site (arrivée de l’écran, changement de capture au clic ou aux flèches, transitions au défilement). Les pixels de l’application viennent de captures d’origine. Les contenus visibles ne font pas partie de la licence. Certaines captures de développement portent le nom SHOW+.

| Fichier | Capture locale d’origine | Écran |
| --- | --- | --- |
| `vyro-series.jpg` | `Screenshot_20261021_000217.png` | Bibliothèque de séries |
| `vyro-live.jpg` | `Screenshot_20261102_191822.png` | Chaînes et programme en cours |
| `vyro-details.jpg` | `Screenshot_20261102_192019.png` | Fiche d’un titre |
| `vyro-player.jpg` | `Screenshot_20261102_191810.png` | Lecteur et commandes |
| `vyro-home.jpg` | `Screenshot_20261102_191459.png` | Accueil et accès au profil |

Les cinq images ont été redimensionnées à 1600 × 900 et compressées en JPEG, sans reconstruction ni remplacement de contenu.

Pour examiner les pages publiques, utilisez `bun install --frozen-lockfile` puis `bun run dev`. La vitrine et les écrans de connexion peuvent être vérifiés sans données client. Avant de connecter l’espace client et la console d’administration à un environnement, suivez le document de configuration du serveur dans ce dossier.
