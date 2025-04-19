#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Operadores de mutación para el algoritmo genético
"""

import random
import copy
from config import NUM_DIAS, NUM_PERIODOS

class OperadorMutacion:
    """
    Clase base para los operadores de mutación.
    """
    
    def __init__(self, probabilidad=0.2):
        """
        Inicializa el operador de mutación.
        
        Args:
            probabilidad: Probabilidad de aplicar la mutación a cada individuo
        """
        self.probabilidad = probabilidad
    
    def mutar(self, horario):
        """
        Aplica la mutación al horario dado.
        
        Args:
            horario: Objeto Horario a mutar
            
        Returns:
            Boolean: True si se realizó la mutación, False en caso contrario
        """
        if random.random() < self.probabilidad:
            return self._aplicar_mutacion(horario)
        return False
    
    def _aplicar_mutacion(self, horario):
        """
        Método interno para aplicar la mutación específica.
        Debe ser implementado en las subclases.
        
        Args:
            horario: Objeto Horario a mutar
            
        Returns:
            Boolean: True si se realizó la mutación, False en caso contrario
        """
        raise NotImplementedError("Método no implementado en clase base")


class MutacionCambioHorario(OperadorMutacion):
    """
    Operador de mutación que cambia el día y/o hora de un evento aleatorio.
    """
    
    def _aplicar_mutacion(self, horario):
        """
        Cambia el horario (día, hora) de un evento aleatorio.
        
        Args:
            horario: Objeto Horario a mutar
            
        Returns:
            Boolean: True si se realizó la mutación, False en caso contrario
        """
        if not horario.eventos:
            return False
        
        # Seleccionar un evento aleatorio
        evento = random.choice(horario.eventos)
        
        # Guardar coordenadas temporales originales
        dia_original = evento.dia
        hora_original = evento.hora
        
        # Generar nuevas coordenadas temporales
        nuevo_dia = random.randint(0, NUM_DIAS - 1)
        nueva_hora = random.randint(0, NUM_PERIODOS - 1)
        
        # Si son iguales a las originales, no hay cambio
        if nuevo_dia == dia_original and nueva_hora == hora_original:
            return False
        
        # Crear una copia del evento con las nuevas coordenadas
        nuevo_evento = copy.deepcopy(evento)
        nuevo_evento.dia = nuevo_dia
        nuevo_evento.hora = nueva_hora
        
        # Verificar si hay conflictos con el nuevo horario
        if (horario.tiene_conflicto_profesor(nuevo_evento) or
            horario.tiene_conflicto_sala(nuevo_evento) or
            horario.tiene_conflicto_grupo(nuevo_evento)):
            return False
        
        # Si no hay conflictos, actualizar el evento
        evento.dia = nuevo_dia
        evento.hora = nueva_hora
        
        # Actualizar índices internos del horario
        horario._actualizar_indices()
        
        return True


class MutacionCambioSala(OperadorMutacion):
    """
    Operador de mutación que cambia la sala asignada a un evento aleatorio.
    """
    
    def __init__(self, probabilidad=0.2, salas=None):
        """
        Inicializa el operador de mutación con lista de salas disponibles.
        
        Args:
            probabilidad: Probabilidad de aplicar la mutación
            salas: Lista de objetos Sala disponibles
        """
        super().__init__(probabilidad)
        self.salas = salas or []
    
    def _aplicar_mutacion(self, horario):
        """
        Cambia la sala de un evento aleatorio.
        
        Args:
            horario: Objeto Horario a mutar
            
        Returns:
            Boolean: True si se realizó la mutación, False en caso contrario
        """
        if not horario.eventos or not self.salas:
            return False
        
        # Seleccionar un evento aleatorio
        evento = random.choice(horario.eventos)
        
        # Buscar salas adecuadas (diferente a la actual y compatible con el nivel)
        salas_adecuadas = [s for s in self.salas 
                          if s.id != evento.sala.id 
                          and s.es_adecuada_para_nivel(evento.materia_seccion.materia.nivel)
                          and s.tiene_equipamiento(evento.materia_seccion.materia.requiere_equipamiento)]
        
        if not salas_adecuadas:
            return False
        
        # Seleccionar una sala aleatoria entre las adecuadas
        nueva_sala = random.choice(salas_adecuadas)
        
        # Crear una copia del evento con la nueva sala
        nuevo_evento = copy.deepcopy(evento)
        nuevo_evento.sala = nueva_sala
        
        # Verificar si hay conflictos con la nueva sala
        if horario.tiene_conflicto_sala(nuevo_evento):
            return False
        
        # Si no hay conflictos, actualizar el evento
        evento.sala = nueva_sala
        
        # Actualizar índices internos del horario
        horario._actualizar_indices()
        
        return True


class MutacionIntercambio(OperadorMutacion):
    """
    Operador de mutación que intercambia los horarios entre dos eventos.
    """
    
    def _aplicar_mutacion(self, horario):
        """
        Intercambia los horarios (día, hora) entre dos eventos aleatorios.
        
        Args:
            horario: Objeto Horario a mutar
            
        Returns:
            Boolean: True si se realizó la mutación, False en caso contrario
        """
        if len(horario.eventos) < 2:
            return False
        
        # Seleccionar dos eventos aleatorios diferentes
        eventos = random.sample(horario.eventos, 2)
        evento1, evento2 = eventos[0], eventos[1]
        
        # Guardar coordenadas temporales originales
        dia1, hora1 = evento1.dia, evento1.hora
        dia2, hora2 = evento2.dia, evento2.hora
        
        # Intercambiar temporalmente para verificar conflictos
        evento1.dia, evento1.hora = dia2, hora2
        evento2.dia, evento2.hora = dia1, hora1
        
        # Verificar si hay conflictos tras el intercambio
        conflictos = False
        
        for evento in [evento1, evento2]:
            if (horario.tiene_conflicto_profesor(evento) or
                horario.tiene_conflicto_sala(evento) or
                horario.tiene_conflicto_grupo(evento)):
                conflictos = True
                break
        
        if conflictos:
            # Revertir el intercambio si hay conflictos
            evento1.dia, evento1.hora = dia1, hora1
            evento2.dia, evento2.hora = dia2, hora2
            return False
        
        # Actualizar índices internos del horario
        horario._actualizar_indices()
        
        return True


class MutacionCompuesta(OperadorMutacion):
    """
    Operador de mutación que aplica una combinación de diferentes mutaciones.
    """
    
    def __init__(self, operadores=None):
        """
        Inicializa el operador compuesto con una lista de operadores.
        
        Args:
            operadores: Lista de objetos OperadorMutacion
        """
        super().__init__(1.0)  # Siempre se intenta aplicar algún operador
        self.operadores = operadores or []
    
    def _aplicar_mutacion(self, horario):
        """
        Aplica uno de los operadores de mutación disponibles de forma aleatoria.
        
        Args:
            horario: Objeto Horario a mutar
            
        Returns:
            Boolean: True si se realizó la mutación, False en caso contrario
        """
        if not self.operadores:
            return False
        
        # Seleccionar un operador aleatorio
        operador = random.choice(self.operadores)
        
        # Aplicar la mutación
        return operador.mutar(horario)