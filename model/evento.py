# -*- coding: utf-8 -*-
"""
Clase para representar un evento (asignación de requisito-sala-horario)
"""
from model.requisito_clase import RequisitoClase
from model.sala import Sala
from model.profesor import Profesor # Aunque esté en requisito, puede ser útil tenerlo directo
from config import DIAS_SEMANA, HORAS_DIA, NUM_PERIODOS # Para __str__ y validación

class Evento:
    """
    Clase que representa una asignación de un RequisitoClase a una Sala
    en un día y hora específicos (potencialmente parte de un bloque).
    """
    def __init__(self, requisito: RequisitoClase, sala: Sala, dia: int, hora: int):
        """
        Inicializa un nuevo evento, representando el inicio de una sesión.

        Args:
            requisito (RequisitoClase): El requisito de clase que se está programando.
            sala (Sala): La sala asignada.
            dia (int): Índice del día (0-N).
            hora (int): Índice de la hora de inicio del slot/bloque (0-M).
        """
        if not isinstance(requisito, RequisitoClase):
             raise TypeError("El argumento 'requisito' debe ser un objeto RequisitoClase")
        if not isinstance(sala, Sala):
            raise TypeError("El argumento 'sala' debe ser un objeto Sala")

        self.requisito = requisito
        self.profesor = requisito.profesor_asignado # Acceso directo
        self.sala = sala
        self.dia = dia
        self.hora = hora # Hora de inicio del primer slot de la sesión

        # Clave para identificar este evento específico (si es necesario distinguirlo de otros para el mismo requisito)
        # Podría ser útil si un requisito tiene múltiples sesiones por semana.
        # Usamos el ID del requisito y el slot de inicio como identificador básico.
        self.id_unico_evento = f"{self.requisito.id}_{self.dia}_{self.hora}"


    def get_slots_ocupados(self) -> list[tuple[int, int]]:
        """
        Devuelve una lista de tuplas (dia, hora_slot) que ocupa este evento,
        considerando la duración de la sesión.
        """
        slots = []
        for i in range(self.requisito.slots_per_session):
            slot_hora = self.hora + i
            # Verificar que el slot no exceda el número de periodos
            if slot_hora < NUM_PERIODOS:
                slots.append((self.dia, slot_hora))
            else:
                # Esto indicaría un problema en la lógica de asignación o configuración
                print(f"Advertencia: Evento para req {self.requisito.id} en ({self.dia},{self.hora}) "
                      f"con duración {self.requisito.slots_per_session} excede NUM_PERIODOS.")
                break # No añadir slots inválidos
        return slots

    def get_key_recurso(self, tipo_recurso: str, slot_hora: int) -> tuple:
        """
        Genera una clave para verificar conflictos de un recurso específico
        en un slot horario específico ocupado por este evento.

        Args:
            tipo_recurso (str): 'profesor', 'sala', 'grupo' (curso_id).
            slot_hora (int): El índice de hora específico a verificar.

        Returns:
            tuple: Clave para usar en los mapas de conflicto del Horario.
        """
        if tipo_recurso == 'profesor':
            return (self.profesor.id, self.dia, slot_hora)
        elif tipo_recurso == 'sala':
            return (self.sala.id, self.dia, slot_hora)
        elif tipo_recurso == 'grupo':
            # Usar curso_id como identificador del grupo de estudiantes
            return (self.requisito.curso_id, self.dia, slot_hora)
        else:
            raise ValueError(f"Tipo de recurso desconocido: {tipo_recurso}")


    def __str__(self):
        """Representación en string del evento."""
        dia_str = DIAS_SEMANA[self.dia] if 0 <= self.dia < len(DIAS_SEMANA) else f"Día {self.dia}"
        hora_str = HORAS_DIA[self.hora] if 0 <= self.hora < len(HORAS_DIA) else f"Hora {self.hora}"
        duracion_str = f"(x{self.requisito.slots_per_session} slots)" if self.requisito.slots_per_session > 1 else ""

        return (f"Evento({self.id_unico_evento}): {self.requisito.materia_nombre} ({self.requisito.curso_id}) "
                f"- Prof. {self.profesor.nombre}, Sala {self.sala.nombre} "
                f"- {dia_str} {hora_str} {duracion_str}")

    def __repr__(self):
         return f"Evento(req_id='{self.requisito.id}', dia={self.dia}, hora={self.hora}, sala='{self.sala.id}')"

    # Métodos de conflicto ahora se manejan mejor en la clase Horario usando get_slots_ocupados