# -*- coding: utf-8 -*- # Para manejar caracteres especiales
import pandas as pd
import random
from collections import defaultdict, namedtuple
import datetime
import time
import os

# --- Constantes y Configuraciones ---
# !!! AJUSTA ESTOS NOMBRES SI SON DIFERENTES EN TU ARCHIVO EXCEL !!!
EXCEL_FILENAME = "tabla_minable.xlsx" # Nombre archivo subido
SHARED_CLASS_COLUMN = 'clase_compartida' # Columna que indica si la clase es compartida o 'Individual'
# -----------------------------------------------------------------

# Mapeo Días (Lunes=0 a Viernes=4)
DIAS_MAP = {'lunes': 0, 'martes': 1, 'miercoles': 2, 'jueves': 3, 'viernes': 4}
DIAS_INV_MAP = {v: k.capitalize() for k, v in DIAS_MAP.items()}
DIAS_COLS = list(DIAS_MAP.keys())

# Periodos (I=0 a VI=5, asumiendo 15:00-21:00)
NUM_PERIODOS = 6
PERIODOS_IDS = [f'P{i}' for i in range(NUM_PERIODOS)]
PERIODOS_NOMBRES = ['I', 'II', 'III', 'IV', 'V', 'VI']
PERIODO_MAP_IDX_TO_NOMBRE = {i: nombre for i, nombre in enumerate(PERIODOS_NOMBRES)}
PERIODO_MAP_NOMBRE_TO_IDX = {v: k for k, v in PERIODO_MAP_IDX_TO_NOMBRE.items()}
PERIODOS_HORAS = {i: (15 + i, 15 + i + 1) for i in range(NUM_PERIODOS)}
PERIODOS_DESC = {
    nombre: f"{PERIODOS_HORAS[idx][0]:02d}:00-{PERIODOS_HORAS[idx][1]:02d}:00"
    for idx, nombre in PERIODO_MAP_IDX_TO_NOMBRE.items()
}

TimeSlot = namedtuple('TimeSlot', ['day_index', 'period_index'])

