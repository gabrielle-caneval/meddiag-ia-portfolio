# Démonstration MedDiag IA

[Vidéo MP4, 51 secondes](media/meddiag-demo.mp4) · [Sous-titres](media/meddiag-demo.fr.vtt)

## Ce que montre la vidéo

L’interface Next.js réelle, avec un scénario entièrement fictif. Les réponses API sont interceptées par le script d’enregistrement et remplacées par des données de démonstration. Aucun modèle externe n’est appelé. Le bandeau visible précise « Interface réelle · Données fictives · Réponses IA simulées ».

1. Sélection du rôle infirmier et saisie d’un cas fictif.
2. Lecture des informations structurées.
3. Lancement du pipeline avec réponse simulée.
4. Lecture de deux hypothèses pédagogiques.
5. Transmission locale du dossier et sélection du rôle médecin.
6. Relecture et confirmation du dossier fictif, sans prescription.

La sélection de rôle, la transmission et la validation appartiennent à la session React. Elles ne constituent pas un contrôle d’accès serveur. La vidéo n’évalue ni la qualité des modèles ni la fiabilité clinique.

## Reproduire l’enregistrement

Lancer le frontend local sur le port 5180. Installer Playwright dans un environnement Node dédié, ainsi que son navigateur Chromium et son encodeur FFmpeg (`npx playwright install chromium ffmpeg`). Exécuter `node scripts/record-demo.cjs` depuis un environnement où `require('playwright')` est résolu. `DEMO_URL` accepte uniquement localhost ou 127.0.0.1. `CHROME_PATH` permet facultativement de choisir un exécutable Chromium local.

Le script produit une vidéo WebM dans `docs/media` et vérifie que la validation finale est atteinte sans erreur JavaScript. Pour obtenir le MP4, convertir le WebM avec FFmpeg : `ffmpeg -i capture.webm -c:v libx264 -crf 24 -pix_fmt yuv420p -movflags +faststart -an meddiag-demo.mp4`.

Le script ne lit aucune clé API, n’utilise pas de profil navigateur personnel et simule tous les appels aux routes `/api/`.
