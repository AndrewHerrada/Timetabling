#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Utilidades para visualizar y exportar los resultados
"""

import os
import pandas as pd
from config import DIAS_SEMANA, HORAS_DIA

class Visualizador:
    """
    Clase para visualizar y exportar horarios.
    """
    
    def __init__(self, profesores=None, materias_secciones=None, salas=None):
        """
        Inicializa el visualizador.
        
        Args:
            profesores: Lista de objetos Profesor
            materias_secciones: Lista de objetos MateriaSecciones
            salas: Lista de objetos Sala
        """
        self.profesores = profesores or []
        self.materias_secciones = materias_secciones or []
        self.salas = salas or []
        
        # Crear mapeos para búsqueda rápida
        self.map_profesores = {p.id: p for p in self.profesores}
        self.map_salas = {s.id: s for s in self.salas}
    
    def exportar_excel(self, horario, archivo_salida):
        """
        Exporta el horario a un archivo Excel con múltiples hojas.
        
        Args:
            horario: Objeto Horario a exportar
            archivo_salida: Ruta del archivo Excel de salida
        """
        # Crear un escritor de Excel
        writer = pd.ExcelWriter(archivo_salida, engine='openpyxl')
        
        # Exportar horarios por profesor
        self._exportar_horarios_profesores(horario, writer)
        
        # Exportar horarios por sala
        self._exportar_horarios_salas(horario, writer)
        
        # Exportar horarios por sección
        self._exportar_horarios_secciones(horario, writer)
        
        # Exportar lista completa de eventos
        self._exportar_lista_eventos(horario, writer)
        
        # Guardar archivo
        writer.close()
    
    def _exportar_horarios_profesores(self, horario, writer):
        """
        Exporta los horarios de todos los profesores.
        
        Args:
            horario: Objeto Horario a exportar
            writer: ExcelWriter para escribir
        """
        # Obtener profesores únicos en el horario
        profesores_ids = {e.profesor.id for e in horario.eventos}
        
        for prof_id in profesores_ids:
            # Obtener nombre del profesor
            nombre = self.map_profesores.get(prof_id, f"Profesor {prof_id}").nombre
            
            # Crear DataFrame vacío
            df = pd.DataFrame(
                index=HORAS_DIA,
                columns=DIAS_SEMANA
            )
            
            # Llenar con eventos
            for evento in horario.eventos:
                if evento.profesor.id == prof_id:
                    dia = DIAS_SEMANA[evento.dia]
                    hora = HORAS_DIA[evento.hora]
                    
                    # Formato: Materia (Sección) - Sala
                    df.loc[hora, dia] = (f"{evento.materia_seccion.materia.nombre} "
                                        f"({evento.materia_seccion.seccion}) - "
                                        f"{evento.sala.nombre}")
            
            # Exportar a Excel
            df.to_excel(writer, sheet_name=f"Prof_{nombre[:20]}")
    
    def _exportar_horarios_salas(self, horario, writer):
        """
        Exporta los horarios de todas las salas.
        
        Args:
            horario: Objeto Horario a exportar
            writer: ExcelWriter para escribir
        """
        # Obtener salas únicas en el horario
        salas_ids = {e.sala.id for e in horario.eventos}
        
        for sala_id in salas_ids:
            # Obtener nombre de la sala
            nombre = self.map_salas.get(sala_id, f"Sala {sala_id}").nombre
            
            # Crear DataFrame vacío
            df = pd.DataFrame(
                index=HORAS_DIA,
                columns=DIAS_SEMANA
            )
            
            # Llenar con eventos
            for evento in horario.eventos:
                if evento.sala.id == sala_id:
                    dia = DIAS_SEMANA[evento.dia]
                    hora = HORAS_DIA[evento.hora]
                    
                    # Formato: Materia (Sección) - Profesor
                    df.loc[hora, dia] = (f"{evento.materia_seccion.materia.nombre} "
                                        f"({evento.materia_seccion.seccion}) - "
                                        f"{evento.profesor.nombre}")
            
            # Exportar a Excel
            df.to_excel(writer, sheet_name=f"Sala_{nombre[:20]}")
    
    def _exportar_horarios_secciones(self, horario, writer):
        """
        Exporta los horarios de todas las secciones.
        
        Args:
            horario: Objeto Horario a exportar
            writer: ExcelWriter para escribir
        """
        # Obtener secciones únicas en el horario
        secciones = {e.materia_seccion.seccion for e in horario.eventos}
        
        for seccion in secciones:
            # Crear DataFrame vacío
            df = pd.DataFrame(
                index=HORAS_DIA,
                columns=DIAS_SEMANA
            )
            
            # Llenar con eventos
            for evento in horario.eventos:
                if evento.materia_seccion.seccion == seccion:
                    dia = DIAS_SEMANA[evento.dia]
                    hora = HORAS_DIA[evento.hora]
                    
                    # Formato: Materia - Profesor - Sala
                    df.loc[hora, dia] = (f"{evento.materia_seccion.materia.nombre} - "
                                        f"{evento.profesor.nombre} - "
                                        f"{evento.sala.nombre}")
            
            # Exportar a Excel
            df.to_excel(writer, sheet_name=f"Seccion_{seccion[:20]}")
    
    def _exportar_lista_eventos(self, horario, writer):
        """
        Exporta una lista completa de todos los eventos.
        
        Args:
            horario: Objeto Horario a exportar
            writer: ExcelWriter para escribir
        """
        # Crear lista de eventos
        eventos_data = []
        
        for evento in horario.eventos:
            eventos_data.append({
                'Día': DIAS_SEMANA[evento.dia],
                'Hora': HORAS_DIA[evento.hora],
                'Materia': evento.materia_seccion.materia.nombre,
                'Sección': evento.materia_seccion.seccion,
                'Profesor': evento.profesor.nombre,
                'Sala': evento.sala.nombre,
                'Nivel': evento.materia_seccion.materia.nivel
            })
        
        # Crear DataFrame
        df = pd.DataFrame(eventos_data)
        
        # Ordenar por día, hora, etc.
        df['Día_idx'] = df['Día'].apply(lambda x: DIAS_SEMANA.index(x))
        df['Hora_idx'] = df['Hora'].apply(lambda x: HORAS_DIA.index(x))
        df = df.sort_values(['Día_idx', 'Hora_idx', 'Sección', 'Materia'])
        df = df.drop(['Día_idx', 'Hora_idx'], axis=1)
        
        # Exportar a Excel
        df.to_excel(writer, sheet_name='Lista_Completa', index=False)
    
    def generar_resumen(self, horario, archivo_salida):
        """
        Genera un resumen de estadísticas del horario.
        
        Args:
            horario: Objeto Horario a analizar
            archivo_salida: Ruta del archivo de salida
        """
        with open(archivo_salida, 'w', encoding='utf-8') as f:
            f.write("RESUMEN DE ESTADÍSTICAS DEL HORARIO\n")
            f.write("===================================\n\n")
            
            # Información general
            f.write(f"Total de eventos programados: {len(horario.eventos)}\n")
            f.write(f"Valor de fitness: {horario.fitness}\n\n")
            
            # Estadísticas por profesor
            f.write("ESTADÍSTICAS POR PROFESOR\n")
            f.write("------------------------\n\n")
            
            # Agrupar eventos por profesor
            eventos_por_profesor = {}
            for evento in horario.eventos:
                prof_id = evento.profesor.id
                if prof_id not in eventos_por_profesor:
                    eventos_por_profesor[prof_id] = []
                eventos_por_profesor[prof_id].append(evento)
            
            for prof_id, eventos in eventos_por_profesor.items():
                profesor = self.map_profesores.get(prof_id, None)
                if not profesor:
                    continue
                
                f.write(f"Profesor: {profesor.nombre} (ID: {prof_id})\n")
                f.write(f"  Tipo: {'Con ítem' if profesor.tiene_item else 'Sin ítem'}\n")
                f.write(f"  Total horas asignadas: {len(eventos)}\n")
                
                # Verificar requisito de horas mínimas
                if profesor.tiene_item and len(eventos) < 14:
                    f.write(f"  ¡ALERTA! Profesor con ítem tiene menos de 14 horas ({len(eventos)})\n")
                
                # Calcular huecos
                huecos = horario.obtener_huecos_profesor(prof_id)
                f.write(f"  Huecos en horario: {huecos}\n")
                
                # Horas por día
                eventos_por_dia = {}
                for e in eventos:
                    if e.dia not in eventos_por_dia:
                        eventos_por_dia[e.dia] = 0
                    eventos_por_dia[e.dia] += 1
                
                f.write("  Distribución por día:\n")
                for dia in range(len(DIAS_SEMANA)):
                    f.write(f"    {DIAS_SEMANA[dia]}: {eventos_por_dia.get(dia, 0)} horas\n")
                
                f.write("\n")
            
            # Estadísticas por sala
            f.write("ESTADÍSTICAS POR SALA\n")
            f.write("--------------------\n\n")
            
            # Agrupar eventos por sala
            eventos_por_sala = {}
            for evento in horario.eventos:
                sala_id = evento.sala.id
                if sala_id not in eventos_por_sala:
                    eventos_por_sala[sala_id] = []
                eventos_por_sala[sala_id].append(evento)
            
            for sala_id, eventos in eventos_por_sala.items():
                sala = self.map_salas.get(sala_id, None)
                if not sala:
                    continue
                
                f.write(f"Sala: {sala.nombre} (ID: {sala_id})\n")
                f.write(f"  Nivel: {sala.nivel}\n")
                f.write(f"  Total horas ocupadas: {len(eventos)}\n")
                
                # Verificar uso correcto según nivel
                if sala.nivel == "infantil":
                    incorrectos = [e for e in eventos if e.materia_seccion.materia.nivel != "infantil"]
                    if incorrectos:
                        f.write(f"  ¡ALERTA! Sala infantil usada para {len(incorrectos)} eventos de otro nivel\n")
                
                # Ocupación por día
                eventos_por_dia = {}
                for e in eventos:
                    if e.dia not in eventos_por_dia:
                        eventos_por_dia[e.dia] = 0
                    eventos_por_dia[e.dia] += 1
                
                f.write("  Distribución por día:\n")
                for dia in range(len(DIAS_SEMANA)):
                    f.write(f"    {DIAS_SEMANA[dia]}: {eventos_por_dia.get(dia, 0)} horas\n")
                
                f.write("\n")
            
            # Verificación de restricciones específicas
            f.write("VERIFICACIÓN DE RESTRICCIONES ESPECÍFICAS\n")
            f.write("---------------------------------------\n\n")
            
            # 1. Profesores con ítem (mínimo 14 horas)
            profesores_item = [p for p in self.profesores if p.tiene_item]
            profesores_incumplen = []
            
            for profesor in profesores_item:
                horas_asignadas = sum(1 for e in horario.eventos if e.profesor.id == profesor.id)
                if horas_asignadas < 14:
                    profesores_incumplen.append((profesor, horas_asignadas))
            
            if profesores_incumplen:
                f.write("Profesores con ítem que NO cumplen 14 horas mínimas:\n")
                for profesor, horas in profesores_incumplen:
                    f.write(f"  {profesor.nombre}: {horas} horas asignadas\n")
            else:
                f.write("CUMPLE: Todos los profesores con ítem tienen al menos 14 horas asignadas.\n")
            
            f.write("\n")
            
            # 2. Salas de nivel infantil
            salas_infantil = [s for s in self.salas if s.nivel == "infantil"]
            usos_incorrectos = []
            
            for sala in salas_infantil:
                for evento in horario.eventos:
                    if (evento.sala.id == sala.id and 
                        evento.materia_seccion.materia.nivel != "infantil"):
                        usos_incorrectos.append((sala, evento))
            
            if usos_incorrectos:
                f.write("Salas de nivel infantil usadas incorrectamente:\n")
                for sala, evento in usos_incorrectos:
                    f.write(f"  {sala.nombre} usada para {evento.materia_seccion.materia.nombre} "
                            f"(nivel {evento.materia_seccion.materia.nivel})\n")
            else:
                f.write("CUMPLE: Todas las salas de nivel infantil son usadas correctamente.\n")
            
            f.write("\n")
            
            # 3. Asignaciones específicas de profesores
            asignaciones_especificas = [ms for ms in self.materias_secciones if ms.profesor_especifico is not None]
            incumplimientos = []
            
            for ms in asignaciones_especificas:
                eventos_ms = [e for e in horario.eventos 
                             if (e.materia_seccion.materia.id == ms.materia.id and 
                                 e.materia_seccion.seccion == ms.seccion)]
                
                for evento in eventos_ms:
                    if evento.profesor.id != ms.profesor_especifico:
                        incumplimientos.append((ms, evento))
            
            if incumplimientos:
                f.write("Incumplimientos de asignaciones específicas de profesores:\n")
                for ms, evento in incumplimientos:
                    f.write(f"  {ms.materia.nombre} (Sección {ms.seccion}) asignada a "
                            f"{evento.profesor.nombre} en lugar de profesor ID {ms.profesor_especifico}\n")
            else:
                f.write("CUMPLE: Todas las asignaciones específicas de profesores son respetadas.\n")