# --- Clase para Cargar y Preprocesar Datos (Modificada) ---
class DataLoader:
    def __init__(self, filename):
        self.filename = filename
        self.df = None
        self.tasks = []
        self.task_details = {}

    def load_data(self):
        print(f"INFO: Intentando cargar datos desde '{self.filename}'...")
        try:
            self.df = pd.read_excel(self.filename, engine='openpyxl') # Especificar engine puede ayudar
            print("INFO: Archivo leído exitosamente como Excel.")
        except Exception as e_excel:
            print(f"ADVERTENCIA: No se pudo leer como Excel ({e_excel}). Intentando como CSV...")
            try:
                self.df = pd.read_csv(self.filename)
                print("INFO: Archivo leído exitosamente como CSV.")
            except Exception as e_csv:
                print(f"ERROR CRÍTICO: No se pudo leer el archivo '{self.filename}': {e_csv}")
                raise

        if self.df is None or self.df.empty:
             raise ValueError("Error: No se cargaron datos o el archivo está vacío.")
        print(f"INFO: Datos cargados. {len(self.df)} filas encontradas.")

    def preprocess_and_validate(self):
        if self.df is None: raise ValueError("Error: Datos no cargados.")

        print("INFO: Iniciando preprocesamiento y validación...")
        self.df.columns = self.df.columns.str.strip().str.lower() # Convertir a minúsculas para consistencia

        # Verificar existencia de la columna de clase compartida
        if SHARED_CLASS_COLUMN not in self.df.columns:
             raise ValueError(f"Error: La columna '{SHARED_CLASS_COLUMN}' especificada para clases compartidas no existe en el archivo.")

        # --- Limpieza general y conversión de tipos ---
        # (Similar a la versión anterior, asegurando robustez)
        required_cols = ['requisito_id', 'profesor_id', 'sala_id', 'curso_id', 'materia_id',
                         'nombre_materia', 'frecuencia_semanal', SHARED_CLASS_COLUMN] + \
                         DIAS_COLS + ['horario_entrada', 'horario_salida']
        missing_cols = [col for col in required_cols if col not in self.df.columns]
        if missing_cols:
            raise ValueError(f"Error: Faltan columnas requeridas: {', '.join(missing_cols)}")

        # Convertir IDs a string, manejar Nulos
        self.df['profesor_id'] = self.df['profesor_id'].astype(float).fillna(-1).astype(int).astype(str).replace('-1', 'PROF_DESCONOCIDO')
        self.df['requisito_id'] = self.df['requisito_id'].astype(int)
        self.df['sala_id'] = self.df['sala_id'].astype(str).fillna('SALA_DESCONOCIDA')
        self.df['curso_id'] = self.df['curso_id'].astype(str).fillna('CURSO_DESCONOCIDO')
        self.df['materia_id'] = self.df['materia_id'].astype(str).fillna('MATERIA_DESCONOCIDA')
        self.df['nombre_materia'] = self.df['nombre_materia'].astype(str).fillna('MATERIA_SIN_NOMBRE')
        self.df[SHARED_CLASS_COLUMN] = self.df[SHARED_CLASS_COLUMN].astype(str).fillna('Individual') # Asumir Individual si está vacío

        # Días y frecuencia
        for d_col in DIAS_COLS:
             self.df[d_col] = pd.to_numeric(self.df[d_col], errors='coerce').fillna(0).astype(int)
             self.df[d_col] = self.df[d_col].apply(lambda x: 1 if x == 1 else 0)
        self.df['frecuencia_semanal'] = pd.to_numeric(self.df['frecuencia_semanal'], errors='coerce').fillna(1).astype(int)
        self.df['frecuencia_semanal'] = self.df['frecuencia_semanal'].apply(lambda x: max(1, x))

        # Horarios
        def parse_time_robust(time_str, default_time):
            if pd.isna(time_str): return default_time
            time_str = str(time_str).split(' ')[-1] # Tomar solo la parte de la hora si hay fecha
            try: return pd.to_datetime(time_str, format='%H:%M:%S').time()
            except ValueError:
                 try: return pd.to_datetime(time_str, format='%H:%M').time()
                 except ValueError:
                    print(f"ADVERTENCIA: Formato de hora inválido '{time_str}'. Se usará default {default_time}.")
                    return default_time

        default_start_time = datetime.time(15, 0)
        default_end_time = datetime.time(21, 0)
        self.df['hora_entrada_obj'] = self.df['horario_entrada'].apply(lambda x: parse_time_robust(x, default_start_time))
        self.df['hora_salida_obj'] = self.df['horario_salida'].apply(lambda x: parse_time_robust(x, default_end_time))

        print("INFO: Preprocesamiento y validación completados.")

    # *** MÉTODO MODIFICADO PARA MANEJAR CLASES COMPARTIDAS ***
    def create_tasks(self):
        if self.df is None: raise ValueError("Error: Datos no cargados.")

        self.tasks = []
        self.task_details = {}
        task_id_counter = 0
        processed_indices = set() # Para no procesar filas de grupos compartidos dos veces

        print("INFO: Creando tareas de programación (manejando clases compartidas)...")

        # 1. Procesar Grupos Compartidos
        df_shared = self.df[self.df[SHARED_CLASS_COLUMN].str.lower() != 'individual'].copy()
        if not df_shared.empty:
            # Definir columnas para agrupar clases compartidas
            grouping_cols = [SHARED_CLASS_COLUMN, 'profesor_id', 'sala_id', 'materia_id']
            print(f"INFO: Agrupando por: {grouping_cols}")

            grouped = df_shared.groupby(grouping_cols)
            print(f"INFO: {len(grouped)} grupos compartidos identificados.")

            for name, group in grouped:
                # 'name' es una tupla con los valores de grouping_cols
                # 'group' es un DataFrame con las filas de este grupo compartido
                print(f"\n--- Procesando Grupo Compartido: {name} ({len(group)} filas) ---")
                group_indices = set(group.index)
                if not group_indices.isdisjoint(processed_indices):
                     print("ADVERTENCIA: Grupo ya procesado, saltando.")
                     continue # Evitar doble procesamiento si hay solapamiento inesperado

                first_row = group.iloc[0] # Usar la primera fila como referencia

                # Validar consistencia dentro del grupo
                if not self._validate_group_consistency(group, name):
                    print(f"ERROR CRÍTICO: Inconsistencias encontradas en el grupo {name}. Este grupo no se puede programar.")
                    processed_indices.update(group_indices)
                    continue

                # Obtener datos consolidados del grupo
                all_curso_ids = sorted(list(group['curso_id'].unique()))
                frecuencia = int(first_row['frecuencia_semanal']) # Asumimos consistencia validada
                allowed_slots = self._get_allowed_slots_for_group(group, name) # Intersección de restricciones

                if not allowed_slots:
                    print(f"ADVERTENCIA: El grupo compartido {name} no tiene slots válidos comunes. Se omitirá.")
                    processed_indices.update(group_indices)
                    continue

                print(f"  Cursos: {all_curso_ids}")
                print(f"  Frecuencia: {frecuencia}")
                # print(f"  Slots Permitidos Comunes: {allowed_slots}") # Puede ser muy largo

                # Crear tareas para el grupo compartido
                for i in range(frecuencia):
                    task_id = task_id_counter
                    task = SchedulingTask(
                        task_id=task_id,
                        req_id=list(group['requisito_id']), # Guardar todos los IDs originales
                        materia_id=first_row['materia_id'],
                        materia_nombre=first_row['nombre_materia'],
                        profesor_id=first_row['profesor_id'],
                        sala_id=first_row['sala_id'],
                        curso_ids=all_curso_ids, # ¡Lista completa de cursos!
                        allowed_slots=allowed_slots,
                        instance=i,
                        is_shared=True,
                        shared_group_key=name # Guardar la clave del grupo
                    )
                    self.tasks.append(task)
                    self.task_details[task_id] = task
                    task_id_counter += 1
                processed_indices.update(group_indices) # Marcar filas como procesadas

        print(f"\nINFO: {len(processed_indices)} filas procesadas como parte de grupos compartidos.")

        # 2. Procesar Clases Individuales
        df_individual = self.df[~self.df.index.isin(processed_indices)].copy()
        print(f"INFO: Procesando {len(df_individual)} filas como clases individuales...")

        for index, row in df_individual.iterrows():
             # Verificar que realmente sea individual (doble chequeo)
             if str(row[SHARED_CLASS_COLUMN]).lower() != 'individual':
                 print(f"ADVERTENCIA: Fila {index} (Req {row['requisito_id']}) no marcada como 'Individual' pero no procesada en grupo. Revisar lógica. Tratando como individual.")

             allowed_slots = self._get_allowed_slots_for_row(row)

             if not allowed_slots:
                 print(f"ADVERTENCIA: Req Individual {row['requisito_id']} no tiene slots válidos. Se omitirá.")
                 continue

             frecuencia = int(row['frecuencia_semanal'])
             for i in range(frecuencia):
                 task_id = task_id_counter
                 task = SchedulingTask(
                     task_id=task_id,
                     req_id=[row['requisito_id']], # Lista con un solo ID
                     materia_id=row['materia_id'],
                     materia_nombre=row['nombre_materia'],
                     profesor_id=row['profesor_id'],
                     sala_id=row['sala_id'],
                     curso_ids=[row['curso_id']], # Lista con un solo curso
                     allowed_slots=allowed_slots,
                     instance=i,
                     is_shared=False,
                     shared_group_key=None
                 )
                 self.tasks.append(task)
                 self.task_details[task_id] = task
                 task_id_counter += 1

        if not self.tasks:
            raise ValueError("Error Crítico: No se generaron tareas de programación.")
        print(f"\nINFO: Total de {len(self.tasks)} tareas de programación creadas (incluyendo compartidas e individuales).")
        return self.tasks, self.task_details


    def _validate_group_consistency(self, group_df, group_key):
        """Verifica que las filas de un grupo compartido tengan datos consistentes."""
        is_consistent = True
        # Chequear Frecuencia Semanal
        if group_df['frecuencia_semanal'].nunique() > 1:
            print(f"ERROR de consistencia (Grupo {group_key}): Múltiples valores para 'frecuencia_semanal': {group_df['frecuencia_semanal'].unique()}")
            is_consistent = False
        # Chequear días/horas (implícitamente manejado por _get_allowed_slots_for_group, pero podríamos añadir chequeos explícitos si es necesario)
        # Por ejemplo, ¿deberían tener todos exactamente los mismos días/horas marcados? La intersección lo maneja.
        # Podríamos chequear si el profesor/sala/materia realmente coincide (aunque el groupby ya lo hizo)
        if group_df['profesor_id'].nunique() > 1 or \
           group_df['sala_id'].nunique() > 1 or \
           group_df['materia_id'].nunique() > 1:
             print(f"ERROR de consistencia (Grupo {group_key}): Discrepancia en profesor/sala/materia DENTRO del grupo. Esto no debería pasar por el groupby.")
             is_consistent = False
        return is_consistent

    def _get_allowed_slots_for_row(self, row):
        """Calcula TimeSlots permitidos para UNA fila."""
        # (Misma lógica que antes)
        allowed = []
        try:
            h_entrada_hour = row['hora_entrada_obj'].hour
            h_salida_hour = row['hora_salida_obj'].hour
            if h_salida_hour == 0: h_salida_hour = 24

            dias_permitidos_idx = {DIAS_MAP[d_col] for d_col in DIAS_COLS if row[d_col] == 1}

            periodos_permitidos_idx = set()
            for p_idx, (p_start, p_end) in PERIODOS_HORAS.items():
                if p_start >= h_entrada_hour and p_end <= h_salida_hour:
                    periodos_permitidos_idx.add(p_idx)

            for dia_idx in dias_permitidos_idx:
                for periodo_idx in periodos_permitidos_idx:
                    allowed.append(TimeSlot(day_index=dia_idx, period_index=periodo_idx))
        except Exception as e:
            print(f"Error calculando slots para Req {row.get('requisito_id', 'N/A')} (fila individual): {e}")
            return []
        return allowed


    def _get_allowed_slots_for_group(self, group_df, group_key):
        """Calcula la INTERSECCIÓN de TimeSlots permitidos para un GRUPO compartido."""
        print(f"  Calculando slots comunes para grupo {group_key}...")
        common_slots = None
        first = True
        for index, row in group_df.iterrows():
            row_slots = set(self._get_allowed_slots_for_row(row)) # Convertir a set para intersección
            if not row_slots:
                print(f"  ADVERTENCIA: Fila {index} (Req {row['requisito_id']}) dentro del grupo {group_key} no tiene slots válidos. Excluyendo de intersección.")
                continue # O podríamos decidir que todo el grupo es inválido

            if first:
                common_slots = row_slots
                first = False
            else:
                common_slots.intersection_update(row_slots)

            # Si en algún punto la intersección se vuelve vacía, no hay slots comunes
            if not common_slots and not first: # Asegurarse que no sea el primer conjunto vacío
                print(f"  ERROR: No hay slots comunes para el grupo {group_key} después de considerar la fila {index}.")
                return []

        if common_slots is None: # Caso donde todas las filas fallaron o el grupo estaba vacío
             print(f"  ERROR: No se pudieron determinar slots comunes para el grupo {group_key}.")
             return []

        print(f"  {len(common_slots)} slots comunes encontrados.")
        return sorted(list(common_slots)) # Devolver como lista ordenada


