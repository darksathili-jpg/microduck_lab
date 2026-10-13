# Jalon 1 — architecture et limites

La présentation institutionnelle reste dans `index.html`, sans modification ni dépendance sur le laboratoire. Le laboratoire est statique et utilise des chemins relatifs compatibles avec `/microduck_lab/lab/`.

Le Worker module charge Pyodide 0.27.7 depuis jsDelivr et le modèle local `lab/python/microduck_sim.py`. Le programme élève est compilé et exécuté par Python, sans filtre AST. Chaque exécution reçoit un nouveau Duck, une nouvelle sortie et un nouveau dictionnaire de variables. Les imports Python peuvent néanmoins conserver leur état dans le runtime : ce n’est pas un environnement hermétique entre programmes malveillants.

Le modèle Python détermine déplacements, collisions, capteurs, traces et état final. La vue JavaScript restitue cette trace ; elle ne décide pas du mouvement. La réussite comportementale exige l’arrivée sur la cible sans collision et sans erreur. Les tests rejouent le même code sur chaque terrain de l’étape, avec un monde réinitialisé. Ils ne recherchent pas de mots-clés et ne prouvent pas que l’élève a compris ou utilisé une construction donnée.

Les identifiants de requête et de session empêchent les réponses et animations anciennes de modifier une nouvelle exécution. Une seule exécution est autorisée à la fois. Changer d’étape ou de terrain réinitialise l’affichage et les résultats, pas le code.

## Limites garanties dans l’usage prévu

- 200 commandes de mouvement/rotation par terrain, avec une exception dédiée.
- 8 000 caractères de stdout/stderr capturés, avec une exception si dépassement.
- 64 000 caractères de code avant envoi au Worker.
- 5 secondes d’exécution par terrain, mesurées dans le fil principal.
- 60 secondes pour initialiser Python, avec possibilité de réessayer.
- Stop détruit le Worker et en crée un nouveau ; il annule aussi la restitution graphique.

## Limites techniques

Un Worker isole le calcul de l’interface, pas les permissions réseau. Ce laboratoire n’est pas un bac à sable pour du code hostile : les programmes ont accès aux possibilités de Pyodide, peuvent modifier les objets Python, contourner des limites logicielles ou consommer beaucoup de mémoire. Il n’existe ici aucun quota mémoire dur. Une allocation brutale peut affecter le navigateur avant que le délai ne soit appliqué. Les temporisations dépendent de l’ordonnancement du navigateur, notamment en arrière-plan. La terminaison du Worker libère son contexte mais le moment exact de récupération mémoire appartient au navigateur.

Les capteurs sont discrets et parfaits. La simulation ne reproduit ni mécanique, ni bruit, ni temps moteur. Aucune compatibilité physique n’est annoncée. Une éventuelle future API matérielle nécessitera une validation technique distincte.

## Réseau et données

Le premier chargement nécessite le CDN ; aucune disponibilité hors ligne n’est garantie. Aucun service worker, compte, analytique ou serveur applicatif n’est ajouté. Code, prévision, thème et réussite locale sont enregistrés dans `localStorage` sous `microduck.lab.jalon1.v1`. L’utilisateur peut effacer cette sauvegarde. La prévision rédigée n’est pas évaluée automatiquement. Les réussites locales sont indicatives et modifiables par l’utilisateur.
