#!/usr/bin/env python3
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
            id: Identificador único de la sala
            nombre: Nombre o número de la sala
            capacidad: Capacidad máxima de estudiantes
            nivel: Nivel educativo para el cual está destinada la sala
            equipamiento: Lista de equipamientos disponibles en la sala
        """
        self.id = id
        self.nombre = nombre
        self.capacidad = capacidad
        self.nivel = nivel  # Ej: "infantil", "primaria", "secundaria", etc.
        self.equipamiento = equipamiento if equipamiento else []
    
    def es_adecuada_para_nivel(self, nivel_requerido):
        """
        Verifica si la sala es adecuada para un determinado nivel educativo.
        
        Args:
            nivel_requerido: Nivel educativo para verificar
            
        Returns:
            Boolean: True si la sala es adecuada, False en caso contrario
        """
        # Regla especial: salas de nivel infantil son exclusivas para ese nivel
        if self.nivel == "infantil":
            return nivel_requerido == "infantil"
        
        # En otros casos, cualquier sala puede ser usada por cualquier nivel
        # excepto el nivel infantil que requiere salas específicas
        if nivel_requerido == "infantil":
            return self.nivel == "infantil"
        
        return True
    
    def tiene_equipamiento(self, equipamiento_requerido):
        """
        Verifica si la sala cuenta con un determinado equipamiento.
        
        Args:
            equipamiento_requerido: Equipamiento a verificar o lista de equipamientos
            
        Returns:
            Boolean: True si la sala tiene el equipamiento requerido, False en caso contrario
        """
        if not equipamiento_requerido:
            return True
        
        if isinstance(equipamiento_requerido, list):
            return all(equip in self.equipamiento for equip in equipamiento_requerido)
        else:
            return equipamiento_requerido in self.equipamiento
    
    def __str__(self):
        """
        Representación en string de la sala.
        
        Returns:
            String con la información básica de la sala
        """
        return f"Sala({self.id}): {self.nombre}, nivel {self.nivel}, capacidad {self.capacidad}"