# --- Clase SchedulingTask (Actualizada) ---
class SchedulingTask:
    def __init__(self, task_id, req_id, materia_id, materia_nombre, profesor_id, sala_id, curso_ids, allowed_slots, instance, is_shared=False, shared_group_key=None):
        self.task_id = task_id
        # req_id ahora puede ser una lista para tareas compartidas
        self.req_id = req_id if isinstance(req_id, list) else [req_id]
        self.materia_id = materia_id
        self.materia_nombre = materia_nombre
        self.profesor_id = profesor_id
        self.sala_id = sala_id
        self.curso_ids = curso_ids # Lista de cursos
        self.allowed_slots = allowed_slots
        self.instance = instance
        self.is_shared = is_shared # Booleano indicando si es compartida
        self.shared_group_key = shared_group_key # Clave del grupo si es compartida

    def __repr__(self):
        shared_marker = "[S]" if self.is_shared else "[I]"
        return (f"Task(id={self.task_id} {shared_marker}, req={self.req_id}, mat='{self.materia_nombre}', "
                f"prof='{self.profesor_id}', sala='{self.sala_id}', "
                f"cursos={self.curso_ids}, inst={self.instance})")


# --- Clase Timetable (Sin cambios en la lógica de fitness) ---
# La lógica de fitness ya manejaba una lista de cursos por tarea,
# por lo que debería funcionar correctamente con las tareas compartidas.
class Timetable:
    task_details_map = None

    def __init__(self, tasks, assignment=None):
        self.tasks = tasks
        self.num_tasks = len(tasks)
        if assignment:
            if len(assignment) != self.num_tasks:
                raise ValueError("Error: Longitud de asignación != número de tareas.")
            self.assignment = list(assignment)
        else:
            self.assignment = self._create_random_assignment()
        self.fitness = -1

    @classmethod
    def set_task_details_map(cls, task_map):
        cls.task_details_map = task_map

    def _create_random_assignment(self):
        if Timetable.task_details_map is None:
             raise RuntimeError("Mapa de detalles no establecido en Timetable.")
        new_assignment = []
        for task_id in range(self.num_tasks):
            task = Timetable.task_details_map.get(task_id)
            if task and task.allowed_slots:
                new_assignment.append(random.choice(task.allowed_slots))
            else:
                 print(f"ADVERTENCIA CRÍTICA: Tarea {task_id} sin slots válidos al crear asignación.")
                 new_assignment.append(TimeSlot(-1, -1))
        return new_assignment

    def calculate_fitness(self):
        if Timetable.task_details_map is None:
             raise RuntimeError("Mapa de detalles no establecido.")

        violations = 0
        schedule = defaultdict(list) # TimeSlot -> lista de task_ids

        for task_id, assigned_slot in enumerate(self.assignment):
            task = Timetable.task_details_map.get(task_id)
            # Chequeo de validez del slot asignado para *esta* tarea
            if not task or assigned_slot == TimeSlot(-1, -1) or assigned_slot not in task.allowed_slots:
                violations += 100
                continue
            schedule[assigned_slot].append(task_id)

        # Chequear conflictos de recursos por slot
        for time_slot, tasks_in_slot in schedule.items():
            if len(tasks_in_slot) > 1:
                professors = [Timetable.task_details_map[tid].profesor_id for tid in tasks_in_slot]
                aulas = [Timetable.task_details_map[tid].sala_id for tid in tasks_in_slot]
                # *** La clave está aquí: Aplanar la lista de TODOS los cursos en el slot ***
                cursos_flat = [curso for tid in tasks_in_slot for curso in Timetable.task_details_map[tid].curso_ids]

                violations += len(professors) - len(set(professors))
                violations += len(aulas) - len(set(aulas))
                # Si un curso está en la lista aplanada más de una vez, es un conflicto
                violations += len(cursos_flat) - len(set(cursos_flat))

        self.fitness = violations
        return self.fitness

    def get_assignment(self): return self.assignment
    def __len__(self): return self.num_tasks
    def __getitem__(self, index): return self.assignment[index]
    def __setitem__(self, index, value):
        if isinstance(value, TimeSlot):
            self.assignment[index] = value
            self.fitness = -1
        else: raise TypeError("El valor debe ser TimeSlot.")


