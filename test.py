#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script de prueba para el sistema de generación de horarios.
Este script puede ser usado para probar el sistema con datos sintéticos 
cuando no se dispone de los archivos Excel reales.
"""

import os
import random
import pandas as pd
from main import main

def generar_datos_prueba():
    """
    Genera archivos Excel con datos de prueba para el sistema.
    """
    print("Generando datos de prueba...")
    
    # Crear directorio db si no existe
    if not os.path.exists("db"):
        os.makedirs("db")
    
    # Generar datos de profesores
    num_profesores = 20
    
    # Secciones posibles
    secciones = ["Dirección", "Guitarra", "Piano", "Violín", "Canto", "Percusión", "Teoría Musical"]
    categorias = ["Item", "Sin Item"]
    
    profesores_data = []
    for i in range(1, num_profesores + 1):
        # Asignar una sección aleatoria
        seccion = random.choice(secciones)
        
        # Decidir categoría (Item o Sin Item)
        categoria = random.choice(categorias)
        
        profesor = {
            'profesor_id': 1000 + i,
            'nombre': f"Nombre{i}",
            'apellido': f"Apellido{i}",
            'seccion': seccion,
            'categoria': categoria
        }
        
        profesores_data.append(profesor)
    
    df_profesores = pd.DataFrame(profesores_data)
    df_profesores.to_excel("db/Profesor.xlsx", index=False)
    print(f"Generado: db/Profesor.xlsx con {num_profesores} profesores")
    
    # Generar datos de salas
    num_salas = 15
    tipos_sala = ["Regular", "Teclado", "Percusión", "Ensamble", "Coro"]
    niveles = ["Infantil", "Todos"]
    
    salas_data = []
    for i in range(1, num_salas + 1):
        # Generar nombre de sala
        prefijo = "F" if i <= 5 else "B"
        numero = 100 + i
        sala_id = f"{prefijo}-{numero}"
        
        # Distribución de niveles
        nivel = "Infantil" if i <= 5 else "Todos"
        
        # Tipo de sala
        tipo_sala = tipos_sala[0] if i % 5 == 0 else random.choice(tipos_sala)
        
        capacidad = random.randint(20, 40)
        
        sala = {
            'sala_id': sala_id,
            'capacidad': capacidad,
            'tipo_sala': tipo_sala,
            'nombre_nivel': nivel
        }
        
        salas_data.append(sala)
    
    df_salas = pd.DataFrame(salas_data)
    df_salas.to_excel("db/Sala.xlsx", index=False)
    print(f"Generado: db/Sala.xlsx con {num_salas} salas")
    
    # Generar datos de materias y secciones
    num_materias = 10
    niveles_materia = ["Infantil", "Básico", "Intermedio", "Avanzado"]
    tipos_materia = ["Regular", "Especialidad", "Taller", "Grupal"]
    cursos = ["1°Inf", "2°Inf", "1°Bas", "2°Bas", "3°Bas"]
    secciones_curso = ["A", "B", "C"]
    
    materias_data = []
    requisito_id = 25000
    
    for i in range(1, num_materias + 1):
        # Crear ID de materia
        prefijo_materia = random.choice(["CI", "GM", "IM", "TA"])
        tipo_materia_id = random.choice(["IC", "GT", "PI", "VI", "PE"])
        materia_id = f"{prefijo_materia}-{tipo_materia_id}-{i:03d}"
        
        # Seleccionar nivel
        nivel = random.choice(niveles_materia)
        tipo_materia = random.choice(tipos_materia)
        
        # Número de horas y frecuencia
        horas_semanales = random.randint(1, 4)
        frecuencia = random.randint(1, horas_semanales)
        duracion_sesion = horas_semanales / frecuencia
        
        # Para cada curso y sección
        for curso in random.sample(cursos, 2):  # Seleccionar 2 cursos aleatoriamente
            for seccion in random.sample(secciones_curso, 2):  # Seleccionar 2 secciones aleatoriamente
                requisito_id += 1
                
                # Generar horarios posibles
                horario_entrada = f"{random.randint(8, 18):02d}:00:00"
                horario_salida = f"{random.randint(int(horario_entrada.split(':')[0]) + 1, 20):02d}:00:00"
                
                # Decidir días disponibles (al menos uno debe ser True)
                while True:
                    dias = {
                        'lunes': random.choice([0, 1]),
                        'martes': random.choice([0, 1]),
                        'miercoles': random.choice([0, 1]),
                        'jueves': random.choice([0, 1]),
                        'viernes': random.choice([0, 1])
                    }
                    if sum(dias.values()) > 0:
                        break
                
                materia = {
                    'requisito_id': requisito_id,
                    'curso_id': f"{curso} ({seccion})",
                    'materia_id': materia_id,
                    'nivel': nivel,
                    'inscritos': random.randint(5, 25),
                    'nombre_materia': f"{prefijo_materia.replace('CI', 'Canto').replace('GM', 'Guitarra').replace('IM', 'Instrumento').replace('TA', 'Taller')} {nivel}",
                    'cantidad_docente': random.randint(1, 3),
                    'seccion': random.choice(["Todos", "A", "B", "C"]),
                    'clase_compartida': random.choice(["Individual", "Grupal"]),
                    'tipo_materia': tipo_materia,
                    'horas_semanales_tipicas': horas_semanales,
                    'frecuencia_semanal': frecuencia,
                    'duracion_sesion_horas': duracion_sesion,
                    'horario_entrada': horario_entrada,
                    'horario_salida': horario_salida,
                    'lunes': dias['lunes'],
                    'martes': dias['martes'],
                    'miercoles': dias['miercoles'],
                    'jueves': dias['jueves'],
                    'viernes': dias['viernes']
                }
                
                materias_data.append(materia)
    
    df_materias = pd.DataFrame(materias_data)
    df_materias.to_excel("db/tabla_minable.xlsx", index=False)
    print(f"Generado: db/tabla_minable.xlsx con {len(materias_data)} materias-secciones")
    
    print("Datos de prueba generados correctamente!")

if __name__ == "__main__":
    # Verificar si existen los archivos Excel
    files_exist = (
        os.path.exists("db/Profesor.xlsx") and
        os.path.exists("db/tabla_minable.xlsx") and
        os.path.exists("db/Sala.xlsx")
    )
    
    if not files_exist:
        # Generar datos de prueba
        generar_datos_prueba()
    
    # Ejecutar el programa principal
    main()#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script de prueba para el sistema de generación de horarios.
Este script puede ser usado para probar el sistema con datos sintéticos 
cuando no se dispone de los archivos Excel reales.
"""

