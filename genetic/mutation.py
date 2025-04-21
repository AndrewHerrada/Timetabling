# -*- coding: utf-8 -*-
"""
Operadores de mutación para el algoritmo genético.
Adaptados para RequisitoClase y nueva validación de Horario.
Revisado para eliminar acceso a profesor_asignado.
"""
import random
import copy
from config import NUM_DIAS, NUM_PERIODOS
# Importar modelos actualizados
from model.horario import Horario
from model.evento import Evento
from model.sala import Sala
from model.profesor import Profesor
from model.requisito_clase import RequisitoClase # Importar RequisitoClase

class OperadorMutacion:
    def __init__(self, probabilidad=0.2): self.probabilidad = probabilidad
    def mutar(self, horario: Horario):
        if random.random() < self.probabilidad: return self._aplicar_mutacion(horario)
        return False
    def _aplicar_mutacion(self, horario: Horario) -> bool: raise NotImplementedError

class MutacionCambioHorario(OperadorMutacion):
    """Cambia el día y/o hora de inicio de un evento aleatorio."""
    def _aplicar_mutacion(self, horario: Horario) -> bool:
        if not horario.eventos: return False
        evento_original = random.choice(horario.eventos)
        # Usar evento.requisito
        requisito = evento_original.requisito
        slots_permitidos = requisito.allowed_slots
        if not slots_permitidos: return False
        slot_actual = (evento_original.dia, evento_original.hora)
        posibles_nuevos_slots = [s for s in slots_permitidos if s != slot_actual]
        if not posibles_nuevos_slots: return False
        nuevo_dia, nueva_hora_inicio = random.choice(posibles_nuevos_slots)
        # Usar evento.profesor (el que ya fue elegido para este evento)
        evento_tentativo = Evento(
            requisito=requisito,
            profesor_elegido=evento_original.profesor, # Usa el profesor ya asignado a este evento
            sala=evento_original.sala,
            dia=nuevo_dia,
            hora=nueva_hora_inicio
        )
        # Lógica quitar/agregar/revertir
        if horario.quitar_evento(evento_original):
             if horario.agregar_evento(evento_tentativo): return True
             else: horario.agregar_evento(evento_original, False); return False
        else: print(f"Error Mut CH: No quitó evt {evento_original.id_unico_evento}"); return False

class MutacionCambioSala(OperadorMutacion):
    """Cambia la sala asignada a un evento aleatorio."""
    def __init__(self, probabilidad=0.2, salas: list[Sala]=None):
        super().__init__(probabilidad)
        self.salas_maestra = salas if salas else []
        self.salas_por_nivel = {}
        for sala in self.salas_maestra: self.salas_por_nivel.setdefault(sala.nivel, []).append(sala)

    def _aplicar_mutacion(self, horario: Horario) -> bool:
        if not horario.eventos or not self.salas_maestra: return False
        evento_original = random.choice(horario.eventos)
        # Usar evento.requisito
        requisito = evento_original.requisito
        # Buscar salas (ya usaba requisito correctamente)
        salas_filtradas_nivel = [s for s in self.salas_maestra if s.es_adecuada_para_nivel(requisito.nivel)]
        salas_candidatas_cap = [s for s in salas_filtradas_nivel if s.capacidad >= requisito.inscritos]
        salas_posibles = [s for s in salas_candidatas_cap if s.id != evento_original.sala.id]
        if not salas_posibles: return False
        random.shuffle(salas_posibles)
        for sala_nueva in salas_posibles:
             # Usar evento.profesor
             evento_tentativo = Evento(
                 requisito=requisito,
                 profesor_elegido=evento_original.profesor, # Usa el profesor ya asignado
                 sala=sala_nueva,
                 dia=evento_original.dia,
                 hora=evento_original.hora
             )
             # Lógica quitar/agregar/revertir
             if horario.quitar_evento(evento_original):
                  if horario.agregar_evento(evento_tentativo): return True
                  else: horario.agregar_evento(evento_original, False)
             else: print(f"Error Mut CS: No quitó evt {evento_original.id_unico_evento}"); return False
        return False

