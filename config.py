#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Configuración global para el sistema de generación de horarios
"""

# Configuración de días y horas
DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]
HORAS_DIA = [
    "08:00-08:45", 
    "08:45-09:30", 
    "09:30-10:15", 
    "10:30-11:15", 
    "11:15-12:00", 
    "12:00-12:45",
    "14:30-15:15",
    "15:15-16:00",
    "16:00-16:45",
    "17:00-17:45"
]

# Número de días y períodos por día
NUM_DIAS = len(DIAS_SEMANA)
NUM_PERIODOS = len(HORAS_DIA)

# Niveles educativos
NIVELES = ["infantil", "primaria", "secundaria", "bachillerato"]

# Configuración del algoritmo genético
GA_CONFIG = {
    "tamaño_poblacion": 100,
    "prob_cruce": 0.8,
    "prob_mutacion": 0.2,
    "elitismo": 5,
    "max_generaciones": 500,
    "criterio_parada_fitness": 0.95,  # Porcentaje del fitness máximo teórico
    "generaciones_sin_mejora": 50     # Número de generaciones sin mejora para detener
}

# Pesos para las restricciones
PESOS = {
    # Restricciones duras
    "profesor_simultaneo": 1000,
    "sala_simultanea": 1000,
    "grupo_simultaneo": 1000,
    "profesor_min_horas": 1000,
    "sala_nivel": 1000,
    "asignacion_especifica": 1000,
    
    # Restricciones blandas
    "minimizar_huecos": 10,
    "distribucion_equilibrada": 5
}

# Valor base para el cálculo de fitness
BASE_FITNESS = 10000