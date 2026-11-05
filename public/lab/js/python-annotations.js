// Exact compatibility annotations for protected metadata and historical dossiers.
// Each pair preserves its complete plain text; no generic recognition at runtime.
export const legacyAnnotations=new Map([
  [
    "Autoriser un déplacement avec if",
    "Autoriser un déplacement avec `if`"
  ],
  [
    "Avec if, autoriser un unique pas seulement si la case devant est libre. Sinon ne rien déplacer.",
    "Avec `if`, autoriser un unique pas seulement si la case devant est libre. Sinon ne rien déplacer."
  ],
  [
    "E1 ; if et indentation.",
    "E1 ; `if` et indentation."
  ],
  [
    "Une condition if choisit si son bloc est exécuté une fois. Une boucle répéterait le test. Pour autoriser un pas, il faut un chemin libre, donc une observation fausse. La négation rend cette condition lisible.",
    "Une condition `if` choisit si son bloc est exécuté une fois. Une boucle répéterait le test. Pour autoriser un pas, il faut un chemin libre, donc une observation fausse. La négation rend cette condition lisible."
  ],
  [
    "Explique pourquoi if suffit ici et pourquoi avancer avant de tester provoquerait une collision sur bloqué.",
    "Explique pourquoi `if` suffit ici et pourquoi avancer avant de tester provoquerait une collision sur bloqué."
  ],
  [
    "Place l’appel avancer dans un bloc if not duck.obstacle_devant():.",
    "Place l’appel avancer dans un bloc `if` `not` `duck.obstacle_devant()`:."
  ],
  [
    "Spécifie des fonctions, vérifie leurs contrats avec assert et distingue variable locale, variable globale, valeur renvoyée et comportement du robot.",
    "Spécifie des fonctions, vérifie leurs contrats avec `assert` et distingue variable locale, variable globale, valeur renvoyée et comportement du robot."
  ],
  [
    "Expliquer if et while, le choix rotation/déplacement et le cas zéro sur ces terrains bornés.",
    "Expliquer `if` et `while`, le choix rotation/déplacement et le cas zéro sur ces terrains bornés."
  ],
  [
    "Écrire une recherche de première occurrence et justifier la sentinelle -1.",
    "Écrire une recherche de première occurrence et justifier la sentinelle `-1`."
  ],
  [
    "Une boucle for peut répéter une commande. range(n) produit n itérations.",
    "Une boucle `for` peut répéter une commande. `range(n)` produit `n` itérations."
  ],
  [
    "Affecte d’abord le nombre de pas à distance (exemple : distance = 3 sur le terrain court), puis répète duck.avancer() avec for i in range(distance): et une indentation de quatre espaces.",
    "Affecte d’abord le nombre de pas à `distance` (exemple : `distance = 3` sur le terrain court), puis répète `duck.avancer()` avec `for i in range(distance):` et une indentation de quatre espaces."
  ],
  [
    "Une boucle while peut continuer tant que le chemin est libre. Pense à not.",
    "Une boucle `while` peut continuer tant que le chemin est libre. Pense à `not`."
  ],
  [
    "Répète duck.avancer() tant que not duck.obstacle_devant(). Explique pourquoi le robot s’arrête.",
    "Répète `duck.avancer()` tant que `not` `duck.obstacle_devant()`. Explique pourquoi le robot s’arrête."
  ],
  [
    "Affectation et boucle bornée for",
    "Affectation et boucle bornée `for`"
  ],
  [
    "Affecter un entier à une variable et utiliser for pour répéter une instruction.",
    "Affecter un entier à une variable et utiliser `for` pour répéter une instruction."
  ],
  [
    "Affecter une valeur entière à distance et utiliser une boucle for pour réaliser le trajet. La boucle doit effectuer les déplacements : trois appels recopiés ne répondent pas à cette consigne. Aucun affichage avec print n’est demandé.",
    "Affecter une valeur entière à `distance` et utiliser une boucle `for` pour réaliser le trajet. La boucle doit effectuer les déplacements : trois appels recopiés ne répondent pas à cette consigne. Aucun affichage avec `print` n’est demandé."
  ],
  [
    "Sur le terrain court : trois déplacements et arrivée en (3, 1), vers l’Est, sans erreur. Une affectation et une boucle for doivent contribuer au trajet. Le prolongement sur le terrain long et votre explication sont examinés séparément avec l’enseignant. Le bouton de lot essaie aussi le terrain long : son bilan d’arrivée ne remplace pas le contrôle courant sur le terrain court.",
    "Sur le terrain court : trois déplacements et arrivée en `(3, 1)`, vers l’Est, sans erreur. Une affectation et une boucle `for` doivent contribuer au trajet. Le prolongement sur le terrain long et votre explication sont examinés séparément avec l’enseignant. Le bouton de lot essaie aussi le terrain long : son bilan d’arrivée ne remplace pas le contrôle courant sur le terrain court."
  ],
  [
    "Boucle while et capteur booléen",
    "Boucle `while` et capteur booléen"
  ],
  [
    "Alternative if/else",
    "Alternative `if`/`else`"
  ],
  [
    "Une condition if peut autoriser un déplacement lorsque le capteur est faux.",
    "Une condition `if` peut autoriser un déplacement lorsque le capteur est faux."
  ],
  [
    "Affectation, booléen et not",
    "Affectation, booléen et `not`"
  ],
  [
    "Le premier indice est 0 ; le dernier vaut len(liste) − 1.",
    "Le premier indice est `0` ; le dernier vaut `len(liste)` − `1`."
  ],
  [
    "append ajoute une observation à la fin ; le capteur ne déplace pas le robot.",
    "`append` ajoute une observation à la fin ; le capteur ne déplace pas le robot."
  ],
  [
    "Enregistre avant chaque déplacement et n’oublie pas l’observation True qui termine le parcours.",
    "Enregistre avant chaque déplacement et n’oublie pas l’observation `True` qui termine le parcours."
  ],
  [
    "Liste, append, while et retour",
    "Liste, `append`, `while` et retour"
  ],
  [
    "Enregistrer le booléen du capteur à chaque case parcourue, avec une clé tuple (x, y). Sur les terrains d’entraînement, partir de (0, 1) vers l’Est.",
    "Enregistrer le booléen du capteur à chaque case parcourue, avec une clé tuple `(x, y)`. Sur les terrains d’entraînement, partir de `(0, 1)` vers l’Est."
  ],
  [
    "TypeError, tuple et accès par clé",
    "`TypeError`, tuple et accès par clé"
  ],
  [
    "Précondition, postcondition et assert",
    "Précondition, postcondition et `assert`"
  ],
  [
    "Fonction paramétrée, for et assertions",
    "Fonction paramétrée, `for` et assertions"
  ],
  [
    "Une liste de n déplacements contient n + 1 cases si le départ est inclus.",
    "Une liste de `n` déplacements contient `n + 1` cases si le départ est inclus."
  ],
  [
    "Construire et renvoyer une liste de tuples dans une fonction avec paramètres, while et le capteur d’obstacle.",
    "Construire et renvoyer une liste de tuples dans une fonction avec paramètres, `while` et le capteur d’obstacle."
  ],
  [
    "Définir puis appeler une fonction avec paramètres et valeur de retour. Construire une liste de tuples avec append, utiliser while et lire duck.obstacle_devant(). Les positions doivent être calculées pendant le trajet, pas recopiées depuis les exemples.",
    "Définir puis appeler une fonction avec paramètres et valeur de retour. Construire une liste de tuples avec `append`, utiliser `while` et lire `duck.obstacle_devant()`. Les positions doivent être calculées pendant le trajet, pas recopiées depuis les exemples."
  ],
  [
    "Écrire une recherche séquentielle avec for, une condition et un retour de fonction.",
    "Écrire une recherche séquentielle avec `for`, une condition et un retour de fonction."
  ],
  [
    "Phase 1 : définir puis appeler chercher avec ses paramètres ; utiliser une boucle for, une condition if et return. Les parcours par indices et avec enumerate sont autorisés ; list.index est interdit. Phase 2 : joindre votre collecteur pour construire la liste à partir des déplacements et du capteur duck.obstacle_devant(). La recherche elle-même ne déplace pas le robot. Les constructions doivent contribuer au résultat.",
    "Phase 1 : définir puis appeler `chercher` avec ses paramètres ; utiliser une boucle `for`, une condition `if` et `return`. Les parcours par indices et avec `enumerate` sont autorisés ; `list.index` est interdit. Phase 2 : joindre votre collecteur pour construire la liste à partir des déplacements et du capteur `duck.obstacle_devant()`. La recherche elle-même ne déplace pas le robot. Les constructions doivent contribuer au résultat."
  ],
  [
    "Comparer la prévision et le trajet sur le terrain court, puis expliquer l’adaptation de distance sur le terrain long.",
    "Comparer la prévision et le trajet sur le terrain court, puis expliquer l’adaptation de `distance` sur le terrain long."
  ],
  [
    "Le capteur obstacle_devant() renvoie un booléen. Un bord compte comme un obstacle.",
    "Le capteur `obstacle_devant()` renvoie un booléen. Un bord compte comme un obstacle."
  ],
  [
    "Utilise des tuples d’entiers comme clés, puis parcours items() pour lire clés et valeurs.",
    "Utilise des tuples d’entiers comme clés, puis parcours `items()` pour lire clés et valeurs."
  ],
  [
    "Trois appels successifs à duck.avancer(), sans boucle.",
    "Trois appels successifs à `duck.avancer()`, sans boucle."
  ],
  [
    "Initialiser la variable locale compte dans avancer_n.",
    "Initialiser la variable locale `compte` dans `avancer_n`."
  ],
  [
    "Incrémenter compte après chaque déplacement.",
    "Incrémenter `compte` après chaque déplacement."
  ],
  [
    "Renvoyer la valeur du compteur local avec return ; renvoyer n ne démontre pas ce travail.",
    "Renvoyer la valeur du compteur local avec `return` ; renvoyer `n` ne démontre pas ce travail."
  ],
  [
    "Expliquer pourquoi la variable globale compte reste à 99 ; conserver les assertions.",
    "Expliquer pourquoi la variable globale `compte` reste à `99` ; conserver les assertions."
  ],
  [
    "Comparer réellement chaque position à la cible et compter ces comparaisons.",
    "Comparer réellement chaque position à la cible et compter ces comparaisons."
  ],
  [
    "Terrain de prolongement : comparer avec la prévision puis adapter distance. Le contrôle courant de cet exercice porte sur le terrain court.",
    "Terrain de prolongement : comparer avec la prévision puis adapter `distance`. Le contrôle courant de cet exercice porte sur le terrain court."
  ]
]);
