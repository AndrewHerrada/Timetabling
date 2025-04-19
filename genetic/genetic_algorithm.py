#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Implementación del algoritmo genético para el problema de timetabling
"""

import random
import copy
import time
from genetic.chromosomes import GeneradorCromosomas
from genetic.crossover import CruceDias, CruceEventos, CruceMateriasSeccion
from genetic.mutation import MutacionCambioHorario, MutacionCambioSala, MutacionIntercambio, MutacionCompuesta
from config import GA_CONFIG

class GeneticAlgorithm:
    """
    Clase principal que implementa el algoritmo genético.
    """
    
    def __init__(self, profesores, materias_secciones, salas, evaluador,
                tamaño_poblacion=None, prob_cruce=None, prob_mutacion=None,
                elitismo=None, max_generaciones=None):
        """
        Inicializa el algoritmo genético.
        
        Args:
            profesores: Lista de objetos Profesor
            materias_secciones: Lista de objetos MateriaSecciones
            salas: Lista de objetos Sala
            evaluador: Objeto Evaluador para calcular fitness
            tamaño_poblacion: Tamaño de la población
            prob_cruce: Probabilidad de cruce
            prob_mutacion: Probabilidad de mutación
            elitismo: Número de mejores individuos que pasan directamente a la siguiente generación
            max_generaciones: Número máximo de generaciones
        """
        self.profesores = profesores
        self.materias_secciones = materias_secciones
        self.salas = salas
        self.evaluador = evaluador
        
        # Configuración del algoritmo
        self.tamaño_poblacion = tamaño_poblacion or GA_CONFIG["tamaño_poblacion"]
        self.prob_cruce = prob_cruce or GA_CONFIG["prob_cruce"]
        self.prob_mutacion = prob_mutacion or GA_CONFIG["prob_mutacion"]
        self.elitismo = elitismo or GA_CONFIG["elitismo"]
        self.max_generaciones = max_generaciones or GA_CONFIG["max_generaciones"]
        
        # Inicializar generador de cromosomas
        self.generador = GeneradorCromosomas(profesores, materias_secciones, salas)
        
        # Inicializar operadores genéticos
        self.operadores_cruce = [
            CruceDias(probabilidad=self.prob_cruce),
            CruceEventos(probabilidad=self.prob_cruce),
            CruceMateriasSeccion(probabilidad=self.prob_cruce)
        ]
        
        self.operador_mutacion = MutacionCompuesta([
            MutacionCambioHorario(probabilidad=self.prob_mutacion),
            MutacionCambioSala(probabilidad=self.prob_mutacion / 2, salas=salas),
            MutacionIntercambio(probabilidad=self.prob_mutacion / 2)
        ])
        
        # Población actual
        self.poblacion = []
        self.mejor_individuo = None
        self.mejor_fitness = 0
        
        # Estadísticas
        self.generaciones_sin_mejora = 0
        self.historia_fitness = []
    
    def inicializar_poblacion(self):
        """
        Inicializa la población con individuos generados aleatoria y heurísticamente.
        """
        self.poblacion = []
        
        # Generar una parte de la población de forma heurística
        num_heuristicos = max(1, self.tamaño_poblacion // 4)
        for _ in range(num_heuristicos):
            horario = self.generador.generar_heuristico()
            self.poblacion.append(horario)
        
        # Generar el resto de forma aleatoria
        for _ in range(self.tamaño_poblacion - num_heuristicos):
            horario = self.generador.generar_aleatorio()
            self.poblacion.append(horario)
        
        # Evaluar la población inicial
        self._evaluar_poblacion()
    
    def _evaluar_poblacion(self):
        """
        Evalúa todos los individuos de la población actual.
        """
        for individuo in self.poblacion:
            self.evaluador.evaluar(individuo)
        
        # Ordenar por fitness (mayor a menor)
        self.poblacion.sort(key=lambda x: x.fitness, reverse=True)
        
        # Actualizar mejor individuo si procede
        if self.poblacion and (not self.mejor_individuo or self.poblacion[0].fitness > self.mejor_fitness):
            self.mejor_individuo = self.poblacion[0].clonar()
            self.mejor_fitness = self.mejor_individuo.fitness
            self.generaciones_sin_mejora = 0
        else:
            self.generaciones_sin_mejora += 1
    
    def _seleccion_torneo(self, tamaño_torneo=3):
        """
        Selecciona un individuo mediante torneo.
        
        Args:
            tamaño_torneo: Número de individuos que participan en el torneo
            
        Returns:
            Individuo seleccionado
        """
        participantes = random.sample(self.poblacion, min(tamaño_torneo, len(self.poblacion)))
        return max(participantes, key=lambda x: x.fitness)
    
    def _siguiente_generacion(self):
        """
        Evoluciona la población a la siguiente generación.
        """
        nueva_poblacion = []
        
        # Elitismo: pasar los mejores directamente
        nueva_poblacion.extend(self.poblacion[:self.elitismo])
        
        # Generar el resto mediante selección, cruce y mutación
        while len(nueva_poblacion) < self.tamaño_poblacion:
            # Seleccionar padres
            padre1 = self._seleccion_torneo()
            padre2 = self._seleccion_torneo()
            
            # Aplicar cruce con cierta probabilidad
            if random.random() < self.prob_cruce:
                # Elegir operador de cruce aleatorio
                operador_cruce = random.choice(self.operadores_cruce)
                hijos = operador_cruce.cruzar(padre1, padre2)
            else:
                # Sin cruce, los hijos son copias de los padres
                hijos = (padre1.clonar(), padre2.clonar())
            
            # Aplicar mutación y agregar a la nueva población
            for hijo in hijos:
                if len(nueva_poblacion) < self.tamaño_poblacion:
                    self.operador_mutacion.mutar(hijo)
                    nueva_poblacion.append(hijo)
        
        # Actualizar población
        self.poblacion = nueva_poblacion
    
    def ejecutar(self):
        """
        Ejecuta el algoritmo genético.
        
        Returns:
            Mejor horario encontrado
        """
        print("Inicializando población...")
        self.inicializar_poblacion()
        
        print(f"Población inicial generada. Mejor fitness: {self.mejor_fitness}")
        
        # Criterios de parada
        criterio_fitness = GA_CONFIG["criterio_parada_fitness"] * self.evaluador.base_fitness
        max_sin_mejora = GA_CONFIG["generaciones_sin_mejora"]
        
        generacion = 0
        inicio = time.time()
        
        # Guardar estado inicial
        self.historia_fitness.append((generacion, self.mejor_fitness))
        
        # Bucle principal
        while generacion < self.max_generaciones:
            # Evolucionar a siguiente generación
            self._siguiente_generacion()
            
            # Evaluar nueva población
            self._evaluar_poblacion()
            
            # Actualizar contador
            generacion += 1
            
            # Guardar estado
            self.historia_fitness.append((generacion, self.mejor_fitness))
            
            # Mostrar progreso cada 10 generaciones
            if generacion % 10 == 0:
                tiempo_transcurrido = time.time() - inicio
                mejor = self.mejor_fitness
                promedio = sum(ind.fitness for ind in self.poblacion) / len(self.poblacion)
                print(f"Generación {generacion}: Mejor fitness = {mejor:.2f}, "
                      f"Promedio = {promedio:.2f}, Tiempo = {tiempo_transcurrido:.2f}s")
            
            # Verificar criterios de parada
            if self.mejor_fitness >= criterio_fitness:
                print(f"¡Solución óptima encontrada en generación {generacion}!")
                break
            
            if self.generaciones_sin_mejora >= max_sin_mejora:
                print(f"Parada por estancamiento tras {max_sin_mejora} generaciones sin mejora.")
                break
        
        tiempo_total = time.time() - inicio
        print(f"Algoritmo finalizado tras {generacion} generaciones. "
              f"Tiempo total: {tiempo_total:.2f}s")
        print(f"Mejor fitness alcanzado: {self.mejor_fitness}")
        
        return self.mejor_individuo
    
    def obtener_estadisticas(self):
        """
        Devuelve estadísticas sobre la ejecución del algoritmo.
        
        Returns:
            Diccionario con estadísticas
        """
        return {
            "generaciones": len(self.historia_fitness),
            "mejor_fitness": self.mejor_fitness,
            "historia_fitness": self.historia_fitness,
            "tiempo_ejecucion": None,  # Se llena al finalizar
            "generaciones_sin_mejora": self.generaciones_sin_mejora,
            "evaluacion_detallada": self.evaluador.detallar_evaluacion(self.mejor_individuo) if self.mejor_individuo else None
        }