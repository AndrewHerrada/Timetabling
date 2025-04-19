#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Punto de entrada principal para el sistema de generación de horarios
mediante algoritmos genéticos.
"""

import os
import time
import random
import copy
from utils.data_loader import DataLoader
from model.horario import Horario
from genetic.genetic_algorithm import GeneticAlgorithm
from genetic.fitness import Evaluador
from genetic.constraints import (
    ProfesorNoSimultaneo, 
    SalaNoSimultanea, 
    GrupoNoSimultaneo,
    ProfesorMinHoras,
    SalaNivelCorrecto,
    AsignacionEspecifica,
    MinimizarHuecos,
    DistribucionEquilibrada
)
from utils.visualization import Visualizador

def main():
    """
    Función principal que coordina el proceso de generación de horarios
    """
    # Configuración del algoritmo
    random.seed(42)  # Para reproducibilidad de los resultados
    
    print("Inicializando sistema de generación de horarios...")
    
    # Cargar datos desde los archivos Excel
    data_loader = DataLoader()
    print("Cargando datos de profesores, materias y salas...")
    profesores = data_loader.cargar_profesores("db/Profesor.xlsx")
    materias_secciones = data_loader.cargar_materias_secciones("db/tabla_minable.xlsx")
    salas = data_loader.cargar_salas("db/Sala.xlsx")
    
    print(f"Datos cargados: {len(profesores)} profesores, {len(materias_secciones)} materias/secciones, {len(salas)} salas")
    
    # Configurar restricciones
    restricciones_duras = [
        ProfesorNoSimultaneo(peso=1000),
        SalaNoSimultanea(peso=1000),
        GrupoNoSimultaneo(peso=1000),
        ProfesorMinHoras(peso=1000),
        SalaNivelCorrecto(peso=1000),
        AsignacionEspecifica(peso=1000)
    ]
    
    restricciones_blandas = [
        MinimizarHuecos(peso=10),
        DistribucionEquilibrada(peso=5)
    ]
    
    # Crear evaluador
    evaluador = Evaluador(restricciones_duras, restricciones_blandas)
    
    # Configurar algoritmo genético
    print("Configurando algoritmo genético...")
    ga = GeneticAlgorithm(
        profesores=profesores,
        materias_secciones=materias_secciones,
        salas=salas,
        evaluador=evaluador,
        tamaño_poblacion=100,
        prob_cruce=0.8,
        prob_mutacion=0.2,
        elitismo=5,
        max_generaciones=500
    )
    
    # Ejecutar algoritmo genético
    print("Iniciando algoritmo genético...")
    start_time = time.time()
    mejor_solucion = ga.ejecutar()
    elapsed_time = time.time() - start_time
    
    print(f"Algoritmo genético finalizado en {elapsed_time:.2f} segundos")
    print(f"Mejor fitness alcanzado: {mejor_solucion.fitness}")
    
    # Visualizar y exportar resultados
    print("Visualizando resultados...")
    visualizador = Visualizador(profesores, materias_secciones, salas)
    
    # Crear directorio para resultados si no existe
    if not os.path.exists("resultados"):
        os.makedirs("resultados")
    
    # Exportar a Excel
    visualizador.exportar_excel(mejor_solucion, "resultados/horario_final.xlsx")
    print("Horario exportado a 'resultados/horario_final.xlsx'")
    
    # Generar resumen de estadísticas
    visualizador.generar_resumen(mejor_solucion, "resultados/resumen.txt")
    print("Resumen generado en 'resultados/resumen.txt'")
    
    return mejor_solucion

if __name__ == "__main__":
    main()