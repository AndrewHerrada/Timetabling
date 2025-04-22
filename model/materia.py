import datetime
import random
import copy
from typing import List, Dict, Set, Tuple, Optional

class Materia:
    """Clase que representa una materia."""
    
    def __init__(self, materia_id: str, nombre: str, tipo: str, clase_compartida: str,
                 frecuencia_semanal: int, duracion_sesion: int, horas_semanales: int):
        self.materia_id = materia_id
        self.nombre = nombre
        self.tipo = tipo  # Regular, Orquestal, etc.
        self.clase_compartida = clase_compartida  # Individual o nombre de clase compartida
        self.frecuencia_semanal = frecuencia_semanal
        self.duracion_sesion = duracion_sesion
        self.horas_semanales = horas_semanales
        
    def es_compartida(self) -> bool:
        """Determina si la materia es compartida o individual."""
        return self.clase_compartida != "Individual"
    
    def __str__(self):
        return f"{self.nombre} ({self.materia_id})"
    
    def __repr__(self):
        return self.__str__()
    
    def __eq__(self, other):
        if not isinstance(other, Materia):
            return False
        return self.materia_id == other.materia_id
    
    def __hash__(self):
        return hash(self.materia_id)