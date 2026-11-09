# Contrôle des applications partenaires

Le site écrit les paramètres, messages, commandes et versions dans la même base que le service Android. Une commande porte l’identifiant d’un appareil, expire au bout de sept jours et passe à « Terminée » uniquement après confirmation du client Android. Les anciennes versions continuent d’utiliser leur boîte de réception et leurs réglages XC existants.

Pour mettre à jour le service Android, capturer la version Cloudflare active du module `vyro-beta-access`, puis exécuter `node device-worker/prepare-release.mjs <module-actif> <dossier-sortie>`. La préparation échoue si les points d’intégration ne correspondent plus. Appliquer d’abord les migrations D1 VYRO, conserver la base et les secrets du Worker, puis comparer le manifeste public SHOW+ avant et après. Ne pas redéployer une copie ancienne du Worker.

## Livraison d’une nouvelle application

1. Depuis la console VYRO, confirmer le règlement de 100 €. Cela réserve un identifiant Android unique et crée l’espace partenaire. Activer un an de mises à jour en confirmant séparément la demande de 20 €, si elle existe. Un renouvellement prolonge la période d’un an à partir de son échéance ou de la date de règlement si elle est expirée.
2. Appliquer `android-partner.patch` au projet Android de SHOW+ 1.0.45. Pour une autre marque, utiliser les propriétés `VYRO_PARTNER_APP_ID` (identifiant indiqué dans la console), `VYRO_PARTNER_PACKAGE`, `VYRO_PARTNER_NAME`, `VYRO_PARTNER_SIGNER_SHA256` (empreinte publique du certificat), `VYRO_PARTNER_VERSION_CODE` et `VYRO_PARTNER_VERSION_NAME`. Préparer les ressources de cette marque et signer avec sa clé, conservée hors du site et du dépôt.
3. Renseigner l’adresse XC, livrer le premier APK signé via la console VYRO et vérifier son installation sur TV et mobile. Le premier APK ne dépend pas de la couverture annuelle. Les versions suivantes doivent être publiées pendant une période couverte et sont accessibles ensuite même quand cette période prend fin.
4. Avant de publier une mise à jour, vérifier le package, la signature, l’empreinte de l’APK et le numéro de build. Sur un appareil de test, vérifier le message et les deux commandes depuis VYRO, puis contrôler qu’un appareil d’une autre marque ne les reçoit pas.

Le site enregistre les demandes et règlements confirmés par le propriétaire. Il ne génère pas d’APK à la commande et ne déclenche pas de prélèvement.
