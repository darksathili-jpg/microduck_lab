// Learner-facing presentation only. No changes to contracts or assessment rules.
const presentations={
 s2:{objective:'Affecter un entier à une variable et utiliser for pour répéter une instruction.',
 constraints:'Affecter une valeur entière à distance et utiliser une boucle for pour réaliser le trajet. La boucle doit effectuer les déplacements : trois appels recopiés ne répondent pas à cette consigne. Aucun affichage avec print n’est demandé.',
 criteria:'Sur le terrain court : trois déplacements et arrivée en (3, 1), vers l’Est, sans erreur. Une affectation et une boucle for doivent contribuer au trajet. Le prolongement sur le terrain long et votre explication sont examinés séparément avec l’enseignant. Le bouton de lot essaie aussi le terrain long : son bilan d’arrivée ne remplace pas le contrôle courant sur le terrain court.',
 reflection:'Comparer la prévision et le trajet sur le terrain court, puis expliquer l’adaptation de distance sur le terrain long.'},
 a1:{objective:'Construire et renvoyer une liste de tuples dans une fonction avec paramètres, while et le capteur d’obstacle.',
 constraints:'Définir puis appeler une fonction avec paramètres et valeur de retour. Construire une liste de tuples avec append, utiliser while et lire duck.obstacle_devant(). Les positions doivent être calculées pendant le trajet, pas recopiées depuis les exemples.',
 criteria:'Sur les trois terrains : deux, quatre ou zéro déplacements, arrêt avant le blocage et liste conforme aux exemples, départ inclus. Les essais vérifient le trajet et l’affichage. L’enseignant examine la construction des positions, le rôle des paramètres et votre explication ; ces trois départs identiques ne suffisent pas à prouver tous les paramétrages.',
 reflection:'Comparer les listes prévues et obtenues. Expliquer pourquoi le départ reste présent même si aucun déplacement n’est possible.'},
 a2:{objective:'Écrire une recherche séquentielle avec for, une condition et un retour de fonction.',
 constraints:'Phase 1 : définir puis appeler chercher avec ses paramètres ; utiliser une boucle for, une condition if et return. Les parcours par indices et avec enumerate sont autorisés ; list.index est interdit. Phase 2 : joindre votre collecteur pour construire la liste à partir des déplacements et du capteur duck.obstacle_devant(). La recherche elle-même ne déplace pas le robot. Les constructions doivent contribuer au résultat.',
 criteria:'Phase 1 : vérifier les exemples de recherche avec l’enseignant, notamment liste vide, doublons et absence ; conserver la liste. Phase 2 : réaliser la collecte puis afficher les deux recherches attendues sur les trois terrains. Le contrôle robotique porte sur cette seconde phase et ses deux cibles ; il ne vérifie pas automatiquement tous les cas d’une recherche. Expliquer un nouveau cas avec l’enseignant.',
 reflection:'Phase 1 : comparer les retours aux exemples. Phase 2 : distinguer la collecte qui déplace le robot de la recherche qui analyse la liste.'}
};
export const pilotPresentation=activity=>presentations[activity?.id]||null;
