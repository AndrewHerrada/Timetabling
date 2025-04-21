# -*- coding: utf-8 -*-
"""
Clase para representar una sala en el sistema de generación de horarios
"""

class Sala:
    """
        Clase que representa una sala o aula física.
    """
    def __init__(self, id, nombre, capacidad, nivel, equipamiento=None):
        """
        Inicializa una nueva sala.

        Args:
            id: Identificador único de la sala (string)
            nombre: Nombre o número de la sala (string)
            capacidad: Capacidad máxima de estudiantes (int)
            nivel: Nivel educativo adecuado ('infantil', 'todos', etc.) (string)
            equipamiento: Lista de equipamientos disponibles (list[string])
        """
        self.id = str(id) # Asegurar ID es string
        self.nombre = nombre
        self.capacidad = int(capacidad)
        self.nivel = str(nivel).lower() # Normalizar a minúsculas
        self.equipamiento = equipamiento if equipamiento else []

    def es_adecuada_para_nivel(self, nivel_requerido):
        """Verifica si la sala es adecuada para un nivel educativo."""
        nivel_req = nivel_requerido.lower()
        # Si la sala es para 'todos', es adecuada para cualquier nivel
        if self.nivel == 'todos':
            return True
        # Si el nivel requerido coincide con el de la sala
        if nivel_req == self.nivel:
             return True
        # Caso especial: ¿Pueden salas no infantiles usarse para infantil? -> Asumimos que NO.
        # ¿Pueden salas de niveles específicos (ej: primaria) usarse para otros (ej: secundaria)? -> Asumimos que SI si no es 'infantil'.
        if self.nivel != 'infantil' and nivel_req != 'infantil':
             # Podría añadirse lógica más compleja si hay jerarquía de niveles
             return True
        # Si la sala es infantil, solo sirve para infantil
        if self.nivel == 'infantil' and nivel_req == 'infantil':
             return True

        return False # En cualquier otro caso, no es adecuada

    def tiene_equipamiento(self, equipamiento_requerido):
        """Verifica si la sala cuenta con el equipamiento necesario."""
        if not equipamiento_requerido:
            return True # No se requiere nada especial

        req_list = equipamiento_requerido if isinstance(equipamiento_requerido, list) else [equipamiento_requerido]

        # Verificar si todos los requeridos están en la sala
        return all(equip.lower() in [e.lower() for e in self.equipamiento] for equip in req_list)

    def __str__(self):
        """Representación en string de la sala."""
        return f"Sala({self.id}): {self.nombre}, Cap: {self.capacidad}, Nivel: {self.nivel}, Equip: {self.equipamiento}"

    def __repr__(self):
         return f"Sala(id='{self.id}', nombre='{self.nombre}', capacidad={self.capacidad}, nivel='{self.nivel}')"