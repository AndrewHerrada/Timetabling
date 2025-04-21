# -*- coding: utf-8 -*-
"""
Clase para representar un horario completo (cromosoma) en el AG.
"""
import copy
import random
from config import NUM_DIAS, NUM_PERIODOS
# Importar los nuevos modelos
from model.evento import Evento
from model.requisito_clase import RequisitoClase
from model.profesor import Profesor
from model.sala import Sala

class Horario:
    """
    Representa una solución de horario completa, compuesta por Eventos.
    Actúa como un cromosoma en el algoritmo genético.
    """
    def __init__(self, profesores: list[Profesor], salas: list[Sala], requisitos: list[RequisitoClase], eventos=None):
        """
        Inicializa un nuevo horario.

        Args:
            profesores (list[Profesor]): Lista maestra de todos los profesores.
            salas (list[Sala]): Lista maestra de todas las salas.
            requisitos (list[RequisitoClase]): Lista maestra de todos los requisitos.
            eventos (list[Evento], optional): Lista inicial de eventos. Defaults to None.
        """
        self.profesores = profesores
        self.salas = salas
        self.requisitos = requisitos
        self.eventos = eventos if eventos else []

        # Mapas para acceso rápido a objetos maestros
        self.profesores_map = {p.id: p for p in self.profesores}
        self.salas_map = {s.id: s for s in self.salas}
        self.requisitos_map = {r.id: r for r in self.requisitos}

        # Mapas para búsqueda rápida de conflictos (clave: (recurso_id, dia, hora_slot))
        # Almacenan el Evento que ocupa ese slot
        self._map_profesor_slot = {}
        self._map_sala_slot = {}
        self._map_grupo_slot = {} # Grupo = curso_id

        self.fitness = 0 # Se calculará por el Evaluador
        self.detalles_evaluacion = {} # Para almacenar detalles del fitness

        # Resetear estado de requisitos y profesores antes de construir/evaluar
        self._reset_estado_asignacion()

        # Construir índices si se proporcionan eventos iniciales
        if self.eventos:
            self._reconstruir_indices_y_estado()

    def _reset_estado_asignacion(self):
         """Resetea contadores de horas/slots en profesores y requisitos."""
         for prof in self.profesores:
             prof.reset_horas_asignadas()
         for req in self.requisitos:
             req.reset_asignacion()

    def _reconstruir_indices_y_estado(self):
        """Llamado después de operaciones (clonación, cruce) para recalcular todo."""
        self._reset_estado_asignacion()
        self._map_profesor_slot = {}
        self._map_sala_slot = {}
        self._map_grupo_slot = {}
        
        eventos_actuales = list(self.eventos) # Copiar lista para iterar de forma segura
        self.eventos = [] # Limpiar lista actual antes de re-agregar

        for evento in eventos_actuales:
            self.agregar_evento(evento, verificar_validez_completa=False) # Re-agregar sin la validación completa (asume que era válido)
            # Nota: Si el cruce/mutación puede invalidar, se necesita un enfoque diferente o una validación aquí.


    def _actualizar_mapas_conflicto(self, evento: Evento, agregar: bool):
        """Añade o quita las entradas de un evento en los mapas de conflicto."""
        slots_ocupados = evento.get_slots_ocupados()
        for dia, hora_slot in slots_ocupados:
            keys = [
                evento.get_key_recurso('profesor', hora_slot),
                evento.get_key_recurso('sala', hora_slot),
                evento.get_key_recurso('grupo', hora_slot)
            ]
            maps = [self._map_profesor_slot, self._map_sala_slot, self._map_grupo_slot]

            for map_dict, key in zip(maps, keys):
                if agregar:
                    # Verificar si ya existe (indicaría un error lógico previo)
                    if key in map_dict:
                         print(f"¡Error interno! Conflicto detectado al agregar evento {evento.id_unico_evento} en slot {key}. Slot ya ocupado por {map_dict[key].id_unico_evento}")
                    map_dict[key] = evento # Asignar evento al slot
                else: # Quitar
                    if key in map_dict:
                        del map_dict[key]
                    # else: # Intentar quitar algo que no existe
                    #    print(f"Advertencia: Intentando quitar evento de slot {key} que no estaba mapeado.")


    def verificar_conflictos_para_evento(self, evento: Evento) -> list[str]:
        """
        Verifica si añadir este evento causaría solapamientos de recursos.
        Devuelve una lista de mensajes de conflicto.
        """
        conflictos = []
        slots_ocupados = evento.get_slots_ocupados()
        if not slots_ocupados:
             conflictos.append("El evento no ocupa ningún slot válido.")
             return conflictos
             
        for dia, hora_slot in slots_ocupados:
             # Verificar Profesor
             key_prof = evento.get_key_recurso('profesor', hora_slot)
             if key_prof in self._map_profesor_slot:
                 conflicto_evento = self._map_profesor_slot[key_prof]
                 # Evitar conflicto consigo mismo si se está re-validando
                 if conflicto_evento.id_unico_evento != evento.id_unico_evento:
                      conflictos.append(f"Profesor {evento.profesor.nombre} ocupado en ({dia},{hora_slot}) por Evt {conflicto_evento.id_unico_evento}")

             # Verificar Sala
             key_sala = evento.get_key_recurso('sala', hora_slot)
             if key_sala in self._map_sala_slot:
                  conflicto_evento = self._map_sala_slot[key_sala]
                  if conflicto_evento.id_unico_evento != evento.id_unico_evento:
                       conflictos.append(f"Sala {evento.sala.nombre} ocupada en ({dia},{hora_slot}) por Evt {conflicto_evento.id_unico_evento}")

             # Verificar Grupo (Curso)
             key_grupo = evento.get_key_recurso('grupo', hora_slot)
             if key_grupo in self._map_grupo_slot:
                  conflicto_evento = self._map_grupo_slot[key_grupo]
                  # Un grupo SÍ puede tener conflicto consigo mismo si se intenta añadir dos veces
                  # O si dos requisitos diferentes son para el mismo grupo
                  if conflicto_evento.requisito.id != evento.requisito.id or conflicto_evento.id_unico_evento != evento.id_unico_evento:
                       conflictos.append(f"Grupo {evento.requisito.curso_id} ocupado en ({dia},{hora_slot}) por Evt {conflicto_evento.id_unico_evento}")
        
        return list(set(conflictos)) # Devolver conflictos únicos


    def validar_evento_completo(self, evento: Evento) -> list[str]:
        """Realiza todas las validaciones duras ANTES de añadir un evento."""
        validaciones_fallidas = []

        # 1. Verificar solapamientos básicos
        validaciones_fallidas.extend(self.verificar_conflictos_para_evento(evento))

        # 2. Verificar si el slot de inicio está permitido para el requisito
        slot_inicio = (evento.dia, evento.hora)
        if slot_inicio not in evento.requisito.allowed_slots:
            validaciones_fallidas.append(f"Slot de inicio ({evento.dia},{evento.hora}) no está en allowed_slots para Req {evento.requisito.id}")

        # 3. Verificar si el profesor es el asignado
        if evento.profesor.id != evento.requisito.profesor_asignado.id:
            validaciones_fallidas.append(f"Profesor incorrecto ({evento.profesor.nombre}) para Req {evento.requisito.id} (debería ser {evento.requisito.profesor_asignado.nombre})")

        # 4. Verificar capacidad de la sala
        if evento.sala.capacidad < evento.requisito.inscritos:
            validaciones_fallidas.append(f"Capacidad de sala {evento.sala.nombre} ({evento.sala.capacidad}) insuficiente para Req {evento.requisito.id} ({evento.requisito.inscritos} inscritos)")

        # 5. Verificar reglas orquestales (día)
        if evento.requisito.is_orquestal:
             dias_orquestal_idx = {1, 3} # Martes, Jueves
             if evento.dia not in dias_orquestal_idx:
                 validaciones_fallidas.append(f"Clase orquestal (Req {evento.requisito.id}) asignada en día inválido ({DIAS_SEMANA[evento.dia]})")

        # 6. Verificar si el bloque cabe (si ocupa más de 1 slot)
        slots_ocupados = evento.get_slots_ocupados()
        if len(slots_ocupados) < evento.requisito.slots_per_session:
             validaciones_fallidas.append(f"Bloque para Req {evento.requisito.id} (duración {evento.requisito.slots_per_session}) no cabe completo desde ({evento.dia},{evento.hora})")

        # 7. Validación de Shared Classes (más compleja, se maneja mejor en Evaluador o Generador)
        # No se puede validar completamente aquí sin conocer el estado de los otros miembros del grupo.

        return list(set(validaciones_fallidas))


    def agregar_evento(self, evento: Evento, verificar_validez_completa=True) -> bool:
        """
        Agrega un evento al horario, validando restricciones duras básicas.
        Actualiza mapas de conflicto y contadores.

        Args:
            evento (Evento): El evento a agregar.
            verificar_validez_completa (bool): Si True, realiza todas las validaciones duras.
                                            Si False, solo verifica solapamientos básicos (útil al reconstruir).

        Returns:
            bool: True si se agregó correctamente, False en caso contrario.
        """
        if verificar_validez_completa:
             fallos = self.validar_evento_completo(evento)
             if fallos:
                 # print(f"DEBUG: No se puede agregar evento {evento.id_unico_evento}. Fallos: {fallos}")
                 return False
        else:
            # Verificar solo solapamientos básicos si no se valida completo
             conflictos = self.verificar_conflictos_para_evento(evento)
             if conflictos:
                  # print(f"DEBUG: No se puede agregar evento {evento.id_unico_evento} (reconstrucción). Conflictos: {conflictos}")
                  return False

        # --- Si pasa la validación, agregar el evento ---
        self.eventos.append(evento)

        # Actualizar mapas de conflicto
        self._actualizar_mapas_conflicto(evento, agregar=True)

        # Actualizar contadores de horas/slots
        slots_agregados = evento.requisito.slots_per_session # Asume que el bloque se añade completo
        evento.requisito.slots_asignados += slots_agregados
        evento.profesor.incrementar_horas(slots_agregados)
        evento.requisito.eventos_asignados.append(evento) # Guardar referencia en el requisito

        return True

    def quitar_evento(self, evento: Evento):
         """Quita un evento del horario y actualiza el estado."""
         if evento in self.eventos:
             self.eventos.remove(evento)

             # Actualizar mapas de conflicto
             self._actualizar_mapas_conflicto(evento, agregar=False)

             # Actualizar contadores
             slots_quitados = evento.requisito.slots_per_session
             evento.requisito.slots_asignados -= slots_quitados
             evento.profesor.horas_asignadas -= slots_quitados # Asume que incrementar_horas solo suma
             if evento in evento.requisito.eventos_asignados:
                  evento.requisito.eventos_asignados.remove(evento)

             # Asegurarse que los contadores no sean negativos
             if evento.requisito.slots_asignados < 0: evento.requisito.slots_asignados = 0
             if evento.profesor.horas_asignadas < 0: evento.profesor.horas_asignadas = 0

             return True
         return False


    def get_horas_asignadas_por_profesor(self) -> dict[str, int]:
        """Calcula las horas (slots) asignadas a cada profesor en este horario."""
        horas_por_profesor = {prof.id: 0 for prof in self.profesores}
        for evento in self.eventos:
            if evento.profesor.id in horas_por_profesor:
                 # Sumar la duración completa de la sesión del evento
                 horas_por_profesor[evento.profesor.id] += evento.requisito.slots_per_session
            # else: # Profesor del evento no está en la lista maestra? Error de datos.
            #    print(f"Error: Profesor {evento.profesor.id} del evento no encontrado en lista maestra.")
        return horas_por_profesor

    def get_matriz_eventos_por_profesor(self) -> dict[str, list[list[Evento | None]]]:
         """Genera un diccionario de matrices de horario por ID de profesor."""
         matrices = {prof.id: [[None for _ in range(NUM_PERIODOS)] for _ in range(NUM_DIAS)]
                     for prof in self.profesores}
         for evento in self.eventos:
             if evento.profesor.id in matrices:
                 matriz_prof = matrices[evento.profesor.id]
                 for dia, hora_slot in evento.get_slots_ocupados():
                      if 0 <= dia < NUM_DIAS and 0 <= hora_slot < NUM_PERIODOS:
                           if matriz_prof[dia][hora_slot] is not None:
                                # Solapamiento interno - no debería ocurrir si agregar_evento funciona
                                print(f"Error matriz: Solapamiento para Prof {evento.profesor.id} en ({dia},{hora_slot})")
                           matriz_prof[dia][hora_slot] = evento
             # else:
             #     print(f"Error matriz: Profesor {evento.profesor.id} no encontrado.")
         return matrices
         
    def get_matriz_eventos_por_sala(self) -> dict[str, list[list[Evento | None]]]:
         """Genera un diccionario de matrices de horario por ID de sala."""
         matrices = {sala.id: [[None for _ in range(NUM_PERIODOS)] for _ in range(NUM_DIAS)]
                     for sala in self.salas}
         for evento in self.eventos:
             if evento.sala.id in matrices:
                 matriz_sala = matrices[evento.sala.id]
                 for dia, hora_slot in evento.get_slots_ocupados():
                      if 0 <= dia < NUM_DIAS and 0 <= hora_slot < NUM_PERIODOS:
                           if matriz_sala[dia][hora_slot] is not None:
                                print(f"Error matriz: Solapamiento para Sala {evento.sala.id} en ({dia},{hora_slot})")
                           matriz_sala[dia][hora_slot] = evento
             # else:
             #     print(f"Error matriz: Sala {evento.sala.id} no encontrada.")
         return matrices

    def get_matriz_eventos_por_grupo(self) -> dict[str, list[list[Evento | None]]]:
         """Genera un diccionario de matrices de horario por curso_id (grupo)."""
         # Obtener todos los curso_id únicos de los requisitos
         grupos_ids = set(req.curso_id for req in self.requisitos)
         matrices = {grupo_id: [[None for _ in range(NUM_PERIODOS)] for _ in range(NUM_DIAS)]
                     for grupo_id in grupos_ids}

         for evento in self.eventos:
              grupo_id = evento.requisito.curso_id
              if grupo_id in matrices:
                  matriz_grupo = matrices[grupo_id]
                  for dia, hora_slot in evento.get_slots_ocupados():
                       if 0 <= dia < NUM_DIAS and 0 <= hora_slot < NUM_PERIODOS:
                            if matriz_grupo[dia][hora_slot] is not None:
                                 # Puede haber solapamiento si dos requisitos son para el mismo grupo
                                 # Esto es detectado por SolapamientoGrupo en fitness
                                 pass # No es un error de la matriz en sí
                            matriz_grupo[dia][hora_slot] = evento
              # else: # El curso_id del evento no está en los requisitos? Error.
              #    print(f"Error matriz: Grupo/Curso ID '{grupo_id}' del evento no encontrado en lista de requisitos.")
         return matrices


    def clonar(self):
        """
        Crea una copia profunda del horario. Es crucial que los objetos internos
        (Profesor, Sala, Requisito) NO se clonen, solo las referencias a ellos,
        pero la lista de eventos y los mapas de estado SÍ se clonen.
        """
        # Clonar la estructura básica y la lista de eventos
        nuevo_horario = Horario(self.profesores, self.salas, self.requisitos) # Usa las listas maestras
        # Clonar los eventos en sí mismos (si contienen estado mutable, aunque no deberían)
        nuevo_horario.eventos = [copy.deepcopy(e) for e in self.eventos]
        
        # Reconstruir los índices y el estado interno (horas asignadas, etc.) basado en los eventos clonados
        nuevo_horario._reconstruir_indices_y_estado()
        
        # Copiar fitness y detalles (se recalcularán de todos modos)
        nuevo_horario.fitness = self.fitness
        nuevo_horario.detalles_evaluacion = copy.deepcopy(self.detalles_evaluacion)

        return nuevo_horario

    def __len__(self):
        """Número de eventos (sesiones) programados."""
        return len(self.eventos)

    def __str__(self):
        total_slots = sum(e.requisito.slots_per_session for e in self.eventos)
        return f"Horario con {len(self.eventos)} eventos ({total_slots} slots), fitness: {self.fitness:.2f}"