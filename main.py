from utils.data_loader import TimetablingSolver
  


def resolver_timetabling(csv_content, tam_poblacion=100, generaciones=200, tasa_mutacion=0.15):
    """Función principal para resolver el problema de timetabling."""
    # Crear instancia del solucionador
    solver = TimetablingSolver(csv_content)
    
    print("Cargando datos...")
    if not solver.cargar_datos():
        print("Error al cargar los datos. Abortando.")
        return None
    
    print("\nIniciando resolución...")
    
    # Resolver
    mejor_horario = solver.resolver(
        tam_poblacion=tam_poblacion,
        generaciones=generaciones,
        tasa_mutacion=tasa_mutacion
    )
    
    # Verificar y mostrar resultados
    es_valido = solver.imprimir_informe(mejor_horario)
    
    # Generar visualización del horario
    html = solver.generar_visualizacion_html(mejor_horario)
    
    return {
        'solucion_valida': es_valido,
        'horario': mejor_horario,
        'html': html
    }


# Ejecutar si se llama como script principal
if __name__ == "__main__":
    # Leer el archivo CSV
    try:
        with open("tabla_minable.csv", "r", encoding="cp1252") as file:
            csv_content = file.read()
            
        resultado = resolver_timetabling(csv_content)
        
        if resultado and resultado['solucion_valida']:
            print("\n¡Solución válida encontrada!")
            
            # Guardar visualización HTML
            with open("horarios.html", "w", encoding="utf-8") as file:
                file.write(resultado['html'])
            print("Visualización HTML generada en horarios.html")
        else:
            print("\nNo se pudo encontrar una solución válida.")
            
    except Exception as e:
        print(f"Error al ejecutar: {e}")