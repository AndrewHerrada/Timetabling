// Manejar pestañas
document.addEventListener('DOMContentLoaded', function () {
    const tabs = document.querySelectorAll('.tab-item');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabs.forEach(tab => {
        tab.addEventListener('click', function () {
            // Desactivar todas las pestañas
            tabs.forEach(t => t.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            // Activar pestaña seleccionada
            this.classList.add('active');
            const targetPane = document.getElementById(this.dataset.tab);
            if (targetPane) {
                targetPane.classList.add('active');
            }
        });
    });

    // Event listeners para carga de archivos
    fileInput.addEventListener('change', handleFileUpload);
    processJsonBtn.addEventListener('click', handleJsonPaste);

    // Cargar ejemplo mínimo
    const sampleButton = document.createElement('button');
    sampleButton.className = 'btn';
    sampleButton.style.marginTop = '10px';
    sampleButton.style.marginLeft = '10px';
    sampleButton.textContent = 'Cargar Datos de Ejemplo';
    sampleButton.addEventListener('click', function () {
        // Cargar los datos del JSON de ejemplo (el proporcionado en el documento)
        fetch('evolucion-data.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error('No se pudo cargar el archivo de ejemplo');
                }
                return response.json();
            })
            .then(data => {
                processEvolutionData(data);
                showAlert(successAlert);
                mainContent.style.display = 'block';
            })
            .catch(error => {
                console.error('Error al cargar datos de ejemplo:', error);
                // Si falla la carga del archivo, intentar con datos mínimos
                loadMinimumSampleData();
            });
    });

    document.querySelector('.paste-area-container').appendChild(sampleButton);
});

