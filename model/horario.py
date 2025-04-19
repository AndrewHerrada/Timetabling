#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Clase para representar un horario completo en el sistema de generación de horarios
"""

import random
import copy
from config import NUM_DIAS, NUM_PERIODOS

class Horario:
    """
    Clase que representa un horario completo, conteniendo todos los eventos asignados.
    Esta clase se utiliza como cromosoma en el algoritmo genético.
    """
    
    def __init__(self, eventos=None):
        """
        Inicializa un nuevo horario.
        
        Args:
            eventos: Lista de objetos Evento (opcional)
        """
        self.eventos = eventos if eventos else []
        self.fitness = 0
        
        # Diccionarios para búsqueda rápida de conflictos
        self._map_profesor_dia_hora = {}  # (profesor_id, dia, hora) -> evento
        self._map_sala_dia_hora = {}      # (sala_id, dia, hora) -> evento
        self._map_seccion_dia_hora = {}   # (seccion, dia, hora) -> evento
        
        # Actualizar índices si hay eventos
        if self.eventos:
            self._actualizar_indices()
    
    def agregar_evento(self, evento):
        """
        Agrega un evento al horario.
        
        Args:
            evento: Objeto Evento a agregar
            
        Returns:
            Boolean: True si se agregó correctamente, False si hay conflictos
        """
        # Verificar conflictos
        if self.tiene_conflicto_profesor(evento):
            return False
        
        if self.tiene_conflicto_sala(evento):
            return False
        
        if self.tiene_conflicto_grupo(evento):
            return False
        
        # Agregar evento
        self.eventos.append(evento)
        
        # Actualizar índices
        profesor_key = (evento.profesor.id, evento.dia, evento.hora)
        sala_key = (evento.sala.id, evento.dia, evento.hora)
        seccion_key = (evento.materia_seccion.seccion, evento.dia, evento.hora)
        
        self._map_profesor_dia_hora[profesor_key] = evento
        self._map_sala_dia_hora[sala_key] = evento
        self._map_seccion_dia_hora[seccion_key] = evento
        
        # Actualizar contadores
        evento.profesor.incrementar_horas()
        evento.materia_seccion.incrementar_horas()
        
        return True
    
    def tiene_conflicto_profesor(self, evento):
        """
        Verifica si hay conflicto de profesor con el evento dado.
        
        Args:
            evento: Objeto Evento a verificar
            
        Returns:
            Boolean: True si hay conflicto, False en caso contrario
        """
        profesor_key = (evento.profesor.id, evento.dia, evento.hora)
        return profesor_key in self._map_profesor_dia_hora
    
    def tiene_conflicto_sala(self, evento):
        """
        Verifica si hay conflicto de sala con el evento dado.
        
        Args:
            evento: Objeto Evento a verificar
            
        Returns:
            Boolean: True si hay conflicto, False en caso contrario
        """
        sala_key = (evento.sala.id, evento.dia, evento.hora)
        return sala_key in self._map_sala_dia_hora
    
    def tiene_conflicto_grupo(self, evento):
        """
        Verifica si hay conflicto de grupo/sección con el evento dado.
        
        Args:
            evento: Objeto Evento a verificar
            
        Returns:
            Boolean: True si hay conflicto, False en caso contrario
        """
        seccion_key = (evento.materia_seccion.seccion, evento.dia, evento.hora)
        return seccion_key in self._map_seccion_dia_hora
    
    def obtener_eventos_profesor(self, profesor_id):
        """
        Obtiene todos los eventos asignados a un profesor.
        
        Args:
            profesor_id: ID del profesor
            
        Returns:
            Lista de eventos del profesor
        """
        return [e for e in self.eventos if e.profesor.id == profesor_id]
    
    def obtener_eventos_sala(self, sala_id):
        """
        Obtiene todos los eventos asignados a una sala.
        
        Args:
            sala_id: ID de la sala
            
        Returns:
            Lista de eventos en la sala
        """
        return [e for e in self.eventos if e.sala.id == sala_id]
    
    def obtener_eventos_seccion(self, seccion):
        """
        Obtiene todos los eventos asignados a una sección.
        
        Args:
            seccion: ID de la sección
            
        Returns:
            Lista de eventos de la sección
        """
        return [e for e in self.eventos if e.materia_seccion.seccion == seccion]
    
    def obtener_huecos_profesor(self, profesor_id):
        """
        Calcula los "huecos" en el horario de un profesor.
        Un hueco es un período libre entre dos períodos ocupados en el mismo día.
        
        Args:
            profesor_id: ID del profesor
            
        Returns:
            Número total de huecos
        """
        eventos_profesor = self.obtener_eventos_profesor(profesor_id)
        if not eventos_profesor:
            return 0
        
        huecos = 0
        
        # Agrupar eventos por día
        eventos_por_dia = {}
        for e in eventos_profesor:
            if e.dia not in eventos_por_dia:
                eventos_por_dia[e.dia] = []
            eventos_por_dia[e.dia].append(e.hora)
        
        # Contar huecos para cada día
        for dia, horas in eventos_por_dia.items():
            if len(horas) <= 1:
                continue
            
            horas.sort()
            for i in range(1, len(horas)):
                if horas[i] - horas[i-1] > 1:
                    huecos += horas[i] - horas[i-1] - 1
        
        return huecos
    
    def _actualizar_indices(self):
        """
        Actualiza los índices internos para búsqueda rápida.
        """
        self._map_profesor_dia_hora = {}
        self._map_sala_dia_hora = {}
        self._map_seccion_dia_hora = {}
        
        for evento in self.eventos:
            profesor_key = (evento.profesor.id, evento.dia, evento.hora)
            sala_key = (evento.sala.id, evento.dia, evento.hora)
            seccion_key = (evento.materia_seccion.seccion, evento.dia, evento.hora)
            
            self._map_profesor_dia_hora[profesor_key] = evento
            self._map_sala_dia_hora[sala_key] = evento
            self._map_seccion_dia_hora[seccion_key] = evento
    
    def clonar(self):
        """
        Crea una copia profunda del horario.
        
        Returns:
            Nuevo objeto Horario con los mismos eventos
        """
        return copy.deepcopy(self)
    
    def obtener_matriz_horario(self, tipo, id_elemento):
        """
        Genera una matriz que representa el horario para un profesor, sala o sección.
        
        Args:
            tipo: Tipo de elemento ('profesor', 'sala', 'seccion')
            id_elemento: ID del elemento
            
        Returns:
            Matriz de NUM_DIAS x NUM_PERIODOS con los eventos o None en cada celda
        """
        matriz = [[None for _ in range(NUM_PERIODOS)] for _ in range(NUM_DIAS)]
        
        if tipo == 'profesor':
            for evento in self.eventos:
                if evento.profesor.id == id_elemento:
                    matriz[evento.dia][evento.hora] = evento
        elif tipo == 'sala':
            for evento in self.eventos:
                if evento.sala.id == id_elemento:
                    matriz[evento.dia][evento.hora] = evento
        elif tipo == 'seccion':
            for evento in self.eventos:
                if evento.materia_seccion.seccion == id_elemento:
                    matriz[evento.dia][evento.hora] = evento
        
        return matriz
    
    def __len__(self):
        """
        Devuelve el número de eventos en el horario.
        
        Returns:
            Número de eventos
        """
        return len(self.eventos)
    
    def __str__(self):
        """
        Representación en string del horario.
        
        Returns:
            String con información básica del horario
        """
        return f"Horario con {len(self.eventos)} eventos, fitness: {self.fitness}"