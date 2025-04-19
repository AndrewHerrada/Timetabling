#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Clase para representar un evento (asignación de profesor-materia-sala-horario)
en el sistema de generación de horarios
"""

class Evento:
    """
    Clase que representa un evento o asignación completa en el horario.
    Un evento es una tupla (profesor, materia, sección, sala, día, hora).
    """
    
    def __init__(self, profesor, materia_seccion, sala, dia, hora):
        """
        Inicializa un nuevo evento.
        
        Args:
            profesor: Objeto Profesor asignado
            materia_seccion: Objeto MateriaSecciones asignado
            sala: Objeto Sala asignado
            dia: Índice del día (0-4 para Lunes a Viernes)
            hora: Índice de la hora (0-n según configuración)
        """
        self.profesor = profesor
        self.materia_seccion = materia_seccion
        self.sala = sala
        self.dia = dia
        self.hora = hora
    
    def get_key(self):
        """
        Genera una clave única para el evento.
        
        Returns:
            Tupla con los IDs y coordenadas temporales que identifican unívocamente el evento
        """
        return (
            self.profesor.id,
            self.materia_seccion.materia.id,
            self.materia_seccion.seccion,
            self.sala.id,
            self.dia,
            self.hora
        )
    
    def conflicto_profesor(self, otro_evento):
        """
        Verifica si hay conflicto de profesor con otro evento.
        
        Args:
            otro_evento: Otro objeto Evento a comparar
            
        Returns:
            Boolean: True si hay conflicto (mismo profesor, día y hora), False en caso contrario
        """
        return (self.profesor.id == otro_evento.profesor.id and
                self.dia == otro_evento.dia and
                self.hora == otro_evento.hora)
    
    def conflicto_sala(self, otro_evento):
        """
        Verifica si hay conflicto de sala con otro evento.
        
        Args:
            otro_evento: Otro objeto Evento a comparar
            
        Returns:
            Boolean: True si hay conflicto (misma sala, día y hora), False en caso contrario
        """
        return (self.sala.id == otro_evento.sala.id and
                self.dia == otro_evento.dia and
                self.hora == otro_evento.hora)
    
    def conflicto_grupo(self, otro_evento):
        """
        Verifica si hay conflicto de grupo/sección con otro evento.
        
        Args:
            otro_evento: Otro objeto Evento a comparar
            
        Returns:
            Boolean: True si hay conflicto (misma sección, día y hora), False en caso contrario
        """
        return (self.materia_seccion.seccion == otro_evento.materia_seccion.seccion and
                self.dia == otro_evento.dia and
                self.hora == otro_evento.hora)
    
    def __str__(self):
        """
        Representación en string del evento.
        
        Returns:
            String con la información básica del evento
        """
        from config import DIAS_SEMANA, HORAS_DIA
        
        dia_str = DIAS_SEMANA[self.dia] if 0 <= self.dia < len(DIAS_SEMANA) else f"Día {self.dia}"
        hora_str = HORAS_DIA[self.hora] if 0 <= self.hora < len(HORAS_DIA) else f"Hora {self.hora}"
        
        return (f"Evento: {self.materia_seccion.materia.nombre} (Sección {self.materia_seccion.seccion}), "
                f"Prof. {self.profesor.nombre}, "
                f"Sala {self.sala.nombre}, "
                f"{dia_str} {hora_str}")