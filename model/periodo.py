import datetime
import random
import copy
from typing import List, Dict, Set, Tuple, Optional

class Periodo:
    """Clase que representa un periodo horario."""
    
    def __init__(self, periodo_id: str, hora_inicio: str, hora_fin: str):
        self.periodo_id = periodo_id
        self.hora_inicio = hora_inicio
        self.hora_fin = hora_fin
        
    def __str__(self):
        return f"{self.periodo_id}: {self.hora_inicio}-{self.hora_fin}"
    
    def __repr__(self):
        return self.__str__()