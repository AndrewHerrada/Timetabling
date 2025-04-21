# -*- coding: utf-8 -*-
"""
Clase para representar un horario completo (cromosoma) en el AG.
"""
import copy
import random
from config import NUM_DIAS, NUM_PERIODOS, DIAS_SEMANA, HORAS_DIA # Añadir DIAS_SEMANA, HORAS_DIA
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
        self.profesores = profesores
        self.salas = salas
        self.requisitos = requisitos
        self.eventos = [] # Iniciar siempre vacío y agregar

        self.profesores_map = {p.id: p for p in self.profesores}
        self.salas_map = {s.id: s for s in self.salas}
        self.requisitos_map = {r.id: r for r in self.requisitos}

        self._map_profesor_slot = {}
        self._map_sala_slot = {}
        self._map_grupo_slot = {}

        self.fitness = 0
        self.detalles_evaluacion = {}

        self._reset_estado_asignacion()

        # Agregar eventos iniciales usando el método seguro
        if eventos:
            for evento in eventos:
                self.agregar_evento(evento, verificar_validez_completa=False)

    def _reset_estado_asignacion(self):
         for prof in self.profesores: prof.reset_horas_asignadas()
         for req in self.requisitos: req.reset_asignacion()

    def _reconstruir_indices_y_estado(self):
        """Llamado después de operaciones para recalcular estado y mapas."""
        # No llamar a reset aquí, porque agregar_evento ya suma.
        # Si se llama después de clonar, el clon empieza reseteado.
        # Si se llama después de cruce/mutación, agregar_evento ya actualizó.
        # Simplemente reconstruir mapas desde self.eventos actuales.
        self._map_profesor_slot = {}
        self._map_sala_slot = {}
        self._map_grupo_slot = {}
        for evento in self.eventos:
            self._actualizar_mapas_conflicto(evento, agregar=True, check_internal_error=False) # No verificar error interno al reconstruir

    def _actualizar_mapas_conflicto(self, evento: Evento, agregar: bool, check_internal_error: bool = True):
        """Añade o quita las entradas de un evento en los mapas de conflicto."""
        slots_ocupados = evento.get_slots_ocupados()
        for dia, hora_slot in slots_ocupados:
            # Verificar límites por si acaso
            if not (0 <= dia < NUM_DIAS and 0 <= hora_slot < NUM_PERIODOS):
                print(f"Advertencia Mapas: Slot ({dia},{hora_slot}) fuera de límites para evento {evento.id_unico_evento}")
                continue

            keys = [
                evento.get_key_recurso('profesor', hora_slot),
                evento.get_key_recurso('sala', hora_slot),
                evento.get_key_recurso('grupo', hora_slot)
            ]
            maps = [self._map_profesor_slot, self._map_sala_slot, self._map_grupo_slot]

            for map_dict, key in zip(maps, keys):
                if agregar:
                    if check_internal_error and key in map_dict and map_dict[key].id_unico_evento != evento.id_unico_evento :
                         # Solo imprimir error si el ocupante NO es el mismo evento (evitar falsos positivos al reconstruir)
                         print(f"¡Error interno! Conflicto detectado al agregar {evento.id_unico_evento} en slot {key}. Slot ya ocupado por {map_dict[key].id_unico_evento}")
                    map_dict[key] = evento
                else: # Quitar
                    if key in map_dict and map_dict[key].id_unico_evento == evento.id_unico_evento:
                        # Quitar solo si el evento coincide con el que se quiere quitar
                        del map_dict[key]
                    elif key in map_dict:
                         # El slot está ocupado, pero por OTRO evento. No borrar.
                         # print(f"Debug Mapas: No se quitó {evento.id_unico_evento} de slot {key}, ocupado por {map_dict[key].id_unico_evento}")
                         pass
                    # else: # Intentar quitar algo que no existe está bien
                    #    pass


    def verificar_conflictos_para_evento(self, evento: Evento) -> list[str]:
        """Verifica si añadir este evento causaría solapamientos de recursos."""
        conflictos = []
        slots_ocupados = evento.get_slots_ocupados()
        if not slots_ocupados:
             conflictos.append(f"Evento {evento.id_unico_evento} no ocupa slots válidos.")
             return conflictos

        for dia, hora_slot in slots_ocupados:
             if not (0 <= dia < NUM_DIAS and 0 <= hora_slot < NUM_PERIODOS): continue # Ignorar slots inválidos

             key_prof = evento.get_key_recurso('profesor', hora_slot)
             if key_prof in self._map_profesor_slot and self._map_profesor_slot[key_prof].id_unico_evento != evento.id_unico_evento:
                 conflictos.append(f"Prof {evento.profesor.id} ocupado en ({dia},{hora_slot})")

             key_sala = evento.get_key_recurso('sala', hora_slot)
             if key_sala in self._map_sala_slot and self._map_sala_slot[key_sala].id_unico_evento != evento.id_unico_evento:
                  conflictos.append(f"Sala {evento.sala.id} ocupada en ({dia},{hora_slot})")

             key_grupo = evento.get_key_recurso('grupo', hora_slot)
             if key_grupo in self._map_grupo_slot and self._map_grupo_slot[key_grupo].id_unico_evento != evento.id_unico_evento:
                  # Conflicto de grupo si otro evento para el mismo grupo está en el mismo slot
                  conflictos.append(f"Grupo {evento.requisito.curso_id} ocupado en ({dia},{hora_slot})")

        return list(set(conflictos))


    def validar_evento_completo(self, evento: Evento) -> list[str]:
        """Realiza todas las validaciones duras ANTES de añadir un evento."""
        validaciones_fallidas = []

        # 1. Verificar solapamientos básicos
        validaciones_fallidas.extend(self.verificar_conflictos_para_evento(evento))

        # 2. Verificar si el slot de inicio está permitido
        slot_inicio = (evento.dia, evento.hora)
        if slot_inicio not in evento.requisito.allowed_slots:
            dia_str = DIAS_SEMANA[evento.dia] if 0 <= evento.dia < len(DIAS_SEMANA) else evento.dia
            hora_str = HORAS_DIA[evento.hora] if 0 <= evento.hora < len(HORAS_DIA) else evento.hora
            validaciones_fallidas.append(f"Slot inicio ({dia_str},{hora_str}) no permitido Req {evento.requisito.id}")

        # 3. Verificar si el profesor es ELEGIBLE (CORREGIDO)
        # *** CORRECCIÓN AQUÍ ***
        if evento.profesor not in evento.requisito.profesores_elegibles:
             validaciones_fallidas.append(f"Profesor {evento.profesor.nombre} ({evento.profesor.id}) no elegible para Req {evento.requisito.id}")
        # **********************

        # 4. Verificar capacidad de la sala
        if evento.sala.capacidad < evento.requisito.inscritos:
            validaciones_fallidas.append(f"Sala {evento.sala.nombre} cap({evento.sala.capacidad}) < inscritos({evento.requisito.inscritos}) Req {evento.requisito.id}")

        # 5. Verificar reglas orquestales (día)
        if evento.requisito.is_orquestal:
             dias_orquestal_idx = {1, 3} # Martes, Jueves
             if evento.dia not in dias_orquestal_idx:
                 dia_str = DIAS_SEMANA[evento.dia] if 0 <= evento.dia < len(DIAS_SEMANA) else evento.dia
                 validaciones_fallidas.append(f"Orquestal Req {evento.requisito.id} en día inválido ({dia_str})")

        # 6. Verificar si el bloque cabe completo
        slots_ocupados = evento.get_slots_ocupados()
        if len(slots_ocupados) < evento.requisito.slots_per_session:
             validaciones_fallidas.append(f"Bloque Req {evento.requisito.id} (dur {evento.requisito.slots_per_session}) no cabe desde ({evento.dia},{evento.hora})")

        return list(set(validaciones_fallidas))


    def agregar_evento(self, evento: Evento, verificar_validez_completa=True) -> bool:
        """Agrega un evento, validando y actualizando estado."""
        if verificar_validez_completa:
             fallos = self.validar_evento_completo(evento)
             if fallos:
                 # Comentado para reducir ruido, pero útil para depurar
                 # print(f"DEBUG AgregarEvento: Falló validación para {evento.id_unico_evento}. Fallos: {fallos}")
                 return False
        else: # Verificar solo solapamientos básicos si no se valida completo
             conflictos = self.verificar_conflictos_para_evento(evento)
             if conflictos:
                  # print(f"DEBUG AgregarEvento: Falló solapamiento básico para {evento.id_unico_evento}. Conflictos: {conflictos}")
                  return False

        # Si pasa validación, agregar
        self.eventos.append(evento)
        self._actualizar_mapas_conflicto(evento, agregar=True)

        # Actualizar contadores (solo si no se está reconstruyendo desde cero)
        # Si agregar_evento se usa consistentemente, esto debería ser seguro.
        slots_agregados = evento.requisito.slots_per_session
        evento.requisito.slots_asignados += slots_agregados
        evento.profesor.incrementar_horas(slots_agregados)
        evento.requisito.eventos_asignados.append(evento)

        return True

    def quitar_evento(self, evento_a_quitar: Evento) -> bool:
         """Quita un evento del horario y actualiza el estado."""
         evento_encontrado = None
         for i, ev in enumerate(self.eventos):
             # Comparar por el ID único generado
             if ev.id_unico_evento == evento_a_quitar.id_unico_evento:
                 evento_encontrado = self.eventos.pop(i)
                 break

         if evento_encontrado:
             # Actualizar mapas de conflicto quitando TODAS sus entradas
             self._actualizar_mapas_conflicto(evento_encontrado, agregar=False)

             # Actualizar contadores
             slots_quitados = evento_encontrado.requisito.slots_per_session
             evento_encontrado.requisito.slots_asignados -= slots_quitados
             evento_encontrado.profesor.horas_asignadas -= slots_quitados
             if evento_encontrado in evento_encontrado.requisito.eventos_asignados:
                  evento_encontrado.requisito.eventos_asignados.remove(evento_encontrado)

             # Asegurar no negativos
             if evento_encontrado.requisito.slots_asignados < 0: evento_encontrado.requisito.slots_asignados = 0
             if evento_encontrado.profesor.horas_asignadas < 0: evento_encontrado.profesor.horas_asignadas = 0

             return True
         else:
             # El evento no estaba en la lista (podría pasar si ya se quitó?)
             # print(f"Advertencia QuitarEvento: Evento {evento_a_quitar.id_unico_evento} no encontrado en la lista.")
             return False


    # get_horas_asignadas_por_profesor, get_matriz_eventos_por_*, clonar, __len__, __str__
    # (Sin cambios respecto a la versión anterior)
    def get_horas_asignadas_por_profesor(self) -> dict[str, int]:
        """Calcula las horas (slots) asignadas a cada profesor en este horario."""
        # Recalcular desde cero basado en los eventos actuales para asegurar consistencia
        horas_por_profesor = {prof.id: 0 for prof in self.profesores}
        for evento in self.eventos:
            if evento.profesor.id in horas_por_profesor:
                 horas_por_profesor[evento.profesor.id] += evento.requisito.slots_per_session
        # Actualizar también el estado interno de cada profesor (útil para evaluación)
        for prof in self.profesores:
             prof.horas_asignadas = horas_por_profesor.get(prof.id, 0)
        return horas_por_profesor

    def get_matriz_eventos_por_profesor(self) -> dict[str, list[list[Evento | None]]]:
         matrices = {prof.id: [[None for _ in range(NUM_PERIODOS)] for _ in range(NUM_DIAS)] for prof in self.profesores}
         for evento in self.eventos:
             if evento.profesor.id in matrices:
                 matriz_prof = matrices[evento.profesor.id]
                 for dia, hora_slot in evento.get_slots_ocupados():
                      if 0 <= dia < NUM_DIAS and 0 <= hora_slot < NUM_PERIODOS:
                           if matriz_prof[dia][hora_slot] is not None and matriz_prof[dia][hora_slot].id_unico_evento != evento.id_unico_evento:
                                print(f"Error matriz prof: Solapamiento detectado para Prof {evento.profesor.id} en ({dia},{hora_slot})")
                           matriz_prof[dia][hora_slot] = evento
         return matrices

    def get_matriz_eventos_por_sala(self) -> dict[str, list[list[Evento | None]]]:
         matrices = {sala.id: [[None for _ in range(NUM_PERIODOS)] for _ in range(NUM_DIAS)] for sala in self.salas}
         for evento in self.eventos:
             if evento.sala.id in matrices:
                 matriz_sala = matrices[evento.sala.id]
                 for dia, hora_slot in evento.get_slots_ocupados():
                      if 0 <= dia < NUM_DIAS and 0 <= hora_slot < NUM_PERIODOS:
                           if matriz_sala[dia][hora_slot] is not None and matriz_sala[dia][hora_slot].id_unico_evento != evento.id_unico_evento:
                                print(f"Error matriz sala: Solapamiento detectado para Sala {evento.sala.id} en ({dia},{hora_slot})")
                           matriz_sala[dia][hora_slot] = evento
         return matrices

    def get_matriz_eventos_por_grupo(self) -> dict[str, list[list[Evento | None]]]:
         grupos_ids = set(req.curso_id for req in self.requisitos)
         matrices = {grupo_id: [[None for _ in range(NUM_PERIODOS)] for _ in range(NUM_DIAS)] for grupo_id in grupos_ids}
         for evento in self.eventos:
              grupo_id = evento.requisito.curso_id
              if grupo_id in matrices:
                  matriz_grupo = matrices[grupo_id]
                  for dia, hora_slot in evento.get_slots_ocupados():
                       if 0 <= dia < NUM_DIAS and 0 <= hora_slot < NUM_PERIODOS:
                            # No verificar solapamiento aquí, se hace en constraints
                            matriz_grupo[dia][hora_slot] = evento
         return matrices

    def clonar(self):
        """Crea una copia profunda del horario."""
        nuevo_horario = Horario(self.profesores, self.salas, self.requisitos)
        # Clonar eventos es importante si tuvieran estado mutable, aunque aquí no lo tienen
        nuevo_horario.eventos = [copy.deepcopy(e) for e in self.eventos]
        nuevo_horario._reconstruir_indices_y_estado() # Reconstruir mapas y contadores
        nuevo_horario.fitness = self.fitness
        nuevo_horario.detalles_evaluacion = copy.deepcopy(self.detalles_evaluacion)
        return nuevo_horario

    def __len__(self): return len(self.eventos)
    def __str__(self):
        total_slots = sum(e.requisito.slots_per_session for e in self.eventos)
        return f"Horario con {len(self.eventos)} eventos ({total_slots} slots), fitness: {self.fitness:.2f}"