// Función para cargar datos mínimos de ejemplo si no se encuentra el archivo
function loadMinimumSampleData() {
    // Datos de ejemplo mínimos basados en la estructura del JSON proporcionado
    const sampleData = {
        "fitnessHistory": [
            { "generation": 0, "bestFitness": 0.37, "avgFitness": 0.24 },
            { "generation": 50, "bestFitness": 0.85, "avgFitness": 0.70 },
            { "generation": 100, "bestFitness": 0.92, "avgFitness": 0.85 },
            { "generation": 150, "bestFitness": 0.94, "avgFitness": 0.88 },
            { "generation": 200, "bestFitness": 0.95, "avgFitness": 0.89 },
            { "generation": 250, "bestFitness": 0.96, "avgFitness": 0.90 },
            { "generation": 300, "bestFitness": 0.96, "avgFitness": 0.91 }
        ],
        "bestFitnessByGeneration": [
            0.37, 0.45, 0.52, 0.58, 0.64, 0.68, 0.72, 0.76, 0.79, 0.82,
            0.85, 0.87, 0.89, 0.90, 0.91, 0.92, 0.93, 0.93, 0.94, 0.94,
            0.95, 0.95, 0.95, 0.96, 0.96, 0.96, 0.96, 0.96, 0.96, 0.96
        ],
        "avgFitnessByGeneration": [
            0.24, 0.30, 0.36, 0.42, 0.48, 0.53, 0.58, 0.62, 0.66, 0.69,
            0.70, 0.73, 0.76, 0.78, 0.80, 0.82, 0.83, 0.84, 0.85, 0.86,
            0.87, 0.88, 0.88, 0.89, 0.89, 0.90, 0.90, 0.91, 0.91, 0.91
        ],
        "diversityByGeneration": [
            { "generation": 0, "diversity": 0.0019 },
            { "generation": 10, "diversity": 0.0011 },
            { "generation": 20, "diversity": 0.0012 },
            { "generation": 30, "diversity": 0.0008 },
            { "generation": 40, "diversity": 0.0011 },
            { "generation": 50, "diversity": 0.0011 },
            { "generation": 60, "diversity": 0.0012 },
            { "generation": 70, "diversity": 0.0015 },
            { "generation": 80, "diversity": 0.0010 },
            { "generation": 90, "diversity": 0.0013 },
            { "generation": 100, "diversity": 0.0011 },
            { "generation": 150, "diversity": 0.0013 },
            { "generation": 200, "diversity": 0.0011 },
            { "generation": 250, "diversity": 0.0010 },
            { "generation": 300, "diversity": 0.0007 }
        ],
        "operatorStats": {
            "crossoverSuccess": [
                { "generation": 1, "attempts": 185, "successes": 0, "rate": 0 },
                { "generation": 50, "attempts": 185, "successes": 37, "rate": 0.2 },
                { "generation": 100, "attempts": 185, "successes": 82, "rate": 0.44 },
                { "generation": 150, "attempts": 185, "successes": 32, "rate": 0.17 },
                { "generation": 200, "attempts": 185, "successes": 47, "rate": 0.25 },
                { "generation": 250, "attempts": 185, "successes": 29, "rate": 0.16 },
                { "generation": 300, "attempts": 185, "successes": 72, "rate": 0.39 }
            ],
            "mutationSuccess": [
                { "generation": 1, "attempts": 29, "successes": 29, "rate": 1 },
                { "generation": 50, "attempts": 35, "successes": 35, "rate": 1 },
                { "generation": 100, "attempts": 28, "successes": 28, "rate": 1 },
                { "generation": 150, "attempts": 32, "successes": 32, "rate": 1 },
                { "generation": 200, "attempts": 29, "successes": 29, "rate": 1 },
                { "generation": 250, "attempts": 29, "successes": 29, "rate": 1 },
                { "generation": 300, "attempts": 28, "successes": 28, "rate": 1 }
            ]
        },
        "convergenceMetrics": {
            "stagnationPeriods": [
                { "startGeneration": 6, "endGeneration": 7, "duration": 2, "fitnessValue": 0.91 },
                { "startGeneration": 226, "endGeneration": 228, "duration": 3, "fitnessValue": 0.95 },
                { "startGeneration": 241, "endGeneration": 250, "duration": 10, "fitnessValue": 0.93 }
            ],
            "improvementRates": [
                { "generation": 1, "rate": 1.25 },
                { "generation": 50, "rate": 0.32 },
                { "generation": 100, "rate": 0.11 },
                { "generation": 150, "rate": 0.01 },
                { "generation": 200, "rate": 0.006 },
                { "generation": 250, "rate": 0.003 },
                { "generation": 300, "rate": 0.001 }
            ]
        },
        "constraintsSatisfaction": {
            "0": {
                "roomCapacity": { "fulfilled": 87, "total": 93 },
                "consecutiveSlots": { "fulfilled": 13, "total": 13 },
                "specificRoom": { "fulfilled": 19, "total": 19 },
                "timeRestriction": { "fulfilled": 38, "total": 50 }
            },
            "100": {
                "roomCapacity": { "fulfilled": 87, "total": 93 },
                "consecutiveSlots": { "fulfilled": 13, "total": 13 },
                "specificRoom": { "fulfilled": 19, "total": 19 },
                "timeRestriction": { "fulfilled": 47, "total": 50 }
            },
            "200": {
                "roomCapacity": { "fulfilled": 86, "total": 93 },
                "consecutiveSlots": { "fulfilled": 13, "total": 13 },
                "specificRoom": { "fulfilled": 19, "total": 19 },
                "timeRestriction": { "fulfilled": 48, "total": 50 }
            },
            "300": {
                "roomCapacity": { "fulfilled": 87, "total": 93 },
                "consecutiveSlots": { "fulfilled": 13, "total": 13 },
                "specificRoom": { "fulfilled": 19, "total": 19 },
                "timeRestriction": { "fulfilled": 49, "total": 50 }
            }
        },
        "populationSnapshots": [
            {
                "generation": 0,
                "chromosomes": [
                    { "fitness": 0.37, "assignmentsCount": 93, "scoreDistribution": [58, 0, 0, 0, 6, 22] },
                    { "fitness": 0.37, "assignmentsCount": 93, "scoreDistribution": [58, 0, 0, 0, 4, 26] },
                    { "fitness": 0.34, "assignmentsCount": 93, "scoreDistribution": [60, 0, 0, 0, 7, 23] }
                ]
            },
            {
                "generation": 300,
                "chromosomes": [
                    { "fitness": 0.94, "assignmentsCount": 93, "scoreDistribution": [13, 0, 0, 0, 0, 69] },
                    { "fitness": 0.94, "assignmentsCount": 93, "scoreDistribution": [10, 0, 0, 0, 0, 71] },
                    { "fitness": 0.93, "assignmentsCount": 93, "scoreDistribution": [13, 0, 0, 0, 0, 68] }
                ]
            }
        ]
    };

    processEvolutionData(sampleData);
    showAlert(successAlert);
    mainContent.style.display = 'block';
}// Función para actualizar barras de progreso de restricciones
function updateConstraintsProgress(data) {
    const constraintsContainer = document.getElementById('constraints-final-container');
    constraintsContainer.innerHTML = '';

    // Obtener datos de la última generación
    const constraintsSatisfaction = data.constraintsSatisfaction || {};
    const generations = Object.keys(constraintsSatisfaction).map(Number).sort((a, b) => a - b);

    if (generations.length === 0) {
        constraintsContainer.innerHTML = '<div class="chart-placeholder">No hay datos de restricciones disponibles</div>';
        return;
    }

    const lastGen = generations[generations.length - 1];
    const lastGenData = constraintsSatisfaction[lastGen];

    // Nombres legibles para restricciones
    const constraintNames = {
        roomCapacity: 'Capacidad de Aulas',
        consecutiveSlots: 'Slots Consecutivos',
        specificRoom: 'Aula Específica',
        timeRestriction: 'Restricción Horaria',
        professorAvailability: 'Disponibilidad Profesor',
        groupConflicts: 'Conflictos de Grupo'
    };

    // Crear barra de progreso para cada restricción
    Object.entries(lastGenData).forEach(([type, data]) => {
        const percentage = (data.fulfilled / Math.max(1, data.total) * 100).toFixed(1);

        let barClass = 'danger';
        if (percentage >= 90) barClass = 'success';
        else if (percentage >= 70) barClass = 'warning';

        const progressItem = document.createElement('div');
        progressItem.className = 'progress-item';

        progressItem.innerHTML = `
            <div class="progress-header">
                <span class="progress-label">${constraintNames[type] || type}</span>
                <span class="progress-value">${percentage}% (${data.fulfilled}/${data.total})</span>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar ${barClass}" style="width: ${percentage}%;"></div>
            </div>
        `;

        constraintsContainer.appendChild(progressItem);
    });
}

