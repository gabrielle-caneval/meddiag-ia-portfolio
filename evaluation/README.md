# MedDiag : évaluation pédagogique reproductible

## Périmètre

Huit vignettes synthétiques en français, rédigées pour ce test à partir des tableaux généraux décrits par le NHS (liens dans `cases.json`). Les chiffres, examens et formulations sont inventés. Ces cas ne proviennent pas de dossiers patients et n'ont pas été validés par un clinicien. Le jeu favorise des présentations typiques ; il est trop petit et trop simple pour estimer la performance clinique ou la généralisation. Les sources sont des références pédagogiques, pas une validation du benchmark.

Le protocole évalue l'extraction puis le graphe complet. Aucun label attendu n'est transmis aux modèles. Une tentative par vignette, avec les reprises internes du programme conservées. Tous les échecs sont enregistrés. Les modèles effectivement utilisés, leurs paramètres, le commit, le hash des cas, les sorties et les durées sont conservés. Aucun score n'est inventé si les appels ne peuvent pas être exécutés.

## Exécution

Configurer `GROQ_API_KEY` dans le fichier `.env` local du projet MedDiag, jamais dans Git ou dans une conversation. Les appels utilisent le quota du compte : environ 56 appels avant éventuelles reprises internes pour les huit cas. Ne pas relancer en sélectionnant seulement les bons résultats.

```sh
python3 evaluation/run.py --repo /chemin/meddiag --output /chemin/prive/run-01.json --dry-run
python3 evaluation/run.py --repo /chemin/meddiag --output /chemin/prive/run-01.json
```

## Notation à réaliser sur les sorties réelles

Revue manuelle de la première hypothèse puis des trois premières hypothèses, selon l'ordre `rang`. Accepter un synonyme direct du diagnostic attendu ; ne pas compter un diagnostic plus général comme une correspondance (par exemple « infection urinaire » à la place de « pyélonéphrite »). Pour la méningite, ne pas exiger une étiologie bactérienne ou virale absente du cas. Toute ambiguïté reste signalée, sans modifier les labels après observation des réponses.

Rapporter séparément : nombre de réponses exploitables / 8, concordances au rang 1 / 8, concordances dans les trois premières / 8, échecs techniques / 8. Chaque erreur technique reste dans le dénominateur global. Décrire aussi les erreurs de diagnostic, pas seulement les succès. La revue par l'assistant n'est pas une adjudication clinique indépendante. Les traitements, l'urgence, la sécurité et la calibration des scores ne sont pas évalués par ce chiffre.

Formulation éventuelle : « X/8 diagnostics attendus retrouvés au premier rang sur huit vignettes synthétiques typiques, un passage, le [date], modèles [liste]. Test pédagogique interne, non clinique. » Ne pas transformer cela en « X % de bons diagnostics » sans ce périmètre.

## Nouvelle vidéo

Le cas 01 (pneumonie) est choisi avant exécution, pas selon son résultat. Le script `record-demo.cjs` attend un fichier de résultats réel via `EVAL_RUN`. Il rejoue exactement les réponses enregistrées du cas 01 dans l'interface, sans inventer les hypothèses. La vidéo porte la mention « réponses IA enregistrées, rejouées » : elle ne prétend pas montrer un appel en direct. Si la réponse est erronée, le commentaire doit le dire ; ne pas remplacer la sortie par la réponse attendue.

« Caneval Gabrielle » est le nom de démonstration de l'utilisatrice. Le patient porte un nom explicitement fictif. La maladie du scénario ne décrit pas la santé de Gabrielle.

```sh
NODE_PATH=/Users/canevalgabrielle/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules EVAL_RUN=/chemin/prive/run-01.json DEMO_URL=http://127.0.0.1:5180 CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node evaluation/record-demo.cjs
```

Aucune nouvelle vidéo ni aucun score ne doit remplacer les médias publics avant une exécution réelle et une inspection des résultats.

## Résultat conservé

Voir `results/summary.json`, `results/run-01.json` et `results/run-02.json`. Premier essai : modèles introuvables. Deuxième essai : un seul résultat exploitable sur huit, concordance de diagnostic sur la pneumonie mais invention de détails dans la justification. Sept échecs techniques. Les raw outputs sont des sorties non validées de modèles sur des données fictives, pas des conseils médicaux.
