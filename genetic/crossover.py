# -*- coding: utf-8 -*-
"""
Operadores de cruzamiento para el algoritmo genético.
Adaptados para inicializar Horario correctamente.
"""
import random
# Importar modelos actualizados
from model.horario import Horario
from model.evento import Evento
from config import NUM_DIAS

class OperadorCruce:
    """Clase base para operadores de cruzamiento."""
    def __init__(self, probabilidad=0.8):
        self.probabilidad = probabilidad

    def cruzar(self, padre1: Horario, padre2: Horario):
        """Realiza el cruce. Debe devolver dos nuevos objetos Horario."""
        raise NotImplementedError


class CruceDias(OperadorCruce):
    """Intercambia días completos entre padres."""
    def cruzar(self, padre1: Horario, padre2: Horario):
        # *** CORRECCIÓN: Inicializar hijos con listas maestras ***
        hijo1 = Horario(padre1.profesores, padre1.salas, padre1.requisitos)
        hijo2 = Horario(padre1.profesores, padre1.salas, padre1.requisitos)
        # --------------------------------------------------------

        dias_cruce = set(random.sample(range(NUM_DIAS), random.randint(1, max(1, NUM_DIAS-1)))) # Asegurar al menos 1 día

        eventos_padre1_hijo1 = []
        eventos_padre1_hijo2 = []
        for evento in padre1.eventos:
            if evento.dia in dias_cruce:
                eventos_padre1_hijo2.append(evento)
            else:
                eventos_padre1_hijo1.append(evento)

        eventos_padre2_hijo1 = []
        eventos_padre2_hijo2 = []
        for evento in padre2.eventos:
            if evento.dia in dias_cruce:
                eventos_padre2_hijo1.append(evento)
            else:
                eventos_padre2_hijo2.append(evento)

        # Agregar eventos a los hijos (usando agregar_evento para actualizar mapas)
        # Es más seguro reconstruir desde cero que añadir directamente a la lista
        for e in eventos_padre1_hijo1: hijo1.agregar_evento(e, verificar_validez_completa=False)
        for e in eventos_padre2_hijo1: hijo1.agregar_evento(e, verificar_validez_completa=False)

        for e in eventos_padre1_hijo2: hijo2.agregar_evento(e, verificar_validez_completa=False)
        for e in eventos_padre2_hijo2: hijo2.agregar_evento(e, verificar_validez_completa=False)

        # Los horarios hijos ya tienen los índices y estado actualizados por agregar_evento
        return hijo1, hijo2


class CruceEventos(OperadorCruce):
    """Intercambia subconjuntos de eventos (representando sesiones)."""
    def cruzar(self, padre1: Horario, padre2: Horario):
        # *** CORRECCIÓN: Inicializar hijos con listas maestras ***
        hijo1 = Horario(padre1.profesores, padre1.salas, padre1.requisitos)
        hijo2 = Horario(padre1.profesores, padre1.salas, padre1.requisitos)
        # --------------------------------------------------------

        if not padre1.eventos or not padre2.eventos: # Si algún padre está vacío
            return padre1.clonar(), padre2.clonar() # Devolver clones

        # Elegir un punto de cruce (número de eventos a intercambiar)
        max_eventos_intercambio = min(len(padre1.eventos), len(padre2.eventos))
        if max_eventos_intercambio == 0: return padre1.clonar(), padre2.clonar()

        num_eventos_intercambiar = random.randint(1, max(1, max_eventos_intercambio // 2)) # Intercambiar hasta la mitad

        # Seleccionar eventos aleatorios de cada padre
        eventos_a_mover_p1 = random.sample(padre1.eventos, num_eventos_intercambiar)
        eventos_a_mover_p2 = random.sample(padre2.eventos, num_eventos_intercambiar)

        # Crear conjuntos de IDs de eventos para búsqueda rápida
        ids_a_mover_p1 = {e.id_unico_evento for e in eventos_a_mover_p1}
        ids_a_mover_p2 = {e.id_unico_evento for e in eventos_a_mover_p2}

        # Construir Hijo 1: Eventos de P1 que NO se mueven + Eventos de P2 que SÍ se mueven
        for evento in padre1.eventos:
            if evento.id_unico_evento not in ids_a_mover_p1:
                hijo1.agregar_evento(evento, verificar_validez_completa=False)
        for evento in eventos_a_mover_p2: # Mover los seleccionados de P2
            hijo1.agregar_evento(evento, verificar_validez_completa=False) # Puede generar conflictos!

        # Construir Hijo 2: Eventos de P2 que NO se mueven + Eventos de P1 que SÍ se mueven
        for evento in padre2.eventos:
            if evento.id_unico_evento not in ids_a_mover_p2:
                hijo2.agregar_evento(evento, verificar_validez_completa=False)
        for evento in eventos_a_mover_p1: # Mover los seleccionados de P1
             hijo2.agregar_evento(evento, verificar_validez_completa=False) # Puede generar conflictos!

        # Nota: Este cruce es propenso a crear hijos inválidos (solapamientos).
        # El Evaluador los penalizará fuertemente.
        # Podríamos añadir una fase de "reparación" aquí, pero aumenta la complejidad.

        # Asegurar que los índices y estado estén actualizados (agregar_evento debería hacerlo)
        # hijo1._reconstruir_indices_y_estado() # Probablemente redundante
        # hijo2._reconstruir_indices_y_estado() # Probablemente redundante

        return hijo1, hijo2


# CruceMateriasSeccion probablemente ya no es relevante o necesita rediseño completo
# class CruceMateriasSeccion(OperadorCruce): ...