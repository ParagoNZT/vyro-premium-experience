# Canal de l’application VYRO originale

Les anciennes versions de l’APK `com.vyro.tv` consultent le fichier `latest.json` de `ParagoNZT/VYRO-Updates`. La console VYRO enregistre une demande et la synchronisation GitHub publie le manifeste après vérification de l’APK. Le canal SHOW+ n’est pas utilisé.

1. Copier `sync-vyro.yml` vers `.github/workflows/sync-vyro.yml` et `sync-vyro.mjs` à la racine du dépôt de mises à jour. L’action tourne sur la branche principale, périodiquement ou à la demande dans GitHub Actions. En cas de désactivation par GitHub ou de vérification échouée, le journal est lié dans la console VYRO.
2. Ajouter `trusted-signer.sha256` à la racine de ce dépôt avec l’empreinte publique du certificat de l’APK officielle VYRO déjà distribuée. Confirmer le paquet `com.vyro.tv` et exclure les builds de développement et les rebrands. Ne jamais déposer de clé privée dans GitHub ou dans le site.
3. Héberger la nouvelle APK signée dans les Releases VYRO. Dans la console, renseigner le lien, la version, le build et l’empreinte de fichier. La synchronisation vérifie la signature, le paquet, la version et l’empreinte avant toute modification de `latest.json`. Elle ne publie jamais un build égal ou inférieur.
4. Appliquer `android-announcements.patch` au projet Android original. Les anciennes versions peuvent recevoir une mise à jour sur le canal existant ; seules les versions qui intègrent le nouveau fil reçoivent les annonces. Ce fil est public et ne doit contenir aucune donnée personnelle.
