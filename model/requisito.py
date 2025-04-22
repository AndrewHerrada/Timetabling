import datetime
import random
import copy
from typing import List, Dict, Set, Tuple, Optional
from model.profesor import Profesor
from model.sala import Sala
from model.curso import Curso
from model.materia import Materia
from model.periodo import Periodo

class Requisito:
    """
    Clase que representa un requisito de clase.
    Un requisito es una combinación de materia, profesor, sala y curso.
    """
    
    def __init__(self, requisito_id: int, profesor: Profesor, sala: Sala, 
                 curso: Curso, materia: Materia):
        self.requisito_id = requisito_id
        self.profesor = profesor
        self.sala = sala
        self.curso = curso
        self.materia = materia
        self.dias_disponibles = []  # Lista de días disponibles (lunes, martes, etc.)
        self.hora_entrada = None
        self.hora_salida = None
        self.asignaciones = []  # Lista de asignaciones realizadas (Día, Periodo)
        
    def set_disponibilidad(self, dias_disponibles: List[str], hora_entrada: str, hora_salida: str):
        """Establece la disponibilidad temporal del requisito."""
        self.dias_disponibles = dias_disponibles
        self.hora_entrada = hora_entrada
        self.hora_salida = hora_salida
        
    def get_periodos_disponibles(self, periodos: Dict[str, Periodo]) -> List[str]:
        """Determina los periodos disponibles según el rango horario."""
        if not self.hora_entrada or not self.hora_salida:
            return []
        
        # Convertir a objetos time para comparar
        entrada = datetime.datetime.strptime(self.hora_entrada, "%H:%M:%S").time()
        salida = datetime.datetime.strptime(self.hora_salida, "%H:%M:%S").time()
        
        periodos_disponibles = []
        for periodo_id, periodo in periodos.items():
            p_inicio = datetime.datetime.strptime(periodo.hora_inicio, "%H:%M").time()
            p_fin = datetime.datetime.strptime(periodo.hora_fin, "%H:%M").time()
            
            # El periodo está dentro del rango si su inicio es >= hora_entrada y su fin <= hora_salida
            if p_inicio >= entrada and p_fin <= salida:
                periodos_disponibles.append(periodo_id)
        
        return periodos_disponibles
    
    def asignar_horario(self, dia: str, periodo: str):
        """Registra una asignación de horario para este requisito."""
        if len(self.asignaciones) < self.materia.frecuencia_semanal:
            self.asignaciones.append((dia, periodo))
            return True
        return False
        
    def reset_asignaciones(self):
        """Reinicia las asignaciones de horario."""
        self.asignaciones = []
        
    def is_completamente_asignado(self) -> bool:
        """Verifica si el requisito tiene todas sus sesiones asignadas."""
        return len(self.asignaciones) == self.materia.frecuencia_semanal
    
    def __str__(self):
        return f"Req{self.requisito_id}: {self.materia} - {self.profesor} - {self.curso} - {self.sala}"
    
    def __repr__(self):
        return self.__str__()