# -*- coding: utf-8 -*-
"""
Implementación detallada de las restricciones duras y blandas
para el problema de generación de horarios.
"""
from model.horario import Horario # Necesita acceso al horario completo
from model.profesor import Profesor
from model.requisito_clase import RequisitoClase
from model.evento import Evento
from config import DIAS_SEMANA, NUM_DIAS # Para reglas Orquestal y huecos

# --- Constantes de Penalización ---
# Penalizaciones MUY ALTAS para restricciones duras para asegurar que se eviten
PENALIZACION_DURA_BASE = 1000000
PENALIZACION_SOLAPAMIENTO = PENALIZACION_DURA_BASE * 1.5 # Prioridad máxima
PENALIZACION_REGLA_ESPECIFICA = PENALIZACION_DURA_BASE

# Pesos para restricciones blandas (ajustar según preferencia)
PESO_HUECOS = 10
PESO_DISTRIBUCION_EQUILIBRADA = 5 # Ejemplo


# --- Clase Base para Restricciones ---
class Restriccion:
    def __init__(self, peso):
        self.peso = peso

    def evaluar(self, horario: Horario, **kwargs) -> float:
        """Evalúa la restricción en el horario dado y devuelve una penalización."""
        raise NotImplementedError

# --- Restricciones Duras ---

class SolapamientoProfesor(Restriccion):
    """Penaliza si un profesor está en dos sitios a la vez."""
    def __init__(self, peso=PENALIZACION_SOLAPAMIENTO):
        super().__init__(peso)

    def evaluar(self, horario: Horario, **kwargs) -> float:
        violaciones = 0
        # El mapa interno del Horario ya previene esto si agregar_evento funciona bien
        # Pero podemos verificarlo explícitamente por seguridad
        slots_ocupados_prof = {} # (prof_id, dia, hora) -> count
        for evento in horario.eventos:
            for dia, hora in evento.get_slots_ocupados():
                key = (evento.profesor.id, dia, hora)
                slots_ocupados_prof[key] = slots_ocupados_prof.get(key, 0) + 1
                if slots_ocupados_prof[key] > 1:
                    violaciones += 1
        # Cada par extra cuenta como una violación grave
        return violaciones * self.peso

class SolapamientoSala(Restriccion):
    """Penaliza si una sala está usada por dos eventos a la vez."""
    def __init__(self, peso=PENALIZACION_SOLAPAMIENTO):
        super().__init__(peso)

    def evaluar(self, horario: Horario, **kwargs) -> float:
        violaciones = 0
        slots_ocupados_sala = {} # (sala_id, dia, hora) -> count
        for evento in horario.eventos:
            for dia, hora in evento.get_slots_ocupados():
                key = (evento.sala.id, dia, hora)
                slots_ocupados_sala[key] = slots_ocupados_sala.get(key, 0) + 1
                if slots_ocupados_sala[key] > 1:
                    violaciones += 1
        return violaciones * self.peso

class SolapamientoGrupo(Restriccion):
    """Penaliza si un grupo (curso_id) tiene dos clases a la vez."""
    def __init__(self, peso=PENALIZACION_SOLAPAMIENTO):
        super().__init__(peso)

    def evaluar(self, horario: Horario, **kwargs) -> float:
        violaciones = 0
        slots_ocupados_grupo = {} # (curso_id, dia, hora) -> count
        for evento in horario.eventos:
            for dia, hora in evento.get_slots_ocupados():
                key = (evento.requisito.curso_id, dia, hora)
                slots_ocupados_grupo[key] = slots_ocupados_grupo.get(key, 0) + 1
                if slots_ocupados_grupo[key] > 1:
                    violaciones += 1
        return violaciones * self.peso

