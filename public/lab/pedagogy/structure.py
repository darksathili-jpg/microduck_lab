"""Read-only Python AST diagnostics. Never executes the student's program.

Potentially useful syntax is evidence to inspect, never proof of actual use.
The simulator, its Worker, and authoritative transition ledger are untouched.
"""
import ast

LABELS = {
    'for': 'boucle for', 'while': 'boucle while', 'if': 'instruction if',
    'ifelse': 'alternative if/else', 'sensor': 'lecture de obstacle_devant()',
    'not': 'négation not', 'assign': 'affectation', 'function': 'définition et appel de fonction',
    'parameter': 'paramètre de fonction', 'return': 'valeur de retour',
    'list': 'construction de liste', 'index': 'accès par indice ou clé',
    'dict': 'construction de dictionnaire', 'tuple': 'tuple',
    'append': 'ajout avec append', 'dictwrite': 'écriture par clé',
    'collection': 'parcours de collection',
    'assert': 'assertion de contrat ou de test',
    'global': 'déclaration global', 'indexmethod': 'appel de la méthode .index()',
}

def analyze(code, required, forbidden=()):
    try:
        tree = ast.parse(code, filename='<eleve>')
    except SyntaxError as error:
        return {'status': 'FAIL', 'reasons': [f'Syntaxe Python invalide, ligne {error.lineno}.'], 'observed': [], 'competence': 'BLOCKED'}
    functions = {n.name: n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)}
    nodes, visited = [], set()
    def walk(node):
        nodes.append(node)
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
            return
        if isinstance(node, ast.If) and isinstance(node.test, ast.Constant):
            walk(node.test)
            for child in node.body if node.test.value else node.orelse:
                walk(child)
            return
        if isinstance(node, ast.While) and isinstance(node.test, ast.Constant) and not node.test.value:
            for child in node.orelse:
                walk(child)
            return
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            name = node.func.id
            if name in functions and name not in visited:
                visited.add(name)
                for child in functions[name].body:
                    walk(child)
                    if isinstance(child, (ast.Return, ast.Raise)):
                        break
        # The code following an unconditional return/raise/break is unreachable.
        for _, value in ast.iter_fields(node):
            if isinstance(value, list):
                for child in value:
                    if isinstance(child, ast.AST):
                        walk(child)
                        if isinstance(child, (ast.Return, ast.Raise, ast.Break, ast.Continue)):
                            break
            elif isinstance(value, ast.AST):
                walk(value)
    walk(tree)
    has = lambda typ: any(isinstance(n, typ) for n in nodes)
    method = lambda name: any(isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr == name for n in nodes)
    constructor = lambda name: any(isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == name for n in nodes)
    sensor_aliases = {target.id for n in nodes if isinstance(n, ast.Assign) and isinstance(n.value, ast.Attribute) and isinstance(n.value.value, ast.Name) and n.value.value.id == 'duck' and n.value.attr == 'obstacle_devant' for target in n.targets if isinstance(target, ast.Name)}
    seen = {
        'for': has(ast.For), 'while': has(ast.While), 'if': has(ast.If),
        'ifelse': any(isinstance(n, ast.If) and n.orelse for n in nodes),
        'sensor': any(isinstance(n, ast.Call) and ((isinstance(n.func, ast.Attribute) and isinstance(n.func.value, ast.Name) and n.func.value.id == 'duck' and n.func.attr == 'obstacle_devant') or (isinstance(n.func, ast.Name) and n.func.id in sensor_aliases)) for n in nodes),
        'not': any(isinstance(n, ast.UnaryOp) and isinstance(n.op, ast.Not) for n in nodes),
        'assign': has((ast.Assign, ast.AnnAssign)), 'function': bool(visited),
        'parameter': any(functions[name].args.args for name in visited),
        'return': any(isinstance(n, ast.Return) and n.value is not None for n in nodes),
        'list': has((ast.List, ast.ListComp)) or constructor('list'),
        'dict': has((ast.Dict, ast.DictComp)) or constructor('dict'),
        'tuple': has(ast.Tuple) or constructor('tuple'), 'index': has(ast.Subscript),
        'append': method('append'),
        'dictwrite': any(isinstance(n, ast.Subscript) and isinstance(n.ctx, ast.Store) for n in nodes),
        'collection': has((ast.For, ast.ListComp, ast.DictComp, ast.GeneratorExp)),
        'assert': has(ast.Assert),
    }
    # Forbidden syntax is checked in the complete tree, including dead branches.
    all_nodes = list(ast.walk(tree))
    banned_types = {'for': ast.For, 'while': ast.While, 'global': ast.Global}
    reasons = [f'{LABELS.get(key, key)} : non démontré dans le code analysable.' for key in required if not seen.get(key, False)]
    reasons += [f'{LABELS.get(key, key)} : construction interdite dans cet exercice.' for key in forbidden if key in banned_types if any(isinstance(n, banned_types[key]) for n in all_nodes)]
    if 'indexmethod' in forbidden and any(isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr == 'index' for n in all_nodes):
        reasons.append('appel de la méthode .index() : interdit dans cet exercice ; écrire la recherche demandée.')
    status = 'FAIL' if reasons else 'BLOCKED' if required or not forbidden else 'PASS'
    if status == 'BLOCKED':
        reasons.append('Constructions repérées ; leur utilisation effective et pertinente reste à vérifier par l’enseignant. Une présence AST ne suffit pas.' if required else 'Choix des constructions libre ; stratégie à justifier avec l’enseignant, sans certification automatique.')
    if status == 'PASS':
        reasons.append('Aucune construction interdite repérée ; la pertinence et la compréhension restent à apprécier.')
    return {'status': status, 'reasons': reasons, 'observed': [key for key, found in seen.items() if found], 'competence': 'BLOCKED'}