# --- Clase GeneticAlgorithm (Sin cambios lógicos) ---
class GeneticAlgorithm:
    def __init__(self, tasks, task_details_map, population_size=100, mutation_rate=0.1, tournament_size=5):
        self.tasks = tasks
        Timetable.set_task_details_map(task_details_map)
        self.population_size = population_size
        self.mutation_rate = mutation_rate
        self.tournament_size = tournament_size
        self.population = self._initialize_population()

    def _initialize_population(self):
        print(f"INFO: Inicializando población con {self.population_size} individuos...")
        pop = []
        attempts = 0
        max_attempts = self.population_size * 5 # Evitar bucle infinito
        while len(pop) < self.population_size and attempts < max_attempts:
             attempts += 1
             try:
                 timetable = Timetable(self.tasks)
                 pop.append(timetable)
             except Exception as e:
                 print(f"Error creando individuo inicial (intento {attempts}): {e}. Reintentando...")
        if len(pop) < self.population_size:
            print(f"ADVERTENCIA: Solo se pudieron crear {len(pop)} individuos iniciales válidos.")
            if not pop: raise RuntimeError("No se pudo crear ningún individuo inicial válido.")
        print(f"INFO: Población inicial creada ({len(pop)} individuos).")
        return pop


    def run(self, max_generations=500, stagnation_limit=100):
        # (Misma lógica de ejecución que la versión OOP anterior)
        print("\n--- Iniciando Algoritmo Genético ---")
        print(f"Parámetros: Población={self.population_size}, Generaciones={max_generations}, Mutación={self.mutation_rate}, Torneo={self.tournament_size}")

        best_timetable = None
        best_fitness = float('inf')
        generations_without_improvement = 0
        start_time = time.time()

        if not self.population:
            print("ERROR CRÍTICO: La población inicial está vacía. No se puede ejecutar el GA.")
            return None

        for generation in range(max_generations):
            fitnesses = [tt.calculate_fitness() for tt in self.population]

            valid_fitnesses_idx = [(f, i) for i, f in enumerate(fitnesses) if f is not None and f != float('inf')]
            if not valid_fitnesses_idx:
                print(f"ERROR CRÍTICO: Gen {generation}: Ningún individuo válido. Deteniendo.")
                break

            current_best_fitness, current_best_idx = min(valid_fitnesses_idx, key=lambda x: x[0])

            if current_best_fitness < best_fitness:
                best_fitness = current_best_fitness
                # Crear una copia explícita del mejor individuo
                best_timetable = Timetable(self.tasks, assignment=self.population[current_best_idx].get_assignment())
                generations_without_improvement = 0
                print(f"Generación {generation}: Nueva mejor solución! Fitness = {best_fitness}")
            else:
                generations_without_improvement += 1

            if best_fitness == 0:
                print(f"\n¡ÉXITO! Solución Válida (Fitness=0) Encontrada en la Generación {generation}!")
                break

            if generations_without_improvement >= stagnation_limit:
                print(f"\nDETENIDO: No hubo mejora en {stagnation_limit} generaciones. Mejor fitness: {best_fitness}")
                break

            # Crear nueva población
            new_population = []
            if best_timetable: # Elitismo
                # Asegurarse de añadir una copia, no la referencia
                new_population.append(Timetable(self.tasks, assignment=best_timetable.get_assignment()))

            while len(new_population) < self.population_size:
                 parent1 = self._tournament_selection(fitnesses)
                 parent2 = self._tournament_selection(fitnesses)
                 child_assign1, child_assign2 = self._crossover(parent1, parent2)

                 mutated_assign1 = self._mutate(child_assign1)
                 new_population.append(Timetable(self.tasks, assignment=mutated_assign1))

                 if len(new_population) < self.population_size:
                     mutated_assign2 = self._mutate(child_assign2)
                     new_population.append(Timetable(self.tasks, assignment=mutated_assign2))

            self.population = new_population

            if generation % 50 == 0 and generation > 0:
                 print(f"Generación {generation}... Mejor fitness: {best_fitness}")

        end_time = time.time()
        print(f"\n--- Algoritmo Genético Finalizado ({end_time - start_time:.2f} segundos) ---")
        if best_timetable:
             final_fitness = best_timetable.calculate_fitness()
             print(f"Mejor fitness encontrado: {final_fitness} (0 = Sin conflictos)")
             return best_timetable
        else:
             print("No se encontró ninguna solución viable.")
             return None

    def _tournament_selection(self, fitnesses):
        valid_indices = [i for i, f in enumerate(fitnesses) if f is not None and f != float('inf')]
        if not valid_indices: return random.choice(self.population) # Fallback
        selected_indices = random.sample(valid_indices, min(self.tournament_size, len(valid_indices)))
        best_index_in_tournament = min(selected_indices, key=lambda i: fitnesses[i])
        return self.population[best_index_in_tournament]

    def _crossover(self, parent1, parent2):
        assign1 = parent1.get_assignment()
        assign2 = parent2.get_assignment()
        num_genes = len(assign1)
        if num_genes < 2: return assign1[:], assign2[:]
        point = random.randint(1, num_genes - 1)
        child_assign1 = assign1[:point] + assign2[point:]
        child_assign2 = assign2[:point] + assign1[point:]
        return child_assign1, child_assign2

    def _mutate(self, assignment):
        mutated_assignment = list(assignment)
        for i in range(len(mutated_assignment)):
            if random.random() < self.mutation_rate:
                task_id = i
                task = Timetable.task_details_map.get(task_id)
                if task and task.allowed_slots:
                    current_slot = mutated_assignment[i]
                    possible_new_slots = [s for s in task.allowed_slots if s != current_slot]
                    if possible_new_slots:
                        mutated_assignment[i] = random.choice(possible_new_slots)
                    elif len(task.allowed_slots) >= 1: # Si solo hay uno (o el mismo), se queda
                         mutated_assignment[i] = task.allowed_slots[0]
        return mutated_assignment


