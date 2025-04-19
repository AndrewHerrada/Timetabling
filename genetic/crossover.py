#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Operadores de cruzamiento para el algoritmo genético
"""

import random
from model.horario import Horario
from config import NUM_DIAS

class OperadorCruce:
    """
    Clase base para los operadores de cruzamiento.
    """
    
    def __init__(self, probabilidad=0.8):
        """
        Inicializa el operador de cruce.
        
        Args:
            probabilidad: Probabilidad de aplicar el cruce (entre 0 y 1)
        """
        self.probabilidad = probabilidad
    
    def cruzar(self, padre1, padre2):
        """
        Realiza el cruce entre dos individuos (horarios).
        
        Args:
            padre1: Primer horario padre
            padre2: Segundo horario padre
            
        Returns:
            Tupla con dos horarios hijos
        """
        raise NotImplementedError("Método no implementado en clase base")


class CruceDias(OperadorCruce):
    """
    Operador de cruce que intercambia días completos entre los padres.
    """
    
    def cruzar(self, padre1, padre2):
        """
        Realiza el cruce por días entre dos horarios.
        
        Args:
            padre1: Primer horario padre
            padre2: Segundo horario padre
            
        Returns:
            Tupla con dos horarios hijos
        """
        # Crear nuevos horarios vacíos
        hijo1 = Horario()
        hijo2 = Horario()
        
        # Seleccionar aleatoriamente los días a intercambiar
        dias_cruce = set(random.sample(range(NUM_DIAS), random.randint(1, NUM_DIAS-1)))
        
        # Copiar eventos según los días seleccionados
        for evento in padre1.eventos:
            if evento.dia in dias_cruce:
                hijo2.agregar_evento(evento)
            else:
                hijo1.agregar_evento(evento)
        
        for evento in padre2.eventos:
            if evento.dia in dias_cruce:
                hijo1.agregar_evento(evento)
            else:
                hijo2.agregar_evento(evento)
        
        return hijo1, hijo2


class CruceEventos(OperadorCruce):
    """
    Operador de cruce que intercambia subconjuntos de eventos entre los padres.
    """
    
    def cruzar(self, padre1, padre2):
        """
        Realiza el cruce por eventos entre dos horarios.
        
        Args:
            padre1: Primer horario padre
            padre2: Segundo horario padre
            
        Returns:
            Tupla con dos horarios hijos
        """
        # Crear nuevos horarios vacíos
        hijo1 = Horario()
        hijo2 = Horario()
        
        # Determinar el punto de cruce (porcentaje de eventos a intercambiar)
        punto_cruce = random.uniform(0.3, 0.7)
        
        # Calcular número de eventos a tomar de cada padre
        num_eventos1 = int(len(padre1.eventos) * punto_cruce)
        num_eventos2 = int(len(padre2.eventos) * punto_cruce)
        
        # Seleccionar eventos aleatorios de cada padre
        eventos_seleccionados1 = random.sample(padre1.eventos, num_eventos1)
        eventos_seleccionados2 = random.sample(padre2.eventos, num_eventos2)
        
        # Crear conjuntos para verificación rápida
        seleccionados1_keys = {e.get_key() for e in eventos_seleccionados1}
        seleccionados2_keys = {e.get_key() for e in eventos_seleccionados2}
        
        # Construir primer hijo: eventos seleccionados del padre2 y restantes del padre1
        for evento in eventos_seleccionados2:
            hijo1.agregar_evento(evento)
        
        for evento in padre1.eventos:
            if evento.get_key() not in seleccionados1_keys:
                hijo1.agregar_evento(evento)
        
        # Construir segundo hijo: eventos seleccionados del padre1 y restantes del padre2
        for evento in eventos_seleccionados1:
            hijo2.agregar_evento(evento)
        
        for evento in padre2.eventos:
            if evento.get_key() not in seleccionados2_keys:
                hijo2.agregar_evento(evento)
        
        return hijo1, hijo2


class CruceMateriasSeccion(OperadorCruce):
    """
    Operador de cruce que intercambia todas las asignaciones de materias-secciones específicas.
    """
    
    def cruzar(self, padre1, padre2):
        """
        Realiza el cruce por materias-secciones entre dos horarios.
        
        Args:
            padre1: Primer horario padre
            padre2: Segundo horario padre
            
        Returns:
            Tupla con dos horarios hijos
        """
        # Crear nuevos horarios vacíos
        hijo1 = Horario()
        hijo2 = Horario()
        
        # Obtener todas las materias-secciones únicas de ambos padres
        materias_secciones1 = {(e.materia_seccion.materia.id, e.materia_seccion.seccion) 
                              for e in padre1.eventos}
        materias_secciones2 = {(e.materia_seccion.materia.id, e.materia_seccion.seccion) 
                              for e in padre2.eventos}
        
        todas_materias_secciones = materias_secciones1.union(materias_secciones2)
        
        # Validar que haya materias-secciones para intercambiar
        if not todas_materias_secciones:
            # Si no hay materias-secciones, devolver los padres sin cambios
            return padre1, padre2
        
        # Seleccionar un subconjunto aleatorio para intercambiar
        num_intercambiar = random.randint(1, min(len(todas_materias_secciones), max(1, len(todas_materias_secciones) // 3)))
        materias_intercambiar = set(random.sample(list(todas_materias_secciones), num_intercambiar))
        
        # Construir los hijos
        for evento in padre1.eventos:
            ms_key = (evento.materia_seccion.materia.id, evento.materia_seccion.seccion)
            if ms_key in materias_intercambiar:
                hijo2.agregar_evento(evento)
            else:
                hijo1.agregar_evento(evento)
        
        for evento in padre2.eventos:
            ms_key = (evento.materia_seccion.materia.id, evento.materia_seccion.seccion)
            if ms_key in materias_intercambiar:
                hijo1.agregar_evento(evento)
            else:
                hijo2.agregar_evento(evento)
        
        return hijo1, hijo2