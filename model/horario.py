"""
Clases para la gestión del horario y estructuras de datos asociadas al problema de timetabling
"""

import copy
from typing import List, Dict, Set, Tuple, Any, Optional
from model.curso import Curso
from model.periodo import Periodo
from model.requisito import Requisito

class Horario:
    """
    Clase que representa un horario completo.
    Contiene la estructura de asignaciones por día, periodo y curso.
    """
    
    def __init__(self, periodos: Dict[str, 'Periodo'], dias: List[str]):
        self.periodos = periodos
        self.dias = dias
        self.asignaciones = {}  # {(dia, periodo): {curso_id: requisito}}
        
        # Inicializar estructura
        for dia in self.dias:
            for periodo_id in self.periodos:
                self.asignaciones[(dia, periodo_id)] = {}
    
    def asignar(self, requisito: 'Requisito', dia: str, periodo: str) -> bool:
        """
        Asigna un requisito a un slot específico.
        Retorna True si la asignación fue exitosa, False en caso contrario.
        """
        # Verificar que el día y periodo estén disponibles para este requisito
        if dia not in requisito.dias_disponibles:
            return False
        
        periodos_disponibles = requisito.get_periodos_disponibles(self.periodos)
        if periodo not in periodos_disponibles:
            return False
        
        # Verificar que el curso no tenga ya una asignación en ese slot
        if requisito.curso.curso_id in self.asignaciones.get((dia, periodo), {}):
            return False
        
        # Verificar que el profesor no esté ocupado en ese slot
        for curso_asignado, req_asignado in self.asignaciones.get((dia, periodo), {}).items():
            if req_asignado.profesor == requisito.profesor:
                return False
            
        # Verificar que la sala no esté ocupada en ese slot
        for curso_asignado, req_asignado in self.asignaciones.get((dia, periodo), {}).items():
            if req_asignado.sala == requisito.sala:
                return False
        
        # Para clases compartidas, verificar si ya existe otra asignación de esa clase compartida
        if requisito.materia.es_compartida():
            clase_compartida = requisito.materia.clase_compartida
            for curso_asignado, req_asignado in self.asignaciones.get((dia, periodo), {}).items():
                if req_asignado.materia.clase_compartida == clase_compartida:
                    # Ya existe una asignación de esta clase compartida, verificar compatibilidad
                    if req_asignado.profesor != requisito.profesor:
                        return False  # Profesores diferentes para la misma clase compartida
        
        # Realizar la asignación
        if (dia, periodo) not in self.asignaciones:
            self.asignaciones[(dia, periodo)] = {}
            
        self.asignaciones[(dia, periodo)][requisito.curso.curso_id] = requisito
        requisito.asignar_horario(dia, periodo)
        
        return True
    
    def asignar_clase_compartida(self, requisitos: List['Requisito'], dia: str, periodo: str) -> bool:
        """
        Asigna una clase compartida para todos los requisitos proporcionados.
        Todos los requisitos deben tener la misma materia compartida.
        """
        if not requisitos:
            return False
        
        # Verificar que todos los requisitos tengan la misma clase compartida
        clase_compartida = requisitos[0].materia.clase_compartida
        if any(req.materia.clase_compartida != clase_compartida for req in requisitos):
            return False
        
        # Verificar disponibilidad para todos los requisitos
        for req in requisitos:
            if dia not in req.dias_disponibles:
                return False
            
            periodos_disponibles = req.get_periodos_disponibles(self.periodos)
            if periodo not in periodos_disponibles:
                return False
            
            # Verificar que el curso no tenga ya una asignación
            if req.curso.curso_id in self.asignaciones.get((dia, periodo), {}):
                return False
        
        # Verificar profesor y sala
        profesor = requisitos[0].profesor
        sala = requisitos[0].sala
        
        # Verificar que el profesor no esté ocupado
        for curso_asignado, req_asignado in self.asignaciones.get((dia, periodo), {}).items():
            if req_asignado.profesor == profesor:
                return False
            
        # Verificar que la sala no esté ocupada
        for curso_asignado, req_asignado in self.asignaciones.get((dia, periodo), {}).items():
            if req_asignado.sala == sala:
                return False
        
        # Realizar las asignaciones
        for req in requisitos:
            self.asignaciones[(dia, periodo)][req.curso.curso_id] = req
            req.asignar_horario(dia, periodo)
        
        return True
    
    def desasignar(self, dia: str, periodo: str, curso_id: str) -> bool:
        """Elimina una asignación existente."""
        if (dia, periodo) in self.asignaciones and curso_id in self.asignaciones[(dia, periodo)]:
            # Recuperar el requisito antes de eliminar
            requisito = self.asignaciones[(dia, periodo)][curso_id]
            # Eliminar la asignación
            del self.asignaciones[(dia, periodo)][curso_id]
            # Actualizar los datos del requisito
            requisito.asignaciones = [(d, p) for d, p in requisito.asignaciones if d != dia or p != periodo]
            return True
        return False
    
    def desasignar_clase_compartida(self, dia: str, periodo: str, clase_compartida: str) -> bool:
        """Elimina todas las asignaciones de una clase compartida específica."""
        if (dia, periodo) not in self.asignaciones:
            return False
        
        # Identificar cursos con esta clase compartida
        cursos_a_eliminar = []
        for curso_id, requisito in self.asignaciones[(dia, periodo)].items():
            if requisito.materia.clase_compartida == clase_compartida:
                cursos_a_eliminar.append(curso_id)
                # Actualizar datos del requisito
                requisito.asignaciones = [(d, p) for d, p in requisito.asignaciones if d != dia or p != periodo]
        
        # Eliminar asignaciones
        for curso_id in cursos_a_eliminar:
            del self.asignaciones[(dia, periodo)][curso_id]
        
        return len(cursos_a_eliminar) > 0
    
    def tiene_huecos(self, curso_id: str) -> bool:
        """
        Verifica si el horario de un curso tiene 'huecos' (periodos sin clase entre periodos con clase).
        Retorna True si existen huecos, False en caso contrario.
        """
        for dia in self.dias:
            periodos_ordenados = sorted(self.periodos.keys())
            primer_periodo = None
            ultimo_periodo = None
            
            # Encontrar el primer y último periodo con clase
            for periodo in periodos_ordenados:
                if (dia, periodo) in self.asignaciones and curso_id in self.asignaciones[(dia, periodo)]:
                    if primer_periodo is None:
                        primer_periodo = periodo
                    ultimo_periodo = periodo
            
            if primer_periodo is not None and ultimo_periodo is not None:
                # Verificar si hay periodos sin clase entre el primero y el último
                for periodo in periodos_ordenados:
                    if periodos_ordenados.index(primer_periodo) < periodos_ordenados.index(periodo) < periodos_ordenados.index(ultimo_periodo):
                        if (dia, periodo) not in self.asignaciones or curso_id not in self.asignaciones[(dia, periodo)]:
                            return True
        
        return False
    
    def compactar_horario(self, curso_id: str) -> bool:
        """
        Elimina huecos en el horario de un curso moviendo clases a periodos contiguos.
        Retorna True si se realizaron cambios, False en caso contrario.
        """
        cambios_realizados = False
        
        for dia in self.dias:
            periodos_ordenados = sorted(self.periodos.keys())
            asignaciones_dia = []
            
            # Recopilar todas las asignaciones del día
            for periodo in periodos_ordenados:
                if (dia, periodo) in self.asignaciones and curso_id in self.asignaciones[(dia, periodo)]:
                    asignaciones_dia.append((periodo, self.asignaciones[(dia, periodo)][curso_id]))
            
            if len(asignaciones_dia) <= 1:
                continue  # No hay suficientes asignaciones para compactar
            
            # Ordenar por periodo
            asignaciones_dia.sort(key=lambda x: periodos_ordenados.index(x[0]))
            
            # Verificar si hay huecos
            huecos = False
            for i in range(len(asignaciones_dia) - 1):
                idx1 = periodos_ordenados.index(asignaciones_dia[i][0])
                idx2 = periodos_ordenados.index(asignaciones_dia[i + 1][0])
                if idx2 - idx1 > 1:  # Hay un hueco
                    huecos = True
                    break
            
            if not huecos:
                continue  # No hay huecos que compactar
            
            # Compactar el horario
            for i, (periodo, requisito) in enumerate(asignaciones_dia):
                # Calcular el periodo objetivo (eliminando huecos)
                periodo_objetivo = periodos_ordenados[periodos_ordenados.index(periodos_ordenados[0]) + i]
                
                if periodo != periodo_objetivo:
                    # Desasignar del periodo actual
                    self.desasignar(dia, periodo, curso_id)
                    
                    # Asignar al nuevo periodo
                    if self.asignar(requisito, dia, periodo_objetivo):
                        cambios_realizados = True
                    else:
                        # Si no se puede asignar al periodo objetivo, intentar recuperar la asignación original
                        self.asignar(requisito, dia, periodo)
        
        return cambios_realizados
    
    def calcular_fitness(self, requisitos: List['Requisito']) -> float:
        """
        Calcula el valor de aptitud (fitness) del horario.
        Mayor valor = mejor horario.
        """
        # Penalización inicial
        penalizacion = 0
        
        # 1. Verificar que cada requisito tenga asignadas todas sus sesiones necesarias
        for requisito in requisitos:
            sesiones_faltantes = requisito.materia.frecuencia_semanal - len(requisito.asignaciones)
            if sesiones_faltantes > 0:
                penalizacion += sesiones_faltantes * 100
        
        # 2. Verificar clases compartidas
        for dia in self.dias:
            for periodo in self.periodos:
                # Agrupar por clase compartida
                clases_compartidas = {}
                for curso_id, requisito in self.asignaciones.get((dia, periodo), {}).items():
                    if requisito.materia.es_compartida():
                        clase = requisito.materia.clase_compartida
                        if clase not in clases_compartidas:
                            clases_compartidas[clase] = []
                        clases_compartidas[clase].append(requisito)
                
                # Verificar que todas las instancias de una clase compartida estén presentes
                for clase, reqs in clases_compartidas.items():
                    # Obtener todos los requisitos que deberían estar en esta clase compartida
                    total_reqs = [r for r in requisitos if r.materia.clase_compartida == clase]
                    if len(reqs) < len(total_reqs):
                        penalizacion += (len(total_reqs) - len(reqs)) * 50
        
        # 3. Verificar huecos en horarios
        cursos_unicos = set(req.curso.curso_id for req in requisitos)
        for curso_id in cursos_unicos:
            if self.tiene_huecos(curso_id):
                penalizacion += 30
        
        # 4. Restricciones blandas: distribución uniforme de clases
        for requisito in requisitos:
            if len(requisito.asignaciones) >= 2:
                # Verificar la distribución en días diferentes
                dias_asignados = [dia for dia, _ in requisito.asignaciones]
                if len(set(dias_asignados)) < len(dias_asignados):
                    penalizacion += 10  # Penalización por tener clases en el mismo día
        
        return 1000 - penalizacion
    
    def clonar(self):
        """Crea una copia profunda del horario."""
        nuevo_horario = Horario(self.periodos, self.dias)
        nuevo_horario.asignaciones = copy.deepcopy(self.asignaciones)
        return nuevo_horario
    
    def generar_matriz_horario(self) -> Dict[str, Dict[str, Dict[str, Any]]]:
        """
        Genera una representación matricial del horario para todos los cursos.
        Retorna un diccionario con la estructura:
        {curso_id: {dia: {periodo: {materia, profesor, sala}}}}
        """
        matriz = {}
        
        # Obtener cursos únicos en el horario
        cursos = set()
        for (dia, periodo), asignaciones in self.asignaciones.items():
            cursos.update(asignaciones.keys())
        
        # Inicializar matriz
        for curso in cursos:
            matriz[curso] = {}
            for dia in self.dias:
                matriz[curso][dia] = {}
                for periodo_id, periodo in self.periodos.items():
                    matriz[curso][dia][periodo_id] = None
        
        # Llenar con asignaciones
        for (dia, periodo), asignaciones in self.asignaciones.items():
            for curso_id, requisito in asignaciones.items():
                if curso_id in matriz and dia in matriz[curso_id] and periodo in matriz[curso_id][dia]:
                    matriz[curso_id][dia][periodo] = {
                        'materia': requisito.materia.nombre,
                        'profesor': requisito.profesor.nombre,
                        'sala': requisito.sala.sala_id,
                        'tipo': requisito.materia.tipo,
                        'clase_compartida': requisito.materia.clase_compartida
                    }
        
        return matriz
    
    def generar_visualizacion(self) -> str:
        """
        Genera una representación visual del horario como tabla HTML.
        Similar al formato mostrado en la imagen de ejemplo.
        """
        html = '<table border="1" cellspacing="0" cellpadding="5" style="border-collapse: collapse; width: 100%;">\n'
        
        # Encabezado con horas y periodos
        html += '<tr>\n'
        html += '<th>HR</th>\n'
        
        # Columnas para cada curso
        cursos = sorted(set(curso_id for _, asignaciones in self.asignaciones.items() 
                            for curso_id in asignaciones.keys()))
        
        for curso in cursos:
            html += f'<th>{curso}</th>\n'
        
        html += '</tr>\n'
        
        # Filas para cada periodo
        periodos_ordenados = sorted(self.periodos.keys())
        for periodo in periodos_ordenados:
            periodo_info = self.periodos[periodo]
            
            # Fila de hora
            html += '<tr>\n'
            html += f'<td>{periodo_info.hora_inicio}<br>{periodo}</td>\n'
            
            # Celdas para cada curso
            for curso in cursos:
                # Buscar asignación para este curso y periodo en cualquier día
                asignacion = None
                for dia in self.dias:
                    if (dia, periodo) in self.asignaciones and curso in self.asignaciones[(dia, periodo)]:
                        requisito = self.asignaciones[(dia, periodo)][curso]
                        asignacion = {
                            'materia': requisito.materia.nombre,
                            'profesor': requisito.profesor.nombre,
                            'sala': requisito.sala.sala_id,
                            'tipo': requisito.materia.tipo
                        }
                        break
                
                if asignacion:
                    # Determinar color según tipo
                    color = '#d4edda' if asignacion['tipo'] == 'Regular' else '#cce5ff'
                    html += f'<td style="background-color: {color};">'
                    html += f'<div><strong>{asignacion["materia"]}</strong></div>'
                    html += f'<div>{asignacion["profesor"]}</div>'
                    html += f'<div>{asignacion["sala"]}</div>'
                    html += '</td>\n'
                else:
                    html += '<td></td>\n'
            
            html += '</tr>\n'
        
        html += '</table>'
        return html