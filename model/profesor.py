#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Clase para representar a un profesor en el sistema de generación de horarios
"""

class Profesor:
    """
    Clase que representa a un profesor con sus atributos y disponibilidad.
    """
    
    def __init__(self, id, nombre, tiene_item=False, especialidades=None, disponibilidad=None):
        """
        Inicializa un nuevo profesor.
        
        Args:
            id: Identificador único del profesor
            nombre: Nombre completo del profesor
            tiene_item: Boolean que indica si el profesor tiene ítem (requiere 14 horas mínimo)
            especialidades: Lista de IDs de materias que el profesor puede impartir
            disponibilidad: Matriz de disponibilidad por día y hora
        """
        self.id = id
        self.nombre = nombre
        self.tiene_item = tiene_item
        self.especialidades = especialidades if especialidades else []
        self.disponibilidad = disponibilidad if disponibilidad else []
        self.horas_asignadas = 0
        
    def puede_impartir(self, materia_id):
        """
        Verifica si el profesor puede impartir una determinada materia.
        
        Args:
            materia_id: ID de la materia a verificar
            
        Returns:
            Boolean: True si puede impartir la materia, False en caso contrario
        """
        return materia_id in self.especialidades
    
    def esta_disponible(self, dia, hora):
        """
        Verifica si el profesor está disponible en un determinado día y hora.
        
        Args:
            dia: Índice del día (0-4 para Lunes a Viernes)
            hora: Índice de la hora (0-n según configuración)
            
        Returns:
            Boolean: True si está disponible, False en caso contrario
        """
        if not self.disponibilidad:
            return True  # Si no hay disponibilidad definida, asumimos disponibilidad total
        
        try:
            return self.disponibilidad[dia][hora]
        except IndexError:
            return False
    
    def incrementar_horas(self, cantidad=1):
        """
        Incrementa el contador de horas asignadas al profesor.
        
        Args:
            cantidad: Número de horas a incrementar (por defecto 1)
        """
        self.horas_asignadas += cantidad
    
    def cumple_horas_minimas(self):
        """
        Verifica si el profesor cumple con el requisito de horas mínimas.
        
        Returns:
            Boolean: True si cumple, False en caso contrario
        """
        if not self.tiene_item:
            return True  # Si no tiene ítem, no hay requisito mínimo
        
        return self.horas_asignadas >= 14
    
    def __str__(self):
        """
        Representación en string del profesor.
        
        Returns:
            String con la información básica del profesor
        """
        item_str = "con ítem" if self.tiene_item else "sin ítem"
        return f"Profesor({self.id}): {self.nombre} {item_str}, {self.horas_asignadas} horas asignadas"