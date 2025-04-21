# -*- coding: utf-8 -*-
"""
Implementación del algoritmo genético para el problema de timetabling
"""
import random
import copy
import time
# Importar modelos y componentes actualizados
# from genetic.chromosomes import GeneradorCromosomas # Ahora se pasa como argumento
from model.horario import Horario
from model.requisito_clase import RequisitoClase
from model.profesor import Profesor
from model.sala import Sala
from genetic.fitness import Evaluador
from genetic.crossover import CruceDias, CruceEventos
# *** AÑADIR MutacionCambioProfesor a la importación ***
from genetic.mutation import (
    MutacionCambioHorario, MutacionCambioSala, MutacionIntercambio,
    MutacionCompuesta, MutacionCambioProfesor
)
# -----------------------------------------------
from config import GA_CONFIG

class GeneticAlgorithm:
    """
    Clase principal que implementa el algoritmo genético.
    Adaptada para trabajar con RequisitoClase y asignación de profesores.
    """
    # El resto de la clase GeneticAlgorithm permanece igual que en la versión anterior
    # (__init__, inicializar_poblacion, _evaluar_poblacion, etc.)
    def __init__(self, requisitos: list[RequisitoClase], # Antes era materias_secciones
                 profesores: list[Profesor], salas: list[Sala],
                 evaluador: Evaluador,
                 generador_cromosomas, # Pasar el objeto generador
                 shared_groups_data: dict, # Pasar datos de grupos compartidos
                 tamaño_poblacion=None, prob_cruce=None, prob_mutacion=None,
                 elitismo=None, max_generaciones=None,
                 criterio_parada_fitness=None, generaciones_sin_mejora=None):

        self.requisitos = requisitos
        self.profesores = profesores
        self.salas = salas
        self.evaluador = evaluador
        self.generador = generador_cromosomas
        self.shared_groups_data = shared_groups_data

        self.tamaño_poblacion = tamaño_poblacion if tamaño_poblacion is not None else GA_CONFIG["tamaño_poblacion"]
        self.prob_cruce = prob_cruce if prob_cruce is not None else GA_CONFIG["prob_cruce"]
        self.prob_mutacion = prob_mutacion if prob_mutacion is not None else GA_CONFIG["prob_mutacion"]
        self.elitismo = elitismo if elitismo is not None else GA_CONFIG["elitismo"]
        self.max_generaciones = max_generaciones if max_generaciones is not None else GA_CONFIG["max_generaciones"]

        self.criterio_parada_fitness = criterio_parada_fitness if criterio_parada_fitness is not None else GA_CONFIG.get("criterio_parada_fitness", 1)
        self.generaciones_sin_mejora_max = generaciones_sin_mejora if generaciones_sin_mejora is not None else GA_CONFIG.get("generaciones_sin_mejora", 50)

        self.operadores_cruce = [
            CruceDias(probabilidad=self.prob_cruce),
            CruceEventos(probabilidad=self.prob_cruce),
        ]

        # Asegurarse que se usa el MutacionCambioProfesor importado
        self.operador_mutacion = MutacionCompuesta([
            MutacionCambioHorario(probabilidad=self.prob_mutacion),
            MutacionCambioSala(probabilidad=self.prob_mutacion / 2, salas=self.salas),
            MutacionIntercambio(probabilidad=self.prob_mutacion / 2),
            MutacionCambioProfesor(probabilidad=self.prob_mutacion / 2) # Usar la clase importada
        ])

        self.poblacion = []
        self.mejor_individuo = None
        self.mejor_fitness = -float('inf')

        self.generaciones_sin_mejora_actual = 0
        self.historia_fitness = []

    def inicializar_poblacion(self):
        """Inicializa la población usando el GeneradorCromosomas."""
        self.poblacion = []
        print(f"Generando población inicial de tamaño {self.tamaño_poblacion}...")
        for i in range(self.tamaño_poblacion):
            try:
                 horario_inicial = self.generador.generar_aleatorio()
                 self.poblacion.append(horario_inicial)
                 if (i + 1) % 10 == 0 or self.tamaño_poblacion < 10:
                     print(f"  Generado individuo {i+1}/{self.tamaño_poblacion}")
            except Exception as e:
                 print(f"Error generando individuo inicial {i+1}: {e}")
                 import traceback; traceback.print_exc() # Imprimir traceback para depurar
        if not self.poblacion:
             raise RuntimeError("No se pudo generar ningún individuo para la población inicial.")
        print("Población inicial generada. Evaluando...")
        self._evaluar_poblacion() # Evaluar después de generar toda la población

    def _evaluar_poblacion(self):
        """Evalúa todos los individuos de la población actual."""
        fitness_actual = []
        for individuo in self.poblacion:
            fit = self.evaluador.evaluar(individuo)
            fitness_actual.append(fit)

        # Guardar el mejor fitness de esta generación para comparación
        mejor_fitness_generacion = -float('inf')
        if self.poblacion:
            # Ordenar por fitness (mayor a menor)
            self.poblacion.sort(key=lambda x: x.fitness, reverse=True)
            mejor_fitness_generacion = self.poblacion[0].fitness

        # Actualizar mejor individuo global si mejora
        if mejor_fitness_generacion > self.mejor_fitness:
            self.mejor_individuo = self.poblacion[0].clonar()
            self.mejor_fitness = self.mejor_individuo.fitness
            self.generaciones_sin_mejora_actual = 0
            print(f"  Nuevo mejor fitness encontrado: {self.mejor_fitness:.4f}")
        else:
            self.generaciones_sin_mejora_actual += 1


    def _seleccion_torneo(self, tamaño_torneo=3):
        """Selecciona un individuo mediante torneo."""
        if not self.poblacion: return None
        tamaño_real_torneo = min(tamaño_torneo, len(self.poblacion))
        if tamaño_real_torneo <= 0: return None
        participantes = random.sample(self.poblacion, tamaño_real_torneo)
        return max(participantes, key=lambda x: x.fitness)

    def _siguiente_generacion(self):
        """Evoluciona la población a la siguiente generación."""
        nueva_poblacion = []
        num_elite = min(self.elitismo, len(self.poblacion))
        if num_elite > 0:
             nueva_poblacion.extend([ind.clonar() for ind in self.poblacion[:num_elite]])

        while len(nueva_poblacion) < self.tamaño_poblacion:
            padre1 = self._seleccion_torneo()
            padre2 = self._seleccion_torneo()
            if padre1 is None or padre2 is None: # Fallback
                 padre1 = self.poblacion[0] if self.poblacion else None
                 padre2 = self.poblacion[min(1, len(self.poblacion)-1)] if len(self.poblacion) > 1 else padre1
                 if padre1 is None: break

            hijo1 = padre1.clonar(); hijo2 = padre2.clonar()

            if random.random() < self.prob_cruce and len(self.operadores_cruce) > 0:
                operador_cruce = random.choice(self.operadores_cruce)
                try:
                    hijo1_cruzado, hijo2_cruzado = operador_cruce.cruzar(hijo1, hijo2)
                    hijo1 = hijo1_cruzado; hijo2 = hijo2_cruzado
                    # Los operadores de cruce ahora deberían devolver horarios listos
                    # hijo1._reconstruir_indices_y_estado() # Ya no debería ser necesario aquí
                    # hijo2._reconstruir_indices_y_estado()
                except Exception as e: print(f"Error Cruce {operador_cruce.__class__.__name__}: {e}"); hijo1=padre1.clonar(); hijo2=padre2.clonar()

            try:
                 mutado1 = self.operador_mutacion.mutar(hijo1) # Mutar() devuelve bool, modifica in-place
                 mutado2 = self.operador_mutacion.mutar(hijo2)
                 # Si la mutación ocurre, Horario ya debería actualizar índices internos
                 # if mutado1: hijo1._reconstruir_indices_y_estado() # Ya no debería ser necesario
                 # if mutado2: hijo2._reconstruir_indices_y_estado()
            except Exception as e: print(f"Error Mutación: {e}")

            if len(nueva_poblacion) < self.tamaño_poblacion: nueva_poblacion.append(hijo1)
            if len(nueva_poblacion) < self.tamaño_poblacion: nueva_poblacion.append(hijo2)

        self.poblacion = nueva_poblacion

    def ejecutar(self):
        """Ejecuta el algoritmo genético."""
        print("\n--- Ejecución del Algoritmo Genético ---")
        try: self.inicializar_poblacion()
        except RuntimeError as e: print(f"Error fatal: {e}"); return None
        except Exception as e: print(f"Error inesperado inicializando: {e}"); import traceback; traceback.print_exc(); return None

        print(f"Población inicial evaluada. Mejor fitness inicial: {self.mejor_fitness:.4f}")
        if not self.poblacion: print("Error: Población vacía después de inicializar."); return None
        if self.mejor_individuo is None: # Si el mejor inicial es muy malo, tomar el mejor actual
             self.mejor_individuo = self.poblacion[0].clonar()
             self.mejor_fitness = self.mejor_individuo.fitness

        self.historia_fitness.append((0, self.mejor_fitness))
        inicio_bucle = time.time()

        for generacion in range(1, self.max_generaciones + 1):
            if not self.poblacion: print(f"Error: Población vacía en Gen {generacion}"); break

            print(f"\n--- Generación {generacion}/{self.max_generaciones} ---")
            try:
                self._siguiente_generacion()
                self._evaluar_poblacion()
            except Exception as e:
                print(f"Error fatal durante la generación {generacion}: {e}")
                import traceback; traceback.print_exc()
                # Podríamos parar o intentar continuar? Mejor parar por ahora.
                break # Salir del bucle si hay un error grave

            self.historia_fitness.append((generacion, self.mejor_fitness))

            if generacion % 10 == 0 or generacion == self.max_generaciones:
                 tiempo_transcurrido = time.time() - inicio_bucle
                 promedio = sum(ind.fitness for ind in self.poblacion) / len(self.poblacion) if self.poblacion else float('nan')
                 print(f"  Mejor fitness : {self.mejor_fitness:.4f}")
                 print(f"  Fitness prom. : {promedio:.4f}")
                 print(f"  Sin mejora    : {self.generaciones_sin_mejora_actual}/{self.generaciones_sin_mejora_max}")
                 print(f"  Tiempo        : {tiempo_transcurrido:.2f}s")

            # Criterio 1: Fitness objetivo y validez
            # Es crucial que es_solucion_valida sea fiable
            if self.mejor_fitness >= self.criterio_parada_fitness and self.evaluador.es_solucion_valida(self.mejor_individuo):
                print(f"\n¡Parada por Solución Válida con Fitness >= {self.criterio_parada_fitness} en Gen {generacion}!")
                break
            # Criterio 2: Estancamiento
            if self.generaciones_sin_mejora_actual >= self.generaciones_sin_mejora_max:
                print(f"\nParada por estancamiento ({self.generaciones_sin_mejora_max} gen sin mejora).")
                break

        tiempo_total_ga = time.time() - inicio_bucle
        print(f"\n--- Fin del Algoritmo Genético (Total Generaciones: {generacion}) ---")
        print(f"Tiempo de ejecución del GA: {tiempo_total_ga:.2f}s")
        print(f"Mejor fitness final: {self.mejor_fitness:.4f}")
        if self.mejor_individuo: print(f"({len(self.mejor_individuo.eventos)} eventos en la mejor solución)")

        if self.mejor_individuo is None and self.poblacion:
             print("Advertencia: No se encontró 'mejor_individuo' válido global, devolviendo el mejor de la última población.")
             return self.poblacion[0].clonar()
        elif self.mejor_individuo is None:
             print("Error: No se encontró ninguna solución.")
             return None

        return self.mejor_individuo

    def obtener_estadisticas(self):
        """Devuelve estadísticas sobre la ejecución del algoritmo."""
        detalle = None
        if self.mejor_individuo and hasattr(self.mejor_individuo, 'detalles_evaluacion'):
             detalle = self.mejor_individuo.detalles_evaluacion
        return {
            "generaciones_ejecutadas": len(self.historia_fitness) -1,
            "mejor_fitness": self.mejor_fitness,
            "historia_fitness": self.historia_fitness,
            "generaciones_sin_mejora_final": self.generaciones_sin_mejora_actual,
            "evaluacion_detallada_mejor": detalle
        }