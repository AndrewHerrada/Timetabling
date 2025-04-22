import datetime
import random
import copy
from typing import List, Dict, Set, Tuple, Optional
class Sala:
    """Clase que representa una sala/aula."""
    
    def __init__(self, sala_id: str):
        self.sala_id = sala_id
        
    def __str__(self):
        return self.sala_id
    
    def __repr__(self):
        return self.__str__()
    
    def __eq__(self, other):
        if not isinstance(other, Sala):
            return False
        return self.sala_id == other.sala_id
    
    def __hash__(self):
        return hash(self.sala_id)