class ProfesorAsignadoCorrecto(Restriccion):
    """Penaliza si un evento no es impartido por el profesor asignado al requisito."""
    def __init__(self, peso=PENALIZACION_REGLA_ESPECIFICA):
        super().__init__(peso)

    def evaluar(self, horario: Horario, **kwargs) -> float:
        violaciones = 0
        for evento in horario.eventos:
            if evento.profesor.id != evento.requisito.profesor_asignado.id:
                violaciones += 1
        return violaciones * self.peso

class SalaCapacidadSuficiente(Restriccion):
    """Penaliza si el número de inscritos excede la capacidad de la sala."""
    def __init__(self, peso=PENALIZACION_REGLA_ESPECIFICA):
        super().__init__(peso)

    def evaluar(self, horario: Horario, **kwargs) -> float:
        violaciones = 0
        for evento in horario.eventos:
            if evento.sala.capacidad < evento.requisito.inscritos:
                # Penalizar más cuanto mayor sea la diferencia?
                violaciones += 1 #(evento.requisito.inscritos - evento.sala.capacidad)
        return violaciones * self.peso

class SlotPermitido(Restriccion):
    """Penaliza si un evento se asigna fuera de sus slots permitidos."""
    def __init__(self, peso=PENALIZACION_REGLA_ESPECIFICA):
        super().__init__(peso)

    def evaluar(self, horario: Horario, **kwargs) -> float:
        violaciones = 0
        for evento in horario.eventos:
             # El evento representa el inicio de la sesión en (evento.dia, evento.hora)
             slot_inicio_evento = (evento.dia, evento.hora)
             # Los allowed_slots en RequisitoClase son los slots donde PUEDE EMPEZAR una sesión
             if slot_inicio_evento not in evento.requisito.allowed_slots:
                 violaciones += 1
             else:
                  # Adicionalmente, verificar que TODOS los slots del bloque estén definidos
                  # (Esto se controla mejor en Horario.agregar_evento)
                  # slots_ocupados = evento.get_slots_ocupados()
                  # if len(slots_ocupados) < evento.requisito.slots_per_session:
                  #      violaciones += 1 # El bloque no cabe completo
                  pass # La validación principal es si el inicio está permitido

        return violaciones * self.peso

class HorasMinimasProfesorItem(Restriccion):
    """Penaliza si un profesor con 'Item' no cumple sus 14 horas mínimas."""
    def __init__(self, peso=PENALIZACION_REGLA_ESPECIFICA, min_horas=14):
        super().__init__(peso)
        self.min_horas = min_horas

    def evaluar(self, horario: Horario, **kwargs) -> float:
        if not horario.profesores: # Necesita la lista de todos los profesores
             print("Advertencia: Lista de profesores no disponible en Horario para evaluar HorasMinimasProfesorItem.")
             return 0

        violaciones = 0
        horas_por_profesor = horario.get_horas_asignadas_por_profesor() # Método a añadir en Horario

        for profesor in horario.profesores:
             if profesor.tiene_item:
                 horas_asignadas = horas_por_profesor.get(profesor.id, 0)
                 if horas_asignadas < self.min_horas:
                     # Penalizar por cada hora faltante
                     violaciones += (self.min_horas - horas_asignadas)

        return violaciones * self.peso

