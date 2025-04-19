#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Funciones de fitness para evaluar la calidad de los horarios
"""

from config import BASE_FITNESS

class Evaluador:
    """
    Clase para evaluar la calidad de los horarios según las restricciones.
    """
    
    def __init__(self, restricciones_duras, restricciones_blandas, base_fitness=BASE_FITNESS):
        """
        Inicializa el evaluador con las restricciones configuradas.
        
        Args:
            restricciones_duras: Lista de objetos Restriccion (duras)
            restricciones_blandas: Lista de objetos Restriccion (blandas)
            base_fitness: Valor base para el cálculo de fitness
        """
        self.restricciones_duras = restricciones_duras
        self.restricciones_blandas = restricciones_blandas
        self.base_fitness = base_fitness
    
    def evaluar(self, horario):
        """
        Evalúa la calidad de un horario según las restricciones.
        
        Args:
            horario: Objeto Horario a evaluar
            
        Returns:
            Valor numérico de fitness (mayor es mejor)
        """
        # Evaluar restricciones duras
        penalizaciones_duras = 0
        for restriccion in self.restricciones_duras:
            violaciones = restriccion.evaluar(horario)
            penalizaciones_duras += violaciones * restriccion.peso
        
        # Evaluar restricciones blandas
        penalizaciones_blandas = 0
        for restriccion in self.restricciones_blandas:
            violaciones = restriccion.evaluar(horario)
            penalizaciones_blandas += violaciones * restriccion.peso
        
        # Calcular fitness final
        fitness = self.base_fitness - penalizaciones_duras - penalizaciones_blandas
        
        # Actualizar fitness del horario
        horario.fitness = max(0, fitness)
        
        return horario.fitness
    
    def es_solucion_valida(self, horario):
        """
        Verifica si un horario satisface todas las restricciones duras.
        
        Args:
            horario: Objeto Horario a verificar
            
        Returns:
            Boolean: True si no hay violaciones de restricciones duras,
                    False en caso contrario
        """
        for restriccion in self.restricciones_duras:
            if restriccion.evaluar(horario) > 0:
                return False
        
        return True
    
    def detallar_evaluacion(self, horario):
        """
        Proporciona un detalle completo de la evaluación de un horario.
        
        Args:
            horario: Objeto Horario a evaluar
            
        Returns:
            Diccionario con el desglose de evaluación por restricción
        """
        detalle = {
            "restricciones_duras": {},
            "restricciones_blandas": {},
            "penalizacion_duras": 0,
            "penalizacion_blandas": 0,
            "fitness": 0
        }
        
        # Evaluar restricciones duras
        penalizaciones_duras = 0
        for restriccion in self.restricciones_duras:
            violaciones = restriccion.evaluar(horario)
            penalizacion = violaciones * restriccion.peso
            penalizaciones_duras += penalizacion
            
            nombre_clase = restriccion.__class__.__name__
            detalle["restricciones_duras"][nombre_clase] = {
                "violaciones": violaciones,
                "peso": restriccion.peso,
                "penalizacion": penalizacion
            }
        
        # Evaluar restricciones blandas
        penalizaciones_blandas = 0
        for restriccion in self.restricciones_blandas:
            violaciones = restriccion.evaluar(horario)
            penalizacion = violaciones * restriccion.peso
            penalizaciones_blandas += penalizacion
            
            nombre_clase = restriccion.__class__.__name__
            detalle["restricciones_blandas"][nombre_clase] = {
                "violaciones": violaciones,
                "peso": restriccion.peso,
                "penalizacion": penalizacion
            }
        
        # Calcular fitness final
        fitness = self.base_fitness - penalizaciones_duras - penalizaciones_blandas
        
        detalle["penalizacion_duras"] = penalizaciones_duras
        detalle["penalizacion_blandas"] = penalizaciones_blandas
        detalle["fitness"] = max(0, fitness)
        
        return detalle