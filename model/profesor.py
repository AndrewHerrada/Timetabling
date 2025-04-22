import datetime
import random
import copy
from typing import List, Dict, Set, Tuple, Optional


class Profesor:
    """Clase que representa a un profesor."""
    
    def __init__(self, profesor_id: int, nombre: str = None):
        self.profesor_id = profesor_id
        self.nombre = nombre if nombre else f"Profesor {profesor_id}"
        
    def __str__(self):
        return self.nombre
    
    def __repr__(self):
        return self.__str__()
    
    def __eq__(self, other):
        if not isinstance(other, Profesor):
            return False
        return self.profesor_id == other.profesor_id
    
    def __hash__(self):
        return hash(self.profesor_id)