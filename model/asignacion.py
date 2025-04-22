from model.requisito import Requisito
from typing import List, Dict, Tuple, Optional

class Asignacion:
    """Clase que representa una asignación de un requisito a un slot horario."""
    
    def __init__(self, requisito: Requisito, dia: str, periodo: str):
        self.requisito = requisito
        self.dia = dia
        self.periodo = periodo
        
    def __str__(self):
        return f"{self.dia} {self.periodo}: {self.requisito}"
    
    def __repr__(self):
        return self.__str__()