# -*- coding: utf-8 -*-
"""
Implementación detallada de las restricciones duras y blandas
para el problema de generación de horarios.
"""
from model.horario import Horario
from model.profesor import Profesor
from model.requisito_clase import RequisitoClase
from model.evento import Evento
from config import DIAS_SEMANA, NUM_DIAS

# --- Constantes de Penalización ---
PENALIZACION_DURA_BASE = 1000000
PENALIZACION_SOLAPAMIENTO = PENALIZACION_DURA_BASE * 1.5
PENALIZACION_REGLA_ESPECIFICA = PENALIZACION_DURA_BASE
PESO_HUECOS = 10
PESO_DISTRIBUCION_EQUILIBRADA = 5

# --- Clase Base ---
class Restriccion:
    def __init__(self, peso): self.peso = peso
    def evaluar(self, horario: Horario, **kwargs) -> float: raise NotImplementedError

# --- Restricciones Duras ---

# SolapamientoProfesor, SolapamientoSala, SolapamientoGrupo (sin cambios respecto a versión anterior)
class SolapamientoProfesor(Restriccion):
    def __init__(self, peso=PENALIZACION_SOLAPAMIENTO): super().__init__(peso)
    def evaluar(self, horario: Horario, **kwargs) -> float:
        violaciones = 0; slots_ocupados_prof = {}
        for evento in horario.eventos:
            for dia, hora in evento.get_slots_ocupados():
                key = (evento.profesor.id, dia, hora)
                slots_ocupados_prof[key] = slots_ocupados_prof.get(key, 0) + 1
                if slots_ocupados_prof[key] > 1: violaciones += 1
        return violaciones * self.peso

class SolapamientoSala(Restriccion):
    def __init__(self, peso=PENALIZACION_SOLAPAMIENTO): super().__init__(peso)
    def evaluar(self, horario: Horario, **kwargs) -> float:
        violaciones = 0; slots_ocupados_sala = {}
        for evento in horario.eventos:
            for dia, hora in evento.get_slots_ocupados():
                key = (evento.sala.id, dia, hora)
                slots_ocupados_sala[key] = slots_ocupados_sala.get(key, 0) + 1
                if slots_ocupados_sala[key] > 1: violaciones += 1
        return violaciones * self.peso

class SolapamientoGrupo(Restriccion):
    def __init__(self, peso=PENALIZACION_SOLAPAMIENTO): super().__init__(peso)
    def evaluar(self, horario: Horario, **kwargs) -> float:
        violaciones = 0; slots_ocupados_grupo = {}
        for evento in horario.eventos:
            # Asegurarse que requisito.curso_id existe
            curso_id = getattr(getattr(evento, 'requisito', None), 'curso_id', None)
            if curso_id is None: continue # Saltar evento si no tiene curso_id (error de datos?)
            
            for dia, hora in evento.get_slots_ocupados():
                key = (curso_id, dia, hora)
                count = slots_ocupados_grupo.get(key, 0) + 1
                slots_ocupados_grupo[key] = count
                # La violación ocurre si > 1 *diferente* requisito usa el slot para el mismo grupo
                # Contar cuántos requisitos únicos usan este slot/grupo
                if count > 1:
                    eventos_en_slot = [e for e in horario.eventos if getattr(getattr(e, 'requisito', None), 'curso_id', None) == curso_id and (dia, hora) in e.get_slots_ocupados()]
                    requisitos_unicos_en_slot = {e.requisito.id for e in eventos_en_slot}
                    if len(requisitos_unicos_en_slot) > 1:
                        # Penalizar solo una vez por slot conflictivo, no por cada evento extra
                        # Ajustar la cuenta de violaciones podría ser necesario para precisión
                        pass # La lógica simple de contar > 1 ya penaliza
                    
        # Contar cuántas claves tienen un conteo > 1 (simplificación)
        violaciones = sum(1 for count in slots_ocupados_grupo.values() if count > 1)
        # Refinamiento: Contar cuántos pares de eventos distintos colisionan? Más complejo.
        return violaciones * self.peso


class ProfesorAsignadoCorrecto(Restriccion):
    """
    Penaliza si el profesor asignado a un evento NO está en la lista
    de profesores elegibles para el requisito de ese evento.
    """
    def __init__(self, peso=PENALIZACION_REGLA_ESPECIFICA):
        super().__init__(peso)

    def evaluar(self, horario: Horario, **kwargs) -> float:
        violaciones = 0
        for evento in horario.eventos:
            # *** LÓGICA CORREGIDA ***
            # Verificar si el profesor del evento está en la lista de elegibles del requisito
            # Usamos los objetos Profesor directamente para comparación segura
            if evento.profesor not in evento.requisito.profesores_elegibles:
                violaciones += 1
                # print(f"DEBUG VIOLACIÓN: Prof {evento.profesor.id} NO ELEGIBLE para Req {evento.requisito.id}")
            # ***********************
        return violaciones * self.peso

