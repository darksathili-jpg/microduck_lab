# microduck_lab
MICRODUCK LAB réunit Python, simulation 3D, résolution de problèmes et robotique pour les élèves de Première et Terminale NSI.

## Deux applications indépendantes

- `index.html` : présentation institutionnelle destinée à la direction du lycée Watteau ; conservée intégralement.
- `lab/index.html` : laboratoire pédagogique, jalon 1 « La traversée », Première NSI. Python réel via Pyodide dans un Worker ; simulation 2D déterministe.

## Essayer le laboratoire

Avec Node.js 22 et un accès Internet : `npm run serve`, puis ouvrir http://127.0.0.1:4173/microduck_lab/lab/ dans un navigateur récent. Aucun build n’est nécessaire. Sur mobile, un hébergement statique HTTPS permet de servir le même dossier `lab/` ; la publication GitHub Pages reste à valider séparément.

## Vérifier

`npm test` exécute les tests du modèle avec Python 3. `npm ci`, puis `npm run test:e2e` exécutent les tests dans Edge installé au chemin Windows configuré dans `tests/browser.mjs`. Le serveur doit tourner sur le port 4173. Les résultats navigateur sont conservés dans `test-results/browser.json` ; les captures locales dans `test-results/desktop.png` et `mobile.png`.

Voir `docs/architecture.md` pour les limites réseau, mémoire et isolation ; `docs/progression-nsi.md` pour la progression et les éléments à valider par l’enseignant. Le laboratoire ne commande aucun robot physique.
