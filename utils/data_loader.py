# -*- coding: utf-8 -*-
# filename: utils/data_loader.py

import os
import pandas as pd
import numpy as np
import datetime
# Asegúrate que las rutas de importación sean correctas
from model.profesor import Profesor
from model.sala import Sala
from model.requisito_clase import RequisitoClase
from config import DIAS_SEMANA, HORAS_DIA

# ... (DataLoaderError y __init__ sin cambios) ...
class DataLoaderError(Exception): pass

class DataLoader:
    def __init__(self, config_horas_dia=HORAS_DIA, config_dias_semana=DIAS_SEMANA):
        self.profesores_map_id = {}
        self.profesores_map_nombre = {}
        self.salas_map_id = {}
        self.requisitos = []
        self.dias_semana = config_dias_semana
        try: self.slots_info = self._procesar_slots_config(config_horas_dia)
        except DataLoaderError as e: print(f"Error fatal inicializando: {e}"); raise

    # _procesar_slots_config, _map_time_to_slot_index, _get_allowed_slots sin cambios desde la versión .xlsx
    def _procesar_slots_config(self, horas_dia_config):
        slots = {}
        if not horas_dia_config: raise DataLoaderError("HORAS_DIA vacía.")
        for i, slot_str in enumerate(horas_dia_config):
            try:
                parts = slot_str.split('-'); start_str, end_str = parts[0], parts[1]
                base_date = datetime.date(2024, 1, 1)
                start_time = datetime.datetime.combine(base_date, datetime.datetime.strptime(start_str.strip(), '%H:%M').time())
                end_time = datetime.datetime.combine(base_date, datetime.datetime.strptime(end_str.strip(), '%H:%M').time())
                if end_time <= start_time: print(f"Advertencia: Slot {slot_str} fin <= inicio.")
                slots[i] = {'idx': i, 'start': start_time, 'end': end_time, 'label': slot_str}
            except Exception as e: raise DataLoaderError(f"Error procesando slot '{slot_str}': {e}")
        if not slots: raise DataLoaderError("No se procesaron slots.")
        return slots

    def _map_time_to_slot_index(self, time_obj):
        base_date = datetime.date(2024, 1, 1)
        target_time = datetime.datetime.combine(base_date, time_obj)
        for idx, info in self.slots_info.items():
            if info['start'] <= target_time < info['end']: return idx
        return None

    def _get_allowed_slots(self, row):
        allowed_slots = []
        req_id_debug = row.get('requisito_id', 'N/A')
        try:
            start_window, end_window = None, None
            start_window_val = row['horario_entrada']; end_window_val = row['horario_salida']
            time_formats = ['%H:%M:%S', '%H:%M']
            if isinstance(start_window_val, datetime.time): start_window = start_window_val
            else:
                for fmt in time_formats:
                    try: start_window = datetime.datetime.strptime(str(start_window_val).strip(), fmt).time(); break
                    except ValueError: continue
            if isinstance(end_window_val, datetime.time): end_window = end_window_val
            else:
                for fmt in time_formats:
                    try: end_window = datetime.datetime.strptime(str(end_window_val).strip(), fmt).time(); break
                    except ValueError: continue
            if start_window is None or end_window is None: raise ValueError("Formato hora no reconocido")

            base_date = datetime.date(2024, 1, 1)
            start_window_dt = datetime.datetime.combine(base_date, start_window)
            end_window_dt = datetime.datetime.combine(base_date, end_window)
            if end_window_dt <= start_window_dt: end_window_dt = start_window_dt + datetime.timedelta(minutes=45) # Ajuste mínimo

            allowed_days_indices = []
            day_cols_map = {d.lower(): i for i, d in enumerate(self.dias_semana)}
            for excel_col in row.index:
                col_lower = str(excel_col).lower()
                if col_lower in day_cols_map:
                    if pd.notna(row[excel_col]):
                        try:
                            if int(row[excel_col]) == 1 or str(row[excel_col]).lower() == 'true':
                                allowed_days_indices.append(day_cols_map[col_lower])
                        except (ValueError, TypeError): pass

            if not allowed_days_indices: return []

            for day_idx in allowed_days_indices:
                for slot_idx, slot_info in self.slots_info.items():
                    if start_window_dt <= slot_info['start'] < end_window_dt:
                        try: slots_needed = int(float(str(row.get('duracion_sesion_horas', '1')).strip()))
                        except: slots_needed = 1
                        if slots_needed <= 0: slots_needed = 1
                        can_fit = True; last_slot_time = slot_info['start']
                        if slots_needed > 0:
                            for i in range(slots_needed):
                                cur_idx = slot_idx + i
                                if cur_idx >= len(self.slots_info): can_fit = False; break
                                cur_info = self.slots_info[cur_idx]
                                if i == slots_needed - 1: last_slot_time = cur_info['end']
                                if i > 0 and cur_info['start'] != self.slots_info[cur_idx - 1]['end']: can_fit = False; break
                            if last_slot_time > end_window_dt: can_fit = False
                        else: can_fit = False
                        if can_fit: allowed_slots.append((day_idx, slot_idx))

        except Exception as e: print(f"Error procesando slots Req {req_id_debug}: {e}"); return []
        if not allowed_slots: print(f"Advertencia Req {req_id_debug}: No hay slots válidos.")
        return sorted(list(set(allowed_slots)))

    # cargar_profesores y cargar_salas sin cambios respecto a la versión anterior
    def cargar_profesores(self, archivo_xlsx):
        print(f"Cargando profesores desde: {archivo_xlsx}")
        try:
            df = pd.read_excel(archivo_xlsx, dtype={'profesor_id': str})
            df.columns = df.columns.str.strip().str.lower()
            initial_rows = len(df); df.dropna(subset=['profesor_id', 'nombre', 'apellido'], inplace=True); rows_dropped = initial_rows - len(df)
            if rows_dropped > 0: print(f"Advertencia: Se eliminaron {rows_dropped} filas de profesores vacías.")
            self.profesores_map_id = {}; self.profesores_map_nombre = {}
            for index, row in df.iterrows():
                row = row.copy()
                for col in df.select_dtypes(include=['object', 'string']).columns:
                     if pd.notna(row[col]): row[col] = str(row[col]).strip()
                prof_id = row.get('profesor_id'); nombre = row.get('nombre', ''); apellido = row.get('apellido', '')
                nombre_completo = f"{nombre} {apellido}".strip(); categoria = row.get('categoria', 'Contrato'); seccion_primaria = row.get('seccion', '')
                if isinstance(categoria, str) and categoria.lower() not in ['item', 'contrato']: categoria = 'Contrato'
                elif not isinstance(categoria, str): categoria = 'Contrato'
                profesor = Profesor( id=prof_id, nombre=nombre_completo, categoria=categoria.capitalize(), seccion_primaria=seccion_primaria )
                if prof_id in self.profesores_map_id: print(f"Advertencia: ID prof duplicado '{prof_id}'.")
                self.profesores_map_id[prof_id] = profesor
                if nombre_completo not in self.profesores_map_nombre: self.profesores_map_nombre[nombre_completo] = profesor
                else: print(f"Advertencia: Nombre prof duplicado '{nombre_completo}'.")
            print(f"Profesores cargados: {len(self.profesores_map_id)}")
            if not self.profesores_map_id: raise DataLoaderError("No se cargaron profesores válidos.")
            return list(self.profesores_map_id.values())
        except FileNotFoundError: raise DataLoaderError(f"Archivo profesores no encontrado: {archivo_xlsx}")
        except KeyError as e: raise DataLoaderError(f"Columna faltante en {archivo_xlsx}: {e}")
        except Exception as e: import traceback; print(f"Error inesperado cargando profesores:"); traceback.print_exc(); raise DataLoaderError(f"Error inesperado cargando profesores: {e}")

    def cargar_salas(self, archivo_xlsx):
        print(f"Cargando salas desde: {archivo_xlsx}")
        try:
            df = pd.read_excel( archivo_xlsx, dtype={'sala_id': str} ); df.columns = df.columns.str.strip().str.lower(); self.salas_map_id = {}
            initial_rows = len(df); df.dropna(subset=['sala_id'], inplace=True); rows_dropped = initial_rows - len(df)
            if rows_dropped > 0: print(f"Advertencia: Se eliminaron {rows_dropped} filas de salas vacías.")
            for index, row in df.iterrows():
                row = row.copy()
                for col in df.select_dtypes(include=['object', 'string']).columns:
                     if pd.notna(row[col]): row[col] = str(row[col]).strip()
                sala_id = row.get('sala_id');
                if 'capacidad' not in df.columns: raise DataLoaderError("Archivo salas falta 'capacidad'.")
                capacidad_val = row.get('capacidad', '0'); tipo_sala = row.get('tipo_sala', 'Regular'); nombre_nivel = row.get('nombre_nivel', 'Todos')
                try: capacidad = int(float(capacidad_val))
                except: print(f"Advertencia: Capacidad inválida sala {sala_id}. Usando 0."); capacidad = 0
                equipamiento = []
                if isinstance(tipo_sala, str) and tipo_sala.lower() != 'regular' and tipo_sala: equipamiento = [eq.strip() for eq in tipo_sala.split(',')]
                sala = Sala( id=sala_id, nombre=sala_id, capacidad=capacidad, nivel=str(nombre_nivel).lower(), equipamiento=equipamiento )
                if sala_id in self.salas_map_id: print(f"Advertencia: ID sala duplicado '{sala_id}'.")
                self.salas_map_id[sala_id] = sala
            print(f"Salas cargadas: {len(self.salas_map_id)}")
            if not self.salas_map_id: raise DataLoaderError("No se cargaron salas válidas.")
            return list(self.salas_map_id.values())
        except FileNotFoundError: raise DataLoaderError(f"Archivo salas no encontrado: {archivo_xlsx}")
        except KeyError as e: raise DataLoaderError(f"Columna faltante en {archivo_xlsx}: {e}")
        except Exception as e: import traceback; print(f"Error inesperado cargando salas:"); traceback.print_exc(); raise DataLoaderError(f"Error inesperado cargando salas: {e}")

    def cargar_requisitos_clase(self, archivo_xlsx):
        """Carga los requisitos de clase desde tabla_minable (.xlsx)."""
        print(f"Cargando requisitos de clase desde: {archivo_xlsx}")
        # *** YA NO NECESITA 'profesor_id', pero SÍ necesita profesores cargados ***
        if not self.profesores_map_id:
             raise DataLoaderError("Se deben cargar los profesores antes.")

        try:
            dtypes = {'requisito_id': str} # Ya no necesitamos dtype para profesor_id
            df = pd.read_excel(archivo_xlsx, dtype=dtypes)
            df.columns = df.columns.str.strip().str.lower()

            # Verificar columnas de días
            day_cols = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']
            for col in day_cols:
                if col not in df.columns:
                    col_cap = col.capitalize(); found = False
                    if col_cap in df.columns: df.rename(columns={col_cap: col}, inplace=True); found=True
                    else:
                         for config_day in DIAS_SEMANA:
                             if config_day.lower() == col and config_day in df.columns:
                                 df.rename(columns={config_day: col}, inplace=True); found=True; break
                    if not found: raise KeyError(f"Falta columna de día: {col}")

            # Eliminar filas con requisito_id vacío
            initial_rows = len(df)
            df.dropna(subset=['requisito_id'], inplace=True)
            rows_dropped = initial_rows - len(df)
            if rows_dropped > 0: print(f"Advertencia: Se eliminaron {rows_dropped} filas de tabla_minable por requisito_id vacío.")

            requisitos_cargados = []
            requisitos_omitidos = 0
            ids_requisitos_cargados = set()

            lista_profesores = list(self.profesores_map_id.values())

            print(f"Procesando {len(df)} filas de {archivo_xlsx}...")
            for index, row in df.iterrows():
                # Limpieza y conversión numérica
                row = row.copy()
                for col in df.select_dtypes(include=['object', 'string']).columns:
                     if pd.notna(row[col]): row[col] = str(row[col]).strip()
                numeric_cols_to_try = ['inscritos', 'horas_semanales_tipicas', 'duracion_sesion_horas', 'frecuencia_semanal', 'cantidad_docente'] + day_cols
                for col in numeric_cols_to_try:
                    if col in row.index: # Verificar si la columna existe
                        if isinstance(row[col], str):
                            try:
                                val_float = float(row[col])
                                row[col] = int(val_float) if val_float.is_integer() else int(val_float) # Truncar float
                            except (ValueError, TypeError): pass
                        elif pd.isna(row[col]): # Poner default si es NA
                             if col in ['inscritos', 'horas_semanales_tipicas', 'frecuencia_semanal']: row[col] = 0
                             elif col in ['duracion_sesion_horas', 'cantidad_docente']: row[col] = 1
                             elif col in day_cols: row[col] = 0


                req_id = row.get('requisito_id')
                if not req_id or req_id in ids_requisitos_cargados: continue

                try:
                    # --- Determinar Profesores Elegibles por SECCION ---
                    requisito_seccion_val = row.get('seccion') # Obtener valor
                    if pd.isna(requisito_seccion_val):
                        print(f"Advertencia Req {req_id}: Columna 'seccion' vacía. Asumiendo 'Todos'.")
                        requisito_seccion = 'todos'
                    else:
                        requisito_seccion = str(requisito_seccion_val).strip().lower()

                    profesores_elegibles = []
                    for prof in lista_profesores:
                         prof_seccion = getattr(prof, 'seccion_primaria', '').lower()
                         # Lógica de Matching: Coincidencia exacta O requisito es 'todos'
                         if requisito_seccion == 'todos' or requisito_seccion == prof_seccion:
                              profesores_elegibles.append(prof)

                    if not profesores_elegibles:
                         # Si nadie coincide exactamente y NO es 'todos', quizás flexibilizar?
                         # Por ahora, omitimos si no hay elegibles estrictos.
                         print(f"Advertencia Req {req_id}: No se encontraron profesores elegibles para sección '{requisito_seccion}'. Omitiendo.")
                         requisitos_omitidos += 1
                         continue
                    # -----------------------------------------------------

                    # --- Extraer otros datos y validar ---
                    required_cols_check = ['materia_id', 'nombre_materia', 'nivel', 'curso_id', 'seccion',
                                           'inscritos', 'horas_semanales_tipicas', 'duracion_sesion_horas',
                                           'frecuencia_semanal', 'clase_compartida', 'horario_entrada', 'horario_salida',
                                           'cantidad_docente'] + day_cols
                    missing_cols = [col for col in required_cols_check if col not in df.columns]
                    if missing_cols: print(f"Advertencia Req {req_id}: Faltan columnas: {missing_cols}. Omitiendo."); requisitos_omitidos += 1; continue

                    materia_id = row.get('materia_id', '')
                    materia_nombre = row.get('nombre_materia', '')
                    nivel = row.get('nivel', '')
                    curso_id = row.get('curso_id', '')
                    seccion = row.get('seccion', '') # Guardamos la sección original del requisito
                    cantidad_docente_val = row.get('cantidad_docente', 1)
                    inscritos_val = row.get('inscritos', 0)
                    required_slots_val = row.get('horas_semanales_tipicas', 0)
                    slots_per_session_val = row.get('duracion_sesion_horas', 1)
                    frecuencia_val = row.get('frecuencia_semanal', 0)
                    try:
                        inscritos = int(float(inscritos_val))
                        required_slots = int(float(required_slots_val))
                        slots_per_session = int(float(slots_per_session_val))
                        frecuencia = int(float(frecuencia_val))
                        cantidad_docente = int(float(cantidad_docente_val))
                        if slots_per_session <= 0: slots_per_session = 1
                        if cantidad_docente <= 0: cantidad_docente = 1
                    except (ValueError, TypeError) as e: print(f"Advertencia Req {req_id}: Error convirtiendo números: {e}. Omitiendo."); requisitos_omitidos += 1; continue

                    # Validaciones de horas
                    if required_slots > 0 and frecuencia > 0 and slots_per_session > 0 and frecuencia * slots_per_session != required_slots: print(f"Advertencia Req {req_id}: Hrs sem ({required_slots}) != Freq ({frecuencia}) * Dur ({slots_per_session}).")
                    elif required_slots <= 0: print(f"Advertencia Req {req_id}: Hrs sem <= 0. Omitiendo."); requisitos_omitidos += 1; continue
                    elif frecuencia <= 0 or slots_per_session <= 0: print(f"Advertencia Req {req_id}: Freq o Dur <= 0. Omitiendo."); requisitos_omitidos += 1; continue

                    shared_class_group = row.get('clase_compartida', 'Individual')
                    if pd.isna(shared_class_group) or str(shared_class_group).lower() == 'individual': shared_class_group = None
                    else: shared_class_group = str(shared_class_group).strip()
                    is_orquestal = str(curso_id).lower() == 'orquestal'
                    allowed_slots = self._get_allowed_slots(row)
                    if not allowed_slots: print(f"Advertencia Req {req_id}: No hay slots válidos. Omitiendo."); requisitos_omitidos += 1; continue

                    # --- Crear objeto RequisitoClase ---
                    requisito = RequisitoClase(
                        id=req_id,
                        profesores_elegibles=profesores_elegibles, # Lista de elegibles
                        cantidad_docente=cantidad_docente,
                        materia_id=materia_id, materia_nombre=materia_nombre, nivel=nivel,
                        curso_id=curso_id, seccion=seccion, # Guardar sección original
                        inscritos=inscritos, required_slots=required_slots,
                        slots_per_session=slots_per_session, allowed_slots=allowed_slots,
                        shared_class_group=shared_class_group, is_orquestal=is_orquestal
                    )
                    requisitos_cargados.append(requisito)
                    ids_requisitos_cargados.add(req_id)

                # ... (Manejo de excepciones igual) ...
                except KeyError as e: print(f"Advertencia: Falta columna '{e}' fila {index+2} (Req ID: {req_id}). Omitiendo."); requisitos_omitidos += 1
                except (ValueError, TypeError) as e: print(f"Advertencia: Error tipo/formato fila {index+2} (Req ID: {req_id}): {e}. Omitiendo."); requisitos_omitidos += 1
                except Exception as e: print(f"Advertencia: Error inesperado fila {index+2} (Req ID: {req_id}): {e}. Omitiendo."); requisitos_omitidos += 1


            self.requisitos = requisitos_cargados
            print(f"Carga finalizada. Requisitos válidos: {len(self.requisitos)}. Filas omitidas/con error: {requisitos_omitidos}")
            if not self.requisitos:
                 print("Error fatal: No se cargaron requisitos de clase válidos.")
                 raise DataLoaderError("No se cargaron requisitos de clase válidos.")
            self.shared_groups = {}
            if self.requisitos:
                for req in self.requisitos:
                    if req.shared_class_group:
                        self.shared_groups.setdefault(req.shared_class_group, []).append(req)
            return self.requisitos

        except FileNotFoundError: raise DataLoaderError(f"Archivo requisitos no encontrado: {archivo_xlsx}")
        except KeyError as e: print(f"Error Clave/Columna en {archivo_xlsx}: {e}."); raise DataLoaderError(f"Columna faltante en {archivo_xlsx}: {e}")
        except ImportError: print("Error: Necesitas 'openpyxl'."); raise DataLoaderError("Falta 'openpyxl'.")
        except Exception as e: import traceback; print(f"Error fatal cargando requisitos:"); traceback.print_exc(); raise DataLoaderError(f"Error fatal cargando requisitos: {e}")

    def get_shared_groups(self):
         return getattr(self, 'shared_groups', {})

# --- Fin de DataLoader ---