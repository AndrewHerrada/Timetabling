# -*- coding: utf-8 -*-
"""
Punto de entrada principal para el sistema de generación de horarios
mediante algoritmos genéticos.
"""
import os
import time
import random
import copy
# Importar componentes actualizados
from utils.data_loader import DataLoader, DataLoaderError
from model.horario import Horario
from model.profesor import Profesor
from model.sala import Sala
from model.requisito_clase import RequisitoClase
from genetic.genetic_algorithm import GeneticAlgorithm # Asumiendo que se adaptará internamente
from genetic.fitness import Evaluador # Usará las nuevas restricciones
# Importar restricciones específicas si se usan directamente o si Evaluador las necesita
# from genetic.constraints_detailed import ... # Si se usan aquí
from genetic.chromosomes import GeneradorCromosomas # Actualizado
from utils.visualization import Visualizador # Necesita ser actualizado
from config import GA_CONFIG # Cargar configuración del AG

# --- Rutas a los archivos CSV (Ajustar según tu estructura) ---
RUTA_PROFESORES_CSV = "db/Profesor.xlsx - Hoja1.csv"
RUTA_SALAS_CSV = "db/Sala.xlsx - Hoja1.csv"
RUTA_REQUISITOS_CSV = "db/tabla_minable.xlsx - Sheet1.csv"
RUTA_RESULTADOS = "resultados"