// Función para crear gráficos de convergencia
function createConvergenceCharts(data) {
    // 1. Gráfico de periodos de estancamiento
    const stagnationCtx = document.getElementById('stagnationPeriodsChart').getContext('2d');

    // Preparar datos
    const stagnationPeriods = data.convergenceMetrics?.stagnationPeriods || [];

    // Si no hay datos de estancamiento, intentar estimarlos
    let estimatedStagnations = [];
    if (stagnationPeriods.length === 0 && data.fitnessHistory && data.fitnessHistory.length > 0) {
        const fitnessHistory = data.fitnessHistory;
        let startGen = 0;
        let prevFitness = fitnessHistory[0].bestFitness;
        let currentPeriod = null;

        for (let i = 1; i < fitnessHistory.length; i++) {
            const entry = fitnessHistory[i];
            const improvement = (entry.bestFitness - prevFitness) / Math.max(0.0001, prevFitness);

            if (improvement < 0.001) {
                // Estancamiento
                if (!currentPeriod) {
                    currentPeriod = {
                        startGeneration: entry.generation,
                        endGeneration: entry.generation,
                        duration: 1,
                        fitnessValue: entry.bestFitness
                    };
                } else {
                    currentPeriod.endGeneration = entry.generation;
                    currentPeriod.duration++;
                }
            } else {
                // Mejora significativa
                if (currentPeriod && currentPeriod.duration > 5) { // Solo considerar periodos de al menos 5 generaciones
                    estimatedStagnations.push(currentPeriod);
                }
                currentPeriod = null;
            }

            prevFitness = entry.bestFitness;
        }

        // Añadir el último periodo si existe
        if (currentPeriod && currentPeriod.duration > 5) {
            estimatedStagnations.push(currentPeriod);
        }
    }

    // Usar periodos reales o estimados
    const periodsToUse = stagnationPeriods.length > 0 ? stagnationPeriods : estimatedStagnations;

    // Actualizar la tabla de periodos de estancamiento
    updateStagnationTable(periodsToUse);

    if (stagnationPeriodsChart) stagnationPeriodsChart.destroy();

    // Crear datos para el gráfico
    const stagnationLabels = periodsToUse.map((p, i) => `Periodo ${i + 1}`);
    const stagnationDurations = periodsToUse.map(p => p.duration);
    const stagnationFitness = periodsToUse.map(p => p.fitnessValue);

    // Crear gráfico combinado
    stagnationPeriodsChart = new Chart(stagnationCtx, {
        type: 'bar',
        data: {
            labels: stagnationLabels,
            datasets: [
                {
                    label: 'Duración (generaciones)',
                    data: stagnationDurations,
                    backgroundColor: 'rgba(231, 74, 59, 0.7)',
                    borderColor: 'rgba(231, 74, 59, 1)',
                    borderWidth: 1,
                    yAxisID: 'y'
                },
                {
                    label: 'Fitness Alcanzado',
                    data: stagnationFitness,
                    type: 'line',
                    borderColor: 'rgba(78, 115, 223, 1)',
                    backgroundColor: 'transparent',
                    pointBackgroundColor: 'rgba(78, 115, 223, 1)',
                    borderWidth: 2,
                    pointRadius: 4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    type: 'linear',
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Duración (generaciones)'
                    }
                },
                y1: {
                    beginAtZero: false,
                    type: 'linear',
                    position: 'right',
                    grid: {
                        drawOnChartArea: false
                    },
                    title: {
                        display: true,
                        text: 'Fitness'
                    }
                }
            }
        }
    });

    // 2. Gráfico de tasas de mejora
    const improvementCtx = document.getElementById('improvementRatesChart').getContext('2d');

    // Preparar datos
    const improvementRates = data.convergenceMetrics?.improvementRates || [];

    // Si no hay datos de tasas, intentar calcularlos
    let calculatedRates = [];
    if (improvementRates.length === 0 && data.fitnessHistory && data.fitnessHistory.length > 1) {
        const fitnessHistory = data.fitnessHistory;

        for (let i = 1; i < fitnessHistory.length; i++) {
            const prevFitness = fitnessHistory[i - 1].bestFitness;
            const currFitness = fitnessHistory[i].bestFitness;
            const improvement = (currFitness - prevFitness) / Math.max(0.0001, prevFitness);

            calculatedRates.push({
                generation: fitnessHistory[i].generation,
                rate: improvement
            });
        }
    }

    // Usar tasas reales o calculadas
    const ratesToUse = improvementRates.length > 0 ? improvementRates : calculatedRates;

    // Limitar número de puntos para mejor visualización
    const maxPoints = 50;
    const ratesForChart = ratesToUse.length > maxPoints
        ? ratesToUse.filter((_, i) => i % Math.ceil(ratesToUse.length / maxPoints) === 0)
        : ratesToUse;

    if (improvementRatesChart) improvementRatesChart.destroy();

    improvementRatesChart = new Chart(improvementCtx, {
        type: 'line',
        data: {
            labels: ratesForChart.map(r => r.generation),
            datasets: [{
                label: 'Tasa de Mejora',
                data: ratesForChart.map(r => r.rate * 100), // Convertir a porcentaje
                borderColor: 'rgba(54, 185, 204, 1)',
                backgroundColor: 'rgba(54, 185, 204, 0.1)',
                borderWidth: 2,
                pointRadius: 1,
                pointHoverRadius: 3,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    title: {
                        display: true,
                        text: 'Tasa de Mejora (%)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Generación'
                    },
                    ticks: {
                        maxTicksLimit: 10
                    }
                }
            }
        }
    });

    // 3. Gráfico de velocidad de convergencia
    const convergenceCtx = document.getElementById('convergenceSpeedChart').getContext('2d');

    // Preparar datos sobre velocidad de convergencia
    // Usar fitness history para calcular qué tan rápido se acerca al fitness final
    const fitnessHistory = data.fitnessHistory || [];

    if (fitnessHistory.length > 0) {
        const finalFitness = fitnessHistory[fitnessHistory.length - 1].bestFitness;

        // Calcular porcentaje del fitness final alcanzado por generación
        const convergenceData = fitnessHistory.map(entry => ({
            generation: entry.generation,
            percentageFinal: (entry.bestFitness / finalFitness) * 100
        }));

        if (convergenceSpeedChart) convergenceSpeedChart.destroy();

        convergenceSpeedChart = new Chart(convergenceCtx, {
            type: 'line',
            data: {
                labels: convergenceData.map(d => d.generation),
                datasets: [{
                    label: '% del Fitness Final',
                    data: convergenceData.map(d => d.percentageFinal),
                    borderColor: 'rgba(246, 194, 62, 1)',
                    backgroundColor: 'rgba(246, 194, 62, 0.1)',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 3,
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: '% del Fitness Final'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Generación'
                        },
                        ticks: {
                            maxTicksLimit: 10
                        }
                    }
                }
            }
        });
    } else {
        // Si no hay datos, mostrar un mensaje
        document.getElementById('convergenceSpeedChart').parentNode.innerHTML =
            '<div class="chart-placeholder">No hay suficientes datos para calcular la velocidad de convergencia</div>';
    }
}

