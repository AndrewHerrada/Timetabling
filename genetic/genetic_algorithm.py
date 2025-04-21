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
from genetic.fitness import Evaluador # Asumiendo que está actualizado
from genetic.crossover import CruceDias, CruceEventos # Adaptar o quitar CruceMateriasSeccion si ya no aplica
from genetic.mutation import MutacionCambioHorario, MutacionCambioSala, MutacionIntercambio, MutacionCompuesta
# Importar MutacionCambioProfesor si se implementa
from config import GA_CONFIG

class GeneticAlgorithm:
    """
    Clase principal que implementa el algoritmo genético.
    Adaptada para trabajar con RequisitoClase y asignación de profesores.
    """

    # *** MODIFICAR __init__ para aceptar nuevos argumentos ***
    def __init__(self, requisitos: list[RequisitoClase], # Antes era materias_secciones
                 profesores: list[Profesor], salas: list[Sala],
                 evaluador: Evaluador,
                 generador_cromosomas, # Pasar el objeto generador
                 shared_groups_data: dict, # Pasar datos de grupos compartidos
                 tamaño_poblacion=None, prob_cruce=None, prob_mutacion=None,
                 elitismo=None, max_generaciones=None,
                 # Añadir nuevos parámetros desde main si es necesario
                 criterio_parada_fitness=None, generaciones_sin_mejora=None):
        """
        Inicializa el algoritmo genético.

        Args:
            requisitos: Lista de objetos RequisitoClase a programar.
            profesores: Lista completa de objetos Profesor.
            salas: Lista completa de objetos Sala.
            evaluador: Objeto Evaluador para calcular fitness.
            generador_cromosomas: Objeto GeneradorCromosomas (ya inicializado).
            shared_groups_data: Diccionario con info de grupos compartidos.
            tamaño_poblacion: Tamaño de la población.
            prob_cruce: Probabilidad de cruce.
            prob_mutacion: Probabilidad de mutación.
            elitismo: Número de mejores individuos que pasan directamente.
            max_generaciones: Número máximo de generaciones.
            criterio_parada_fitness: Fitness objetivo para parada temprana.
            generaciones_sin_mejora: Generaciones sin mejora para parada temprana.
        """
        self.requisitos = requisitos
        self.profesores = profesores
        self.salas = salas
        self.evaluador = evaluador
        self.generador = generador_cromosomas # Usar el generador pasado
        self.shared_groups_data = shared_groups_data

        # Configuración del algoritmo (usar valores pasados o de GA_CONFIG)
        self.tamaño_poblacion = tamaño_poblacion if tamaño_poblacion is not None else GA_CONFIG["tamaño_poblacion"]
        self.prob_cruce = prob_cruce if prob_cruce is not None else GA_CONFIG["prob_cruce"]
        self.prob_mutacion = prob_mutacion if prob_mutacion is not None else GA_CONFIG["prob_mutacion"]
        self.elitismo = elitismo if elitismo is not None else GA_CONFIG["elitismo"]
        self.max_generaciones = max_generaciones if max_generaciones is not None else GA_CONFIG["max_generaciones"]

        # Criterios de parada
        # Nota: El fitness > 0 ahora indica validez. Un criterio fijo puede no ser ideal.
        # Usamos 1 como valor mínimo para una solución válida si no se especifica otro.
        self.criterio_parada_fitness = criterio_parada_fitness if criterio_parada_fitness is not None else GA_CONFIG.get("criterio_parada_fitness", 1)
        self.generaciones_sin_mejora_max = generaciones_sin_mejora if generaciones_sin_mejora is not None else GA_CONFIG.get("generaciones_sin_mejora", 50)


        # *** Inicializar generador (ya no se hace aquí, se recibe) ***
        # self.generador = GeneradorCromosomas(requisitos, profesores, salas, shared_groups_data)

        # --- Inicializar operadores genéticos ---
        # (Necesitan ser adaptados para la nueva estructura si no lo están ya)
        self.operadores_cruce = [
            # Revisar si estos cruces tienen sentido con la nueva estructura y restricciones
            CruceDias(probabilidad=self.prob_cruce),
            CruceEventos(probabilidad=self.prob_cruce),
            # CruceMateriasSeccion probablemente ya no aplica directamente
        ]

        # Añadir MutacionCambioProfesor y asegurar que las otras están adaptadas
        self.operador_mutacion = MutacionCompuesta([
            MutacionCambioHorario(probabilidad=self.prob_mutacion), # Necesita adaptación interna
            MutacionCambioSala(probabilidad=self.prob_mutacion / 2, salas=self.salas), # Necesita adaptación interna
            MutacionIntercambio(probabilidad=self.prob_mutacion / 2), # Necesita adaptación interna
            # TODO: Añadir MutacionCambioProfesor(probabilidad=self.prob_mutacion)
        ])
        # -----------------------------------------

        # Población actual
        self.poblacion = []
        self.mejor_individuo = None
        self.mejor_fitness = -float('inf') # Iniciar con fitness muy bajo

        # Estadísticas
        self.generaciones_sin_mejora_actual = 0
        self.historia_fitness = []

    def inicializar_poblacion(self):
        """
        Inicializa la población usando el GeneradorCromosomas.
        """
        self.poblacion = []
        print(f"Generando población inicial de tamaño {self.tamaño_poblacion}...")

        # TODO: Considerar diferentes estrategias de generación (aleatoria vs heurística)
        # Por ahora, solo usamos la generación (aleatoria por defecto) del generador
        for i in range(self.tamaño_poblacion):
            # Asume que el generador tiene un método como generar() o generar_aleatorio()
            # que devuelve un objeto Horario
            try:
                 # Usamos generar_aleatorio que definimos antes
                 horario_inicial = self.generador.generar_aleatorio()
                 self.poblacion.append(horario_inicial)
                 if (i + 1) % 10 == 0: print(f"  Generado individuo {i+1}/{self.tamaño_poblacion}")
            except Exception as e:
                 print(f"Error generando individuo inicial {i+1}: {e}")
                 # Decide si continuar o abortar. Continuemos por ahora.

        if not self.poblacion:
             raise RuntimeError("No se pudo generar ningún individuo para la población inicial.")

        print("Población inicial generada. Evaluando...")
        self._evaluar_poblacion()

    def _evaluar_poblacion(self):
        """Evalúa todos los individuos de la población actual."""
        fitness_actual = []
        for individuo in self.poblacion:
            fit = self.evaluador.evaluar(individuo)
            fitness_actual.append(fit)

        # Ordenar por fitness (mayor a menor)
        self.poblacion.sort(key=lambda x: x.fitness, reverse=True)

        # Actualizar mejor individuo
        if self.poblacion and self.poblacion[0].fitness > self.mejor_fitness:
            # Hacer copia profunda del mejor individuo encontrado
            self.mejor_individuo = self.poblacion[0].clonar()
            # Actualizar el mejor fitness registrado
            self.mejor_fitness = self.mejor_individuo.fitness # Usar fitness del clonado
            self.generaciones_sin_mejora_actual = 0
            print(f"  Nuevo mejor fitness encontrado: {self.mejor_fitness:.4f}")
        else:
            self.generaciones_sin_mejora_actual += 1

    def _seleccion_torneo(self, tamaño_torneo=3):
        """Selecciona un individuo mediante torneo."""
        if not self.poblacion: return None # No hay población para seleccionar
        # Asegurar que el tamaño del torneo no exceda el tamaño de la población
        tamaño_real_torneo = min(tamaño_torneo, len(self.poblacion))
        if tamaño_real_torneo <= 0: return None # No se puede hacer torneo

        participantes = random.sample(self.poblacion, tamaño_real_torneo)
        # Devolver el participante con el mayor fitness
        return max(participantes, key=lambda x: x.fitness)

    def _siguiente_generacion(self):
        """Evoluciona la población a la siguiente generación."""
        nueva_poblacion = []

        # Elitismo: pasar los mejores directamente (asegúrate que self.elitismo <= tamaño_poblacion)
        num_elite = min(self.elitismo, len(self.poblacion))
        if num_elite > 0:
             # Pasar clones para evitar modificaciones accidentales
             nueva_poblacion.extend([ind.clonar() for ind in self.poblacion[:num_elite]])

        # Generar el resto mediante selección, cruce y mutación
        while len(nueva_poblacion) < self.tamaño_poblacion:
            # Seleccionar padres
            padre1 = self._seleccion_torneo()
            padre2 = self._seleccion_torneo()

            # Si la selección falla (población muy pequeña?), usar aleatorios o los elite
            if padre1 is None or padre2 is None:
                 print("Advertencia: Selección de padres falló, usando elite/aleatorios.")
                 padre1 = self.poblacion[0] if self.poblacion else None
                 padre2 = self.poblacion[min(1, len(self.poblacion)-1)] if len(self.poblacion) > 1 else padre1
                 if padre1 is None: break # No se puede continuar si no hay padres

            # Clonar padres antes de cruce/mutación
            hijo1 = padre1.clonar()
            hijo2 = padre2.clonar()

            # Aplicar cruce con cierta probabilidad
            if random.random() < self.prob_cruce and len(self.operadores_cruce) > 0:
                # Elegir operador de cruce aleatorio
                operador_cruce = random.choice(self.operadores_cruce)
                try:
                    # El operador de cruce debe devolver dos nuevos horarios (hijos)
                    hijo1_cruzado, hijo2_cruzado = operador_cruce.cruzar(hijo1, hijo2)
                    # Reemplazar los clones originales con los hijos cruzados
                    hijo1 = hijo1_cruzado
                    hijo2 = hijo2_cruzado
                    # ¡Importante! Los hijos deben tener índices reconstruidos si cruce los altera
                    # Asumiendo que cruzar() devuelve horarios con índices correctos o clonar() lo hace.
                    # Si no, llamar a _reconstruir_indices_y_estado() aquí.
                    hijo1._reconstruir_indices_y_estado()
                    hijo2._reconstruir_indices_y_estado()

                except NotImplementedError:
                     print(f"Advertencia: Operador de cruce {operador_cruce.__class__.__name__} no implementado.")
                except Exception as e:
                     print(f"Error durante el cruce con {operador_cruce.__class__.__name__}: {e}")
                     # Mantener los clones originales si el cruce falla
                     hijo1 = padre1.clonar()
                     hijo2 = padre2.clonar()


            # Aplicar mutación a los hijos (o clones si no hubo cruce)
            # El operador mutar() modifica el horario in-place
            try:
                 self.operador_mutacion.mutar(hijo1) # Modifica hijo1
                 self.operador_mutacion.mutar(hijo2) # Modifica hijo2
                 # La mutación también debe asegurar que los índices se actualicen si es necesario.
                 # Si mutar() no lo hace, llamar a _reconstruir_indices_y_estado() aquí.
                 hijo1._reconstruir_indices_y_estado()
                 hijo2._reconstruir_indices_y_estado()
            except Exception as e:
                 print(f"Error durante la mutación: {e}")
                 # Podríamos decidir si descartar los hijos mutados o continuar

            # Agregar hijos a la nueva población hasta llenarla
            if len(nueva_poblacion) < self.tamaño_poblacion:
                nueva_poblacion.append(hijo1)
            if len(nueva_poblacion) < self.tamaño_poblacion:
                nueva_poblacion.append(hijo2)

        # Actualizar población
        self.poblacion = nueva_poblacion

    def ejecutar(self):
        """Ejecuta el algoritmo genético."""
        print("\n--- Ejecución del Algoritmo Genético ---")
        try:
            self.inicializar_poblacion()
        except RuntimeError as e:
             print(f"Error fatal: {e}")
             return None
        except Exception as e:
            print(f"Error inesperado durante la inicialización: {e}")
            import traceback; traceback.print_exc()
            return None


        print(f"Población inicial evaluada. Mejor fitness inicial: {self.mejor_fitness:.4f}")
        self.historia_fitness.append((0, self.mejor_fitness))

        inicio_bucle = time.time()
        for generacion in range(1, self.max_generaciones + 1):
            print(f"\n--- Generación {generacion}/{self.max_generaciones} ---")

            # Evolucionar a siguiente generación
            self._siguiente_generacion()

            # Evaluar nueva población
            self._evaluar_poblacion()

            # Guardar estado
            self.historia_fitness.append((generacion, self.mejor_fitness))

            # Mostrar progreso
            if generacion % 10 == 0 or generacion == self.max_generaciones:
                 tiempo_transcurrido = time.time() - inicio_bucle
                 if self.poblacion: # Asegurarse que hay población
                     promedio = sum(ind.fitness for ind in self.poblacion) / len(self.poblacion)
                 else: promedio = float('nan')
                 print(f"  Mejor fitness actual: {self.mejor_fitness:.4f}")
                 print(f"  Fitness promedio: {promedio:.4f}")
                 print(f"  Generaciones sin mejora: {self.generaciones_sin_mejora_actual}")
                 print(f"  Tiempo transcurrido: {tiempo_transcurrido:.2f}s")


            # Verificar criterios de parada
            # Criterio 1: Fitness objetivo alcanzado (solución válida encontrada)
            # Un fitness > 0 significa que no viola restricciones duras ni cobertura
            if self.mejor_fitness >= self.criterio_parada_fitness and self.evaluador.es_solucion_valida(self.mejor_individuo):
                print(f"\n¡Parada por alcanzar fitness objetivo ({self.criterio_parada_fitness}) y ser válida en generación {generacion}!")
                break

            # Criterio 2: Estancamiento
            if self.generaciones_sin_mejora_actual >= self.generaciones_sin_mejora_max:
                print(f"\nParada por estancamiento tras {self.generaciones_sin_mejora_max} generaciones sin mejora.")
                break

        tiempo_total_ga = time.time() - inicio_bucle
        print(f"\n--- Fin del Algoritmo Genético (Total Generaciones: {generacion}) ---")
        print(f"Tiempo de ejecución del GA: {tiempo_total_ga:.2f}s")
        print(f"Mejor fitness final alcanzado: {self.mejor_fitness:.4f}")

        if self.mejor_individuo is None:
             print("Advertencia: No se encontró ningún individuo como 'mejor solución'.")
             # Podría devolver el mejor de la última población aunque sea malo?
             if self.poblacion:
                  return self.poblacion[0].clonar() # Devolver el mejor encontrado, aunque sea inválido
             else: return None


        return self.mejor_individuo # Devuelve el clon del mejor individuo válido encontrado

    # obtener_estadisticas() probablemente necesite actualizarse para usar detalles_evaluacion
    def obtener_estadisticas(self):
        """Devuelve estadísticas sobre la ejecución del algoritmo."""
        detalle = None
        if self.mejor_individuo and hasattr(self.mejor_individuo, 'detalles_evaluacion'):
             detalle = self.mejor_individuo.detalles_evaluacion

        return {
            "generaciones_ejecutadas": len(self.historia_fitness) -1, # Excluye inicial
            "mejor_fitness": self.mejor_fitness,
            "historia_fitness": self.historia_fitness,
            # "tiempo_ejecucion": # Se calcula en main.py
            "generaciones_sin_mejora_final": self.generaciones_sin_mejora_actual,
            "evaluacion_detallada_mejor": detalle
        }