# -*- coding: utf-8 -*-
# filename: utils/data_loader.py

"""
Utilidad para cargar datos desde archivos CSV y prepararlos para el algoritmo.
"""

import os
import pandas as pd
import numpy as np
import datetime
# Asegúrate que las rutas de importación sean correctas respecto a tu estructura
from model.profesor import Profesor
from model.sala import Sala
from model.requisito_clase import RequisitoClase
from config import DIAS_SEMANA, HORAS_DIA

class DataLoaderError(Exception):
    """Custom exception for data loading errors."""
    pass

class DataLoader:
    """
    Clase para cargar y procesar datos desde archivos CSV.
    """

    def __init__(self, config_horas_dia=HORAS_DIA, config_dias_semana=DIAS_SEMANA):
        self.profesores_map_id = {}
        self.profesores_map_nombre = {}
        self.salas_map_id = {}
        self.requisitos = []
        self.dias_semana = config_dias_semana
        try:
            self.slots_info = self._procesar_slots_config(config_horas_dia)
        except DataLoaderError as e:
            print(f"Error fatal inicializando DataLoader: {e}")
            raise # Re-lanzar error fatal

    def _procesar_slots_config(self, horas_dia_config):
        """Procesa la configuración HORAS_DIA para facilitar el mapeo de tiempos."""
        slots = {}
        if not horas_dia_config:
             raise DataLoaderError("La configuración HORAS_DIA está vacía.")
        for i, slot_str in enumerate(horas_dia_config):
            try:
                parts = slot_str.split('-')
                if len(parts) != 2:
                    raise ValueError("Formato incorrecto, falta '-'")
                start_str, end_str = parts
                # Usar una fecha base fija (año bisiesto para evitar problemas) para convertir a datetime
                base_date = datetime.date(2024, 1, 1)
                start_time = datetime.datetime.combine(base_date, datetime.datetime.strptime(start_str.strip(), '%H:%M').time())
                end_time = datetime.datetime.combine(base_date, datetime.datetime.strptime(end_str.strip(), '%H:%M').time())
                 # Ajustar fin de día si cruza la medianoche (poco probable en este contexto)
                if end_time <= start_time:
                     print(f"Advertencia: Slot {slot_str} parece terminar antes o al mismo tiempo que empieza. Asegúrate que es correcto.")
                     # Decidir si ajustar o lanzar error. Ajustemos por ahora.
                     # end_time += datetime.timedelta(days=1) # Descomentar si se permiten clases nocturnas

                slots[i] = {'idx': i, 'start': start_time, 'end': end_time, 'label': slot_str}
            except ValueError as e:
                 raise DataLoaderError(f"Formato incorrecto en HORAS_DIA: '{slot_str}'. Debe ser HH:MM-HH:MM. Error: {e}")
            except Exception as e:
                 raise DataLoaderError(f"Error inesperado procesando slot '{slot_str}': {e}")

        if not slots:
             raise DataLoaderError("No se pudieron procesar slots desde HORAS_DIA.")
        return slots

    def _map_time_to_slot_index(self, time_obj):
        """Encuentra el índice del slot que contiene la hora dada (comparando tiempos)."""
        base_date = datetime.date(2024, 1, 1)
        target_time = datetime.datetime.combine(base_date, time_obj)
        for idx, info in self.slots_info.items():
            # Comprobar si el tiempo está dentro del slot [start, end)
            # Ajuste: Considerar si el inicio del slot es >= target time?
            # Por ahora, mantenemos la lógica original: el target time debe caer DENTRO del slot.
            if info['start'] <= target_time < info['end']:
                return idx
        # Si no se encuentra, puede ser un hueco entre slots definidos
        # print(f"Debug: Tiempo {time_obj} no cae exactamente dentro de ningún slot definido.")
        return None

    def _get_allowed_slots(self, row):
        """Calcula los slots permitidos para un requisito de tabla_minable."""
        allowed_slots = []
        req_id_debug = row.get('requisito_id', 'N/A')
        try:
            # --- Parsear ventana horaria ---
            start_window_str = str(row['horario_entrada']).strip()
            end_window_str = str(row['horario_salida']).strip()
            time_formats = ['%H:%M:%S', '%H:%M'] # Permitir ambos formatos
            start_window = None
            end_window = None
            for fmt in time_formats:
                try:
                    start_window = datetime.datetime.strptime(start_window_str, fmt).time()
                    break
                except ValueError: continue
            for fmt in time_formats:
                 try:
                    end_window = datetime.datetime.strptime(end_window_str, fmt).time()
                    break
                 except ValueError: continue

            if start_window is None or end_window is None:
                 raise ValueError(f"Formato de hora no reconocido para entrada/salida: '{start_window_str}'/'{end_window_str}'")

            base_date = datetime.date(2024, 1, 1)
            start_window_dt = datetime.datetime.combine(base_date, start_window)
            end_window_dt = datetime.datetime.combine(base_date, end_window)
            if end_window_dt <= start_window_dt: # Manejar ventana que cruza medianoche o es inválida
                 # Asumimos que no cruza medianoche para horarios escolares
                 if end_window_dt < start_window_dt:
                     print(f"Advertencia Req {req_id_debug}: horario_salida es anterior a horario_entrada. ({start_window_str} - {end_window_str}). Se usará solo la hora de inicio.")
                     end_window_dt = start_window_dt + datetime.timedelta(minutes=1) # Ventana mínima
                 # Si son iguales, es una ventana instantánea, quizás no útil
                 elif end_window_dt == start_window_dt:
                      print(f"Advertencia Req {req_id_debug}: horario_entrada y salida son iguales ({start_window_str}).")
                      end_window_dt += datetime.timedelta(minutes=1)


            # --- Parsear días permitidos ---
            allowed_days_indices = []
            # Usar DIAS_SEMANA de config para la comparación y mapeo de índices
            day_columns_expected = [d.lower() for d in self.dias_semana] # lunes, martes, ...
            for i, day_name_lower_config in enumerate(day_columns_expected):
                 # Buscar columna en el CSV (insensible a mayúsculas/minúsculas)
                 found_col = None
                 for csv_col in row.index: # Iterar sobre nombres de columna reales del CSV
                     if csv_col.lower() == day_name_lower_config:
                         found_col = csv_col
                         break
                 if found_col and pd.notna(row[found_col]):
                     try:
                         if int(row[found_col]) == 1:
                             allowed_days_indices.append(i)
                     except (ValueError, TypeError):
                          print(f"Advertencia Req {req_id_debug}: Valor no numérico en columna de día '{found_col}'. Se ignora.")


            if not allowed_days_indices:
                 print(f"Advertencia Req {req_id_debug}: No tiene días asignados (lunes-viernes = 0). No se generarán slots.")
                 return []

            # --- Encontrar slots válidos ---
            for day_idx in allowed_days_indices:
                for slot_idx, slot_info in self.slots_info.items():
                    # Un slot es válido si su intervalo [start, end) INTERSECTA
                    # con la ventana permitida [start_window, end_window).
                    # Simplificación: El inicio del slot debe estar DENTRO de la ventana.
                    # Esto asegura que la clase no empieza antes de lo permitido.
                    # Necesita refinamiento si las clases pueden empezar a mitad de slot.
                    # Condición: slot_start >= window_start AND slot_start < window_end
                    if start_window_dt <= slot_info['start'] < end_window_dt:
                        # Ahora, verificar si el bloque completo cabe antes de window_end
                        slots_needed = int(row.get('duracion_sesion_horas', 1))
                        if slots_needed <= 0: slots_needed = 1
                        
                        can_fit = True
                        last_slot_time = slot_info['start'] # Hora inicio primer slot
                        for i in range(slots_needed):
                             current_slot_idx = slot_idx + i
                             if current_slot_idx >= len(self.slots_info): # Se sale de los slots definidos
                                 can_fit = False
                                 break
                             current_slot_info = self.slots_info[current_slot_idx]
                             # El *fin* del último slot del bloque debe ser <= window_end
                             if i == slots_needed - 1:
                                last_slot_time = current_slot_info['end']

                             # Podría haber huecos en HORAS_DIA, verificar continuidad si es necesario
                             if i > 0:
                                 prev_slot_info = self.slots_info[current_slot_idx - 1]
                                 if current_slot_info['start'] != prev_slot_info['end']:
                                     # print(f"Debug Req {req_id_debug}: Bloque no contiguo en slot {current_slot_idx} para inicio {slot_idx}")
                                     can_fit = False # No contiguo
                                     break

                        # Verificar si el fin del último slot está dentro de la ventana
                        if last_slot_time > end_window_dt:
                            can_fit = False

                        if can_fit:
                            allowed_slots.append((day_idx, slot_idx))
                        # else:
                            # print(f"Debug Req {req_id_debug}: Bloque iniciado en ({day_idx},{slot_idx}) no cabe en ventana {start_window_str}-{end_window_str}")


        except KeyError as e:
             print(f"Error procesando slots para Req {req_id_debug}: Falta columna esperada '{e}'. Se devolverán 0 slots.")
             return []
        except (ValueError, TypeError) as e:
             print(f"Error procesando slots para Req {req_id_debug}: Error de tipo/formato: {e}. Se devolverán 0 slots.")
             return []
        except Exception as e:
            print(f"Error inesperado procesando slots para Req {req_id_debug}: {e}. Se devolverán 0 slots.")
            return []

        if not allowed_slots:
             print(f"Advertencia Req {req_id_debug}: No resultó en slots permitidos válidos con la configuración y ventana {start_window_str}-{end_window_str} en días {allowed_days_indices}.")

        # Devolver slots únicos por si acaso
        return sorted(list(set(allowed_slots)))


    def cargar_profesores(self, archivo_csv):
        """Carga datos de profesores desde un archivo CSV."""
        print(f"Cargando profesores desde: {archivo_csv}")
        try:
            # Especificar dtype=str para leer IDs sin interpretación numérica
            df = pd.read_csv(archivo_csv, dtype={'profesor_id': str})
            df.columns = df.columns.str.strip().str.lower() # Normalizar nombres de columna

            self.profesores_map_id = {} # Resetear mapas
            self.profesores_map_nombre = {}

            for _, row in df.iterrows():
                 # Usar .loc para evitar SettingWithCopyWarning si se modifica df
                row = row.copy()
                # Limpiar espacios en todas las celdas de string
                for col in df.select_dtypes(include=['object']).columns:
                     if pd.notna(row[col]):
                          row[col] = str(row[col]).strip()

                prof_id = row.get('profesor_id') # Ya es string por dtype
                nombre = row.get('nombre', '')
                apellido = row.get('apellido', '')
                nombre_completo = f"{nombre} {apellido}".strip()
                categoria = row.get('categoria', 'Contrato')
                seccion_primaria = row.get('seccion', '')

                if not prof_id or not nombre_completo:
                     print(f"Advertencia: Fila de profesor omitida por falta de ID ({prof_id}) o nombre ({nombre_completo}). Fila: {row.to_dict()}")
                     continue

                # Validar categoría
                if categoria.lower() not in ['item', 'contrato']:
                     print(f"Advertencia: Categoría de profesor '{categoria}' no reconocida para ID {prof_id}. Se asume 'Contrato'.")
                     categoria = 'Contrato'

                profesor = Profesor(
                    id=prof_id,
                    nombre=nombre_completo,
                    categoria=categoria.capitalize(), # Guardar como 'Item' o 'Contrato'
                    seccion_primaria=seccion_primaria
                )

                if prof_id in self.profesores_map_id:
                     print(f"Advertencia: ID de profesor duplicado '{prof_id}'. Se sobrescribirá con la última entrada.")
                self.profesores_map_id[prof_id] = profesor

                if nombre_completo in self.profesores_map_nombre:
                     # Podría haber homónimos, usar ID como desambiguador si es necesario en tabla_minable
                     print(f"Advertencia: Nombre de profesor duplicado '{nombre_completo}'. La búsqueda por nombre puede fallar si no se usa ID.")
                     # Podríamos almacenar una lista de IDs por nombre:
                     # self.profesores_map_nombre.setdefault(nombre_completo, []).append(prof_id)
                else:
                     self.profesores_map_nombre[nombre_completo] = profesor # Guardar solo si es único por ahora

            print(f"Profesores cargados: {len(self.profesores_map_id)}")
            if not self.profesores_map_id:
                 raise DataLoaderError("No se cargaron profesores.")
            return list(self.profesores_map_id.values())

        except FileNotFoundError:
             raise DataLoaderError(f"Archivo de profesores no encontrado: {archivo_csv}")
        except KeyError as e:
             raise DataLoaderError(f"Columna esperada no encontrada en {archivo_csv}: {e}")
        except Exception as e:
            raise DataLoaderError(f"Error inesperado al cargar profesores desde {archivo_csv}: {e}")

    def cargar_salas(self, archivo_csv):
        """Carga datos de salas desde un archivo CSV."""
        print(f"Cargando salas desde: {archivo_csv}")
        try:
            # Especificar dtype para IDs
            df = pd.read_csv(archivo_csv, dtype={'sala_id': str})
            df.columns = df.columns.str.strip().str.lower() # Normalizar

            self.salas_map_id = {} # Resetear

            for _, row in df.iterrows():
                row = row.copy()
                for col in df.select_dtypes(include=['object']).columns:
                     if pd.notna(row[col]):
                          row[col] = str(row[col]).strip()

                sala_id = row.get('sala_id')
                capacidad_str = str(row.get('capacidad', '0')).strip()
                tipo_sala = row.get('tipo_sala', 'Regular')
                nombre_nivel = row.get('nombre_nivel', 'Todos')

                if not sala_id:
                     print(f"Advertencia: Fila de sala omitida por falta de ID. Fila: {row.to_dict()}")
                     continue

                try:
                    capacidad = int(float(capacidad_str)) # Permitir decimales y convertir a int
                except (ValueError, TypeError):
                    print(f"Advertencia: Capacidad inválida '{capacidad_str}' para sala {sala_id}. Se usará 0.")
                    capacidad = 0

                # Mapear tipo_sala a equipamiento
                equipamiento = []
                if tipo_sala.lower() != 'regular' and tipo_sala:
                    # Considerar si tipo_sala puede tener múltiples equipos separados por comas, etc.
                    equipamiento = [eq.strip() for eq in tipo_sala.split(',')] # Ejemplo: "Proyector, Pizarra"

                sala = Sala(
                    id=sala_id,
                    nombre=sala_id, # Usar ID como nombre
                    capacidad=capacidad,
                    nivel=nombre_nivel.lower(), # Guardar en minúsculas
                    equipamiento=equipamiento
                )

                if sala_id in self.salas_map_id:
                     print(f"Advertencia: ID de sala duplicado '{sala_id}'. Se sobrescribirá.")
                self.salas_map_id[sala_id] = sala

            print(f"Salas cargadas: {len(self.salas_map_id)}")
            if not self.salas_map_id:
                 raise DataLoaderError("No se cargaron salas.")
            return list(self.salas_map_id.values())

        except FileNotFoundError:
             raise DataLoaderError(f"Archivo de salas no encontrado: {archivo_csv}")
        except KeyError as e:
             raise DataLoaderError(f"Columna esperada no encontrada en {archivo_csv}: {e}")
        except Exception as e:
            raise DataLoaderError(f"Error inesperado al cargar salas desde {archivo_csv}: {e}")


    def cargar_requisitos_clase(self, archivo_csv):
        """Carga los requisitos de clase desde tabla_minable."""
        print(f"Cargando requisitos de clase desde: {archivo_csv}")
        if not self.profesores_map_id:
             raise DataLoaderError("Se deben cargar los profesores antes de los requisitos.")

        try:
            # Leer con dtype para IDs y columnas binarias de días si es posible
            dtypes = {'requisito_id': str, 'profesor_id': str} # Añadir profesor_id si existe
            day_cols = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']
            # Leer columnas de días como object y luego convertir para manejar errores
            # for day in day_cols: dtypes[day] = 'Int64' # Usar Int64 para permitir NA

            df = pd.read_csv(archivo_csv, dtype=dtypes)
            df.columns = df.columns.str.strip().str.lower() # Normalizar

            # Asegurar que las columnas de días esperadas existan
            for col in day_cols:
                if col not in df.columns:
                    # Intentar encontrar con mayúscula inicial
                    col_cap = col.capitalize()
                    if col_cap in df.columns:
                         df.rename(columns={col_cap: col}, inplace=True)
                    else:
                         raise KeyError(f"Falta la columna de día esperada: {col} (o {col_cap})")


            requisitos_cargados = []
            requisitos_omitidos = 0
            ids_requisitos_cargados = set()

            print(f"Procesando {len(df)} filas de {archivo_csv}...")
            for index, row in df.iterrows():
                row = row.copy() # Evitar warnings
                 # Limpiar strings
                for col in df.select_dtypes(include=['object']).columns:
                    if pd.notna(row[col]):
                        row[col] = str(row[col]).strip()

                req_id = row.get('requisito_id')
                if not req_id:
                     print(f"Advertencia: Fila {index+2} omitida por falta de requisito_id.")
                     requisitos_omitidos += 1
                     continue

                if req_id in ids_requisitos_cargados:
                     print(f"Advertencia: requisito_id duplicado '{req_id}' en fila {index+2}. Omitiendo duplicado.")
                     requisitos_omitidos += 1
                     continue

                try:
                    # --- Identificar Profesor ---
                    profesor_asignado = None
                    prof_id_en_tabla = row.get('profesor_id') # Asume existe columna profesor_id
                    nombre_prof = row.get('nombre_profesor', '')
                    apellido_prof = row.get('apellido_profesor', '')
                    prof_nombre_completo = f"{nombre_prof} {apellido_prof}".strip()

                    if prof_id_en_tabla and pd.notna(prof_id_en_tabla):
                        profesor_asignado = self.profesores_map_id.get(prof_id_en_tabla)
                        if not profesor_asignado:
                             print(f"Advertencia Req {req_id}: Profesor ID '{prof_id_en_tabla}' no encontrado en la lista de profesores.")
                             # Podríamos intentar buscar por nombre como fallback
                             if prof_nombre_completo in self.profesores_map_nombre:
                                 profesor_asignado = self.profesores_map_nombre[prof_nombre_completo]
                                 print(f"--> Encontrado por nombre: '{prof_nombre_completo}'")
                             else:
                                print(f"--> Tampoco encontrado por nombre. Omitiendo requisito.")
                                requisitos_omitidos += 1
                                continue
                        # else: # Verificación opcional si nombre e ID coinciden
                        #    if profesor_asignado.nombre != prof_nombre_completo and prof_nombre_completo:
                        #         print(f"Advertencia Req {req_id}: Nombre de profesor en tabla ('{prof_nombre_completo}') no coincide con nombre para ID {prof_id_en_tabla} ('{profesor_asignado.nombre}').")
                    elif prof_nombre_completo:
                         # Buscar solo por nombre si no hay ID en tabla_minable
                         profesor_asignado = self.profesores_map_nombre.get(prof_nombre_completo)
                         if not profesor_asignado:
                             print(f"Advertencia Req {req_id}: Profesor '{prof_nombre_completo}' no encontrado y no hay profesor_id. Omitiendo requisito.")
                             requisitos_omitidos += 1
                             continue
                    else:
                         # Ni ID ni nombre
                         print(f"Advertencia Req {req_id}: No se especificó profesor (ni por ID ni por nombre). Omitiendo requisito.")
                         requisitos_omitidos += 1
                         continue

                    # --- Extraer otros datos ---
                    materia_id = row.get('materia_id', '')
                    materia_nombre = row.get('nombre_materia', '')
                    nivel = row.get('nivel', '')
                    curso_id = row.get('curso_id', '') # Grupo específico
                    seccion = row.get('seccion', '') # Contexto materia

                    inscritos_str = str(row.get('inscritos', '0')).strip()
                    required_slots_str = str(row.get('horas_semanales_tipicas', '0')).strip()
                    slots_per_session_str = str(row.get('duracion_sesion_horas', '1')).strip() # Default 1
                    frecuencia_str = str(row.get('frecuencia_semanal', '0')).strip()

                    # Convertir a números con validación
                    try:
                        inscritos = int(float(inscritos_str))
                        required_slots = int(float(required_slots_str))
                        slots_per_session = int(float(slots_per_session_str))
                        frecuencia = int(float(frecuencia_str))
                        if slots_per_session <= 0: slots_per_session = 1
                    except (ValueError, TypeError) as e:
                        print(f"Advertencia Req {req_id}: Error convirtiendo números (inscritos, horas, duracion, frec): {e}. Omitiendo.")
                        requisitos_omitidos += 1
                        continue

                    # Validar consistencia de horas
                    if required_slots > 0 and frecuencia * slots_per_session != required_slots:
                        print(f"Advertencia Req {req_id}: Horas semanales ({required_slots}) no coincide con frecuencia ({frecuencia}) * duración ({slots_per_session}). Se usará required_slots={required_slots}.")
                    elif required_slots <= 0:
                         print(f"Advertencia Req {req_id}: Horas semanales es 0 o negativo ({required_slots}). Omitiendo.")
                         requisitos_omitidos += 1
                         continue

                    shared_class_group = row.get('clase_compartida', 'Individual')
                    if pd.isna(shared_class_group) or shared_class_group.lower() == 'individual':
                        shared_class_group = None
                    # else: # Limpiar por si acaso
                    #     shared_class_group = shared_class_group.strip()

                    is_orquestal = curso_id.lower() == 'orquestal' # Ajustar si la condición es diferente

                    # Calcular slots permitidos (usa función auxiliar)
                    allowed_slots = self._get_allowed_slots(row)
                    if not allowed_slots:
                         print(f"Advertencia Req {req_id}: No se pudieron determinar slots válidos. Omitiendo requisito.")
                         requisitos_omitidos += 1
                         continue

                    # --- Crear objeto RequisitoClase ---
                    requisito = RequisitoClase(
                        id=req_id,
                        profesor_asignado=profesor_asignado,
                        materia_id=materia_id,
                        materia_nombre=materia_nombre,
                        nivel=nivel,
                        curso_id=curso_id,
                        seccion=seccion,
                        inscritos=inscritos,
                        required_slots=required_slots,
                        slots_per_session=slots_per_session,
                        allowed_slots=allowed_slots,
                        shared_class_group=shared_class_group,
                        is_orquestal=is_orquestal
                    )
                    requisitos_cargados.append(requisito)
                    ids_requisitos_cargados.add(req_id)

                except KeyError as e:
                    print(f"Advertencia: Falta la columna '{e}' al procesar fila {index+2} (Req ID: {req_id if req_id else 'N/A'}). Omitiendo requisito.")
                    requisitos_omitidos += 1
                except (ValueError, TypeError) as e:
                     print(f"Advertencia: Error de tipo/formato al procesar fila {index+2} (Req ID: {req_id if req_id else 'N/A'}): {e}. Omitiendo requisito.")
                     requisitos_omitidos += 1
                except Exception as e:
                     print(f"Advertencia: Error inesperado procesando fila {index+2} (Req ID: {req_id if req_id else 'N/A'}): {e}. Omitiendo requisito.")
                     requisitos_omitidos += 1


            self.requisitos = requisitos_cargados
            print(f"Carga finalizada. Requisitos válidos: {len(self.requisitos)}. Filas omitidas/con error: {requisitos_omitidos}")
            if not self.requisitos:
                 # Decidir si lanzar error o permitir continuar con 0 requisitos
                 print("Error fatal: No se cargaron requisitos de clase válidos.")
                 raise DataLoaderError("No se cargaron requisitos de clase válidos.")
                 # return [] # Alternativa: devolver lista vacía

            # Agrupar requisitos por grupo compartido para fácil acceso posterior
            self.shared_groups = {}
            if self.requisitos:
                for req in self.requisitos:
                    if req.shared_class_group:
                        self.shared_groups.setdefault(req.shared_class_group, []).append(req)

            return self.requisitos

        except FileNotFoundError:
             raise DataLoaderError(f"Archivo de requisitos no encontrado: {archivo_csv}")
        except KeyError as e: # Capturar KeyErrors que ocurren al acceder a df antes del bucle
             raise DataLoaderError(f"Columna esperada no encontrada en {archivo_csv} (puede ser de días u otra): {e}")
        except Exception as e:
            # Loggear el traceback completo podría ser útil aquí
            import traceback
            print(f"Error fatal inesperado al cargar requisitos desde {archivo_csv}: {e}")
            traceback.print_exc()
            raise DataLoaderError(f"Error fatal inesperado al cargar requisitos desde {archivo_csv}: {e}")

    def get_shared_groups(self):
         """Devuelve el diccionario de grupos compartidos."""
         return getattr(self, 'shared_groups', {})

# --- Fin de DataLoader ---