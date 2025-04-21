# -*- coding: utf-8 -*-
"""
Generador de cromosomas (horarios) iniciales para el AG.
"""
import random
import copy
# Importar modelos actualizados
from model.horario import Horario
from model.requisito_clase import RequisitoClase
from model.evento import Evento
from model.sala import Sala
from model.profesor import Profesor
from config import NUM_DIAS, NUM_PERIODOS

class GeneradorCromosomas:
    """
    Genera horarios iniciales (población) para el algoritmo genético,
    intentando respetar restricciones duras básicas.
    """
    def __init__(self, requisitos: list[RequisitoClase], profesores: list[Profesor], salas: list[Sala], shared_groups_data: dict):
        """
        Inicializa el generador.

        Args:
            requisitos (list[RequisitoClase]): Lista completa de requisitos a programar.
            profesores (list[Profesor]): Lista completa de profesores.
            salas (list[Sala]): Lista completa de salas.
            shared_groups_data (dict): Diccionario de grupos compartidos del DataLoader.
        """
        self.requisitos_originales = requisitos
        self.profesores = profesores
        self.salas = salas
        self.shared_groups_data = shared_groups_data

        # Pre-filtrar salas por nivel para eficiencia
        self.salas_por_nivel = {}
        for sala in self.salas:
             self.salas_por_nivel.setdefault(sala.nivel, []).append(sala)
             if sala.nivel != 'todos': # Salas 'todos' pueden usarse en otros niveles (excepto infantil)
                  pass # Lógica adicional si 'todos' tiene restricciones

    def _encontrar_sala_valida(self, horario: Horario, requisito: RequisitoClase, dia: int, hora_inicio: int) -> Sala | None:
         """Busca una sala disponible y adecuada para el requisito en el slot/bloque dado."""

         # Filtrar salas candidatas por nivel y capacidad
         salas_candidatas = []
         # Buscar en el nivel específico del requisito
         salas_candidatas.extend(self.salas_por_nivel.get(requisito.nivel, []))
         # Añadir salas de nivel 'todos' si el requisito no es 'infantil'
         if requisito.nivel != 'infantil':
              salas_candidatas.extend(self.salas_por_nivel.get('todos', []))

         # Filtrar por capacidad
         salas_adecuadas_cap = [s for s in salas_candidatas if s.capacidad >= requisito.inscritos]

         if not salas_adecuadas_cap:
              # print(f"DEBUG Gen: No hay salas con capacidad >= {requisito.inscritos} para Req {requisito.id} nivel {requisito.nivel}")
              return None

         # Filtrar por equipamiento si es necesario (asumiendo que RequisitoClase tiene .equipamiento_requerido)
         # equip_req = getattr(requisito, 'equipamiento_requerido', None)
         # if equip_req:
         #     salas_adecuadas_cap = [s for s in salas_adecuadas_cap if s.tiene_equipamiento(equip_req)]
         #     if not salas_adecuadas_cap: return None

         # Barajar para aleatoriedad
         random.shuffle(salas_adecuadas_cap)

         # Verificar disponibilidad de la sala para TODO el bloque
         for sala in salas_adecuadas_cap:
             sala_disponible = True
             for i in range(requisito.slots_per_session):
                 hora_slot = hora_inicio + i
                 if hora_slot >= NUM_PERIODOS: # Bloque se sale del horario
                      sala_disponible = False
                      break
                 key_sala = (sala.id, dia, hora_slot)
                 if key_sala in horario._map_sala_slot: # Usar mapa interno del horario
                      sala_disponible = False
                      break
             if sala_disponible:
                  return sala # Encontrada sala válida

         # print(f"DEBUG Gen: No se encontró sala disponible/adecuada para Req {requisito.id} en ({dia},{hora_inicio})")
         return None # No se encontró sala disponible

    def generar_aleatorio(self, max_intentos_por_req=20) -> Horario:
        """
        Genera un horario intentando asignar requisitos de forma aleatoria
        pero respetando restricciones básicas (slot permitido, capacidad, solapamientos básicos).
        """
        # Crear horario vacío, pasando las listas maestras
        horario = Horario(self.profesores, self.salas, self.requisitos_originales)
        
        # Copiar y barajar la lista de requisitos para procesar en orden aleatorio
        requisitos_a_programar = copy.deepcopy(self.requisitos_originales) # Copia profunda para no alterar el original con contadores
        random.shuffle(requisitos_a_programar)

        requisitos_no_completados = []

        print(f"Generando horario aleatorio para {len(requisitos_a_programar)} requisitos...")

        for requisito in requisitos_a_programar:
            sesiones_necesarias = requisito.get_frecuencia_requerida()
            sesiones_asignadas = 0
            intentos_req = 0

            # Barajar los slots permitidos para este requisito
            slots_permitidos_barajados = list(requisito.allowed_slots)
            random.shuffle(slots_permitidos_barajados)

            while sesiones_asignadas < sesiones_necesarias and intentos_req < max_intentos_por_req:
                intentos_req += 1
                found_placement = False
                
                # --- Manejo de Clases Compartidas ---
                # Si es compartida, intentar asignar todo el grupo a la vez es muy complejo aquí.
                # Estrategia simple: Asignar individualmente, el fitness penalizará la desincronización.

                for dia, hora_inicio in slots_permitidos_barajados:
                    
                    # 1. Verificar disponibilidad del PROFESOR para todo el bloque
                    profesor_disponible = True
                    for i in range(requisito.slots_per_session):
                        hora_slot = hora_inicio + i
                        if hora_slot >= NUM_PERIODOS: # Bloque se sale
                             profesor_disponible = False
                             break
                        key_prof = (requisito.profesor_asignado.id, dia, hora_slot)
                        if key_prof in horario._map_profesor_slot:
                             profesor_disponible = False
                             break
                    if not profesor_disponible:
                        continue # Probar siguiente slot permitido

                    # 2. Verificar disponibilidad del GRUPO (curso_id) para todo el bloque
                    grupo_disponible = True
                    for i in range(requisito.slots_per_session):
                         hora_slot = hora_inicio + i
                         if hora_slot >= NUM_PERIODOS:
                              grupo_disponible = False
                              break
                         key_grupo = (requisito.curso_id, dia, hora_slot)
                         if key_grupo in horario._map_grupo_slot:
                              # Verificar si el conflicto es con otro requisito para el mismo grupo
                              evento_conflicto = horario._map_grupo_slot[key_grupo]
                              if evento_conflicto.requisito.id != requisito.id:
                                   grupo_disponible = False
                                   break
                    if not grupo_disponible:
                         continue # Probar siguiente slot permitido


                    # 3. Encontrar una SALA válida y disponible
                    sala = self._encontrar_sala_valida(horario, requisito, dia, hora_inicio)

                    if sala:
                        # ¡Se encontró un slot y sala válidos! Crear y agregar evento
                        evento = Evento(requisito, sala, dia, hora_inicio)
                        if horario.agregar_evento(evento, verificar_validez_completa=False): # Solo verifica solapamientos ahora
                             sesiones_asignadas += 1
                             found_placement = True
                             # Quitar el slot usado de la lista para no intentar usarlo de nuevo para este req? No necesariamente, podría haber otros req.
                             break # Pasar al siguiente intento o requisito
                        # else: # Falló agregar_evento (raro si las verificaciones previas son correctas)
                        #    print(f"Error Gen: Falló agregar_evento para {evento} aunque parecía válido.")

                # Si se recorrieron todos los slots permitidos y no se pudo asignar esta sesión
                if not found_placement:
                     # print(f"DEBUG Gen: No se pudo asignar sesión {sesiones_asignadas+1}/{sesiones_necesarias} para Req {requisito.id} tras {intentos_req} intentos.")
                     pass # Intentar de nuevo hasta max_intentos_por_req

            # Si después de los intentos no se completó el requisito
            if not requisito.esta_completo():
                 requisitos_no_completados.append(requisito.id)
                 # print(f"Advertencia Gen: Req {requisito.id} no completado ({requisito.slots_asignados}/{requisito.required_slots})")

        print(f"Generación Aleatoria Finalizada. {len(requisitos_no_completados)} requisitos no completados.")
        # El horario generado puede no ser válido según todas las restricciones (ej: Item horas, Shared sync)
        # La evaluación del fitness se encargará de penalizarlo.
        return horario

    def generar_heuristico(self) -> Horario:
        """
        Genera un horario usando heurísticas (ej: priorizar requisitos difíciles).
        POR IMPLEMENTAR: Similar a generar_aleatorio pero con ordenamiento inteligente
        de requisitos y selección de slots/salas.
        """
        print("Advertencia: Generador heurístico no implementado, usando generación aleatoria.")
        return self.generar_aleatorio()