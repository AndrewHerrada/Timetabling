# Dashboard de Análisis Evolutivo - Manual de Usuario

## Descripción General

El Dashboard de Análisis Evolutivo es una herramienta de visualización diseñada para monitorear y analizar el rendimiento de algoritmos genéticos aplicados a problemas de timetabling. Permite cargar y visualizar datos generados por el algoritmo, facilitando el análisis del proceso evolutivo, la convergencia y el cumplimiento de restricciones.

## Requisitos

- Navegador web moderno (Chrome, Firefox, Edge, Safari)
- Archivo JSON con datos evolutivos generados por el algoritmo genético

## Instalación

1. Clona este repositorio o descarga los archivos
2. No requiere instalación adicional - simplemente abre `index.html` en tu navegador

## Archivos incluidos

- `index.html` - Interfaz principal del dashboard
- `styles.css` - Estilos visuales
- `scripts.js` - Lógica de procesamiento y visualización

## Uso Básico

### Cargar Datos

El dashboard ofrece tres métodos para cargar datos:

1. **Cargar archivo JSON**:
   - Haz clic en "Seleccionar archivo JSON"
   - Selecciona el archivo `evolucion-data.json` generado por el algoritmo

2. **Pegar contenido JSON**:
   - Copia el contenido JSON
   - Pégalo en el área de texto
   - Haz clic en "Procesar datos JSON"

3. **Usar datos de ejemplo**:
   - Haz clic en "Cargar Datos de Ejemplo" para visualizar un conjunto de datos predefinido

### Navegación

El dashboard está organizado en cinco pestañas principales:

1. **Evolución del fitness**: Muestra la progresión del fitness a lo largo de las generaciones
2. **Diversidad genética**: Visualiza los patrones de diversidad y su impacto
3. **Operadores genéticos**: Analiza el rendimiento de los operadores (cruzamiento y mutación)
4. **Restricciones**: Evalúa el cumplimiento de las diferentes restricciones
5. **Convergencia**: Analiza la velocidad de convergencia y los periodos de estancamiento

## Descripción de las Visualizaciones

### Evolución del fitness

- **Evolución del fitness**: Gráfico que muestra el mejor fitness y el fitness promedio a lo largo de las generaciones
- **Mejora relativa**: Muestra el porcentaje de mejora entre generaciones consecutivas
- **Distribución del fitness**: Histograma de la distribución de fitness en la población final
- **Estadísticas clave**: Fitness final, total de generaciones, mejora total y generación de convergencia

### Diversidad genética

- **Evolución de la diversidad**: Muestra cómo cambia la diversidad genética a lo largo del tiempo
- **Diversidad vs. Fitness**: Gráfico de dispersión que relaciona diversidad y fitness promedio
- **Efecto de la diversidad**: Analiza cómo el nivel de diversidad afecta a la tasa de mejora

### Operadores genéticos

- **Tasa de Éxito del cruzamiento**: Muestra la efectividad del operador de cruzamiento
- **Tasa de Éxito de la mutación**: Muestra la efectividad del operador de mutación
- **Comparación de operadores**: Análisis comparativo del rendimiento de ambos operadores

### Restricciones

- **Cumplimiento de restricciones**: Barras de progreso que muestran el nivel de cumplimiento de cada restricción
- **Evolución del cumplimiento**: Gráfico temporal de la satisfacción de restricciones
- **Restricciones más difíciles**: Identifica las restricciones más difíciles de satisfacer

### Convergencia

- **Periodos de estancamiento**: Visualiza duración y fitness alcanzado en cada periodo
- **Tasas de mejora**: Muestra las tasas de mejora a lo largo del tiempo
- **Velocidad de convergencia**: Gráfico que muestra qué tan rápido se acerca al fitness final
- **Tabla de Estancamiento**: Resumen de los periodos más significativos de estancamiento

## Interpretación de los Datos

- **Fitness creciente**: Indica que el algoritmo está mejorando con el tiempo
- **Periodos de estancamiento**: Sugieren posibles mejoras en los operadores genéticos
- **Baja diversidad + estancamiento**: Puede indicar convergencia prematura
- **Restricciones difíciles**: Señalan áreas donde el algoritmo encuentra mayores dificultades

## Soporte

Si tienes problemas o preguntas:
1. Revisa que el formato JSON sea correcto y compatible con el dashboard
2. Verifica que los archivos estén en el mismo directorio
3. Prueba con el conjunto de datos de ejemplo para verificar la funcionalidad

## Licencia

Este proyecto está disponible bajo licencia MIT.

---

Desarrollado para la visualización y análisis de algoritmos genéticos aplicados a problemas de timetabling.