import os
import random
import pandas as pd
from main import main

def generar_datos_prueba():
    """
    Genera archivos Excel con datos de prueba para el sistema.
    """
    print("Generando datos de prueba...")
    
    # Crear directorio db si no existe
    if not os.path.exists("db"):
        os.makedirs("db")
    
    # Generar datos de profesores
    num_profesores = 20
    
    profesores_data = []
    for i in range(1, num_profesores + 1):
        # Decidir si tiene ítem
        tiene_item = random.choice([True, False])
        
        # Generar especialidades (materias que puede impartir)
        num_especialidades = random.randint(1, 5)
        especialidades = random.sample(range(1, 11), num_especialidades)
        
        profesor = {
            'ID': i,
            'Nombre': f"Profesor {i}",
            'Item': tiene_item
        }
        
        # Agregar especialidades
        for j, materia_id in enumerate(especialidades):
            profesor[f'Materia_{materia_id}'] = True
        
        profesores_data.append(profesor)
    
    df_profesores = pd.DataFrame(profesores_data)
    df_profesores.to_excel("db/Profesor.xlsx", index=False)
    print(f"Generado: db/Profesor.xlsx con {num_profesores} profesores")
    
    # Generar datos de materias y secciones
    num_materias = 10
    num_secciones = 5
    niveles = ['infantil', 'primaria', 'secundaria', 'bachillerato']
    
    materias_data = []
    for i in range(1, num_materias + 1):
        nivel = random.choice(niveles)
        horas_semanales = random.randint(2, 6)
        
        # Generar para cada sección
        for seccion in [chr(65 + j) for j in range(num_secciones)]:  # A, B, C, D, E
            # Decidir si requiere profesor específico
            if random.random() < 0.2:  # 20% de probabilidad
                profesor_especifico = random.randint(1, num_profesores)
            else:
                profesor_especifico = None
            
            materia = {
                'ID_Materia': i,
                'Nombre': f"Materia {i}",
                'Nivel': nivel,
                'Horas_Semanales': horas_semanales,
                'Seccion': seccion,
                'Profesor_Especifico': profesor_especifico
            }
            
            materias_data.append(materia)
    
    df_materias = pd.DataFrame(materias_data)
    df_materias.to_excel("db/tabla_minable.xlsx", index=False)
    print(f"Generado: db/tabla_minable.xlsx con {len(materias_data)} materias-secciones")
    
    # Generar datos de salas
    num_salas = 15
    
    salas_data = []
    for i in range(1, num_salas + 1):
        # Distribución de niveles
        if i <= 3:
            nivel = 'infantil'
        else:
            nivel = random.choice(niveles)
        
        capacidad = random.randint(20, 40)
        
        sala = {
            'ID': i,
            'Nombre': f"Sala {i}",
            'Nivel': nivel,
            'Capacidad': capacidad
        }
        
        salas_data.append(sala)
    
    df_salas = pd.DataFrame(salas_data)
    df_salas.to_excel("db/Sala.xlsx", index=False)
    print(f"Generado: db/Sala.xlsx con {num_salas} salas")
    
    print("Datos de prueba generados correctamente!")

if __name__ == "__main__":
    # Verificar si existen los archivos Excel
    files_exist = (
        os.path.exists("db/Profesor.xlsx") and
        os.path.exists("db/tabla_minable.xlsx") and
        os.path.exists("db/Sala.xlsx")
    )
    
    if not files_exist:
        # Generar datos de prueba
        generar_datos_prueba()
    
    # Ejecutar el programa principal
    main()