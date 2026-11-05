"""Public educational API: commands and boolean sensors, no mutable model state.
The JS bridge owns the independent ledger. This is not a security sandbox.
"""
import _duck_bridge as _bridge

class DuckAPI:
    __slots__ = ()

    def avancer(self):
        _bridge.action('avancer')

    def tourner_gauche(self):
        _bridge.action('tourner_gauche')

    def tourner_droite(self):
        _bridge.action('tourner_droite')

    def obstacle_devant(self):
        return bool(_bridge.obstacle())

    def objectif_atteint(self):
        return bool(_bridge.goal())
