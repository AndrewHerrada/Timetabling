import datetime
import random
import copy
from typing import List, Dict, Set, Tuple, Optional

class Curso:
    """Clase que representa un curso/grupo."""
    
    def __init__(self, curso_id: str):
        self.curso_id = curso_id
        
    def __str__(self):
        return self.curso_id
    
    def __repr__(self):
        return self.__str__()
    
    def __eq__(self, other):
        if not isinstance(other, Curso):
            return False
        return self.curso_id == other.curso_id
    
    def __hash__(self):
        return hash(self.curso_id)