def main():
    """
    Función principal que coordina el proceso de generación de horarios
    """
    start_total_time = time.time()
    random.seed(42)  # Para reproducibilidad

    print("--- Inicializando Sistema de Generación de Horarios ---")

    # --- Carga de Datos ---
    print("\n--- Cargando Datos ---")
    data_loader = DataLoader() # Usa HORAS_DIA, DIAS_SEMANA de config.py por defecto
    try:
        profesores = data_loader.cargar_profesores(RUTA_PROFESORES_CSV)
        salas = data_loader.cargar_salas(RUTA_SALAS_CSV)
        requisitos = data_loader.cargar_requisitos_clase(RUTA_REQUISITOS_CSV)
        shared_groups_data = data_loader.get_shared_groups() # Obtener info de grupos compartidos
        
        print(f"\nDatos cargados:")
        print(f"- {len(profesores)} Profesores")
        print(f"- {len(salas)} Salas")
        print(f"- {len(requisitos)} Requisitos de Clase")
        print(f"- {len(shared_groups_data)} Grupos Compartidos")
        
        if not requisitos:
             print("Error fatal: No se cargaron requisitos válidos. Abortando.")
             return None

    except DataLoaderError as e:
        print(f"\nError fatal durante la carga de datos: {e}")
        return None
    except Exception as e:
         print(f"\nError inesperado durante la carga de datos: {e}")
         import traceback
         traceback.print_exc()
         return None

    # --- Configuración del Evaluador ---
    print("\n--- Configurando Evaluador de Fitness ---")
    evaluador = Evaluador(
        requisitos_totales=requisitos,
        profesores_todos=profesores,
        salas_todas=salas,
        shared_groups_data=shared_groups_data,
        config=GA_CONFIG # Pasar config por si se usa ahí
    )
    print("Evaluador configurado.")

    # --- Configuración del Algoritmo Genético ---
    # (Asume que GeneticAlgorithm y GeneradorCromosomas usan la nueva estructura)
    print("\n--- Configurando Algoritmo Genético ---")
    generador_cromosomas = GeneradorCromosomas(requisitos, profesores, salas, shared_groups_data)

    # Crear instancia del AG (Asegúrate que GeneticAlgorithm internamente
    # llama a generador_cromosomas.generar_aleatorio() o similar)
    ga = GeneticAlgorithm(
        profesores=profesores, # Podrían no ser necesarios si usa requisitos
        # Pasar requisitos en lugar de materias_secciones
        requisitos=requisitos,
        salas=salas, # Podrían no ser necesarios si usa requisitos
        evaluador=evaluador,
        generador_cromosomas=generador_cromosomas, # Pasar el generador actualizado
        shared_groups_data=shared_groups_data, # Pasar grupos compartidos
        # Leer parámetros del GA desde config.py
        tamaño_poblacion=GA_CONFIG.get("tamaño_poblacion", 100),
        prob_cruce=GA_CONFIG.get("prob_cruce", 0.8),
        prob_mutacion=GA_CONFIG.get("prob_mutacion", 0.2),
        elitismo=GA_CONFIG.get("elitismo", 5),
        max_generaciones=GA_CONFIG.get("max_generaciones", 500),
        # Añadir nuevos criterios de parada si existen en config
        criterio_parada_fitness=GA_CONFIG.get("criterio_parada_fitness", 0), # Fitness > 0 es válido
        generaciones_sin_mejora=GA_CONFIG.get("generaciones_sin_mejora", 50)
    )
    print("Algoritmo Genético configurado.")


    # --- Ejecución del Algoritmo Genético ---
    print("\n--- Iniciando Algoritmo Genético ---")
    start_ga_time = time.time()
    mejor_horario_final = ga.ejecutar() # Asume que ejecutar() devuelve el mejor Horario
    end_ga_time = time.time()
    print(f"--- Algoritmo Genético Finalizado (Tiempo: {end_ga_time - start_ga_time:.2f}s) ---")

    if mejor_horario_final is None:
        print("\nError: El algoritmo genético no devolvió una solución.")
        return None
        
    # Validar la mejor solución encontrada
    print("\n--- Validando la Mejor Solución Encontrada ---")
    es_valida = evaluador.es_solucion_valida(mejor_horario_final)
    print(f"¿La mejor solución es válida (cumple restricciones duras y cobertura)? {'Sí' if es_valida else 'No'}")
    print(f"Fitness final: {mejor_horario_final.fitness:.2f}")
    # Imprimir detalles de evaluación si existen
    if hasattr(mejor_horario_final, 'detalles_evaluacion'):
         print("Detalles de evaluación:")
         # print(mejor_horario_final.detalles_evaluacion) # Puede ser muy verboso
         violaciones_duras = {k:v for k,v in mejor_horario_final.detalles_evaluacion.get("duras", {}).items() if v > 0}
         violaciones_blandas = {k:v for k,v in mejor_horario_final.detalles_evaluacion.get("blandas", {}).items() if v > 0}
         if violaciones_duras:
             print(f"  Violaciones Duras: {violaciones_duras}")
         else:
             print("  Sin violaciones duras detectadas.")
         if violaciones_blandas:
              print(f"  Penalizaciones Blandas: {violaciones_blandas}")


    # --- Visualización y Exportación ---
    print("\n--- Generando Salidas ---")
    try:
        # Crear directorio de resultados si no existe
        if not os.path.exists(RUTA_RESULTADOS):
            os.makedirs(RUTA_RESULTADOS)
            print(f"Directorio creado: {RUTA_RESULTADOS}")

        # Instanciar visualizador actualizado
        visualizador = Visualizador(profesores, salas, requisitos, shared_groups_data)

        # Exportar a Excel
        archivo_excel = os.path.join(RUTA_RESULTADOS, "horario_generado.xlsx")
        visualizador.exportar_excel(mejor_horario_final, archivo_excel)
        print(f"Horario exportado a: {archivo_excel}")

        # Generar resumen de estadísticas
        archivo_resumen = os.path.join(RUTA_RESULTADOS, "resumen_horario.txt")
        visualizador.generar_resumen(mejor_horario_final, archivo_resumen, evaluador) # Pasar evaluador para re-validar
        print(f"Resumen generado en: {archivo_resumen}")

    except ImportError as e:
         print(f"\nError: Falta biblioteca para exportar/visualizar (puede ser 'openpyxl'). Instálala (`pip install openpyxl`). Error: {e}")
    except Exception as e:
         print(f"\nError durante la visualización/exportación: {e}")
         import traceback
         traceback.print_exc()

    end_total_time = time.time()
    print(f"\n--- Proceso Completo Finalizado (Tiempo Total: {end_total_time - start_total_time:.2f}s) ---")

    return mejor_horario_final


if __name__ == "__main__":
    # Ejecutar la función principal y almacenar el resultado si es necesario
    horario_resultado = main()
    # Puedes añadir código aquí para hacer algo más con el horario_resultado si lo deseas
    if horario_resultado:
         print("\nEjecución de main() completada.")
    else:
         print("\nEjecución de main() fallida o no produjo resultado.")