// Función para actualizar la tabla de periodos de estancamiento
function updateStagnationTable(periods) {
    const tableBody = document.getElementById('stagnationTable').querySelector('tbody');
    tableBody.innerHTML = '';

    if (periods.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="5" class="text-center">No se detectaron periodos de estancamiento significativos</td>';
        tableBody.appendChild(row);
        return;
    }

    // Filtrar para mostrar solo los periodos más significativos
    // (duración mayor a 5 generaciones o los 3 periodos más largos)
    let significantPeriods = periods.filter(p => p.duration > 5);

    if (significantPeriods.length === 0) {
        // Si no hay periodos significativos, tomar los 3 más largos
        significantPeriods = [...periods].sort((a, b) => b.duration - a.duration).slice(0, 3);
    } else if (significantPeriods.length > 5) {
        // Si hay más de 5 periodos significativos, mostrar solo los 5 más largos
        significantPeriods = significantPeriods.sort((a, b) => b.duration - a.duration).slice(0, 5);
    }

    // Ordenar los periodos por duración (descendente)
    significantPeriods.sort((a, b) => b.duration - a.duration);

    // Mostrar solo los periodos seleccionados
    significantPeriods.forEach((period, index) => {
        const row = document.createElement('tr');

        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${period.startGeneration}</td>
            <td>${period.endGeneration}</td>
            <td>${period.duration}</td>
            <td>${period.fitnessValue.toFixed(4)}</td>
        `;

        tableBody.appendChild(row);
    });
}// Elementos DOM
const fileInput = document.getElementById('file-input');
const fileNameDisplay = document.getElementById('file-name-display');
const jsonPasteArea = document.getElementById('json-paste-area');
const processJsonBtn = document.getElementById('process-json-btn');
const loadingOverlay = document.querySelector('.loading-overlay');
const successAlert = document.getElementById('success-alert');
const errorAlert = document.getElementById('error-alert');
const mainContent = document.getElementById('main-content');

// Variables para los gráficos
let fitnessEvolutionChart, fitnessImprovementChart, fitnessFinalDistributionChart,
    diversityEvolutionChart, diversityVsFitnessChart, diversityImpactChart,
    crossoverSuccessChart, mutationSuccessChart, operatorsComparisonChart,
    constraintsEvolutionChart, hardestConstraintsChart,
    stagnationPeriodsChart, improvementRatesChart, convergenceSpeedChart;

// Función para mostrar el cargador
function showLoading() {
    loadingOverlay.classList.add('show-loading');
}

// Función para ocultar el cargador
function hideLoading() {
    loadingOverlay.classList.remove('show-loading');
}

// Función para mostrar una alerta
function showAlert(alertElement, duration = 3000) {
    alertElement.style.display = 'block';
    setTimeout(() => {
        alertElement.style.display = 'none';
    }, duration);
}

// Función para manejar la carga de archivo
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    fileNameDisplay.textContent = file.name;

    try {
        showLoading();
        const content = await file.text();
        let data;

        try {
            data = JSON.parse(content);
        } catch (parseError) {
            console.error("Error al analizar JSON:", parseError);
            showAlert(errorAlert);
            hideLoading();
            return;
        }

        const success = processEvolutionData(data);
        if (success) {
            showAlert(successAlert);
            mainContent.style.display = 'block';
        } else {
            showAlert(errorAlert);
        }
    } catch (error) {
        console.error('Error al procesar archivo:', error);
        showAlert(errorAlert);
    } finally {
        hideLoading();
    }
}

// Función para manejar el contenido JSON pegado
function handleJsonPaste() {
    const jsonText = jsonPasteArea.value.trim();
    if (!jsonText) {
        showAlert(errorAlert);
        return;
    }

    try {
        showLoading();
        let data;

        try {
            data = JSON.parse(jsonText);
        } catch (parseError) {
            console.error("Error al analizar JSON pegado:", parseError);
            showAlert(errorAlert);
            hideLoading();
            return;
        }

        const success = processEvolutionData(data);
        if (success) {
            showAlert(successAlert);
            mainContent.style.display = 'block';
        } else {
            showAlert(errorAlert);
        }
    } catch (error) {
        console.error('Error al procesar JSON:', error);
        showAlert(errorAlert);
    } finally {
        hideLoading();
    }
}

// Función principal para procesar los datos de evolución
function processEvolutionData(data) {
    try {
        console.log("Procesando datos de evolución...");

        // Validación básica de la estructura del JSON
        if (!data || typeof data !== 'object') {
            throw new Error("Los datos no tienen un formato válido");
        }

        // Verificar campos mínimos requeridos
        if (!data.fitnessHistory && !data.bestFitnessByGeneration) {
            throw new Error("No se encontraron datos de fitness en el JSON");
        }

        // Actualizar estadísticas clave
        updateEvolutionStats(data);

        // Crear gráficas por categorías
        createFitnessCharts(data);
        createDiversityCharts(data);
        createOperatorsCharts(data);
        createConstraintsCharts(data);
        createConvergenceCharts(data);

        return true;
    } catch (error) {
        console.error("Error al procesar datos:", error);
        return false;
    }
}

// Función para actualizar estadísticas clave
function updateEvolutionStats(data) {
    // Obtener el fitness final (último de la historia o del mejor)
    const fitnessHistory = data.fitnessHistory || [];
    const finalFitness = fitnessHistory.length > 0
        ? fitnessHistory[fitnessHistory.length - 1].bestFitness
        : (data.bestFitnessByGeneration?.length > 0
            ? data.bestFitnessByGeneration[data.bestFitnessByGeneration.length - 1]
            : 0);

    // Calcular el número total de generaciones
    const totalGenerations = fitnessHistory.length > 0
        ? fitnessHistory[fitnessHistory.length - 1].generation
        : (data.bestFitnessByGeneration?.length || 0);

    // Obtener el fitness inicial
    const initialFitness = fitnessHistory.length > 0
        ? fitnessHistory[0].bestFitness
        : (data.bestFitnessByGeneration?.length > 0
            ? data.bestFitnessByGeneration[0]
            : 0);

    // Actualizar los elementos del DOM con los datos calculados
    document.getElementById('final-fitness').textContent = finalFitness.toFixed(4);
    document.getElementById('total-generations').textContent = totalGenerations;

    // Calcular y mostrar la mejora porcentual
    const improvement = ((finalFitness - initialFitness) / Math.max(0.0001, initialFitness) * 100).toFixed(1);
    document.getElementById('fitness-improvement').textContent = `${improvement}%`;

    // Generación de convergencia (estimada como la última generación donde hubo mejora significativa)
    let convergenceGen = totalGenerations;
    if (data.convergenceMetrics && data.convergenceMetrics.improvementRates) {
        const significantImprovement = 0.001; // Umbral de mejora significativa
        const improvements = data.convergenceMetrics.improvementRates;

        for (let i = improvements.length - 1; i >= 0; i--) {
            if (improvements[i].rate > significantImprovement) {
                convergenceGen = improvements[i].generation;
                break;
            }
        }
    }

    document.getElementById('convergence-generation').textContent = convergenceGen;
}

// Función para crear gráficos de fitness
function createFitnessCharts(data) {
    // 1. Gráfico de evolución del fitness
    const fitnessCtx = document.getElementById('fitnessEvolutionChart').getContext('2d');

    // Preparar datos
    const fitnessHistory = data.fitnessHistory || [];
    const generations = fitnessHistory.map(d => d.generation);
    const bestFitness = fitnessHistory.map(d => d.bestFitness);
    const avgFitness = fitnessHistory.map(d => d.avgFitness);

    if (fitnessEvolutionChart) fitnessEvolutionChart.destroy();

    fitnessEvolutionChart = new Chart(fitnessCtx, {
        type: 'line',
        data: {
            labels: generations,
            datasets: [
                {
                    label: 'Mejor Fitness',
                    data: bestFitness,
                    borderColor: 'rgba(78, 115, 223, 1)',
                    backgroundColor: 'rgba(78, 115, 223, 0.1)',
                    borderWidth: 2,
                    pointRadius: 1,
                    pointHoverRadius: 3,
                    tension: 0.3,
                    fill: false
                },
                {
                    label: 'Fitness Promedio',
                    data: avgFitness,
                    borderColor: 'rgba(28, 200, 138, 1)',
                    backgroundColor: 'rgba(28, 200, 138, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    pointHoverRadius: 3,
                    tension: 0.3,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Fitness'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Generación'
                    }
                }
            },
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false
                },
                legend: {
                    position: 'top'
                }
            }
        }
    });

    // 2. Gráfico de mejora relativa del fitness
    const improvementCtx = document.getElementById('fitnessImprovementChart').getContext('2d');

    // Calcular mejora relativa
    const improvements = [];
    let previousFitness = generations.length > 0 ? bestFitness[0] : 0;

    for (let i = 1; i < generations.length; i++) {
        const currentFitness = bestFitness[i];
        const improvement = (currentFitness - previousFitness) / Math.max(0.0001, previousFitness);
        improvements.push(improvement * 100); // Convertir a porcentaje
        previousFitness = currentFitness;
    }

    if (fitnessImprovementChart) fitnessImprovementChart.destroy();

    fitnessImprovementChart = new Chart(improvementCtx, {
        type: 'bar',
        data: {
            labels: generations.slice(1), // Omitir la primera generación
            datasets: [{
                label: 'Mejora Relativa (%)',
                data: improvements,
                backgroundColor: improvements.map(imp =>
                    imp > 1 ? 'rgba(28, 200, 138, 0.7)' :
                        imp > 0.1 ? 'rgba(54, 185, 204, 0.7)' :
                            'rgba(246, 194, 62, 0.7)'
                ),
                borderColor: improvements.map(imp =>
                    imp > 1 ? 'rgba(28, 200, 138, 1)' :
                        imp > 0.1 ? 'rgba(54, 185, 204, 1)' :
                            'rgba(246, 194, 62, 1)'
                ),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    title: {
                        display: true,
                        text: 'Mejora Relativa (%)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Generación'
                    },
                    ticks: {
                        maxTicksLimit: 10 // Limitar el número de etiquetas en el eje X
                    }
                }
            }
        }
    });

    // 3. Distribución del fitness en la población final
    const distributionCtx = document.getElementById('fitnessFinalDistributionChart').getContext('2d');

    // Intentar obtener datos de la última instantánea de población
    let populationData = [];
    if (data.populationSnapshots && data.populationSnapshots.length > 0) {
        const lastSnapshot = data.populationSnapshots[data.populationSnapshots.length - 1];
        populationData = lastSnapshot.chromosomes.map(c => c.fitness);
    }

    // Si no hay datos, usar un dataset ficticio
    if (populationData.length === 0 && bestFitness.length > 0) {
        // Generar distribución sintética centrada en el último mejor fitness
        const lastBestFitness = bestFitness[bestFitness.length - 1];
        const lastAvgFitness = avgFitness[avgFitness.length - 1] || lastBestFitness * 0.9;

        // Crear distribución aproximada
        populationData = [
            lastBestFitness,
            lastBestFitness * 0.99,
            lastBestFitness * 0.98,
            lastBestFitness * 0.97,
            lastBestFitness * 0.96,
            lastBestFitness * 0.95,
            lastBestFitness * 0.94,
            lastBestFitness * 0.92,
            lastBestFitness * 0.90,
            lastAvgFitness
        ];
    }

    // Crear histograma
    const binCount = 10;
    const min = Math.min(...populationData);
    const max = Math.max(...populationData);
    const binSize = (max - min) / binCount;

    const bins = Array(binCount).fill(0);
    populationData.forEach(fitness => {
        const binIndex = Math.min(binCount - 1, Math.floor((fitness - min) / binSize));
        bins[binIndex]++;
    });

    const binLabels = Array(binCount).fill(0).map((_, i) =>
        `${(min + i * binSize).toFixed(3)}-${(min + (i + 1) * binSize).toFixed(3)}`
    );

    if (fitnessFinalDistributionChart) fitnessFinalDistributionChart.destroy();

    fitnessFinalDistributionChart = new Chart(distributionCtx, {
        type: 'bar',
        data: {
            labels: binLabels,
            datasets: [{
                label: 'Frecuencia',
                data: bins,
                backgroundColor: 'rgba(78, 115, 223, 0.7)',
                borderColor: 'rgba(78, 115, 223, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Frecuencia'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Rango de Fitness'
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Distribución del Fitness en la Población'
                },
                legend: {
                    display: false
                }
            }
        }
    });
}

// Función para crear gráficos de diversidad genética
function createDiversityCharts(data) {
    // 1. Gráfico de evolución de la diversidad
    const diversityCtx = document.getElementById('diversityEvolutionChart').getContext('2d');

    // Preparar datos
    const diversityData = data.diversityByGeneration || [];

    if (diversityData.length === 0) {
        document.getElementById('diversityEvolutionChart').closest('.chart-container').innerHTML =
            '<div class="chart-placeholder">No hay datos de diversidad disponibles</div>';
        document.getElementById('diversityVsFitnessChart').closest('.chart-container').innerHTML =
            '<div class="chart-placeholder">No hay datos de diversidad disponibles</div>';
        document.getElementById('diversityImpactChart').closest('.chart-container').innerHTML =
            '<div class="chart-placeholder">No hay datos de diversidad disponibles</div>';
        return;
    }

    const generations = diversityData.map(d => d.generation);
    const diversityValues = diversityData.map(d => d.diversity);

    if (diversityEvolutionChart) diversityEvolutionChart.destroy();

    diversityEvolutionChart = new Chart(diversityCtx, {
        type: 'line',
        data: {
            labels: generations,
            datasets: [{
                label: 'Diversidad Genética',
                data: diversityValues,
                borderColor: 'rgba(246, 194, 62, 1)',
                backgroundColor: 'rgba(246, 194, 62, 0.1)',
                borderWidth: 2,
                pointRadius: 2,
                pointHoverRadius: 4,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Diversidad (Varianza de Fitness)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Generación'
                    }
                }
            }
        }
    });

    // 2. Gráfico de diversidad vs fitness promedio
    const diversityVsFitnessCtx = document.getElementById('diversityVsFitnessChart').getContext('2d');

    // Crear dataset combinando diversidad y fitness promedio
    const combinedData = [];
    const fitnessHistory = data.fitnessHistory || [];

    for (const div of diversityData) {
        const gen = div.generation;
        const fitnessEntry = fitnessHistory.find(f => f.generation === gen);
        if (fitnessEntry) {
            combinedData.push({
                generation: gen,
                diversity: div.diversity,
                avgFitness: fitnessEntry.avgFitness
            });
        }
    }

    if (diversityVsFitnessChart) diversityVsFitnessChart.destroy();

    diversityVsFitnessChart = new Chart(diversityVsFitnessCtx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Diversidad vs Fitness',
                data: combinedData.map(d => ({
                    x: d.diversity,
                    y: d.avgFitness
                })),
                backgroundColor: combinedData.map(d => {
                    // Colorear según la generación (más reciente = más oscuro)
                    const intensity = Math.min(255, Math.max(100, 255 - (d.generation / (generations.length || 1)) * 155));
                    return `rgba(${intensity}, ${intensity}, 255, 0.7)`;
                }),
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    title: {
                        display: true,
                        text: 'Fitness Promedio'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Diversidad'
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const index = context.dataIndex;
                            const generation = combinedData[index].generation;
                            return `Gen ${generation}: Div=${context.parsed.x.toFixed(4)}, Fitness=${context.parsed.y.toFixed(4)}`;
                        }
                    }
                }
            }
        }
    });

    // 3. Gráfico de impacto de la diversidad
    const diversityImpactCtx = document.getElementById('diversityImpactChart').getContext('2d');

    // Calcular la tasa de mejora en función de la diversidad
    const diversityImpactData = [];

    for (let i = 1; i < combinedData.length; i++) {
        const prevEntry = combinedData[i - 1];
        const currEntry = combinedData[i];

        const improvementRate = (currEntry.avgFitness - prevEntry.avgFitness) / Math.max(0.0001, prevEntry.avgFitness);

        diversityImpactData.push({
            prevDiversity: prevEntry.diversity,
            improvementRate: improvementRate
        });
    }

    if (diversityImpactChart) diversityImpactChart.destroy();

    diversityImpactChart = new Chart(diversityImpactCtx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Impacto de Diversidad',
                data: diversityImpactData.map(d => ({
                    x: d.prevDiversity,
                    y: d.improvementRate * 100 // Convertir a porcentaje
                })),
                backgroundColor: diversityImpactData.map(d =>
                    d.improvementRate > 0.01 ? 'rgba(28, 200, 138, 0.7)' :
                        d.improvementRate > 0 ? 'rgba(246, 194, 62, 0.7)' :
                            'rgba(231, 74, 59, 0.7)'
                ),
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    title: {
                        display: true,
                        text: 'Tasa de Mejora (%)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Diversidad Previa'
                    }
                }
            }
        }
    });
}

// Función para crear gráficos de operadores genéticos
function createOperatorsCharts(data) {
    // 1. Gráfico de tasa de éxito del cruzamiento
    const crossoverCtx = document.getElementById('crossoverSuccessChart').getContext('2d');

    // Preparar datos
    const crossoverData = data.operatorStats?.crossoverSuccess || [];

    if (crossoverData.length === 0) {
        document.getElementById('crossoverSuccessChart').closest('.chart-container').innerHTML =
            '<div class="chart-placeholder">No hay datos de operadores de cruzamiento disponibles</div>';
        document.getElementById('mutationSuccessChart').closest('.chart-container').innerHTML =
            '<div class="chart-placeholder">No hay datos de operadores de mutación disponibles</div>';
        document.getElementById('operatorsComparisonChart').closest('.chart-container').innerHTML =
            '<div class="chart-placeholder">No hay datos suficientes para comparar operadores</div>';
        return;
    }

    const crossoverGens = crossoverData.map(d => d.generation);
    const crossoverRates = crossoverData.map(d => d.rate * 100); // Convertir a porcentaje

    if (crossoverSuccessChart) crossoverSuccessChart.destroy();

    crossoverSuccessChart = new Chart(crossoverCtx, {
        type: 'line',
        data: {
            labels: crossoverGens,
            datasets: [{
                label: 'Tasa de Éxito (%)',
                data: crossoverRates,
                borderColor: 'rgba(54, 185, 204, 1)',
                backgroundColor: 'rgba(54, 185, 204, 0.1)',
                borderWidth: 2,
                pointRadius: 1,
                pointHoverRadius: 3,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Tasa de Éxito (%)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Generación'
                    },
                    ticks: {
                        maxTicksLimit: 10
                    }
                }
            },
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            }
        }
    });

    // 2. Gráfico de tasa de éxito de la mutación
    const mutationCtx = document.getElementById('mutationSuccessChart').getContext('2d');

    // Preparar datos
    const mutationData = data.operatorStats?.mutationSuccess || [];
    const mutationGens = mutationData.map(d => d.generation);
    const mutationRates = mutationData.map(d => d.rate * 100); // Convertir a porcentaje

    if (mutationSuccessChart) mutationSuccessChart.destroy();

    mutationSuccessChart = new Chart(mutationCtx, {
        type: 'line',
        data: {
            labels: mutationGens,
            datasets: [{
                label: 'Tasa de Éxito (%)',
                data: mutationRates,
                borderColor: 'rgba(231, 74, 59, 1)',
                backgroundColor: 'rgba(231, 74, 59, 0.1)',
                borderWidth: 2,
                pointRadius: 1,
                pointHoverRadius: 3,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Tasa de Éxito (%)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Generación'
                    },
                    ticks: {
                        maxTicksLimit: 10
                    }
                }
            },
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            }
        }
    });

    // 3. Gráfico de comparación de operadores
    const comparisonCtx = document.getElementById('operatorsComparisonChart').getContext('2d');

    // Encontrar generaciones comunes
    const commonGens = crossoverGens.filter(gen => mutationGens.includes(gen));

    // Si no hay suficientes datos para comparar
    if (commonGens.length < 2) {
        document.getElementById('operatorsComparisonChart').closest('.chart-container').innerHTML =
            '<div class="chart-placeholder">No hay suficientes datos para comparar operadores</div>';
        return;
    }

    // Crear datos para comparación
    const compareData = commonGens.map(gen => {
        const crossoverEntry = crossoverData.find(d => d.generation === gen);
        const mutationEntry = mutationData.find(d => d.generation === gen);

        return {
            generation: gen,
            crossoverRate: crossoverEntry ? crossoverEntry.rate * 100 : 0,
            mutationRate: mutationEntry ? mutationEntry.rate * 100 : 0
        };
    });

    if (operatorsComparisonChart) operatorsComparisonChart.destroy();

    operatorsComparisonChart = new Chart(comparisonCtx, {
        type: 'line',
        data: {
            labels: compareData.map(d => d.generation),
            datasets: [
                {
                    label: 'Cruzamiento',
                    data: compareData.map(d => d.crossoverRate),
                    borderColor: 'rgba(54, 185, 204, 1)',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 1,
                    pointHoverRadius: 3,
                    tension: 0.3
                },
                {
                    label: 'Mutación',
                    data: compareData.map(d => d.mutationRate),
                    borderColor: 'rgba(231, 74, 59, 1)',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 1,
                    pointHoverRadius: 3,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Tasa de Éxito (%)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Generación'
                    },
                    ticks: {
                        maxTicksLimit: 15
                    }
                }
            },
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false
                },
                legend: {
                    position: 'top'
                }
            }
        }
    });
}

// Función para crear gráficos de restricciones
function createConstraintsCharts(data) {
    // Obtener datos de restricciones
    const constraintsSatisfaction = data.constraintsSatisfaction || {};
    const generations = Object.keys(constraintsSatisfaction).map(Number).sort((a, b) => a - b);

    if (generations.length === 0) {
        document.getElementById('constraintsEvolutionChart').closest('.chart-container').innerHTML =
            '<div class="chart-placeholder">No hay datos de restricciones disponibles</div>';
        document.getElementById('hardestConstraintsChart').closest('.chart-container').innerHTML =
            '<div class="chart-placeholder">No hay datos de restricciones disponibles</div>';

        // También actualizar la sección de barras de progreso
        document.getElementById('constraints-final-container').innerHTML =
            '<div class="chart-placeholder">No hay datos de restricciones disponibles</div>';
        return;
    }

    // Definir nombres legibles para tipos de restricciones
    const constraintNames = {
        roomCapacity: 'Capacidad de Aulas',
        consecutiveSlots: 'Slots Consecutivos',
        specificRoom: 'Aula Específica',
        timeRestriction: 'Restricción Horaria',
        professorAvailability: 'Disponibilidad Profesor',
        groupConflicts: 'Conflictos de Grupo'
    };

    // Obtener todos los tipos de restricciones disponibles en los datos
    const allConstraintTypes = new Set();
    generations.forEach(gen => {
        Object.keys(constraintsSatisfaction[gen]).forEach(type => {
            allConstraintTypes.add(type);
        });
    });

    // 1. Actualizar barras de progreso de restricciones finales
    updateConstraintsProgress(data);

    // 2. Crear gráfico de evolución de restricciones
    const evolutionCtx = document.getElementById('constraintsEvolutionChart').getContext('2d');

    // Preparar datos para el gráfico
    const evolutionDatasets = [];

    allConstraintTypes.forEach(type => {
        const data = [];
        generations.forEach(gen => {
            if (constraintsSatisfaction[gen][type]) {
                const satisfactionRate = (constraintsSatisfaction[gen][type].fulfilled /
                    Math.max(1, constraintsSatisfaction[gen][type].total)) * 100;
                data.push({
                    x: gen,
                    y: satisfactionRate
                });
            }
        });

        // Solo agregar al dataset si hay datos
        if (data.length > 0) {
            // Generar un color basado en el índice del tipo
            const colorIndex = Array.from(allConstraintTypes).indexOf(type);
            const hue = (colorIndex * 50) % 360;

            evolutionDatasets.push({
                label: constraintNames[type] || type,
                data: data,
                borderColor: `hsl(${hue}, 70%, 50%)`,
                backgroundColor: `hsl(${hue}, 70%, 80%, 0.1)`,
                fill: false,
                tension: 0.3,
                borderWidth: 2,
                pointRadius: 1,
                pointHoverRadius: 3
            });
        }
    });

    if (constraintsEvolutionChart) constraintsEvolutionChart.destroy();

    constraintsEvolutionChart = new Chart(evolutionCtx, {
        type: 'line',
        data: {
            datasets: evolutionDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false,
                    min: 20,  // Comienza en 20%
                    max: 120, // Llega hasta 120%
                    title: {
                        display: true,
                        text: 'Tasa de Satisfacción (%)'
                    }
                },
                x: {
                    type: 'linear',
                    position: 'bottom',
                    title: {
                        display: true,
                        text: 'Generación'
                    }
                }
            },
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false
                },
                legend: {
                    position: 'top'
                }
            }
        }
    });

    // Calcular satisfacción promedio de cada restricción
    const avgSatisfaction = {};
    Array.from(allConstraintTypes).forEach(type => {
        let sum = 0;
        let count = 0;

        generations.forEach(gen => {
            const constraintData = constraintsSatisfaction[gen][type];
            if (constraintData && constraintData.total > 0) {
                sum += (constraintData.fulfilled / constraintData.total) * 100;
                count++;
            }
        });

        if (count > 0) {
            avgSatisfaction[type] = sum / count;
        }
    });

    // Ordenar restricciones por dificultad (menor satisfacción = más difícil)
    const sortedConstraints = Object.entries(avgSatisfaction)
        .sort((a, b) => a[1] - b[1])
        .map(([type, avg]) => ({
            type: constraintNames[type] || type,
            satisfaction: avg
        }));

    // 3. Gráfico de restricciones más difíciles
    const hardestCtx = document.getElementById('hardestConstraintsChart').getContext('2d');

    if (hardestConstraintsChart) hardestConstraintsChart.destroy();

    hardestConstraintsChart = new Chart(hardestCtx, {
        type: 'bar',
        data: {
            labels: sortedConstraints.map(c => c.type),
            datasets: [{
                label: 'Satisfacción Promedio (%)',
                data: sortedConstraints.map(c => c.satisfaction),
                backgroundColor: sortedConstraints.map(c => {
                    const sat = c.satisfaction;
                    if (sat >= 90) return 'rgba(28, 200, 138, 0.7)';
                    if (sat >= 70) return 'rgba(246, 194, 62, 0.7)';
                    return 'rgba(231, 74, 59, 0.7)';
                }),
                borderColor: sortedConstraints.map(c => {
                    const sat = c.satisfaction;
                    if (sat >= 90) return 'rgba(28, 200, 138, 1)';
                    if (sat >= 70) return 'rgba(246, 194, 62, 1)';
                    return 'rgba(231, 74, 59, 1)';
                }),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            scales: {
                x: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Satisfacción (%)'
                    }
                }
            }
        }
    });
}