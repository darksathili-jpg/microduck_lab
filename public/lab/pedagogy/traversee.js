// Pedagogical content only. Existing mission files remain authoritative for worlds.
export const activities=[
 {id:'s1',title:'1 · Ordonner les instructions',stage:'depart',terrain:'court',minutes:15,
  prerequisites:'Lire (x, y) et le cap Est ; une commande se termine par ().',
  course:'Python exécute les instructions dans leur ordre. duck.avancer() demande une case dans le cap actuel ; une rotation change le cap sans changer de case. Les coordonnées affichées indiquent la dernière case achevée, pas une distance physique.',
  prediction:'Depuis (0, 1) vers (3, 1), annonce le nombre de commandes et la position après chacune.',
  task:'A. Prévois le trajet. B. Écris trois instructions successives pour atteindre l’étoile, sans boucle. Exécute puis compare à ta prévision.',
  explain:'Justifie l’ordre des instructions. Quelle différence entre tourner et avancer ? Une arrivée suffit-elle à prouver que tu as compris ?',
  hints:['Compte les intervalles entre départ et cible, pas les cases occupées.','Une commande avancer change une seule coordonnée d’une unité dans le cap actuel.','Écris trois appels duck.avancer(), chacun sur sa propre ligne.'],cases:{court:{x:3,actions:3}},starter:'# Écris tes trois commandes ici.\n'},
 {id:'s2',title:'2 · Répéter avec for',stage:'depart',terrain:'court',minutes:25,
  prerequisites:'S1 ; entier, affectation et indentation de quatre espaces.',
  course:'distance = 2 affecte l’entier 2 au nom distance ; ce n’est pas un test d’égalité. for i in range(distance): répète le bloc indenté distance fois. range(3) donne 0, 1, 2 : trois valeurs. La borne finale est exclue. Si distance vaut zéro, le bloc ne s’exécute pas.',
  prediction:'Prévois les valeurs de i, le nombre de pas et la position finale pour distance = 3, puis distance = 0.',
  task:'A. Compare la répétition à S1. B. Affecte distance et écris une boucle sur le terrain court. Essaie ensuite le terrain long, observe l’échec attendu du nombre fixe et adapte la distance : le but est d’expliquer cette limite, pas de réussir les deux avec la même constante.',
  explain:'Explique pourquoi range(3) ne fait pas quatre pas. Pourquoi faut-il changer la distance sur le terrain long ?',
  hints:['Quelle opération se répète ? Quelle quantité connaît-on avant de partir ?','Sépare le nombre de pas du bloc répété. Affecte ce nombre avant la boucle.','Affecte distance = 3 pour le court ; utilise for i in range(distance): puis indente la commande de déplacement.'],cases:{court:{x:3,actions:3}},starter:'# Affecte la distance avant de construire la boucle.\n'},
 {id:'s3',title:'3 · Diagnostiquer un pas de trop',stage:'depart',terrain:'court',minutes:20,
  prerequisites:'S2 ; lire la console et la trace, distinguer erreur Python et objectif non atteint.',
  course:'Un programme peut être valide en Python et ne pas répondre au problème. La console distingue erreur de syntaxe, exception et résultat non attendu. Un test qui passe ne prouve pas tous les cas. Pour corriger : prévoir, reproduire, localiser, changer une cause puis réessayer.',
  prediction:'Que donnera le programme proposé ? Python signalera-t-il une exception, ou seulement une arrivée manquée ?',
  task:'A. Prévois avant de préparer le code volontairement incorrect. B. Exécute range(4) sur le court et explique le résultat. Corrige le décalage. Essaie aussi distance non définie puis corrige son affectation ; conserve le diagnostic, pas seulement la version finale.',
  explain:'Note la cause, la ligne ou la valeur changée, et pourquoi la correction répond au problème. Distingue NameError et quatre pas valides.',
  hints:['Compare nombre d’itérations et distance à l’étoile.','La dernière valeur de range(n) est n−1, mais il y a n valeurs.','Sur le court, remplace le nombre de répétitions par le nombre de déplacements nécessaires ; définis distance avant son utilisation.'],cases:{court:{x:3,actions:3}},starter:'for i in range(4):\n    duck.avancer()\n'},
 {id:'s4',title:'4 · S’arrêter avec le capteur',stage:'capteurs',terrain:'mur',minutes:35,
  prerequisites:'S2/S3 ; True, False et négation not.',
  course:'duck.obstacle_devant() renvoie un booléen sans déplacer le robot. Un bord compte comme un obstacle. not True vaut False et not False vaut True. while condition: teste avant chaque itération ; si la condition est fausse au départ, zéro pas. Une boucle sans condition d’arrêt adaptée peut ne jamais terminer.',
  prediction:'Sur mur, puis zéro : capteur avant le premier pas, valeur de not capteur, décision et nombre de pas attendus. Fais une petite table avant/après.',
  task:'A. Prévois le cas déjà bloqué. B. Écris un même programme qui avance tant que la case devant est libre, puis teste les quatre terrains révélés sans changer le code. Compare les résultats au nombre de cases libres. La réussite sur un seul terrain ne suffit pas.',
  explain:'Pourquoi tester avant de bouger ? Quel nombre diminue à chaque pas sur ces lignes finies ? Une boucle utilisant seulement objectif_atteint peut aussi réussir : cela prouve-t-il l’usage du capteur ?',
  hints:['Quelle observation permet de décider de continuer avant un pas ?','Construis la table du booléen observé et de sa négation ; quelle valeur autorise la marche ?','Utilise while avec not duck.obstacle_devant(): et un appel avancer indenté. Explique le cas zéro avant de copier cette syntaxe.'],cases:{mur:{x:2,actions:2},'mur-loin':{x:6,actions:6},bord:{x:4,actions:4},zero:{x:0,actions:0}},starter:'# Observe, puis décide si un nouveau pas est autorisé.\n'},
 {id:'s5',title:'5 · Choisir une réponse avec if',stage:'capteurs',terrain:'zero',minutes:20,
  prerequisites:'S4 ; chaîne de caractères et print().',
  course:'if condition: exécute un bloc si la condition est vraie ; else: exécute l’autre bloc. Un capteur retourne une valeur, print affiche une valeur, avancer est une action. Lire ou afficher le capteur ne doit pas déplacer le robot.',
  prediction:'Que doit-on afficher au départ sur zéro, puis sur mur ? Le robot doit-il bouger dans cet exercice ?',
  task:'B. Sans déplacement, affiche exactement bloque si un obstacle est devant, sinon libre. Teste zéro puis mur avec le même code. Ici le critère de l’exercice est la sortie et l’absence de mouvement ; atteindre l’étoile n’est pas demandé. La console d’arrivée de la mission reste distincte.',
  explain:'Explique les deux branches et le type de retour du capteur. Compare if avec while : décision unique ou répétition ?',
  hints:['Décris les deux situations possibles et leur message avant de chercher la syntaxe.','Une seule observation booléenne choisit un des deux blocs.','Écris if duck.obstacle_devant(): puis print("bloque") indenté ; ajoute else: et le message libre.'],cases:{zero:{x:0,actions:0,output:'bloque'},mur:{x:0,actions:0,output:'libre'}},starter:'# Observe et affiche un message ; ne déplace pas le robot.\n'},
 {id:'s6',title:'6 · Construire une fonction simple',stage:'depart',terrain:'court',minutes:25,
  prerequisites:'S2/S3 ; distinguer définir et appeler une fonction.',
  course:'def nom(parametre): définit un bloc réutilisable ; il ne s’exécute qu’à l’appel. Le paramètre reçoit la valeur de l’argument. return renvoie une valeur et termine l’appel ; print l’affiche. Sans return explicite, une fonction renvoie None. Exemple de contrat : avancer_n(n), n entier positif ou nul, n cases libres devant ; après l’appel, n pas effectués et entier n renvoyé.',
  prediction:'Combien de pas avant l’appel ? Et pour n=0 ? Quelle différence entre la valeur renvoyée et son affichage ?',
  task:'B. Écris avancer_n(n), qui utilise une boucle, avance n fois et renvoie n. Sur le court, appelle-la avec 3 et affiche son résultat. Après reset, vérifie volontairement n=0 puis n=2 en adaptant l’appel ; explique le contrat. Ne tente pas un n dépassant l’espace libre.',
  explain:'Montre le paramètre, l’argument, le corps, le retour et l’appel. Les tests d’arrivée ne prouvent pas que tu as écrit une fonction : l’enseignant examine la réutilisation et les cas 0/2.',
  hints:['Quelle partie du programme dépend du nombre choisi à chaque appel ?','Distingue définition, répétition interne, retour et appel final.','Place for i in range(n): dans def avancer_n(n): ; indente le déplacement, puis renvoie n après la boucle. L’appel et print sont hors de la définition.'],cases:{court:{counts:[0,2,3]}},starter:'# Définis ta fonction, puis appelle-la et affiche son retour.\n'},
 {id:'transfert',title:'7 · Réinvestir et expliquer',stage:'capteurs',terrain:'mur',minutes:20,
  prerequisites:'S4 ; prévoir sans exécuter et justifier une généralisation.',
  course:'Un transfert utilise une situation non montrée pendant l’entraînement. On distingue une stratégie générale d’une adaptation à un trajet mémorisé. Il faut annoncer les hypothèses : départ orienté, obstacle ou bord devant le but, chemin en ligne droite.',
  prediction:'Avant le premier essai sur le terrain révélé, annonce capteur initial, nombre de pas et position finale. Explique ce qui reste valable malgré le changement.',
  task:'C. À la demande de l’enseignant, utilise le bouton de transfert existant en bas de page. Ne recopie pas mécaniquement : justifie si ta stratégie générale convient, puis exécute. D. Compare prévision, comportement et explication. L’enseignant peut demander une autre justification sans indices.',
  explain:'Pourquoi la solution dépend-elle de l’observation et non du nombre de cases ou d’un cap Est supposé ? Que changerait une cible avant le mur plutôt que juste devant ?',
  hints:['Vérifie les hypothèses de ta stratégie, pas seulement la longueur.','Distingue le cap courant et le déplacement relatif devant soi.','Reprends ta condition d’arrêt en mots ; l’enseignant décide de l’aide syntaxique en évaluation.'],cases:{'evaluation-ouest':{goal:true}},starter:null}
];

export function assess(activity,terrainId,result){
  const expected=activity.cases[terrainId];if(!expected)return {applicable:false};
  const last=result.trace?.at(-1);
  if(expected.counts){const n=Number(result.output?.trim());return {applicable:true,pass:result.kind==='ok'&&expected.counts.includes(n)&&result.output?.trim()===String(n)&&last?.x===n&&last.y===1&&last.heading===1&&result.actions===n};}
  const pass=result.kind==='ok'&&!!last&&(expected.goal?result.success:
    last.x===expected.x&&last.y===1&&last.heading===1&&result.actions===expected.actions&&
    (expected.output===undefined||result.output?.trim()===expected.output));
  return {applicable:true,pass};
}
