# -*- coding: utf-8 -*-
# filename: genetic/fitness.py

"""
Funciones de fitness para evaluar la calidad de los horarios
"""
from config import BASE_FITNESS, GA_CONFIG # Asumiendo pesos en GA_CONFIG o definidos aquí
from model.horario import Horario
# Importar las nuevas restricciones detalladas
from genetic.constraints_detailed import (
    SolapamientoProfesor, SolapamientoSala, SolapamientoGrupo,
    ProfesorAsignadoCorrecto, SalaCapacidadSuficiente, SlotPermitido,
    HorasMinimasProfesorItem, SincronizacionClaseCompartida, ReglasOrquestal,
    MinimizarHuecos, # Añadir otras blandas si existen
    PENALIZACION_DURA_BASE # Para la cobertura
)

class Evaluador:
    """
    Clase para evaluar la calidad de los horarios según las restricciones detalladas.
    """
    def __init__(self, requisitos_totales, profesores_todos, salas_todas, shared_groups_data, config=GA_CONFIG):
        """
        Inicializa el evaluador con los datos y restricciones configuradas.

        Args:
            requisitos_totales (list[RequisitoClase]): Lista completa de requisitos a programar.
            profesores_todos (list[Profesor]): Lista completa de profesores.
            salas_todas (list[Sala]): Lista completa de salas.
            shared_groups_data (dict): Diccionario de grupos compartidos del DataLoader.
            config (dict): Configuración del GA, incluyendo pesos si se definen ahí.
        """
        self.requisitos_totales = requisitos_totales
        self.profesores_todos = profesores_todos
        self.salas_todas = salas_todas
        self.shared_groups_data = shared_groups_data
        self.base_fitness = config.get("base_fitness", BASE_FITNESS) # Usar valor de config si existe

        # Calcular el total de slots requeridos por todos los requisitos
        self.total_slots_requeridos = sum(r.required_slots for r in requisitos_totales)

        # --- Instanciar Restricciones ---
        # (Leer pesos desde config o usar defaults)
        self.restricciones_duras = [
            SolapamientoProfesor(),
            SolapamientoSala(),
            SolapamientoGrupo(),
            ProfesorAsignadoCorrecto(),
            SalaCapacidadSuficiente(),
            SlotPermitido(),
            HorasMinimasProfesorItem(),
            SincronizacionClaseCompartida(),
            ReglasOrquestal(),
        ]
        self.restricciones_blandas = [
            MinimizarHuecos(),
            # Añadir otras como DistribucionEquilibrada si se implementa
        ]

    def evaluar(self, horario: Horario):
        """
        Evalúa la calidad de un horario según las restricciones. Mayor es mejor.
        Un fitness <= 0 indica una solución inválida (viola restricciones duras).

        Args:
            horario: Objeto Horario a evaluar

        Returns:
            Valor numérico de fitness
        """
        # Pasar datos necesarios al horario para evaluación interna
        # (Alternativa: pasar datos como kwargs a restriccion.evaluar)
        horario.profesores = self.profesores_todos
        horario.requisitos = self.requisitos_totales
        horario.profesores_map = {p.id: p for p in self.profesores_todos} # Crear mapa para acceso rápido


        total_penalizacion_dura = 0
        detalles_evaluacion = {"duras": {}, "blandas": {}}

        # 1. Evaluar Restricciones Duras
        for restriccion in self.restricciones_duras:
            penalizacion = restriccion.evaluar(horario, shared_groups_data=self.shared_groups_data)
            if penalizacion > 0:
                 total_penalizacion_dura += penalizacion
                 # Guardar detalle (opcional)
                 detalles_evaluacion["duras"][restriccion.__class__.__name__] = penalizacion


        # 2. Evaluar Cobertura (como restricción dura implícita)
        # Penalizar fuertemente si no se programan todos los slots requeridos
        total_slots_programados = sum(evento.requisito.slots_per_session for evento in horario.eventos)
        slots_faltantes = self.total_slots_requeridos - total_slots_programados
        penalizacion_cobertura = 0
        if slots_faltantes > 0:
             # Penalización proporcional a los slots faltantes, con peso alto
             penalizacion_cobertura = slots_faltantes * (PENALIZACION_DURA_BASE / 10) # Ajustar multiplicador
             total_penalizacion_dura += penalizacion_cobertura
             detalles_evaluacion["duras"]["CoberturaSlots"] = penalizacion_cobertura


        # 3. Evaluar Restricciones Blandas (Solo si no hay violaciones duras)
        total_penalizacion_blanda = 0
        if total_penalizacion_dura == 0:
            for restriccion in self.restricciones_blandas:
                penalizacion = restriccion.evaluar(horario, shared_groups_data=self.shared_groups_data)
                total_penalizacion_blanda += penalizacion
                # Guardar detalle (opcional)
                detalles_evaluacion["blandas"][restriccion.__class__.__name__] = penalizacion


        # 4. Calcular Fitness Final
        # Si hay CUALQUIER penalización dura, el fitness debe ser muy bajo o negativo.
        if total_penalizacion_dura > 0:
            # Fitness negativo indica invalidez, magnitud indica "cuán inválido"
            fitness = -total_penalizacion_dura - total_penalizacion_blanda
        else:
            # Si es válido, partir de base_fitness y restar penalizaciones blandas
            # Un fitness > 0 indica una solución válida.
            fitness = self.base_fitness - total_penalizacion_blanda

        horario.fitness = fitness
        horario.detalles_evaluacion = detalles_evaluacion # Guardar para análisis

        return fitness

    def es_solucion_valida(self, horario):
        """Verifica si un horario satisface todas las restricciones duras."""
        # Evaluar con fitness=0 puede no ser suficiente si hay errores flotantes
        # Re-evaluar explícitamente restricciones duras
         # Pasar datos necesarios al horario
        horario.profesores = self.profesores_todos
        horario.requisitos = self.requisitos_totales
        horario.profesores_map = {p.id: p for p in self.profesores_todos}

        for restriccion in self.restricciones_duras:
             if restriccion.evaluar(horario, shared_groups_data=self.shared_groups_data) > 0:
                 #print(f"DEBUG: Falla validación en {restriccion.__class__.__name__}")
                 return False

        # Verificar cobertura completa
        total_slots_programados = sum(evento.requisito.slots_per_session for evento in horario.eventos)
        if total_slots_programados < self.total_slots_requeridos:
             #print(f"DEBUG: Falla validación por cobertura incompleta ({total_slots_programados}/{self.total_slots_requeridos})")
             return False

        return True # Si pasa todo, es válida

    # La función detallar_evaluacion se puede basar en horario.detalles_evaluacion
    # o recalcular aquí si se prefiere.