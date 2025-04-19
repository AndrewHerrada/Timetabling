#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Clases para la representación cromosómica en el algoritmo genético
"""

import random
import copy
from model.evento import Evento
from model.horario import Horario
from config import NUM_DIAS, NUM_PERIODOS

class GeneradorCromosomas:
    """
    Clase responsable de generar cromosomas iniciales para el algoritmo genético.
    """
    
    def __init__(self, profesores, materias_secciones, salas):
        """
        Inicializa el generador con los datos disponibles.
        
        Args:
            profesores: Lista de objetos Profesor
            materias_secciones: Lista de objetos MateriaSecciones
            salas: Lista de objetos Sala
        """
        self.profesores = profesores
        self.materias_secciones = materias_secciones
        self.salas = salas
    
    def generar_aleatorio(self):
        """
        Genera un horario (cromosoma) de forma totalmente aleatoria.
        
        Returns:
            Objeto Horario con asignaciones aleatorias
        """
        horario = Horario()
        
        # Ordenar materias_secciones por horas semanales (priorizar las que tienen más horas)
        materias_ordenadas = sorted(
            copy.deepcopy(self.materias_secciones),
            key=lambda ms: ms.materia.horas_semanales,
            reverse=True
        )
        
        # Para cada materia-sección, intentar asignar todas sus horas
        for ms in materias_ordenadas:
            # Determinar profesor a asignar
            if ms.profesor_especifico:
                # Si la sección requiere un profesor específico
                profesor = next((p for p in self.profesores if p.id == ms.profesor_especifico), None)
                if not profesor:
                    continue  # Saltar si no se encuentra el profesor específico
            else:
                # Buscar profesores que puedan impartir la materia
                profesores_posibles = [p for p in self.profesores if p.puede_impartir(ms.materia.id)]
                if not profesores_posibles:
                    continue  # Saltar si no hay profesores disponibles
                
                # Priorizar profesores con ítem que necesitan más horas
                profesores_posibles.sort(key=lambda p: (p.tiene_item and p.horas_asignadas < 14, -p.horas_asignadas))
                profesor = profesores_posibles[0]
            
            # Buscar salas adecuadas
            salas_posibles = [s for s in self.salas 
                             if s.es_adecuada_para_nivel(ms.materia.nivel) 
                             and s.tiene_equipamiento(ms.materia.requiere_equipamiento)]
            
            if not salas_posibles:
                continue  # Saltar si no hay salas adecuadas
            
            # Intentar asignar todas las horas requeridas
            horas_pendientes = ms.horas_pendientes()
            intentos = 0
            max_intentos = 100  # Límite para evitar bucles infinitos
            
            while horas_pendientes > 0 and intentos < max_intentos:
                # Seleccionar sala aleatoria de las posibles
                sala = random.choice(salas_posibles)
                
                # Seleccionar día y hora aleatorios
                dia = random.randint(0, NUM_DIAS - 1)
                hora = random.randint(0, NUM_PERIODOS - 1)
                
                # Verificar disponibilidad del profesor
                if not profesor.esta_disponible(dia, hora):
                    intentos += 1
                    continue
                
                # Crear evento
                evento = Evento(profesor, ms, sala, dia, hora)
                
                # Intentar agregar al horario
                if horario.agregar_evento(evento):
                    horas_pendientes -= 1
                
                intentos += 1
        
        return horario
    
    def generar_heuristico(self):
        """
        Genera un horario (cromosoma) utilizando heurísticas para mejorar la calidad inicial.
        
        Returns:
            Objeto Horario con asignaciones basadas en heurísticas
        """
        horario = Horario()
        
        # Ordenar materias_secciones por horas semanales (priorizar las que tienen más horas)
        materias_ordenadas = sorted(
            copy.deepcopy(self.materias_secciones),
            key=lambda ms: ms.materia.horas_semanales,
            reverse=True
        )
        
        # Priorizar las materias que requieren profesor específico
        materias_ordenadas.sort(key=lambda ms: 1 if ms.profesor_especifico else 0, reverse=True)
        
        # Para cada materia-sección, intentar asignar todas sus horas
        for ms in materias_ordenadas:
            # Determinar profesor a asignar
            if ms.profesor_especifico:
                # Si la sección requiere un profesor específico
                profesor = next((p for p in self.profesores if p.id == ms.profesor_especifico), None)
                if not profesor:
                    continue  # Saltar si no se encuentra el profesor específico
            else:
                # Buscar profesores que puedan impartir la materia
                profesores_posibles = [p for p in self.profesores if p.puede_impartir(ms.materia.id)]
                if not profesores_posibles:
                    continue  # Saltar si no hay profesores disponibles
                
                # Priorizar profesores con ítem que necesitan más horas
                profesores_posibles.sort(key=lambda p: (p.tiene_item and p.horas_asignadas < 14, -p.horas_asignadas))
                profesor = profesores_posibles[0]
            
            # Buscar salas adecuadas
            salas_posibles = [s for s in self.salas 
                             if s.es_adecuada_para_nivel(ms.materia.nivel) 
                             and s.tiene_equipamiento(ms.materia.requiere_equipamiento)]
            
            if not salas_posibles:
                continue  # Saltar si no hay salas adecuadas
            
            # Obtener matriz de eventos del profesor para distribuir clases
            matriz_profesor = horario.obtener_matriz_horario('profesor', profesor.id)
            
            # Intentar asignar todas las horas requeridas
            horas_pendientes = ms.horas_pendientes()
            max_intentos_por_hora = 50
            
            while horas_pendientes > 0:
                mejor_evento = None
                mejor_valoracion = -float('inf')
                
                # Probar diferentes combinaciones para encontrar la mejor asignación
                for _ in range(max_intentos_por_hora):
                    # Seleccionar sala aleatoria de las posibles
                    sala = random.choice(salas_posibles)
                    
                    # Seleccionar día y hora de forma más inteligente
                    # Buscar espacios donde el profesor no tenga clases adyacentes para reducir huecos
                    dias_candidatos = list(range(NUM_DIAS))
                    random.shuffle(dias_candidatos)
                    
                    for dia in dias_candidatos:
                        horas_candidatas = list(range(NUM_PERIODOS))
                        random.shuffle(horas_candidatas)
                        
                        for hora in horas_candidatas:
                            # Verificar si el profesor está disponible
                            if not profesor.esta_disponible(dia, hora):
                                continue
                            
                            # Crear evento candidato
                            evento = Evento(profesor, ms, sala, dia, hora)
                            
                            # Verificar si hay conflictos
                            if (horario.tiene_conflicto_profesor(evento) or 
                                horario.tiene_conflicto_sala(evento) or 
                                horario.tiene_conflicto_grupo(evento)):
                                continue
                            
                            # Calcular valoración de este evento (menor es mejor)
                            valoracion = 0
                            
                            # Penalizar si crea huecos en el horario del profesor
                            tiene_clase_anterior = (hora > 0 and matriz_profesor[dia][hora-1] is not None)
                            tiene_clase_posterior = (hora < NUM_PERIODOS-1 and matriz_profesor[dia][hora+1] is not None)
                            
                            if (hora > 0 and hora < NUM_PERIODOS-1 and 
                                not tiene_clase_anterior and not tiene_clase_posterior and
                                any(matriz_profesor[dia][h] is not None for h in range(NUM_PERIODOS))):
                                valoracion -= 10  # Penalizar creación de huecos
                            
                            # Favorecer clases consecutivas de la misma materia
                            if (hora > 0 and matriz_profesor[dia][hora-1] is not None and 
                                matriz_profesor[dia][hora-1].materia_seccion.materia.id == ms.materia.id):
                                valoracion += 5
                            if (hora < NUM_PERIODOS-1 and matriz_profesor[dia][hora+1] is not None and 
                                matriz_profesor[dia][hora+1].materia_seccion.materia.id == ms.materia.id):
                                valoracion += 5
                            
                            # Favorecer distribución uniforme a lo largo de la semana
                            eventos_por_dia = [sum(1 for h in range(NUM_PERIODOS) if matriz_profesor[d][h] is not None) 
                                              for d in range(NUM_DIAS)]
                            if eventos_por_dia[dia] < max(eventos_por_dia):
                                valoracion += 3
                            
                            if valoracion > mejor_valoracion:
                                mejor_valoracion = valoracion
                                mejor_evento = evento
                
                # Si se encontró un evento adecuado, agregarlo al horario
                if mejor_evento:
                    if horario.agregar_evento(mejor_evento):
                        horas_pendientes -= 1
                        # Actualizar matriz del profesor
                        matriz_profesor[mejor_evento.dia][mejor_evento.hora] = mejor_evento
                    else:
                        # Si no se pudo agregar, reducir intentos pendientes
                        horas_pendientes -= 1
                else:
                    # Si no se encontró un evento adecuado tras los intentos, desistir
                    horas_pendientes -= 1
        
        return horario