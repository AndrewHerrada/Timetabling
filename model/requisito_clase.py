# -*- coding: utf-8 -*-
"""
Clase para representar un requisito de clase a programar, derivado de tabla_minable.
"""
from model.profesor import Profesor

class RequisitoClase:
    """
    Representa una necesidad de programación específica para una materia,
    grupo, profesor en ciertos horarios y días.
    """
    def __init__(self, id, profesor_asignado: Profesor, materia_id, materia_nombre,
                 nivel, curso_id, seccion, inscritos, required_slots,
                 slots_per_session, allowed_slots, shared_class_group, is_orquestal):
        """
        Inicializa un requisito de clase.

        Args:
            id (str): Identificador único del requisito (ej: requisito_id).
            profesor_asignado (Profesor): Objeto Profesor asignado.
            materia_id (str): ID de la materia.
            materia_nombre (str): Nombre de la materia.
            nivel (str): Nivel educativo.
            curso_id (str): Identificador del grupo/curso específico (ej: '1°Inf (A)').
            seccion (str): Sección o contexto de la materia (ej: 'Guitarra', 'Todos').
            inscritos (int): Número de estudiantes inscritos.
            required_slots (int): Número total de slots (ej: 45min) requeridos por semana.
            slots_per_session (int): Número de slots consecutivos por cada sesión/clase.
            allowed_slots (list[tuple]): Lista de (dia_idx, hora_idx) permitidos para iniciar una sesión.
            shared_class_group (str | None): Identificador del grupo de clases simultáneas, o None.
            is_orquestal (bool): True si aplican reglas de 'orquestal'.
        """
        self.id = str(id)
        self.profesor_asignado = profesor_asignado
        self.materia_id = materia_id
        self.materia_nombre = materia_nombre
        self.nivel = nivel.lower()
        self.curso_id = curso_id
        self.seccion = seccion
        self.inscritos = int(inscritos)
        self.required_slots = int(required_slots)
        self.slots_per_session = int(slots_per_session) if slots_per_session > 0 else 1 # Mínimo 1 slot
        self.allowed_slots = allowed_slots # Lista de (dia_idx, hora_idx) válidos para INICIAR la sesión
        self.shared_class_group = shared_class_group
        self.is_orquestal = is_orquestal

        # Estado de programación (se actualiza al construir el horario)
        self.slots_asignados = 0
        self.eventos_asignados = [] # Lista de objetos Evento para este requisito

        if self.required_slots <= 0:
             print(f"Advertencia: Requisito {self.id} tiene required_slots <= 0 ({self.required_slots}).")
        if not self.allowed_slots:
             print(f"Advertencia: Requisito {self.id} no tiene slots permitidos.")


    def reset_asignacion(self):
         """Resetea el estado de asignación."""
         self.slots_asignados = 0
         self.eventos_asignados = []

    def get_frecuencia_requerida(self):
        """Calcula cuántas sesiones se necesitan por semana."""
        if self.slots_per_session > 0:
            # Redondear hacia arriba para asegurar que se cubren las horas
            return (self.required_slots + self.slots_per_session - 1) // self.slots_per_session
        return 0

    def esta_completo(self):
        """Verifica si se han asignado todos los slots requeridos."""
        return self.slots_asignados >= self.required_slots

    def __str__(self):
        orq_str = "[ORQ]" if self.is_orquestal else ""
        share_str = f"[SHARED:{self.shared_class_group}]" if self.shared_class_group else ""
        return (f"Req({self.id}): {self.materia_nombre} ({self.curso_id}) {orq_str}{share_str} "
                f"- Prof: {self.profesor_asignado.nombre} ({self.slots_asignados}/{self.required_slots} slots)")

    def __repr__(self):
         return f"RequisitoClase(id='{self.id}', materia='{self.materia_nombre}', curso='{self.curso_id}')"

    def __eq__(self, other):
        if not isinstance(other, RequisitoClase):
            return NotImplemented
        return self.id == other.id

    def __hash__(self):
        return hash(self.id)