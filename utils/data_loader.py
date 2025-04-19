#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Utilidad para cargar datos desde archivos Excel
"""

import os
import pandas as pd
from model.profesor import Profesor
from model.materia import Materia, MateriaSecciones
from model.sala import Sala
from config import NUM_DIAS, NUM_PERIODOS

class DataLoader:
    """
    Clase para cargar datos desde archivos Excel.
    """
    
    def cargar_profesores(self, archivo):
        """
        Carga datos de profesores desde un archivo Excel.
        
        Args:
            archivo: Ruta al archivo Excel
            
        Returns:
            Lista de objetos Profesor
        """
        try:
            # Leer archivo Excel
            df = pd.read_excel(archivo)
            
            profesores = []
            
            # Procesar cada fila
            for _, row in df.iterrows():
                # Extraer datos básicos según la estructura proporcionada
                id_profesor = row.get('profesor_id', len(profesores) + 1)
                nombre = f"{row.get('nombre', '')} {row.get('apellido', '')}".strip()
                
                # Determinar si tiene ítem basado en la categoría
                tiene_item = row.get('categoria', '').lower() == 'item'
                
                # Extraer especialidades basadas en la sección
                # Por ejemplo, si la sección es "Guitarra", puede impartir materias relacionadas
                especialidades = []
                seccion = row.get('seccion', '')
                
                # Lógica para asignar especialidades basadas en la sección
                # Esta es una implementación básica que debe adaptarse según los requisitos
                if seccion:
                    # Asignar IDs de materias basados en la sección
                    # En una implementación real, se debería cargar esta relación desde los datos
                    especialidades.append(seccion)
                
                # Crear objeto Profesor
                profesor = Profesor(
                    id=id_profesor,
                    nombre=nombre,
                    tiene_item=tiene_item,
                    especialidades=especialidades,
                    disponibilidad=None  # La disponibilidad se configurará más adelante
                )
                
                profesores.append(profesor)
            
            return profesores
        
        except Exception as e:
            print(f"Error al cargar profesores: {e}")
            return []
    
    def cargar_materias_secciones(self, archivo):
        """
        Carga datos de materias y secciones desde un archivo Excel.
        
        Args:
            archivo: Ruta al archivo Excel
            
        Returns:
            Lista de objetos MateriaSecciones
        """
        try:
            # Leer archivo Excel
            df = pd.read_excel(archivo)
            
            materias_dict = {}  # Para evitar duplicados
            materias_secciones = []
            
            # Procesar cada fila
            for _, row in df.iterrows():
                # Extraer datos básicos según la estructura proporcionada
                id_materia = row.get('materia_id', len(materias_dict) + 1)
                nombre = row.get('nombre_materia', f"Materia {id_materia}")
                nivel = row.get('nivel', 'general').lower()
                horas_semanales = int(row.get('horas_semanales_tipicas', 1))
                seccion = row.get('seccion', 'Todos')
                
                # Obtener profesor específico si se requiere
                # En este caso, basado en la cantidad de docentes
                profesor_especifico = None
                
                # Extraer requisitos de equipamiento si están presentes
                # Basado en el tipo_materia o otros campos relevantes
                equipamiento = []
                tipo_materia = row.get('tipo_materia', '').lower()
                if tipo_materia:
                    equipamiento.append(tipo_materia)
                
                # Crear o recuperar objeto Materia
                if id_materia not in materias_dict:
                    materia = Materia(
                        id=id_materia,
                        nombre=nombre,
                        nivel=nivel,
                        horas_semanales=horas_semanales,
                        requiere_equipamiento=equipamiento if equipamiento else None
                    )
                    materias_dict[id_materia] = materia
                else:
                    materia = materias_dict[id_materia]
                
                # Crear objeto MateriaSecciones
                materia_seccion = MateriaSecciones(
                    materia=materia,
                    seccion=seccion,
                    profesor_especifico=profesor_especifico
                )
                
                materias_secciones.append(materia_seccion)
            
            return materias_secciones
        
        except Exception as e:
            print(f"Error al cargar materias y secciones: {e}")
            return []
    
    def cargar_salas(self, archivo):
        """
        Carga datos de salas desde un archivo Excel.
        
        Args:
            archivo: Ruta al archivo Excel
            
        Returns:
            Lista de objetos Sala
        """
        try:
            # Leer archivo Excel
            df = pd.read_excel(archivo)
            
            salas = []
            
            # Procesar cada fila
            for _, row in df.iterrows():
                # Extraer datos básicos según la estructura proporcionada
                id_sala = row.get('sala_id', len(salas) + 1)
                nombre = row.get('sala_id', f"Sala {id_sala}")  # Usando sala_id como nombre
                capacidad = int(row.get('capacidad', 30))
                
                # Determinar el nivel de la sala
                nombre_nivel = row.get('nombre_nivel', '').lower()
                if nombre_nivel == 'todos':
                    nivel = 'general'
                else:
                    nivel = nombre_nivel.lower()
                
                # Extraer equipamiento disponible basado en tipo_sala
                equipamiento = []
                tipo_sala = row.get('tipo_sala', '').lower()
                if tipo_sala and tipo_sala != 'regular':
                    equipamiento.append(tipo_sala)
                
                # Crear objeto Sala
                sala = Sala(
                    id=id_sala,
                    nombre=nombre,
                    capacidad=capacidad,
                    nivel=nivel,
                    equipamiento=equipamiento if equipamiento else None
                )
                
                salas.append(sala)
            
            return salas
        
        except Exception as e:
            print(f"Error al cargar salas: {e}")
            return []
    
    def establecer_disponibilidad_profesores(self, profesores, archivo_materias):
        """
        Establece la disponibilidad de los profesores basada en los datos de materias.
        
        Args:
            profesores: Lista de objetos Profesor
            archivo_materias: Ruta al archivo Excel con información de disponibilidad
            
        Returns:
            Lista actualizada de profesores con disponibilidad
        """
        try:
            # Leer archivo Excel
            df = pd.read_excel(archivo_materias)
            
            # Crear mapa de profesores por ID para acceso rápido
            profesores_map = {p.id: p for p in profesores}
            
            # Procesar cada fila para extraer disponibilidad
            for _, row in df.iterrows():
                # Verificar disponibilidad por día
                disponibilidad = [[False for _ in range(NUM_PERIODOS)] for _ in range(NUM_DIAS)]
                
                # Días de la semana (0=Lunes, 4=Viernes)
                dias = [
                    bool(row.get('lunes', 0)),
                    bool(row.get('martes', 0)),
                    bool(row.get('miercoles', 0)),
                    bool(row.get('jueves', 0)),
                    bool(row.get('viernes', 0))
                ]
                
                # Convertir hora de entrada/salida en períodos disponibles
                hora_entrada = row.get('horario_entrada', '00:00:00')
                hora_salida = row.get('horario_salida', '23:59:59')
                
                # Simplificación: asignar disponibilidad para todos los períodos en los días indicados
                for dia in range(NUM_DIAS):
                    if dias[dia]:
                        for periodo in range(NUM_PERIODOS):
                            disponibilidad[dia][periodo] = True
                
                # Asignar esta disponibilidad a los profesores relevantes
                # En este ejemplo, asignamos a todos los profesores la misma disponibilidad
                # En una implementación real, se debería relacionar cada materia con sus profesores
                for profesor in profesores:
                    if profesor.disponibilidad is None:
                        profesor.disponibilidad = [row[:] for row in disponibilidad]
                    else:
                        # Combinar disponibilidades (OR lógico)
                        for dia in range(NUM_DIAS):
                            for periodo in range(NUM_PERIODOS):
                                profesor.disponibilidad[dia][periodo] |= disponibilidad[dia][periodo]
            
            return profesores
        
        except Exception as e:
            print(f"Error al establecer disponibilidad de profesores: {e}")
            return profesores