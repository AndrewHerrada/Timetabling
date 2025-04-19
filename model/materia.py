#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Clase para representar una materia en el sistema de generación de horarios
"""

class Materia:
    """
    Clase que representa una materia o asignatura académica.
    """
    
    def __init__(self, id, nombre, nivel, horas_semanales, requiere_equipamiento=None):
        """
        Inicializa una nueva materia.
        
        Args:
            id: Identificador único de la materia
            nombre: Nombre de la materia
            nivel: Nivel educativo (infantil, inicial, basico, intensivo, intermedio)
            horas_semanales: Número de horas semanales que debe impartirse
            requiere_equipamiento: Lista de equipamientos especiales requeridos
        """
        self.id = id
        self.nombre = nombre
        self.nivel = nivel
        self.horas_semanales = horas_semanales
        self.requiere_equipamiento = requiere_equipamiento if requiere_equipamiento else []
    
    def __str__(self):
        """
        Representación en string de la materia.
        
        Returns:
            String con la información básica de la materia
        """
        return f"Materia({self.id}): {self.nombre}, nivel {self.nivel}, {self.horas_semanales} horas/semana"


class MateriaSecciones:
    """
    Clase que representa una materia con sus secciones (grupos) específicas.
    """
    
    def __init__(self, materia, seccion, profesor_especifico=None):
        """
        Inicializa una nueva combinación de materia-sección.
        
        Args:
            materia: Objeto Materia
            seccion: Identificador de la sección o grupo
            profesor_especifico: ID del profesor específicamente asignado (opcional)
        """
        self.materia = materia
        self.seccion = seccion
        self.profesor_especifico = profesor_especifico
        self.horas_asignadas = 0
    
    def incrementar_horas(self, cantidad=1):
        """
        Incrementa el contador de horas asignadas a esta materia-sección.
        
        Args:
            cantidad: Número de horas a incrementar (por defecto 1)
        """
        self.horas_asignadas += cantidad
    
    def horas_pendientes(self):
        """
        Calcula las horas que faltan por asignar.
        
        Returns:
            Número de horas pendientes de asignar
        """
        return max(0, self.materia.horas_semanales - self.horas_asignadas)
    
    def esta_completa(self):
        """
        Verifica si se han asignado todas las horas requeridas.
        
        Returns:
            Boolean: True si se han asignado todas las horas, False en caso contrario
        """
        return self.horas_asignadas >= self.materia.horas_semanales
    
    def __str__(self):
        """
        Representación en string de la materia-sección.
        
        Returns:
            String con la información básica
        """
        prof_str = f", profesor asignado: {self.profesor_especifico}" if self.profesor_especifico else ""
        return f"{self.materia.nombre} (Sección {self.seccion}){prof_str}, {self.horas_asignadas}/{self.materia.horas_semanales} horas"