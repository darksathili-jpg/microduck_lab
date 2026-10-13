# Livraison du jalon 1

Application indépendante : `lab/index.html`, `lab/styles/lab.css`, `lab/js/{app,runtime-client,simulator-view}.js`, `lab/workers/python-worker.js`, `lab/python/microduck_sim.py`, `lab/missions/traversee.json`.

Outillage : `package.json`, `package-lock.json`, `.gitignore`, `tests/{server,browser}.mjs`, `tests/test_simulation.py`, `tests/preservation.py`. Documentation : ce fichier, `architecture.md`, `progression-nsi.md` et README actualisé.

## Vérification exécutée

- Python 3.14.2 : 5 tests du modèle réussis.
- Edge réel sans interface visible, piloté par Playwright : 17 contrôles réussis, viewport ordinateur 1440 × 1000 et mobile 390 × 844. Ce dernier est un format mobile émulé, pas un appareil physique.
- Modules JavaScript : contrôles de syntaxe Node réussis.
- Chemin `/microduck_lab/lab/` : servi et testé localement avec ce préfixe ; aucun déploiement GitHub Pages effectué.
- Captures ordinateur/mobile examinées ; absence de débordement testée dans les trois modes sur mobile, navigation Tab/Maj+Tab autour de l’éditeur vérifiée.
- Préservation institutionnelle : empreintes du fichier avant/après identiques et contenu Git identique à `main`, dans `test-results/preservation.json`. Le fichier Windows est en CRLF, le blob Git en LF ; les empreintes du fichier prouvent la préservation de ses octets.

Les résultats détaillés sont conservés dans `test-results/browser.json` et `test-results/python.txt`. Les captures `desktop.png` et `mobile.png` restent locales et ignorées par Git.

## Difficultés et limites

L’environnement protégeait les métadonnées Git et l’accès réseau : création de branche et tests CDN ont nécessité l’exécution autorisée hors restriction. La première installation Playwright et le premier lancement navigateur restreints n’ont pas abouti ; les validations réussies sont celles exécutées ensuite avec accès réseau.

Mémoire sans quota dur ; Pyodide et sa passerelle JavaScript ne constituent pas un environnement pour code hostile. Premier chargement dépendant du réseau. Les tests valident les comportements des terrains proposés, pas l’explication écrite de l’élève ni tous les navigateurs. Les limites détaillées figurent dans `architecture.md`.

## Validation humaine attendue

Valider la difficulté des deux étapes, l’utilité des indices, la consigne de transfert, la taille du robot et la lisibilité en projection réelle. Tester avec des élèves, en particulier la saisie/indentation Python sur mobile. Aucune fusion ni publication n’est effectuée automatiquement.
