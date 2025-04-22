"""
Implementación del Algoritmo Genético para resolver el problema de timetabling
"""

import random
import copy
from typing import List, Dict, Set, Tuple, Any, Optional
from model.profesor import Profesor
from model.sala import Sala
from model.curso import Curso
from model.materia import Materia
from model.periodo import Periodo
from model.requisito import Requisito
from model.horario import Horario
from model.asignacion import Asignacion


class AlgoritmoGenetico:
    """
    Implementación de un algoritmo genético para resolver el problema de timetabling.
    """
    
    def __init__(self, requisitos: List['Requisito'], cursos: List['Curso'], periodos: Dict[str, 'Periodo'], 
                 dias: List[str], tam_poblacion: int = 50, generaciones: int = 100, tasa_mutacion: float = 0.1):
        self.requisitos = requisitos
        self.cursos = cursos
        self.periodos = periodos
        self.dias = dias
        self.tam_poblacion = tam_poblacion
        self.generaciones = generaciones
        self.tasa_mutacion = tasa_mutacion
        self.poblacion = []
        
        # Agrupar requisitos por clase compartida
        self.requisitos_por_clase_compartida = {}
        for req in requisitos:
            if req.materia.es_compartida():
                clase = req.materia.clase_compartida
                if clase not in self.requisitos_por_clase_compartida:
                    self.requisitos_por_clase_compartida[clase] = []
                self.requisitos_por_clase_compartida[clase].append(req)
    
    def generar_horario_aleatorio(self) -> 'Horario':
        """
        Genera un horario aleatorio intentando respetar las restricciones.
        Primero asigna clases compartidas, luego el resto de materias.
        """
        horario = Horario(self.periodos, self.dias)
        
        # Reiniciar asignaciones previas
        for requisito in self.requisitos:
            requisito.reset_asignaciones()
        
        # Paso 1: Asignar primero las clases compartidas
        for clase_compartida, requisitos_clase in self.requisitos_por_clase_compartida.items():
            # Para cada sesión requerida (según la frecuencia semanal)
            frecuencia = requisitos_clase[0].materia.frecuencia_semanal
            for _ in range(frecuencia):
                # Intentar varias veces para evitar quedarse sin opciones
                max_intentos = 50
                asignado = False
                
                for _ in range(max_intentos):
                    if asignado:
                        break
                    
                    # Seleccionar día aleatorio (debe ser compatible con todos los requisitos)
                    dias_comunes = self._encontrar_dias_comunes(requisitos_clase)
                    if not dias_comunes:
                        break
                    dia = random.choice(dias_comunes)
                    
                    # Seleccionar periodo aleatorio (debe ser compatible con todos los requisitos)
                    periodos_comunes = self._encontrar_periodos_comunes(requisitos_clase, dia)
                    if not periodos_comunes:
                        break
                    periodo = random.choice(periodos_comunes)
                    
                    # Intentar asignar la clase compartida
                    if horario.asignar_clase_compartida(requisitos_clase, dia, periodo):
                        asignado = True
        
        # Paso 2: Asignar el resto de materias (no compartidas)
        req_individuales = [req for req in self.requisitos if not req.materia.es_compartida()]
        
        # Ordenar por restricciones (primero los más restrictivos)
        req_individuales.sort(key=lambda r: (
            len(r.dias_disponibles), 
            len(r.get_periodos_disponibles(self.periodos)),
            -r.materia.frecuencia_semanal
        ))
        
        for requisito in req_individuales:
            # Para cada sesión requerida
            for _ in range(requisito.materia.frecuencia_semanal - len(requisito.asignaciones)):
                # Intentar varias veces
                max_intentos = 50
                asignado = False
                
                for _ in range(max_intentos):
                    if asignado:
                        break
                    
                    # Seleccionar día aleatorio de los disponibles
                    if not requisito.dias_disponibles:
                        break
                    dia = random.choice(requisito.dias_disponibles)
                    
                    # Seleccionar periodo aleatorio de los disponibles
                    periodos_disponibles = requisito.get_periodos_disponibles(self.periodos)
                    if not periodos_disponibles:
                        break
                    periodo = random.choice(periodos_disponibles)
                    
                    # Intentar asignar
                    if horario.asignar(requisito, dia, periodo):
                        asignado = True
        
        # Paso 3: Eliminar huecos en los horarios
        for curso in self.cursos:
            horario.compactar_horario(curso.curso_id)
        
        return horario
    
    def _encontrar_dias_comunes(self, requisitos: List['Requisito']) -> List[str]:
        """Encuentra los días disponibles comunes a todos los requisitos."""
        if not requisitos:
            return []
        
        # Inicializar con los días del primer requisito
        dias_comunes = set(requisitos[0].dias_disponibles)
        
        # Intersectar con los días de los demás requisitos
        for req in requisitos[1:]:
            dias_comunes &= set(req.dias_disponibles)
        
        return list(dias_comunes)
    
    def _encontrar_periodos_comunes(self, requisitos: List['Requisito'], dia: str) -> List[str]:
        """Encuentra los periodos disponibles comunes a todos los requisitos en un día específico."""
        if not requisitos:
            return []
        
        periodos_comunes = None
        
        for req in requisitos:
            if dia not in req.dias_disponibles:
                return []
            
            periodos_req = set(req.get_periodos_disponibles(self.periodos))
            
            if periodos_comunes is None:
                periodos_comunes = periodos_req
            else:
                periodos_comunes &= periodos_req
        
        return list(periodos_comunes) if periodos_comunes else []
    
    def inicializar_poblacion(self):
        """Inicializa la población con horarios aleatorios."""
        self.poblacion = []
        for _ in range(self.tam_poblacion):
            horario = self.generar_horario_aleatorio()
            self.poblacion.append(horario)
    
    def seleccion_torneo(self) -> List['Horario']:
        """Selecciona individuos mediante el método de torneo."""
        seleccionados = []
        
        for _ in range(self.tam_poblacion):
            # Seleccionar 3 individuos aleatorios
            candidatos = random.sample(self.poblacion, min(3, len(self.poblacion)))
            
            # Evaluar su fitness
            mejores = [(h, h.calcular_fitness(self.requisitos)) for h in candidatos]
            mejores.sort(key=lambda x: x[1], reverse=True)
            
            # Seleccionar el mejor
            seleccionados.append(mejores[0][0])
        
        return seleccionados
    
    def cruce(self, padre_a: 'Horario', padre_b: 'Horario') -> 'Horario':
        """
        Realiza el cruce entre dos horarios para generar uno nuevo.
        Este cruce respeta las clases compartidas.
        """
        hijo = Horario(self.periodos, self.dias)
        
        # Reiniciar asignaciones de los requisitos
        for requisito in self.requisitos:
            requisito.reset_asignaciones()
        
        # Paso 1: Copiar clases compartidas desde uno de los padres (aleatoriamente)
        for clase_compartida, requisitos_clase in self.requisitos_por_clase_compartida.items():
            padre = padre_a if random.random() < 0.5 else padre_b
            
            # Buscar asignaciones existentes en el padre para esta clase compartida
            asignaciones_encontradas = []
            
            for (dia, periodo), asignaciones_curso in padre.asignaciones.items():
                # Verificar si alguno de los requisitos de la clase compartida está asignado
                req_encontrado = None
                for req in requisitos_clase:
                    if req.curso.curso_id in asignaciones_curso:
                        req_asignado = asignaciones_curso[req.curso.curso_id]
                        if req_asignado.materia.clase_compartida == clase_compartida:
                            req_encontrado = req_asignado
                            break
                
                if req_encontrado:
                    asignaciones_encontradas.append((dia, periodo))
            
            # Copiar las asignaciones encontradas al hijo
            for dia, periodo in asignaciones_encontradas:
                hijo.asignar_clase_compartida(requisitos_clase, dia, periodo)
        
        # Paso 2: Para cada requisito individual, copiar del padre A o B aleatoriamente
        for requisito in self.requisitos:
            if not requisito.materia.es_compartida() and not requisito.is_completamente_asignado():
                padre = padre_a if random.random() < 0.5 else padre_b
                
                # Buscar asignaciones en el padre
                for (dia, periodo), asignaciones_curso in padre.asignaciones.items():
                    if requisito.curso.curso_id in asignaciones_curso:
                        req_asignado = asignaciones_curso[requisito.curso.curso_id]
                        if req_asignado.requisito_id == requisito.requisito_id:
                            # Intentar asignar en el hijo
                            hijo.asignar(requisito, dia, periodo)
        
        # Paso 3: Eliminar huecos en los horarios
        for curso in self.cursos:
            hijo.compactar_horario(curso.curso_id)
        
        return hijo
    
    def mutar(self, horario: 'Horario') -> 'Horario':
        """
        Realiza mutaciones aleatorias en el horario.
        Respeta las clases compartidas durante la mutación.
        """
        horario_mutado = horario.clonar()
        
        # Reiniciar las asignaciones en los requisitos para evitar inconsistencias
        for requisito in self.requisitos:
            requisito.reset_asignaciones()
            # Reconstruir las asignaciones basadas en el horario
            for (dia, periodo), asignaciones_curso in horario_mutado.asignaciones.items():
                for curso_id, req in asignaciones_curso.items():
                    if req.requisito_id == requisito.requisito_id:
                        requisito.asignar_horario(dia, periodo)
        
        # Paso 1: Mutar clases compartidas (con baja probabilidad)
        for clase_compartida, requisitos_clase in self.requisitos_por_clase_compartida.items():
            if random.random() < self.tasa_mutacion / 2:  # Menor probabilidad para clases compartidas
                # Encontrar las asignaciones actuales
                asignaciones_actuales = []
                
                for (dia, periodo), asignaciones_curso in horario_mutado.asignaciones.items():
                    for curso_id, req in asignaciones_curso.items():
                        if req.materia.clase_compartida == clase_compartida:
                            asignaciones_actuales.append((dia, periodo))
                            break
                
                if asignaciones_actuales:
                    # Seleccionar una asignación al azar para mutar
                    dia_actual, periodo_actual = random.choice(asignaciones_actuales)
                    
                    # Eliminar la asignación actual
                    horario_mutado.desasignar_clase_compartida(dia_actual, periodo_actual, clase_compartida)
                    
                    # Intentar reasignar en otro slot
                    dias_comunes = self._encontrar_dias_comunes(requisitos_clase)
                    if dias_comunes:
                        max_intentos = 30
                        for _ in range(max_intentos):
                            nuevo_dia = random.choice(dias_comunes)
                            periodos_comunes = self._encontrar_periodos_comunes(requisitos_clase, nuevo_dia)
                            if periodos_comunes:
                                nuevo_periodo = random.choice(periodos_comunes)
                                if horario_mutado.asignar_clase_compartida(requisitos_clase, nuevo_dia, nuevo_periodo):
                                    break
        
        # Paso 2: Mutar requisitos individuales
        for requisito in self.requisitos:
            if not requisito.materia.es_compartida():
                for i, (dia_actual, periodo_actual) in enumerate(list(requisito.asignaciones)):
                    if random.random() < self.tasa_mutacion:
                        # Eliminar la asignación actual
                        horario_mutado.desasignar(dia_actual, periodo_actual, requisito.curso.curso_id)
                        
                        # Intentar reasignar en otro slot
                        max_intentos = 30
                        for _ in range(max_intentos):
                            if requisito.dias_disponibles:
                                nuevo_dia = random.choice(requisito.dias_disponibles)
                                periodos_disponibles = requisito.get_periodos_disponibles(self.periodos)
                                if periodos_disponibles:
                                    nuevo_periodo = random.choice(periodos_disponibles)
                                    if horario_mutado.asignar(requisito, nuevo_dia, nuevo_periodo):
                                        break
        
        # Paso 3: Eliminar huecos en los horarios
        for curso in self.cursos:
            horario_mutado.compactar_horario(curso.curso_id)
        
        return horario_mutado
    
    def ejecutar(self) -> 'Horario':
        """Ejecuta el algoritmo genético y retorna el mejor horario encontrado."""
        # Paso 1: Inicializar población
        self.inicializar_poblacion()
        
        mejor_horario = None
        mejor_fitness = -float('inf')
        
        # Paso 2: Evolucionar la población
        for generacion in range(self.generaciones):
            # Evaluar población actual
            for horario in self.poblacion:
                fitness = horario.calcular_fitness(self.requisitos)
                if fitness > mejor_fitness:
                    mejor_fitness = fitness
                    mejor_horario = horario.clonar()
            
            print(f"Generación {generacion+1}/{self.generaciones}, Mejor Fitness = {mejor_fitness}")
            
            # Criterio de parada temprana
            if mejor_fitness >= 1000:  # Solución perfecta
                break
            
            # Seleccionar padres
            padres = self.seleccion_torneo()
            
            # Crear nueva población
            nueva_poblacion = []
            
            # Elitismo: mantener el mejor individuo
            nueva_poblacion.append(mejor_horario)
            
            # Generar el resto mediante cruce y mutación
            while len(nueva_poblacion) < self.tam_poblacion:
                # Seleccionar padres al azar
                padre_a, padre_b = random.sample(padres, 2)
                
                # Cruzar
                hijo = self.cruce(padre_a, padre_b)
                
                # Mutar
                hijo_mutado = self.mutar(hijo)
                
                # Añadir a la nueva población
                nueva_poblacion.append(hijo_mutado)
            
            # Reemplazar población
            self.poblacion = nueva_poblacion
        
        return mejor_horario