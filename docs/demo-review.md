# Revue de la démonstration pédagogique

## Ce que nous cherchons à montrer

Un parcours logiciel cohérent sur **un cas entièrement fictif**, et non une mesure de performance médicale. La toux, la fièvre, l’essoufflement, la douleur thoracique et le foyer radiographique ont été écrits dans le scénario. L’antigène pneumococcique positif est lui aussi une donnée inventée du scénario, pas un examen réalisé par l’application. Le cas est volontairement typique et guidé.

La proposition de pneumonie est une hypothèse à examiner. Une référence descriptive générale est la [page NHS sur la pneumonie](https://www.nhs.uk/conditions/pneumonia/), consultée le 29 octobre 2026. Cette source ne valide ni notre vignette, ni une décision thérapeutique, ni la réponse d’un modèle.

## Problèmes identifiés et corrections

Les versions précédentes pouvaient afficher des pourcentages non calibrés, des prescriptions générées, des négations non étayées et une « validation » locale susceptible d’être confondue avec une validation clinique. Nous avons réduit le périmètre plutôt que présenter ces sorties comme fiables.

Le **parcours pédagogique activé par défaut** (`MEDDIAG_EDUCATIONAL_MODE=1`) :

- conserve le texte original indépendamment de l’extraction LLM ;
- prépare le contexte avec LangGraph, demande deux propositions puis un arbitrage ;
- impose un schéma strict avec seulement une hypothèse principale et des identifiants de passages source ;
- résout les identifiants vers les passages originaux et refuse une réponse si un identifiant est inconnu, si une citation n’est pas présente mot pour mot dans le texte original, si le JSON est invalide ou si des champs supplémentaires sont ajoutés ;
- ne demande ni score, ni posologie, ni prescription et ne prévoit aucun champ pour ces éléments dans la réponse finale ;
- affiche « hypothèses à examiner » et « relecture simulée », jamais « diagnostic validé » dans ce parcours.

Un échec de contrôle n’est pas remplacé par une réponse attendue. Les appels réels sont conservés localement. Les réponses ne sont pas retouchées pour la capture. La vidéo rejoue des réponses enregistrées et l’indique à l’écran : elle ne montre pas une requête en direct ni sa latence réelle.

## Ce que les contrôles ne prouvent pas

Les modèles sélectionnent des identifiants ; le serveur insère les passages originaux sans les réécrire. Une citation exacte peut néanmoins être mal interprétée. Le contrôle textuel ne valide ni le choix, ni l’exhaustivité, ni l’ordre des hypothèses. Un nom d’hypothèse reste du texte généré. L’extraction et les étapes intermédiaires peuvent encore omettre ou déformer des informations. Les modèles A et C peuvent être identiques : leur accord ne constitue pas une validation indépendante. Une reprise fournisseur peut modifier le modèle utilisé ; le journal local conserve celui réellement retourné.

Il n’y a eu **aucune revue clinique indépendante**, aucun essai prospectif, aucune calibration, aucune vérification exhaustive des biais ou de la sécurité. Le cas choisi et les itérations sur celui-ci ne permettent aucune estimation de précision. Aucun taux de réussite n’est publié. Aucune maladie n’est attribuée à Gabrielle : son nom désigne seulement l’utilisatrice de démonstration.

Le rôle « médecin », la transmission et la relecture sont des états locaux du navigateur, sans contrôle d’accès serveur. Ne pas entrer de vraies données de santé ni exposer l’API avec une clé fournisseur. Les entrées sont envoyées à Groq. Ce dépôt n’est pas un dispositif médical ni un service de soins.

## Ancien parcours conservé

`MEDDIAG_EDUCATIONAL_MODE=0` conserve le prototype historique pour lecture du code. Il comporte encore des suggestions thérapeutiques, des scores non calibrés et des exports non validés. Les protections du parcours pédagogique ne s’appliquent pas à ce mode. Le nouvel enregistrement ne prétend pas corriger ou certifier toute l’application historique.

## Vérifications reproductibles

```sh
python3 -m unittest discover -s tests -v
npm run build --prefix frontend
MEDDIAG_EDUCATIONAL_MODE=1 python3 evaluation/run.py --repo . --output /chemin/prive/demo.json --demo-only
```

Les tests simulent les appels LLM ; ils vérifient les refus et la conservation du texte, pas la médecine. La capture contrôlée vérifie ensuite les étapes visibles, l’absence de widgets historiques dans les résultats et les citations du cas réel enregistré. Une inspection des captures complète ces assertions.

## Itération observée le 29 octobre 2026

La première tentative du parcours restreint a été rejetée : les modèles avaient recomposé des fragments en fausses citations exactes. La sélection de passages numérotés a remplacé cette recopie libre. L’exécution suivante a produit une proposition finale cohérente avec les passages sélectionnés, mais trois préparations tronquées ont été détectées. Elle a également été écartée de la publication. Les préparations ont été raccourcies et les réponses tronquées sont maintenant rejetées avant propagation. Cet échec est conservé dans le journal local ; il n’est pas compté comme une réponse correcte. Les itérations de cette démonstration sont du développement sur un même cas, pas une évaluation indépendante.

`python3 evaluation/check_demo.py /chemin/prive/demo.json` contrôle aussi que la réponse affichée correspond à la dernière réponse réellement enregistrée après résolution des identifiants. Le [manifeste de la démonstration](demo-provenance.json) publie uniquement le scénario fictif, la proposition affichée, les modèles retournés et les empreintes de traçabilité, sans résultat de benchmark.

## Revue du dernier enregistrement retenu

La sortie finale propose « pneumonie bactérienne pneumocoque » et sélectionne quatre passages : symptômes respiratoires et fièvre, crépitants droits, foyer radiographique et antigène pneumococcique positif. Ces passages sont tous fournis dans le scénario. L’antigène soutient ici une hypothèse étiologique ; il n’est pas présenté comme une certification absolue. Aucun diagnostic alternatif n’est déclaré exclu dans le résultat affiché.

Les sept appels se sont terminés sans troncature. Le contrôle de rejouabilité et les onze tests techniques passent. La compilation du frontend et le parcours de l’interface ont été vérifiés. Cela porte sur cette exécution et ce parcours seulement.

Des défauts persistent dans les préparations non affichées : une synthèse généralise l’absence de certains antécédents à une absence de facteurs de risque ; une autre évoque une complication postopératoire malgré l’absence de chirurgie récente dans la source. L’extraction qualifie aussi la détresse respiratoire sans validation clinique. Nous ne présentons pas ces textes intermédiaires comme des preuves ni comme un raisonnement médical validé. L’arbitrage final doit citer la source originale, et non ces textes. La restriction de l’affichage et le contrôle des citations ne corrigent pas à eux seuls la qualité médicale de toute la chaîne.
