import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'lab' / 'python'))
from microduck_sim import Duck, CollisionError, ActionLimitError

class SimulationTests(unittest.TestCase):
    def terrain(self):
        return dict(width=4, height=3, start=[0, 1], goal=[2, 1], heading=1, obstacles=[[3, 1]])

    def test_actual_python_functions_variables(self):
        duck = Duck(self.terrain())
        exec('def parcourir(n):\n    for k in range(n):\n        duck.avancer()\ndistance = 1 + 1\nparcourir(distance)', {'duck': duck})
        self.assertTrue(duck.objectif_atteint())
        self.assertEqual(len(duck.trace), 3)

    def test_collision_and_sensor(self):
        duck = Duck(self.terrain())
        self.assertFalse(duck.obstacle_devant())
        duck.avancer(); duck.avancer()
        self.assertTrue(duck.obstacle_devant())
        with self.assertRaises(CollisionError): duck.avancer()
        self.assertEqual((duck.x, duck.y), (2, 1))
        self.assertEqual(duck.collisions, 1)

    def test_border_and_turns(self):
        duck = Duck(self.terrain())
        duck.tourner_gauche(); duck.avancer()
        self.assertTrue(duck.obstacle_devant())
        duck.tourner_droite()
        self.assertEqual(duck.heading, 1)

    def test_limit(self):
        duck = Duck(self.terrain(), limit=2)
        duck.tourner_droite(); duck.tourner_gauche()
        with self.assertRaises(ActionLimitError): duck.avancer()

    def test_all_terrains_and_reproducibility(self):
        import json
        mission = json.loads((Path(__file__).resolve().parents[1] / 'lab/missions/traversee.json').read_text(encoding='utf-8'))
        for terrain in mission['stages'][1]['terrains']:
            traces = []
            for _ in range(2):
                duck = Duck(terrain)
                exec('while not duck.obstacle_devant():\n    duck.avancer()', {'duck': duck})
                self.assertTrue(duck.objectif_atteint())
                traces.append(duck.trace)
            self.assertEqual(*traces)

if __name__ == '__main__': unittest.main()
