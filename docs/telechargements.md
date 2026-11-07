# Fichiers d’installation privés

Déclarez un compartiment R2 privé sur le Worker sous la liaison `VYRO_RELEASES`. Vous pouvez passer son nom à `VYRO_R2_RELEASES_BUCKET` lors de la compilation pour générer cette liaison. Déposez uniquement les APK officielles signées et approuvées pour diffusion, aux clés suivantes :

- `vyro-premium-androidtv.apk` : Android TV et Google TV
- `vyro-premium-firetv.apk` : Amazon Fire TV

Sans compartiment ou fichier, le site indique que le téléchargement n’est pas disponible. Aucune APK, clé de signature ou URL privée n’est incluse dans le dépôt. Ne rendez pas le compartiment public.

`GET /api/download` vérifie la session et la licence avant de retourner les plateformes publiées. `GET /api/download?platform=androidtv` ou `platform=firetv` vérifie à nouveau le droit puis transmet le fichier sans mise en cache. Vérifiez la récupération depuis un compte de test actif et le refus d’un compte sans licence avant de publier.
