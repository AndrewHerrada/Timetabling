# -*- coding: utf-8 -*-
"""
Generador de cromosomas (horarios) iniciales para el AG.
Adaptado para asignar profesores elegibles.
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
    asignando profesores elegibles y respetando restricciones básicas.
    """
    # *** ACTUALIZAR __init__ para aceptar argumentos correctos ***
    def __init__(self, requisitos: list[RequisitoClase], profesores: list[Profesor], salas: list[Sala], shared_groups_data: dict):
        """
        Inicializa el generador.

        Args:
            requisitos (list[RequisitoClase]): Lista completa de requisitos a programar.
            profesores (list[Profesor]): Lista completa de profesores.
            salas (list[Sala]): Lista completa de salas.
            shared_groups_data (dict): Diccionario de grupos compartidos del DataLoader.
        """
        # Guardar copias para evitar modificaciones externas? O usar referencias?
        # Usaremos referencias por ahora, asumiendo que no se modifican externamente.
        self.requisitos_originales = requisitos
        self.profesores = profesores
        self.salas = salas
        self.shared_groups_data = shared_groups_data # Puede ser útil para heurísticas

        # Pre-filtrar salas por nivel para eficiencia (igual que antes)
        self.salas_por_nivel = {}
        for sala in self.salas:
             self.salas_por_nivel.setdefault(sala.nivel, []).append(sala)

    def _encontrar_sala_valida(self, horario: Horario, requisito: RequisitoClase, dia: int, hora_inicio: int) -> Sala | None:
         """Busca una sala disponible y adecuada para el requisito en el slot/bloque dado."""
         salas_candidatas = []
         nivel_req = requisito.nivel # Ya está en minúsculas
         # Buscar salas del nivel específico
         salas_candidatas.extend(self.salas_por_nivel.get(nivel_req, []))
         # Añadir salas 'todos' si el requisito no es infantil (o si es infantil y la sala es todos?)
         # Lógica de Sala.es_adecuada_para_nivel es más robusta, usemos esa.
         
         salas_filtradas_nivel = [s for s in self.salas if s.es_adecuada_para_nivel(nivel_req)]

         # Filtrar por capacidad
         salas_adecuadas_cap = [s for s in salas_filtradas_nivel if s.capacidad >= requisito.inscritos]
         if not salas_adecuadas_cap: return None

         # TODO: Filtrar por equipamiento si RequisitoClase tuviera ese atributo
         # equip_req = getattr(requisito, 'equipamiento_requerido', None) ...

         random.shuffle(salas_adecuadas_cap)

         for sala in salas_adecuadas_cap:
             sala_disponible = True
             for i in range(requisito.slots_per_session):
                 hora_slot = hora_inicio + i
                 if hora_slot >= NUM_PERIODOS: sala_disponible = False; break
                 key_sala = (sala.id, dia, hora_slot)
                 if key_sala in horario._map_sala_slot: sala_disponible = False; break
             if sala_disponible: return sala

         return None

    def generar_aleatorio(self, max_intentos_por_sesion=50) -> Horario:
        """
        Genera un horario intentando asignar requisitos y eligiendo un profesor
        elegible de forma aleatoria, respetando restricciones básicas.
        """
        horario = Horario(self.profesores, self.salas, self.requisitos_originales)
        
        # Copiar requisitos para poder modificar su estado (slots_asignados) sin afectar la lista original
        requisitos_a_programar = copy.deepcopy(self.requisitos_originales)
        random.shuffle(requisitos_a_programar)

        requisitos_no_completados = 0
        eventos_creados = 0

        print(f"Generando horario aleatorio para {len(requisitos_a_programar)} requisitos...")

        for requisito in requisitos_a_programar:
            sesiones_necesarias = requisito.get_frecuencia_requerida()
            sesiones_asignadas_para_este_req = 0

            # --- Obtener elegibles y barajarlos ---
            profesores_elegibles = list(requisito.profesores_elegibles) # Copiar lista
            if not profesores_elegibles:
                # print(f"DEBUG Gen: Req {requisito.id} no tiene profesores elegibles. Saltando.")
                requisitos_no_completados += 1
                continue
            random.shuffle(profesores_elegibles)
            # --------------------------------------

            slots_permitidos_barajados = list(requisito.allowed_slots)
            random.shuffle(slots_permitidos_barajados)

            # Intentar asignar todas las sesiones necesarias para este requisito
            intentos_totales_req = 0 # Contador global para evitar bucles infinitos por requisito
            MAX_INTENTOS_GLOBAL_REQ = max_intentos_por_sesion * sesiones_necesarias + 50 # Un margen

            while sesiones_asignadas_para_este_req < sesiones_necesarias and intentos_totales_req < MAX_INTENTOS_GLOBAL_REQ:
                intentos_totales_req += 1
                found_placement_this_session = False

                # Iterar sobre slots permitidos
                for dia, hora_inicio in slots_permitidos_barajados:
                    
                     # Iterar sobre profesores elegibles para este slot/día
                     for profesor_elegido in profesores_elegibles:

                         # 1. Verificar disponibilidad del PROFESOR ELEGIDO para el bloque
                         profesor_disponible = True
                         for i in range(requisito.slots_per_session):
                             hora_slot = hora_inicio + i
                             if hora_slot >= NUM_PERIODOS: profesor_disponible = False; break
                             key_prof = (profesor_elegido.id, dia, hora_slot)
                             if key_prof in horario._map_profesor_slot: profesor_disponible = False; break
                         if not profesor_disponible:
                             continue # Probar siguiente profesor elegible

                         # 2. Verificar disponibilidad del GRUPO (curso_id) para el bloque
                         grupo_disponible = True
                         for i in range(requisito.slots_per_session):
                              hora_slot = hora_inicio + i
                              if hora_slot >= NUM_PERIODOS: grupo_disponible = False; break
                              key_grupo = (requisito.curso_id, dia, hora_slot)
                              if key_grupo in horario._map_grupo_slot:
                                   evento_conflicto = horario._map_grupo_slot[key_grupo]
                                   # Si ya hay OTRO requisito para el mismo grupo, hay conflicto
                                   if evento_conflicto.requisito.id != requisito.id:
                                        grupo_disponible = False; break
                         if not grupo_disponible:
                              continue # Probar siguiente profesor (o slot si se acaban profes)


                         # 3. Encontrar SALA válida y disponible
                         sala = self._encontrar_sala_valida(horario, requisito, dia, hora_inicio)

                         if sala:
                             # ¡Combinación válida encontrada!
                             # *** Crear Evento con profesor elegido ***
                             evento = Evento(requisito, profesor_elegido, sala, dia, hora_inicio)

                             # Intentar agregar al horario (verifica solapamientos de nuevo por si acaso)
                             if horario.agregar_evento(evento, verificar_validez_completa=False):
                                  sesiones_asignadas_para_este_req += 1
                                  eventos_creados += 1
                                  found_placement_this_session = True
                                  # print(f"DEBUG Gen: Asignado Req {requisito.id} Sesión {sesiones_asignadas_para_este_req}/{sesiones_necesarias} con Prof {profesor_elegido.id} en ({dia},{hora_inicio}) Sala {sala.id}")
                                  # Romper bucles internos (profesor, slot) para pasar a la siguiente sesión necesaria
                                  break # Salir del bucle de profesores
                             # else: # Falló agregar_evento
                             #    print(f"Error Gen Interno: Falló agregar_evento para {evento}")
                    
                     if found_placement_this_session:
                          break # Salir del bucle de slots

                # Si no se encontró hueco para esta sesión después de probar todos los slots/profes
                if not found_placement_this_session:
                    # print(f"DEBUG Gen: No se pudo asignar sesión {sesiones_asignadas_para_este_req+1} para Req {requisito.id}")
                    # Podríamos simplemente continuar intentando hasta MAX_INTENTOS_GLOBAL_REQ
                    # o romper antes si es claro que no hay opciones.
                    pass


            # Verificar si el requisito se completó al final
            # Usamos >= por si acaso la duración/frecuencia da un slot extra
            if requisito.slots_asignados < requisito.required_slots:
                 requisitos_no_completados += 1
                 # print(f"Advertencia Gen Final: Req {requisito.id} no completado ({requisito.slots_asignados}/{requisito.required_slots})")

        print(f"Generación Aleatoria Finalizada.")
        print(f"  Eventos creados: {eventos_creados}")
        print(f"  Requisitos no completados (slots insuficientes): {requisitos_no_completados}")
        
        # Recalcular estado final por si acaso (aunque agregar_evento debería mantenerlo)
        horario._reconstruir_indices_y_estado()
        return horario


    def generar_heuristico(self) -> Horario:
        """
        Genera un horario usando heurísticas.
        POR IMPLEMENTAR: Podría priorizar requisitos con menos slots permitidos,
                         menos profesores elegibles, o requisitos compartidos.
                         Podría intentar asignar profesores de forma más balanceada.
        """
        print("Advertencia: Generador heurístico no implementado, usando generación aleatoria.")
        # Por ahora, simplemente llama a la versión aleatoria.
        # Una heurística podría ser ordenar `requisitos_a_programar` de forma inteligente.
        return self.generar_aleatorio()