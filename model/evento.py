# -*- coding: utf-8 -*-
"""
Clase para representar un evento (asignación de requisito-profesor-sala-horario)
"""
from model.requisito_clase import RequisitoClase
from model.sala import Sala
from model.profesor import Profesor # Importar Profesor
from config import DIAS_SEMANA, HORAS_DIA, NUM_PERIODOS

class Evento:
    """
    Clase que representa una asignación de un RequisitoClase,
    impartido por un Profesor específico, en una Sala y horario dados.
    """
    def __init__(self, requisito: RequisitoClase, profesor_elegido: Profesor, sala: Sala, dia: int, hora: int):
        """
        Inicializa un nuevo evento, representando el inicio de una sesión.

        Args:
            requisito (RequisitoClase): El requisito que se está programando.
            profesor_elegido (Profesor): El profesor ELEGIDO de la lista de elegibles del requisito.
            sala (Sala): La sala asignada.
            dia (int): Índice del día (0-N).
            hora (int): Índice de la hora de inicio del slot/bloque (0-M).
        """
        if not isinstance(requisito, RequisitoClase): raise TypeError("requisito debe ser RequisitoClase")
        if not isinstance(profesor_elegido, Profesor): raise TypeError("profesor_elegido debe ser Profesor")
        if not isinstance(sala, Sala): raise TypeError("sala debe ser Sala")
        # Validar si el profesor elegido es realmente elegible para el requisito
        if profesor_elegido not in requisito.profesores_elegibles:
             print(f"¡ADVERTENCIA DE DATOS! Intentando crear evento para Req {requisito.id} "
                   f"con Profesor {profesor_elegido.id} que NO está en la lista de elegibles.")
             # Podríamos lanzar un error o continuar permitiéndolo y que la restricción lo penalice

        self.requisito = requisito
        self.profesor = profesor_elegido # El profesor específico que imparte ESTE evento
        self.sala = sala
        self.dia = dia
        self.hora = hora # Hora de inicio del primer slot

        self.id_unico_evento = f"{self.requisito.id}_{self.profesor.id}_{self.dia}_{self.hora}"

    def get_slots_ocupados(self) -> list[tuple[int, int]]:
        """Devuelve [(dia, hora_slot)] que ocupa este evento."""
        slots = []
        for i in range(self.requisito.slots_per_session):
            slot_hora = self.hora + i
            if slot_hora < NUM_PERIODOS: slots.append((self.dia, slot_hora))
            else: print(f"Advertencia Evento: Req {self.requisito.id} ({self.dia},{self.hora}) dura {self.requisito.slots_per_session} y excede NUM_PERIODOS."); break
        return slots

    def get_key_recurso(self, tipo_recurso: str, slot_hora: int) -> tuple:
        """Genera clave para verificar conflictos."""
        if tipo_recurso == 'profesor': return (self.profesor.id, self.dia, slot_hora)
        elif tipo_recurso == 'sala': return (self.sala.id, self.dia, slot_hora)
        elif tipo_recurso == 'grupo': return (self.requisito.curso_id, self.dia, slot_hora)
        else: raise ValueError(f"Tipo recurso desconocido: {tipo_recurso}")

    def __str__(self):
        dia_str = DIAS_SEMANA[self.dia] if 0 <= self.dia < len(DIAS_SEMANA) else f"D{self.dia}"
        hora_str = HORAS_DIA[self.hora] if 0 <= self.hora < len(HORAS_DIA) else f"H{self.hora}"
        dur_str = f"(x{self.requisito.slots_per_session})" if self.requisito.slots_per_session > 1 else ""
        return (f"Evt({self.id_unico_evento}): {self.requisito.materia_nombre} ({self.requisito.curso_id}) "
                f"- Prof.{self.profesor.nombre}, S.{self.sala.nombre} @{dia_str}{hora_str}{dur_str}")

    def __repr__(self):
         return f"Evento(req='{self.requisito.id}', prof='{self.profesor.id}', dia={self.dia}, hora={self.hora})"

    # Añadir __eq__ y __hash__ basados en id_unico_evento para poder usar sets si es necesario
    def __eq__(self, other):
        if not isinstance(other, Evento): return NotImplemented
        return self.id_unico_evento == other.id_unico_evento

    def __hash__(self):
        return hash(self.id_unico_evento)