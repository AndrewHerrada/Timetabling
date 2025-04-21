# -*- coding: utf-8 -*-
"""
Clase para representar un requisito de clase a programar, derivado de tabla_minable.
"""
from model.profesor import Profesor # Importar Profesor

class RequisitoClase:
    """
    Representa una necesidad de programación específica para una materia,
    grupo, con profesores elegibles, en ciertos horarios y días.
    """
    def __init__(self, id, profesores_elegibles: list[Profesor], cantidad_docente: int, # Cambiado/Añadido
                 materia_id, materia_nombre, nivel, curso_id, seccion, inscritos,
                 required_slots, slots_per_session, allowed_slots,
                 shared_class_group, is_orquestal):
        """
        Inicializa un requisito de clase.
        Args:
            id (str): Identificador único del requisito.
            profesores_elegibles (list[Profesor]): Lista de Profesores que pueden impartir esto.
            cantidad_docente (int): Número de docentes requeridos (de la tabla).
            ... (otros args igual que antes) ...
        """
        self.id = str(id)
        # Quitar: self.profesor_asignado = profesor_asignado
        self.profesores_elegibles = profesores_elegibles if profesores_elegibles else []
        self.cantidad_docente = int(cantidad_docente) # Cuántos se especifican en la tabla
        self.materia_id = materia_id
        self.materia_nombre = materia_nombre
        self.nivel = nivel.lower()
        self.curso_id = curso_id
        self.seccion = seccion
        self.inscritos = int(inscritos)
        self.required_slots = int(required_slots)
        self.slots_per_session = int(slots_per_session) if slots_per_session > 0 else 1
        self.allowed_slots = allowed_slots
        self.shared_class_group = shared_class_group
        self.is_orquestal = is_orquestal

        self.slots_asignados = 0
        self.eventos_asignados = [] # Lista de objetos Evento

        # Validación interna
        if not self.profesores_elegibles:
             print(f"Advertencia Modelo: Req {self.id} inicializado sin profesores elegibles.")
        if self.required_slots <= 0: print(f"Advertencia Modelo: Req {self.id} tiene required_slots <= 0.")
        if not self.allowed_slots: print(f"Advertencia Modelo: Req {self.id} no tiene slots permitidos.")


    def reset_asignacion(self):
         self.slots_asignados = 0
         self.eventos_asignados = []

    def get_frecuencia_requerida(self):
        if self.slots_per_session > 0:
            return (self.required_slots + self.slots_per_session - 1) // self.slots_per_session
        return 0

    def esta_completo(self):
        return self.slots_asignados >= self.required_slots

    def __str__(self):
        orq_str = "[ORQ]" if self.is_orquestal else ""
        share_str = f"[SHARED:{self.shared_class_group}]" if self.shared_class_group else ""
        eleg_str = f"({len(self.profesores_elegibles)} eleg, {self.cantidad_docente} req)"
        return (f"Req({self.id}): {self.materia_nombre} ({self.curso_id}) {eleg_str} {orq_str}{share_str} "
                f"({self.slots_asignados}/{self.required_slots} slots)")

    def __repr__(self):
         return f"RequisitoClase(id='{self.id}', materia='{self.materia_nombre}', curso='{self.curso_id}')"

    def __eq__(self, other):
        if not isinstance(other, RequisitoClase): return NotImplemented
        return self.id == other.id

    def __hash__(self): return hash(self.id)