# SalaCapacidadSuficiente, SlotPermitido, HorasMinimasProfesorItem,
# SincronizacionClaseCompartida, ReglasOrquestal, MinimizarHuecos
# (sin cambios respecto a la versión anterior, ya usaban evento.requisito o evento.profesor)

class SalaCapacidadSuficiente(Restriccion):
    def __init__(self, peso=PENALIZACION_REGLA_ESPECIFICA): super().__init__(peso)
    def evaluar(self, horario: Horario, **kwargs) -> float:
        violaciones = 0
        for evento in horario.eventos:
            if evento.sala.capacidad < evento.requisito.inscritos: violaciones += 1
        return violaciones * self.peso

class SlotPermitido(Restriccion):
    def __init__(self, peso=PENALIZACION_REGLA_ESPECIFICA): super().__init__(peso)
    def evaluar(self, horario: Horario, **kwargs) -> float:
        violaciones = 0
        for evento in horario.eventos:
             slot_inicio_evento = (evento.dia, evento.hora)
             if slot_inicio_evento not in evento.requisito.allowed_slots:
                 violaciones += 1
             # Podríamos añadir verificación de que el bloque cabe, pero Horario.agregar_evento debería prevenirlo
        return violaciones * self.peso

class HorasMinimasProfesorItem(Restriccion):
    def __init__(self, peso=PENALIZACION_REGLA_ESPECIFICA, min_horas=14):
        super().__init__(peso); self.min_horas = min_horas
    def evaluar(self, horario: Horario, **kwargs) -> float:
        if not hasattr(horario, 'profesores') or not horario.profesores: return 0
        violaciones = 0
        horas_por_profesor = horario.get_horas_asignadas_por_profesor()
        for profesor in horario.profesores:
             if profesor.tiene_item:
                 horas_asignadas = horas_por_profesor.get(profesor.id, 0)
                 if horas_asignadas < self.min_horas:
                     violaciones += (self.min_horas - horas_asignadas)
        return violaciones * self.peso

class SincronizacionClaseCompartida(Restriccion):
    def __init__(self, peso=PENALIZACION_REGLA_ESPECIFICA): super().__init__(peso)
    def evaluar(self, horario: Horario, **kwargs) -> float:
        violaciones = 0
        shared_groups_info = {}
        for evento in horario.eventos:
            if evento.requisito.shared_class_group:
                group_id = evento.requisito.shared_class_group
                slot_inicio = (evento.dia, evento.hora)
                if group_id not in shared_groups_info: shared_groups_info[group_id] = set()
                shared_groups_info[group_id].add(slot_inicio)
        for group_id, slots_asignados in shared_groups_info.items():
            if len(slots_asignados) > 1: violaciones += (len(slots_asignados) - 1)
        # TODO: Chequear si faltan miembros del grupo (necesita shared_groups_data de kwargs)
        # shared_groups_data = kwargs.get('shared_groups_data', {}) ...
        return violaciones * self.peso

class ReglasOrquestal(Restriccion):
    def __init__(self, peso=PENALIZACION_REGLA_ESPECIFICA):
        super().__init__(peso); self.dias_orquestal_idx = {1, 3} # Ma/Ju
    def evaluar(self, horario: Horario, **kwargs) -> float:
        violaciones = 0
        for evento in horario.eventos:
            if evento.requisito.is_orquestal:
                if evento.dia not in self.dias_orquestal_idx: violaciones += 1
        return violaciones * self.peso

class MinimizarHuecos(Restriccion):
    def __init__(self, peso=PESO_HUECOS):
        super().__init__(peso); self.dias_orquestal_idx = {1, 3}
    def evaluar(self, horario: Horario, **kwargs) -> float:
        if not hasattr(horario, 'profesores') or not horario.profesores: return 0
        total_huecos_penalizados = 0
        matriz_por_profesor = horario.get_matriz_eventos_por_profesor()
        if not hasattr(horario, 'profesores_map'): # Asegurar que el mapa existe
             horario.profesores_map = {p.id: p for p in horario.profesores}
             
        for prof_id, matriz_prof in matriz_por_profesor.items():
             profesor = horario.profesores_map.get(prof_id);
             if not profesor: continue
             for dia in range(NUM_DIAS):
                 horas_ocupadas_indices = sorted([h for h, evt in enumerate(matriz_prof[dia]) if evt is not None])
                 if len(horas_ocupadas_indices) > 1:
                     es_dia_orquestal = dia in self.dias_orquestal_idx
                     tiene_clase_orquestal = False
                     if es_dia_orquestal:
                          for h_idx in horas_ocupadas_indices:
                              evt = matriz_prof[dia][h_idx]
                              if evt and evt.requisito.is_orquestal: tiene_clase_orquestal = True; break
                     # Penalizar huecos solo si NO es día con clase orquestal para este profesor
                     if not tiene_clase_orquestal:
                         for i in range(len(horas_ocupadas_indices) - 1):
                             hueco = horas_ocupadas_indices[i+1] - horas_ocupadas_indices[i] - 1
                             if hueco > 0: total_huecos_penalizados += hueco
        return total_huecos_penalizados * self.peso

# --- Fin de constraints_detailed.py ---