class SincronizacionClaseCompartida(Restriccion):
    """Penaliza si los eventos del mismo grupo compartido no están en el mismo slot."""
    def __init__(self, peso=PENALIZACION_REGLA_ESPECIFICA):
        super().__init__(peso)

    def evaluar(self, horario: Horario, **kwargs) -> float:
        if not horario.requisitos:
             print("Advertencia: Lista de requisitos no disponible en Horario para evaluar SincronizacionClaseCompartida.")
             return 0

        violaciones = 0
        shared_groups_info = {} # group_id -> set of (dia, hora) found for events of this group

        # Recolectar los slots de inicio de los eventos para cada grupo compartido
        for evento in horario.eventos:
            if evento.requisito.shared_class_group:
                group_id = evento.requisito.shared_class_group
                slot_inicio = (evento.dia, evento.hora)
                if group_id not in shared_groups_info:
                    shared_groups_info[group_id] = set()
                shared_groups_info[group_id].add(slot_inicio)

        # Verificar que cada grupo tenga exactamente un slot asignado
        for group_id, slots_asignados in shared_groups_info.items():
            if len(slots_asignados) > 1:
                # Penalizar por cada slot extra encontrado (indica desincronización)
                violaciones += (len(slots_asignados) - 1)

        # Adicionalmente (más complejo): Verificar si TODOS los requisitos del grupo están presentes
        # all_shared_groups_data = kwargs.get('shared_groups_data', {}) # Necesita el mapa de DataLoader
        # for group_id, requisitos_del_grupo in all_shared_groups_data.items():
        #     eventos_encontrados = [e for e in horario.eventos if e.requisito.shared_class_group == group_id]
        #     if len(eventos_encontrados) != len(requisitos_del_grupo) and len(eventos_encontrados) > 0:
        #          # Si algunos están pero no todos, es una violación
        #          violaciones += abs(len(requisitos_del_grupo) - len(eventos_encontrados))


        return violaciones * self.peso

class ReglasOrquestal(Restriccion):
    """Penaliza si clases orquestales no están en Martes o Jueves."""
    def __init__(self, peso=PENALIZACION_REGLA_ESPECIFICA):
        super().__init__(peso)
        # Asumir índices: Lunes=0, Martes=1, Miercoles=2, Jueves=3, Viernes=4
        self.dias_orquestal_idx = {1, 3} # Martes, Jueves

    def evaluar(self, horario: Horario, **kwargs) -> float:
        violaciones = 0
        for evento in horario.eventos:
            if evento.requisito.is_orquestal:
                if evento.dia not in self.dias_orquestal_idx:
                    violaciones += 1 # Cada slot fuera de Ma/Ju es una violación
        return violaciones * self.peso


# --- Restricciones Blandas ---

class MinimizarHuecos(Restriccion):
    """Penaliza huecos en el horario de los profesores (excepto orquestal en Ma/Ju)."""
    def __init__(self, peso=PESO_HUECOS):
        super().__init__(peso)
        self.dias_orquestal_idx = {1, 3} # Martes, Jueves

    def evaluar(self, horario: Horario, **kwargs) -> float:
        if not horario.profesores: return 0

        total_huecos_penalizados = 0
        matriz_por_profesor = horario.get_matriz_eventos_por_profesor() # Método a añadir en Horario

        for prof_id, matriz_prof in matriz_por_profesor.items():
             profesor = horario.profesores_map.get(prof_id) # Necesita mapa ID->Profesor en Horario
             if not profesor: continue

             for dia in range(NUM_DIAS):
                 horas_ocupadas_indices = sorted([h for h, evento in enumerate(matriz_prof[dia]) if evento is not None])

                 if len(horas_ocupadas_indices) > 1:
                     # Verificar si este profesor tiene clases orquestales asignadas ESE día
                     es_dia_orquestal_permitido = dia in self.dias_orquestal_idx
                     tiene_clase_orquestal_ese_dia = False
                     if es_dia_orquestal_permitido:
                          for hora_idx in horas_ocupadas_indices:
                              evento = matriz_prof[dia][hora_idx]
                              if evento and evento.requisito.is_orquestal:
                                   tiene_clase_orquestal_ese_dia = True
                                   break

                     # Calcular huecos solo si NO es día con clase orquestal para este prof
                     if not tiene_clase_orquestal_ese_dia:
                         for i in range(len(horas_ocupadas_indices) - 1):
                             hueco = horas_ocupadas_indices[i+1] - horas_ocupadas_indices[i] - 1
                             if hueco > 0:
                                 total_huecos_penalizados += hueco

        return total_huecos_penalizados * self.peso

# --- Puedes añadir más restricciones blandas como DistribucionEquilibrada ---