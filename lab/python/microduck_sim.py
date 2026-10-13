"""Deterministic grid simulation; no dependency on its graphical renderer."""
class ActionLimitError(Exception):
    pass

class CollisionError(Exception):
    pass

class Duck:
    DIRECTIONS = ((0, -1), (1, 0), (0, 1), (-1, 0))

    def __init__(self, terrain, limit=200):
        self.width, self.height = terrain['width'], terrain['height']
        self.x, self.y = terrain['start']
        self.heading = terrain.get('heading', 1)
        self.goal = tuple(terrain['goal'])
        self.obstacles = {tuple(p) for p in terrain['obstacles']}
        self.limit, self.actions, self.collisions = limit, 0, 0
        self.trace = [self.state()]

    def state(self):
        return {'x': self.x, 'y': self.y, 'heading': self.heading}

    def objectif_atteint(self):
        return (self.x, self.y) == self.goal

    def obstacle_devant(self):
        dx, dy = self.DIRECTIONS[self.heading]
        x, y = self.x + dx, self.y + dy
        return not (0 <= x < self.width and 0 <= y < self.height) or (x, y) in self.obstacles

    def _count(self):
        if self.actions >= self.limit:
            raise ActionLimitError(f'Limite de {self.limit} actions atteinte.')
        self.actions += 1

    def avancer(self):
        self._count()
        if self.obstacle_devant():
            self.collisions += 1
            raise CollisionError('Obstacle ou bord : déplacement impossible.')
        dx, dy = self.DIRECTIONS[self.heading]
        self.x, self.y = self.x + dx, self.y + dy
        self.trace.append(self.state())

    def tourner_gauche(self):
        self._count()
        self.heading = (self.heading - 1) % 4
        self.trace.append(self.state())

    def tourner_droite(self):
        self._count()
        self.heading = (self.heading + 1) % 4
        self.trace.append(self.state())