class MutacionIntercambio(OperadorMutacion):
    """Intercambia los slots de inicio entre dos eventos aleatorios."""
    def _aplicar_mutacion(self, horario: Horario) -> bool:
        if len(horario.eventos) < 2: return False
        # Usar sample para asegurar que son diferentes
        try:
            evento1, evento2 = random.sample(horario.eventos, 2)
        except ValueError: # No hay suficientes eventos para elegir 2
            return False
            
        dia1, hora1 = evento1.dia, evento1.hora
        dia2, hora2 = evento2.dia, evento2.hora
        # Usar evento.requisito
        req1 = evento1.requisito
        req2 = evento2.requisito
        # Simplificación (igual que antes)
        if req1.slots_per_session != req2.slots_per_session: return False
        if (dia2, hora2) not in req1.allowed_slots: return False
        if (dia1, hora1) not in req2.allowed_slots: return False
        # Usar evento.profesor
        evento1_nuevo = Evento(req1, evento1.profesor, evento1.sala, dia2, hora2)
        evento2_nuevo = Evento(req2, evento2.profesor, evento2.sala, dia1, hora1)
        # Lógica quitar/agregar/revertir
        q1_ok = horario.quitar_evento(evento1)
        q2_ok = horario.quitar_evento(evento2)
        if not q1_ok or not q2_ok:
             if q1_ok: horario.agregar_evento(evento1, False)
             if q2_ok: horario.agregar_evento(evento2, False)
             # print(f"Error Mut Int: No quitó originales.") # Debug
             return False
        a1_ok = horario.agregar_evento(evento1_nuevo)
        if a1_ok:
            a2_ok = horario.agregar_evento(evento2_nuevo)
            if a2_ok: return True # Exito
            else: horario.quitar_evento(evento1_nuevo); horario.agregar_evento(evento1, False); horario.agregar_evento(evento2, False); return False # Revertir
        else: horario.agregar_evento(evento1, False); horario.agregar_evento(evento2, False); return False # Revertir


class MutacionCambioProfesor(OperadorMutacion):
    """Cambia el profesor asignado a un evento por otro elegible."""
    def _aplicar_mutacion(self, horario: Horario) -> bool:
        if not horario.eventos: return False
        evento_original = random.choice(horario.eventos)
        # Usar evento.requisito
        requisito = evento_original.requisito
        profesores_elegibles = requisito.profesores_elegibles
        alternativas = [p for p in profesores_elegibles if p.id != evento_original.profesor.id]
        if not alternativas: return False
        random.shuffle(alternativas)
        for profesor_nuevo in alternativas:
             evento_tentativo = Evento(
                 requisito=requisito,
                 profesor_elegido=profesor_nuevo, # Nuevo profesor
                 sala=evento_original.sala,
                 dia=evento_original.dia,
                 hora=evento_original.hora
             )
             # Lógica quitar/agregar/revertir
             if horario.quitar_evento(evento_original):
                  if horario.agregar_evento(evento_tentativo): return True
                  else: horario.agregar_evento(evento_original, False)
             else: print(f"Error Mut CP: No quitó evt {evento_original.id_unico_evento}"); return False
        return False


class MutacionCompuesta(OperadorMutacion):
    """Aplica una combinación de diferentes mutaciones."""
    def __init__(self, operadores=None):
        super().__init__(1.0)
        self.operadores = operadores if operadores else []
    def _aplicar_mutacion(self, horario: Horario) -> bool:
        if not self.operadores: return False
        operador_elegido = random.choice(self.operadores)
        try:
            # Llamar a _aplicar_mutacion del operador elegido para forzar intento
            return operador_elegido._aplicar_mutacion(horario)
        except Exception as e:
             print(f"Error aplicando mutación {operador_elegido.__class__.__name__}: {e}")
             # import traceback; traceback.print_exc() # Descomentar para depurar
             return False