# --- Función Principal y de Visualización (Sin cambios) ---
def display_timetable(timetable, task_details_map):
    # (Igual que la versión OOP anterior)
    print("\n--- Horario Generado ---")
    final_schedule_display = defaultdict(list)
    assignment = timetable.get_assignment()

    for task_id, slot in enumerate(assignment):
        if slot == TimeSlot(-1,-1):
             task_info = task_details_map.get(task_id,"Info no disponible")
             print(f"ADVERTENCIA: Tarea ID {task_id} ({task_info}) no pudo asignarse.")
             continue

        dia_idx, periodo_idx = slot.day_index, slot.period_index
        details = task_details_map.get(task_id)
        if not details: continue

        shared_marker = "[S]" if details.is_shared else "[I]"
        req_id_str = ','.join(map(str, details.req_id)) # Mostrar todos los req_id

        entry = (
            f"{shared_marker} Materia: {details.materia_nombre} ({details.materia_id}), "
            f"Prof: {details.profesor_id}, Aula: {details.sala_id}, "
            f"Curso(s): {', '.join(details.curso_ids)}, "
            f"(ReqIDs: {req_id_str}, Sesión: {details.instance})"
        )
        final_schedule_display[(dia_idx, periodo_idx)].append(entry)

    sorted_slots = sorted(final_schedule_display.keys(), key=lambda x: (x[0], x[1]))
    for slot_key in sorted_slots:
        dia_idx, periodo_idx = slot_key
        dia = DIAS_INV_MAP.get(dia_idx, f"D?{dia_idx}")
        periodo_label = PERIODO_MAP_IDX_TO_NOMBRE.get(periodo_idx, f"P?{periodo_idx}")
        periodo_hora = PERIODOS_DESC.get(periodo_label, "")
        print(f"\n--- {dia} - Periodo {periodo_label} ({periodo_hora}) ---")
        for entry_text in sorted(final_schedule_display[slot_key]):
            print(f"  - {entry_text}")

    final_fitness = timetable.calculate_fitness()
    print("\n" + "="*70)
    if final_fitness == 0: print("¡HORARIO VÁLIDO! No se detectaron conflictos.")
    else: print(f"ADVERTENCIA: {final_fitness} conflictos restantes.")
    print("="*70)

def main():
    try:
        loader = DataLoader(EXCEL_FILENAME)
        loader.load_data()
        loader.preprocess_and_validate()
        tasks, task_details_map = loader.create_tasks()

        # Ajusta parámetros del GA según necesidad
        ga = GeneticAlgorithm(
            tasks=tasks,
            task_details_map=task_details_map,
            population_size=250, # Aumentado
            mutation_rate=0.2,   # Aumentado
            tournament_size=7
        )
        best_timetable_solution = ga.run(
            max_generations=2500, # Aumentado
            stagnation_limit=300  # Aumentado
        )

        if best_timetable_solution:
            display_timetable(best_timetable_solution, task_details_map)
        else:
            print("\nNo se pudo generar un horario.")

    except FileNotFoundError:
        print(f"\nERROR FATAL: Archivo '{EXCEL_FILENAME}' no encontrado.")
    except ValueError as ve:
        print(f"\nERROR FATAL: {ve}")
    except Exception as e:
        print(f"\nERROR FATAL inesperado: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()