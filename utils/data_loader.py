"""
Clase principal que implementa el solucionador del problema de timetabling
"""

import datetime
import pandas as pd
import io
from typing import List, Dict, Set, Tuple, Any, Optional
from model.profesor import Profesor
from model.sala import Sala
from model.curso import Curso
from model.materia import Materia
from model.periodo import Periodo
from model.requisito import Requisito
from model.horario import Horario
from genetic.algoritmo_genetico import AlgoritmoGenetico
from model.asignacion import Asignacion
from model.horario import Horario


class TimetablingSolver:
    """
    Clase principal para resolver el problema de timetabling.
    Gestiona la carga de datos, ejecución del algoritmo y generación de resultados.
    """
    
    def __init__(self, csv_data):
        self.csv_data = csv_data
        
        # Periodos disponibles
        self.periodos = {
            'I': Periodo('I', '15:00', '16:00'),
            'II': Periodo('II', '16:00', '17:00'),
            'III': Periodo('III', '17:00', '18:00'),
            'IV': Periodo('IV', '18:00', '19:00'),
            'V': Periodo('V', '19:00', '20:00'),
            'VI': Periodo('VI', '20:00', '21:00')
        }
        self.dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']
        
        # Colecciones
        self.requisitos = []
        self.cursos = {}
        self.profesores = {}
        self.salas = {}
        self.materias = {}
    
    def cargar_datos(self):
        """Carga los datos desde el DataFrame."""
        try:
            # Convertir a DataFrame si es necesario
            if not isinstance(self.csv_data, pd.DataFrame):
                
                # Crear un objeto StringIO con el contenido del CSV
                csv_io = io.StringIO(self.csv_data)
                
                # Leer el CSV con pandas
                self.csv_data = pd.read_csv(csv_io, delimiter=';', encoding='cp1252')
            
            for _, row in self.csv_data.iterrows():
                # Crear o recuperar objetos
                curso_id = row['curso_id']
                if curso_id not in self.cursos:
                    self.cursos[curso_id] = Curso(curso_id)
                
                profesor_id = int(row['profesor_id'])
                nombre_profesor = f"Profesor {profesor_id}"  # Nombre por defecto
                if profesor_id not in self.profesores:
                    self.profesores[profesor_id] = Profesor(profesor_id, nombre_profesor)
                
                sala_id = row['sala_id']
                if sala_id not in self.salas:
                    self.salas[sala_id] = Sala(sala_id)
                
                materia_id = row['materia_id']
                if materia_id not in self.materias:
                    # Convertir valores a tipos apropiados
                    clase_compartida = row['clase_compartida']
                    frecuencia_semanal = int(row['frecuencia_semanal'])
                    duracion_sesion = int(row['duracion_sesion_horas'])
                    horas_semanales = int(row['horas_semanales_tipicas'])
                    
                    self.materias[materia_id] = Materia(
                        materia_id=materia_id,
                        nombre=row['nombre_materia'],
                        tipo=row['tipo_materia'],
                        clase_compartida=clase_compartida,
                        frecuencia_semanal=frecuencia_semanal,
                        duracion_sesion=duracion_sesion,
                        horas_semanales=horas_semanales
                    )
                
                # Crear requisito
                requisito = Requisito(
                    requisito_id=int(row['requisito_id']),
                    profesor=self.profesores[profesor_id],
                    sala=self.salas[sala_id],
                    curso=self.cursos[curso_id],
                    materia=self.materias[materia_id]
                )
                
                # Establecer disponibilidad
                dias_disponibles = []
                if int(row['lunes']) == 1:
                    dias_disponibles.append('Lunes')
                if int(row['martes']) == 1:
                    dias_disponibles.append('Martes')
                if int(row['miercoles']) == 1:
                    dias_disponibles.append('Miércoles')
                if int(row['jueves']) == 1:
                    dias_disponibles.append('Jueves')
                if int(row['viernes']) == 1:
                    dias_disponibles.append('Viernes')
                
                requisito.set_disponibilidad(
                    dias_disponibles=dias_disponibles,
                    hora_entrada=row['horario_entrada'],
                    hora_salida=row['horario_salida']
                )
                
                self.requisitos.append(requisito)
            
            print(f"Datos cargados: {len(self.requisitos)} requisitos, {len(self.cursos)} cursos, {len(self.profesores)} profesores, {len(self.salas)} salas, {len(self.materias)} materias")
            return True
        
        except Exception as e:
            print(f"Error al cargar datos: {e}")
            return False
    
    def resolver(self, tam_poblacion=50, generaciones=100, tasa_mutacion=0.1):
        """Resuelve el problema de timetabling y devuelve la solución."""
        print("Iniciando algoritmo genético...")
        
        # Crear instancia del algoritmo genético
        ag = AlgoritmoGenetico(
            requisitos=self.requisitos,
            cursos=list(self.cursos.values()),
            periodos=self.periodos,
            dias=self.dias,
            tam_poblacion=tam_poblacion,
            generaciones=generaciones,
            tasa_mutacion=tasa_mutacion
        )
        
        # Ejecutar el algoritmo
        mejor_horario = ag.ejecutar()
        
        return mejor_horario
    
    def verificar_solucion(self, horario: 'Horario'):
        """Verifica si la solución cumple con todas las restricciones."""
        violaciones_duras = 0
        violaciones_blandas = 0
        
        # 1. Cada materia debe estar asignada según su frecuencia semanal
        for requisito in self.requisitos:
            asignaciones = 0
            # Contar asignaciones en el horario
            for (dia, periodo), asignaciones_curso in horario.asignaciones.items():
                for curso_id, req in asignaciones_curso.items():
                    if req.requisito_id == requisito.requisito_id:
                        asignaciones += 1
            
            if asignaciones != requisito.materia.frecuencia_semanal:
                violaciones_duras += 1
                print(f"Violación dura: {requisito} debería tener {requisito.materia.frecuencia_semanal} sesiones, pero tiene {asignaciones}")
        
        # 2. Un profesor no puede dar clases a la misma hora
        for dia in self.dias:
            for periodo in self.periodos:
                profesores_en_periodo = set()
                for curso_id, req in horario.asignaciones.get((dia, periodo), {}).items():
                    if req.profesor in profesores_en_periodo:
                        violaciones_duras += 1
                        print(f"Violación dura: El profesor {req.profesor} está asignado a múltiples clases en {dia}, periodo {periodo}")
                    profesores_en_periodo.add(req.profesor)
        
        # 3. Una sala no puede tener más de una clase a la misma hora
        for dia in self.dias:
            for periodo in self.periodos:
                salas_en_periodo = set()
                for curso_id, req in horario.asignaciones.get((dia, periodo), {}).items():
                    if req.sala in salas_en_periodo:
                        violaciones_duras += 1
                        print(f"Violación dura: La sala {req.sala} está asignada a múltiples clases en {dia}, periodo {periodo}")
                    salas_en_periodo.add(req.sala)
        
        # 4. Un curso no puede tener más de una clase a la misma hora
        for dia in self.dias:
            for periodo in self.periodos:
                if (dia, periodo) in horario.asignaciones:
                    cursos_en_periodo = horario.asignaciones[(dia, periodo)].keys()
                    if len(cursos_en_periodo) > len(set(cursos_en_periodo)):
                        violaciones_duras += 1
                        print(f"Violación dura: Hay cursos duplicados en {dia}, periodo {periodo}")
        
        # 5. Verificar clases compartidas
        clases_compartidas = {}
        for requisito in self.requisitos:
            if requisito.materia.es_compartida():
                clase = requisito.materia.clase_compartida
                if clase not in clases_compartidas:
                    clases_compartidas[clase] = []
                clases_compartidas[clase].append(requisito)
        
        for clase, requisitos_clase in clases_compartidas.items():
            # Verificar que todas las instancias están asignadas correctamente
            for i, req1 in enumerate(requisitos_clase):
                for j, req2 in enumerate(requisitos_clase):
                    if i < j:  # Evitar comparaciones duplicadas
                        # Las asignaciones deberían ser idénticas
                        if sorted(req1.asignaciones) != sorted(req2.asignaciones):
                            violaciones_duras += 1
                            print(f"Violación dura: Clase compartida '{clase}' no está correctamente asignada para todos los cursos")
                            break
        
        # 6. Verificar huecos en los horarios
        for curso_id in self.cursos:
            if horario.tiene_huecos(curso_id):
                violaciones_duras += 1
                print(f"Violación dura: El curso {curso_id} tiene huecos en su horario")
        
        # 7. Restricciones blandas: distribución uniforme de clases
        for requisito in self.requisitos:
            if len(requisito.asignaciones) >= 2:
                # Verificar la distribución en días diferentes
                dias_asignados = [dia for dia, _ in requisito.asignaciones]
                if len(set(dias_asignados)) < len(dias_asignados):
                    violaciones_blandas += 1
                    print(f"Violación blanda: {requisito} tiene sesiones concentradas en los mismos días")
        
        return {
            'violaciones_duras': violaciones_duras,
            'violaciones_blandas': violaciones_blandas,
            'solucion_valida': violaciones_duras == 0
        }
    
    def imprimir_informe(self, horario: 'Horario'):
        """Imprime un informe detallado de la solución."""
        print("\n===== INFORME DE SOLUCIÓN =====")
        
        # Imprimir estadísticas
        total_asignaciones = sum(len(asignaciones) for _, asignaciones in horario.asignaciones.items())
        print(f"Total de asignaciones realizadas: {total_asignaciones}")
        
        # Verificar completitud
        requisitos_completados = 0
        total_sesiones_requeridas = sum(req.materia.frecuencia_semanal for req in self.requisitos)
        total_sesiones_asignadas = 0
        
        for requisito in self.requisitos:
            asignaciones = 0
            for (dia, periodo), asignaciones_curso in horario.asignaciones.items():
                for curso_id, req in asignaciones_curso.items():
                    if req.requisito_id == requisito.requisito_id:
                        asignaciones += 1
            
            total_sesiones_asignadas += asignaciones
            if asignaciones == requisito.materia.frecuencia_semanal:
                requisitos_completados += 1
        
        print(f"Requisitos completamente asignados: {requisitos_completados}/{len(self.requisitos)} ({requisitos_completados/len(self.requisitos)*100:.2f}%)")
        print(f"Sesiones asignadas: {total_sesiones_asignadas}/{total_sesiones_requeridas} ({total_sesiones_asignadas/total_sesiones_requeridas*100:.2f}%)")
        
        # Verificar restricciones
        resultado_verificacion = self.verificar_solucion(horario)
        print(f"Violaciones de restricciones duras: {resultado_verificacion['violaciones_duras']}")
        print(f"Violaciones de restricciones blandas: {resultado_verificacion['violaciones_blandas']}")
        print(f"Solución válida: {'Sí' if resultado_verificacion['solucion_valida'] else 'No'}")
        
        # Retornar validez de la solución
        return resultado_verificacion['solucion_valida']
    
    def generar_visualizacion_html(self, horario: 'Horario') -> str:
        """Genera una visualización HTML de la solución similar al formato de la imagen de referencia."""
        # Obtener la matriz del horario
        matriz = horario.generar_matriz_horario()
        
        # Generar HTML
        html = """
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Horarios - Academia Nacional de Música 'Man Césped'</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 20px;
                }
                table {
                    border-collapse: collapse;
                    width: 100%;
                    margin-bottom: 30px;
                }
                th, td {
                    border: 1px solid #000;
                    padding: 8px;
                    text-align: center;
                    vertical-align: top;
                }
                th {
                    background-color: #f2f2f2;
                }
                .period-cell {
                    text-align: center;
                    font-weight: bold;
                    background-color: #e1e1e1;
                }
                .regular-class {
                    background-color: #ffe6cc;
                }
                .orchestral-class {
                    background-color: #d9edf7;
                }
                .class-name {
                    font-weight: bold;
                    margin-bottom: 3px;
                }
                .teacher-name {
                    color: #555;
                    font-style: italic;
                }
                .room-name {
                    color: #777;
                }
                h1, h2 {
                    color: #333;
                }
            </style>
        </head>
        <body>
            <h1>Academia Nacional de Música 'Man Césped'</h1>
            <h2>Horarios Generados con Algoritmos Genéticos</h2>
        """
        
        # Tabla por día y periodo (como en la imagen de referencia)
        html += """
            <table>
                <tr>
                    <th>HR</th>
        """
        
        # Encabezados de cursos
        cursos_ordenados = sorted(self.cursos.keys())
        for curso_id in cursos_ordenados:
            html += f"<th>{curso_id}</th>\n"
        
        html += "</tr>\n"
        
        # Filas por periodo
        for periodo_id, periodo in self.periodos.items():
            html += "<tr>\n"
            
            # Celda de hora y periodo
            html += f"""
                <td class="period-cell">
                    {periodo.hora_inicio}<br>
                    {periodo_id}
                </td>
            """
            
            # Celdas para cada curso
            for curso_id in cursos_ordenados:
                # Buscar asignación para este curso en cualquier día (simplificación)
                asignacion_encontrada = False
                for dia in self.dias:
                    if (dia, periodo_id) in horario.asignaciones and curso_id in horario.asignaciones[(dia, periodo_id)]:
                        requisito = horario.asignaciones[(dia, periodo_id)][curso_id]
                        
                        # Determinar clase de estilo
                        clase_estilo = "orchestral-class" if requisito.materia.tipo == "Orquestal" else "regular-class"
                        
                        html += f"""
                            <td class="{clase_estilo}">
                                <div class="class-name">{requisito.materia.nombre}</div>
                                <div class="teacher-name">{requisito.profesor.nombre}</div>
                                <div class="room-name">{requisito.sala.sala_id}</div>
                            </td>
                        """
                        asignacion_encontrada = True
                        break
                
                if not asignacion_encontrada:
                    html += "<td></td>\n"
            
            html += "</tr>\n"
        
        html += """
            </table>
        </body>
        </html>
        """
        
        return html