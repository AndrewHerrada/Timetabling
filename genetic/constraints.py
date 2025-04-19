#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Restricciones para el problema de timetabling
"""

class Restriccion:
    """
    Clase base para las restricciones del problema.
    """
    
    def __init__(self, peso):
        """
        Inicializa una restricción con un peso asociado.
        
        Args:
            peso: Peso numérico que indica la importancia de la restricción
        """
        self.peso = peso
    
    def evaluar(self, horario):
        """
        Evalúa el cumplimiento de la restricción en un horario.
        
        Args:
            horario: Objeto Horario a evaluar
            
        Returns:
            Número de violaciones de la restricción (0 si se cumple completamente)
        """
        raise NotImplementedError("Método no implementado en clase base")


#========================
# Restricciones Duras
#========================

class ProfesorNoSimultaneo(Restriccion):
    """
    Restricción: un profesor no puede impartir dos clases simultáneamente.
    """
    
    def evaluar(self, horario):
        """
        Cuenta el número de conflictos de profesor en el horario.
        
        Args:
            horario: Objeto Horario a evaluar
            
        Returns:
            Número de conflictos detectados
        """
        # Agrupar eventos por profesor, día y hora
        eventos_profesor = {}
        for evento in horario.eventos:
            clave = (evento.profesor.id, evento.dia, evento.hora)
            if clave not in eventos_profesor:
                eventos_profesor[clave] = []
            eventos_profesor[clave].append(evento)
        
        # Contar conflictos (más de un evento para el mismo profesor, día y hora)
        conflictos = sum(len(eventos) - 1 for eventos in eventos_profesor.values() if len(eventos) > 1)
        
        return conflictos


class SalaNoSimultanea(Restriccion):
    """
    Restricción: una sala no puede albergar dos clases simultáneamente.
    """
    
    def evaluar(self, horario):
        """
        Cuenta el número de conflictos de sala en el horario.
        
        Args:
            horario: Objeto Horario a evaluar
            
        Returns:
            Número de conflictos detectados
        """
        # Agrupar eventos por sala, día y hora
        eventos_sala = {}
        for evento in horario.eventos:
            clave = (evento.sala.id, evento.dia, evento.hora)
            if clave not in eventos_sala:
                eventos_sala[clave] = []
            eventos_sala[clave].append(evento)
        
        # Contar conflictos (más de un evento para la misma sala, día y hora)
        conflictos = sum(len(eventos) - 1 for eventos in eventos_sala.values() if len(eventos) > 1)
        
        return conflictos


class GrupoNoSimultaneo(Restriccion):
    """
    Restricción: un grupo/sección no puede asistir a dos clases simultáneamente.
    """
    
    def evaluar(self, horario):
        """
        Cuenta el número de conflictos de grupo/sección en el horario.
        
        Args:
            horario: Objeto Horario a evaluar
            
        Returns:
            Número de conflictos detectados
        """
        # Agrupar eventos por sección, día y hora
        eventos_seccion = {}
        for evento in horario.eventos:
            clave = (evento.materia_seccion.seccion, evento.dia, evento.hora)
            if clave not in eventos_seccion:
                eventos_seccion[clave] = []
            eventos_seccion[clave].append(evento)
        
        # Contar conflictos (más de un evento para la misma sección, día y hora)
        conflictos = sum(len(eventos) - 1 for eventos in eventos_seccion.values() if len(eventos) > 1)
        
        return conflictos


class ProfesorMinHoras(Restriccion):
    """
    Restricción: profesores con ítem deben tener al menos 14 horas asignadas.
    """
    
    def evaluar(self, horario):
        """
        Cuenta la diferencia entre las horas asignadas y las 14 horas mínimas
        para profesores con ítem.
        
        Args:
            horario: Objeto Horario a evaluar
            
        Returns:
            Suma de horas faltantes para todos los profesores con ítem
        """
        # Contabilizar horas por profesor
        horas_profesor = {}
        for evento in horario.eventos:
            prof_id = evento.profesor.id
            if prof_id not in horas_profesor:
                horas_profesor[prof_id] = 0
            horas_profesor[prof_id] += 1  # Cada evento cuenta como 1 hora
        
        # Verificar profesores con ítem que no cumplen las 14 horas mínimas
        violaciones = 0
        profesores_con_item = {e.profesor.id for e in horario.eventos if e.profesor.tiene_item}
        
        for prof_id in profesores_con_item:
            horas = horas_profesor.get(prof_id, 0)
            if horas < 14:
                violaciones += (14 - horas)
        
        return violaciones


class SalaNivelCorrecto(Restriccion):
    """
    Restricción: las salas de nivel infantil solo pueden ser utilizadas
    para clases de nivel infantil y viceversa.
    """
    
    def evaluar(self, horario):
        """
        Cuenta el número de asignaciones incorrectas de sala según nivel.
        
        Args:
            horario: Objeto Horario a evaluar
            
        Returns:
            Número de asignaciones incorrectas
        """
        violaciones = 0
        
        for evento in horario.eventos:
            nivel_materia = evento.materia_seccion.materia.nivel
            nivel_sala = evento.sala.nivel
            
            # Verificar restricción específica: nivel infantil exclusivo
            if nivel_sala == "infantil" and nivel_materia != "infantil":
                violaciones += 1
            
            if nivel_materia == "infantil" and nivel_sala != "infantil":
                violaciones += 1
        
        return violaciones


class AsignacionEspecifica(Restriccion):
    """
    Restricción: hay profesores que deben encargarse específicamente
    de una materia si la sección así lo desea.
    """
    
    def evaluar(self, horario):
        """
        Cuenta el número de asignaciones que no respetan las asignaciones
        específicas de profesores a materias-secciones.
        
        Args:
            horario: Objeto Horario a evaluar
            
        Returns:
            Número de asignaciones incorrectas
        """
        violaciones = 0
        
        for evento in horario.eventos:
            # Si la materia-sección requiere un profesor específico
            if evento.materia_seccion.profesor_especifico is not None:
                # Y el profesor asignado no es el requerido
                if evento.profesor.id != evento.materia_seccion.profesor_especifico:
                    violaciones += 1
        
        return violaciones


#========================
# Restricciones Blandas
#========================

class MinimizarHuecos(Restriccion):
    """
    Restricción blanda: minimizar los "huecos" en los horarios de los profesores.
    """
    
    def evaluar(self, horario):
        """
        Calcula el número total de huecos en los horarios de los profesores.
        Un hueco es un período libre entre dos períodos ocupados en el mismo día.
        
        Args:
            horario: Objeto Horario a evaluar
            
        Returns:
            Número total de huecos
        """
        total_huecos = 0
        
        # Obtener todos los profesores únicos
        profesores = {evento.profesor.id for evento in horario.eventos}
        
        # Calcular huecos para cada profesor
        for prof_id in profesores:
            total_huecos += horario.obtener_huecos_profesor(prof_id)
        
        return total_huecos


class DistribucionEquilibrada(Restriccion):
    """
    Restricción blanda: distribuir equilibradamente las clases a lo largo de la semana.
    """
    
    def evaluar(self, horario):
        """
        Calcula el desequilibrio en la distribución de clases por día.
        
        Args:
            horario: Objeto Horario a evaluar
            
        Returns:
            Medida del desequilibrio (desviación estándar de clases por día)
        """
        from math import sqrt
        
        # Obtener todos los profesores únicos
        profesores = {evento.profesor.id for evento in horario.eventos}
        
        total_desequilibrio = 0
        
        # Calcular desequilibrio para cada profesor
        for prof_id in profesores:
            # Contar eventos por día para este profesor
            eventos_por_dia = [0] * 5  # 5 días a la semana
            
            for evento in horario.eventos:
                if evento.profesor.id == prof_id:
                    eventos_por_dia[evento.dia] += 1
            
            # Calcular promedio
            total_eventos = sum(eventos_por_dia)
            if total_eventos == 0:
                continue
                
            promedio = total_eventos / 5
            
            # Calcular desequilibrio (desviación estándar)
            suma_cuadrados = sum((dia - promedio) ** 2 for dia in eventos_por_dia)
            desviacion = sqrt(suma_cuadrados / 5)
            
            total_desequilibrio += desviacion
        
        return int(total_desequilibrio * 10)  # Multiplicar por 10 para dar más peso