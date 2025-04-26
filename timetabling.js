// Proyecto de Timetabling en JavaScript
// Estructura principal del proyecto

// Constantes
const fs = (typeof require !== 'undefined') ? require('fs') : null;
const DAYS_OF_WEEK = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const HOURS_PER_DAY = 9; // Ej: 8:00 AM - 5:00 PM
const TIME_SLOTS = DAYS_OF_WEEK.length * HOURS_PER_DAY;

// Clases base
class Room {
    constructor(id, capacity, hasComputers = false) {
        this.id = id;
        this.capacity = capacity;
        this.hasComputers = hasComputers;
    }
}

class Professor {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.availability = Array(TIME_SLOTS).fill(true); // Por defecto disponible en todos los slots
    }

    // Establecer franjas horarias específicas de disponibilidad
    setAvailability(dayIndex, hourIndex, isAvailable) {
        const slotIndex = dayIndex * HOURS_PER_DAY + hourIndex;
        this.availability[slotIndex] = isAvailable;
    }
}

class StudentGroup {
    constructor(id, name, size) {
        this.id = id;
        this.name = name;
        this.size = size;
    }
}

class Course {
    constructor(id, name, professor, studentGroups, requiresComputers = false, duration = 1) {
        this.id = id;
        this.name = name;
        this.professor = professor;
        this.studentGroups = Array.isArray(studentGroups) ? studentGroups : [studentGroups];
        this.requiresComputers = requiresComputers;
        this.duration = duration; // Número de slots consecutivos que ocupa la clase
    }
}

class TimeSlot {
    constructor(dayIndex, hourIndex) {
        this.dayIndex = dayIndex;
        this.hourIndex = hourIndex;
    }

    toString() {
        return `${DAYS_OF_WEEK[this.dayIndex]}, ${this.hourIndex + 8}:00`; // Asumiendo que el día comienza a las 8:00
    }

    // Obtener índice global del slot
    getSlotIndex() {
        return this.dayIndex * HOURS_PER_DAY + this.hourIndex;
    }
}

class ClassAssignment {
    constructor(course, room, timeSlot) {
        this.course = course;
        this.room = room;
        this.timeSlot = timeSlot;
        this.score = 0; // Puntuación del asignamiento según restricciones
    }
}

// Chromosome representa una solución potencial (un horario completo)
class Chromosome {
    constructor() {
        this.classAssignments = []; // Lista de ClassAssignment
        this.fitness = 0;
    }

    // Añadir una asignación de clase
    addClassAssignment(classAssignment) {
        this.classAssignments.push(classAssignment);
    }

    // Calcular el fitness de este cromosoma
    calculateFitness() {
        let totalScore = 0;
        const maxScore = this.classAssignments.length * 5; // Máxima puntuación posible

        for (const assignment of this.classAssignments) {
            let assignmentScore = this.evaluateAssignment(assignment);
            totalScore += assignmentScore;
            assignment.score = assignmentScore;
        }

        this.fitness = maxScore > 0 ? totalScore / maxScore : 0;
        return this.fitness;
    }

    // Evaluar una asignación individual según las restricciones
    evaluateAssignment(assignment) {
        let score = 0;

        // 1. Verificar si hay un aula disponible (no hay conflicto)
        if (this.isRoomAvailableForAssignment(assignment)) {
            score++;
        }

        // 2. Verificar si el aula tiene computadoras si se requieren
        if (!assignment.course.requiresComputers ||
            (assignment.course.requiresComputers && assignment.room.hasComputers)) {
            score++;
        }

        // 3. Verificar si el aula tiene capacidad suficiente
        const totalStudents = assignment.course.studentGroups.reduce((sum, group) => sum + group.size, 0);
        if (assignment.room.capacity >= totalStudents) {
            score++;
        }

        // 4. Verificar si el profesor no tiene otra clase al mismo tiempo
        if (this.isProfessorAvailableForAssignment(assignment)) {
            score++;
        }

        // 5. Verificar si los grupos de estudiantes no tienen otras clases al mismo tiempo
        if (this.areStudentGroupsAvailableForAssignment(assignment)) {
            score++;
        }

        return score;
    }

    // Verificar si el aula está disponible para la asignación
    isRoomAvailableForAssignment(newAssignment) {
        for (const assignment of this.classAssignments) {
            if (assignment === newAssignment) continue;

            if (assignment.room.id === newAssignment.room.id) {
                // Verificar si hay superposición de tiempo
                const startSlot1 = assignment.timeSlot.getSlotIndex();
                const endSlot1 = startSlot1 + assignment.course.duration - 1;

                const startSlot2 = newAssignment.timeSlot.getSlotIndex();
                const endSlot2 = startSlot2 + newAssignment.course.duration - 1;

                if (startSlot1 <= endSlot2 && startSlot2 <= endSlot1) {
                    return false; // Hay superposición
                }
            }
        }
        return true;
    }

    // Verificar si el profesor está disponible para la asignación
    isProfessorAvailableForAssignment(newAssignment) {
        const professor = newAssignment.course.professor;
        const startSlot = newAssignment.timeSlot.getSlotIndex();
        const endSlot = startSlot + newAssignment.course.duration - 1;

        // Verificar la disponibilidad del profesor
        for (let i = startSlot; i <= endSlot; i++) {
            if (!professor.availability[i]) {
                return false;
            }
        }

        // Verificar si el profesor no tiene otra clase en ese tiempo
        for (const assignment of this.classAssignments) {
            if (assignment === newAssignment) continue;

            if (assignment.course.professor.id === professor.id) {
                const otherStartSlot = assignment.timeSlot.getSlotIndex();
                const otherEndSlot = otherStartSlot + assignment.course.duration - 1;

                if (startSlot <= otherEndSlot && otherStartSlot <= endSlot) {
                    return false; // El profesor ya tiene otra clase en ese tiempo
                }
            }
        }

        return true;
    }

    // Verificar si los grupos de estudiantes están disponibles para la asignación
    areStudentGroupsAvailableForAssignment(newAssignment) {
        const startSlot = newAssignment.timeSlot.getSlotIndex();
        const endSlot = startSlot + newAssignment.course.duration - 1;

        for (const group of newAssignment.course.studentGroups) {
            for (const assignment of this.classAssignments) {
                if (assignment === newAssignment) continue;

                // Verificar si este grupo está en otra clase
                if (assignment.course.studentGroups.some(g => g.id === group.id)) {
                    const otherStartSlot = assignment.timeSlot.getSlotIndex();
                    const otherEndSlot = otherStartSlot + assignment.course.duration - 1;

                    if (startSlot <= otherEndSlot && otherStartSlot <= endSlot) {
                        return false; // El grupo ya tiene otra clase en ese tiempo
                    }
                }
            }
        }

        return true;
    }
}

// Clase para generar y evaluar horarios
class TimetableGenerator {
    constructor(rooms, professors, studentGroups, courses) {
        this.rooms = rooms;
        this.professors = professors;
        this.studentGroups = studentGroups;
        this.courses = courses;

        // Configuración del algoritmo genético
        this.populationSize = 50;
        this.maxGenerations = 1000;
        this.mutationRate = 0.1;
        this.elitismCount = 5;

        // Lista de restricciones personalizadas
        this.hardConstraints = [];
        this.softConstraints = [];
    }

    // Añadir una restricción dura personalizada
    addHardConstraint(constraintFunction, description) {
        this.hardConstraints.push({ evaluate: constraintFunction, description });
    }

    // Añadir una restricción blanda personalizada
    addSoftConstraint(constraintFunction, weight, description) {
        this.softConstraints.push({ evaluate: constraintFunction, weight, description });
    }

    // Generar una población inicial aleatoria
    generateInitialPopulation() {
        const population = [];

        for (let i = 0; i < this.populationSize; i++) {
            const chromosome = new Chromosome();

            // Asignar cada curso a un aula y horario aleatorio
            for (const course of this.courses) {
                // Elegir un aula aleatoria
                const randomRoomIndex = Math.floor(Math.random() * this.rooms.length);
                const room = this.rooms[randomRoomIndex];

                // Elegir un slot de tiempo aleatorio
                const randomDayIndex = Math.floor(Math.random() * DAYS_OF_WEEK.length);
                const randomHourIndex = Math.floor(Math.random() * (HOURS_PER_DAY - course.duration + 1));
                const timeSlot = new TimeSlot(randomDayIndex, randomHourIndex);

                // Crear asignación y añadirla al cromosoma
                const assignment = new ClassAssignment(course, room, timeSlot);
                chromosome.addClassAssignment(assignment);
            }

            // Calcular fitness del cromosoma
            chromosome.calculateFitness();
            population.push(chromosome);
        }

        return population;
    }

    // Método principal para generar el horario
    generateTimetable() {
        let population = this.generateInitialPopulation();
        let bestChromosome = null;
        let bestFitness = 0;
        let generationsWithoutImprovement = 0;
        const maxGenerationsWithoutImprovement = 200;

        for (let generation = 0; generation < this.maxGenerations; generation++) {
            // Ordenar población por fitness (descendente)
            population.sort((a, b) => b.fitness - a.fitness);

            // Guardar el mejor cromosoma
            if (population[0].fitness > bestFitness) {
                bestFitness = population[0].fitness;
                bestChromosome = population[0];
                generationsWithoutImprovement = 0;

                console.log(`Generación ${generation}: Mejor fitness = ${bestFitness.toFixed(4)}`);

                // Si encontramos una solución perfecta, terminamos
                if (bestFitness >= 1.0) {
                    console.log("¡Solución perfecta encontrada!");
                    break;
                }
            } else {
                generationsWithoutImprovement++;

                // Mostrar progreso cada 100 generaciones
                if (generation % 100 === 0) {
                    console.log(`Generación ${generation}: Mejor fitness = ${bestFitness.toFixed(4)} (sin mejora por ${generationsWithoutImprovement} generaciones)`);
                }

                // Si no hay mejora por muchas generaciones, terminar
                if (generationsWithoutImprovement >= maxGenerationsWithoutImprovement) {
                    console.log(`Terminando: No hay mejora después de ${maxGenerationsWithoutImprovement} generaciones.`);
                    break;
                }
            }

            // Crear nueva población
            const newPopulation = [];

            // Elitismo: copiar los mejores cromosomas directamente
            for (let i = 0; i < this.elitismCount; i++) {
                newPopulation.push(population[i]);
            }

            // Generar el resto de la población con selección, cruce y mutación
            while (newPopulation.length < this.populationSize) {
                // Selección por torneo
                const parent1 = this.tournamentSelection(population);
                const parent2 = this.tournamentSelection(population);

                // Cruce
                const child = this.crossover(parent1, parent2);

                // Mutación
                if (Math.random() < this.mutationRate) {
                    this.mutate(child);
                }

                // Calcular fitness del hijo
                child.calculateFitness();

                // Añadir a la nueva población
                newPopulation.push(child);
            }

            // Reemplazar población
            population = newPopulation;
        }

        return bestChromosome;
    }

    // Selección por torneo
    tournamentSelection(population) {
        const tournamentSize = 3;
        let best = null;

        for (let i = 0; i < tournamentSize; i++) {
            const randomIndex = Math.floor(Math.random() * population.length);
            const chromosome = population[randomIndex];

            if (best === null || chromosome.fitness > best.fitness) {
                best = chromosome;
            }
        }

        return best;
    }

    // Operador de cruce
    crossover(parent1, parent2) {
        const child = new Chromosome();

        // Punto de cruce
        const crossoverPoint = Math.floor(Math.random() * this.courses.length);

        // Copiar asignaciones de ambos padres
        for (let i = 0; i < this.courses.length; i++) {
            const courseId = this.courses[i].id;
            let assignment;

            if (i < crossoverPoint) {
                assignment = parent1.classAssignments.find(a => a.course.id === courseId);
            } else {
                assignment = parent2.classAssignments.find(a => a.course.id === courseId);
            }

            // Si la asignación causa conflictos, intentar reparar
            if (!this.isValidAssignment(child, assignment)) {
                assignment = this.repairAssignment(child, assignment);
            }

            child.addClassAssignment(assignment);
        }

        return child;
    }

    // Verificar si una asignación es válida en el contexto actual
    isValidAssignment(chromosome, assignment) {
        // Implementación simple: comprobar si no hay conflictos de aula, profesor o grupo
        return chromosome.isRoomAvailableForAssignment(assignment) &&
            chromosome.isProfessorAvailableForAssignment(assignment) &&
            chromosome.areStudentGroupsAvailableForAssignment(assignment);
    }

    // Reparar una asignación problemática
    repairAssignment(chromosome, assignment) {
        // Crear una nueva asignación con el mismo curso pero diferente aula/horario
        const course = assignment.course;

        // Intentar diferentes combinaciones hasta encontrar una válida
        for (const room of this.rooms) {
            for (let dayIndex = 0; dayIndex < DAYS_OF_WEEK.length; dayIndex++) {
                for (let hourIndex = 0; hourIndex <= HOURS_PER_DAY - course.duration; hourIndex++) {
                    const timeSlot = new TimeSlot(dayIndex, hourIndex);
                    const newAssignment = new ClassAssignment(course, room, timeSlot);

                    if (this.isValidAssignment(chromosome, newAssignment)) {
                        return newAssignment;
                    }
                }
            }
        }

        // Si no se encuentra una combinación válida, devolver la original
        // (esto podría crear un horario inválido, pero es mejor que un error)
        return assignment;
    }

    // Operador de mutación
    mutate(chromosome) {
        // Elegir una asignación aleatoria para mutar
        const randomIndex = Math.floor(Math.random() * chromosome.classAssignments.length);
        const assignment = chromosome.classAssignments[randomIndex];

        // Determinar qué mutar (aula o horario)
        const mutationType = Math.random() < 0.5 ? 'room' : 'timeSlot';

        if (mutationType === 'room') {
            // Cambiar el aula
            const randomRoomIndex = Math.floor(Math.random() * this.rooms.length);
            const newRoom = this.rooms[randomRoomIndex];
            assignment.room = newRoom;
        } else {
            // Cambiar el horario
            const course = assignment.course;
            const randomDayIndex = Math.floor(Math.random() * DAYS_OF_WEEK.length);
            const randomHourIndex = Math.floor(Math.random() * (HOURS_PER_DAY - course.duration + 1));
            const newTimeSlot = new TimeSlot(randomDayIndex, randomHourIndex);
            assignment.timeSlot = newTimeSlot;
        }
    }
    // Imprimir el horario generado
    printTimetable(chromosome) {
        console.log("\n===== HORARIO GENERADO =====");
        console.log(`Fitness: ${chromosome.fitness.toFixed(4)}`);

        // Estructura para almacenar el horario en formato JSON
        const timetableJSON = {};

        // Inicializar la estructura JSON con todos los días y horas
        DAYS_OF_WEEK.forEach(day => {
            timetableJSON[day] = {};
            for (let hour = 0; hour < HOURS_PER_DAY; hour++) {
                timetableJSON[day][hour] = [];
            }
        });

        // Llenar la estructura JSON con las asignaciones
        for (const assignment of chromosome.classAssignments) {
            const dayName = DAYS_OF_WEEK[assignment.timeSlot.dayIndex];
            const startHour = assignment.timeSlot.hourIndex;
            const duration = assignment.course.duration;

            // Añadir la entrada principal para el inicio de la clase
            const mainEntry = {
                course: assignment.course.name,
                professor: assignment.course.professor.name,
                room: assignment.room.id,
                groups: assignment.course.studentGroups.map(g => g.name).join(', '),
                duration: duration,
                requiresComputers: assignment.course.requiresComputers,
                score: assignment.score // Puntuación de esta asignación específica
            };
            // Asegurarse de que el array existe (aunque ya debería por la inicialización)
            if (!timetableJSON[dayName][startHour]) {
                timetableJSON[dayName][startHour] = [];
            }
            timetableJSON[dayName][startHour].push(mainEntry);

            // Añadir entradas de continuación para las horas siguientes si dura más de 1 hora
            for (let i = 1; i < duration; i++) {
                const currentHour = startHour + i;
                // Verificar si la hora está dentro del rango diario
                if (currentHour < HOURS_PER_DAY) {
                    const continuationEntry = {
                        continuation: true,
                        course: assignment.course.name,
                        professor: assignment.course.professor.name,
                        room: assignment.room.id,
                        groups: assignment.course.studentGroups.map(g => g.name).join(', ')
                    };
                    // Asegurarse de que el array existe
                    if (!timetableJSON[dayName][currentHour]) {
                        timetableJSON[dayName][currentHour] = [];
                    }
                    timetableJSON[dayName][currentHour].push(continuationEntry);
                }
            }
        }

        // Imprimir la salida JSON formateada
        console.log("\n===== DATOS DEL HORARIO (JSON) =====");
        console.log("Copia estos datos para usar en el visualizador HTML:");
        const jsonOutput = JSON.stringify(timetableJSON, null, 2); // null, 2 para indentación
        console.log(jsonOutput);
        console.log("=====================================");

        // Intentar guardar el archivo si estamos en Node.js
        if (fs) {
            try {
                fs.writeFileSync('horario-data.json', jsonOutput, 'utf8');
                console.log("Archivo 'horario-data.json' guardado en el directorio actual.");
            } catch (error) {
                console.error("Error al guardar el archivo 'horario-data.json':", error);
            }
        } else {
            console.log("Guardado de archivo no disponible en este entorno (requiere Node.js). Copia la salida JSON de arriba.");
        }
    }
}

// Ejemplo de uso
function runExample() {
    // Crear aulas
    const rooms = [
        new Room("A101", 30, false),
        new Room("A102", 25, false),
        new Room("A103", 35, false),
        new Room("A104", 40, false),
        new Room("A105", 35, false),
        new Room("A106", 25, false),
        new Room("A107", 30, false),
        new Room("A108", 45, false),
        new Room("B201", 40, true),
        new Room("B202", 35, true),
        new Room("B203", 30, true),
        new Room("B204", 25, true),
        new Room("B205", 45, true),
        new Room("B206", 35, true),
        new Room("C301", 50, false),
        new Room("C302", 40, false),
        new Room("C303", 30, false),
        new Room("C304", 35, false),
        new Room("C305", 45, false),
        new Room("LAB101", 25, true),
        new Room("LAB102", 30, true),
        new Room("LAB103", 35, true),
        new Room("LAB104", 40, true) // Nueva aula con computadoras
    ];

    // Crear profesores
    const professors = [
        new Professor("P1", "Dr. García"),
        new Professor("P2", "Dra. Rodríguez"),
        new Professor("P3", "Dr. López"),
        new Professor("P4", "Dra. Martínez"),
        new Professor("P5", "Dr. Fernández"),
        new Professor("P6", "Dra. Sánchez"),
        new Professor("P7", "Dr. González"),
        new Professor("P8", "Dra. Pérez"),
        new Professor("P9", "Dr. Ramírez"),
        new Professor("P10", "Dra. Torres"),
        new Professor("P11", "Dr. Díaz"),
        new Professor("P12", "Dra. Ruiz"),
        new Professor("P13", "Dr. Morales"),
        new Professor("P14", "Dra. Jiménez"),
        new Professor("P15", "Dr. Castro")
    ];

    // Establecer algunas restricciones de disponibilidad para los profesores
    professors[0].setAvailability(0, 0, false); // El Dr. García no está disponible los lunes a primera hora
    professors[1].setAvailability(4, 8, false); // La Dra. Rodríguez no está disponible los viernes a última hora
    professors[2].setAvailability(2, 3, false); // Dr. López no está disponible los miércoles a la cuarta hora
    professors[3].setAvailability(1, 7, false); // Dra. Martínez no está disponible los martes a la octava hora
    professors[4].setAvailability(3, 0, false); // Dr. Fernández no está disponible los jueves a primera hora
    professors[5].setAvailability(0, 8, false); // Dra. Sánchez no está disponible los lunes a última hora
    professors[6].setAvailability(4, 4, false); // Dr. González no está disponible los viernes a la quinta hora
    professors[7].setAvailability(2, 6, false); // Dra. Pérez no está disponible los miércoles a la séptima hora
    professors[8].setAvailability(3, 2, false); // Dr. Ramírez no está disponible los jueves a la tercera hora
    professors[9].setAvailability(1, 1, false); // Dra. Torres no está disponible los martes a la segunda hora

    // Crear grupos de estudiantes
    const studentGroups = [
        new StudentGroup("G1", "1º A", 20),
        new StudentGroup("G2", "1º B", 15),
        new StudentGroup("G3", "1º C", 18),
        new StudentGroup("G4", "1º D", 22),
        new StudentGroup("G5", "2º A", 25),
        new StudentGroup("G6", "2º B", 22),
        new StudentGroup("G7", "2º C", 20),
        new StudentGroup("G8", "2º D", 24),
        new StudentGroup("G9", "3º A", 19),
        new StudentGroup("G10", "3º B", 21),
        new StudentGroup("G11", "3º C", 23),
        new StudentGroup("G12", "3º D", 17),
        new StudentGroup("G13", "4º A", 22),
        new StudentGroup("G14", "4º B", 20),
        new StudentGroup("G15", "4º C", 18)
    ];

    // Crear cursos
    const courses = [
        // Cursos de 1º
        new Course("C1", "Matemáticas I", professors[0], [studentGroups[0], studentGroups[1]], false, 2),
        new Course("C2", "Física I", professors[1], [studentGroups[0], studentGroups[2]], false, 2),
        new Course("C3", "Programación Básica", professors[2], [studentGroups[0], studentGroups[3]], true, 3),
        new Course("C4", "Introducción a Bases de Datos", professors[2], [studentGroups[1], studentGroups[2]], true, 2),
        new Course("C5", "Inglés Técnico I", professors[3], [studentGroups[0], studentGroups[1], studentGroups[2]], false, 1),
        new Course("C6", "Historia de la Computación", professors[1], studentGroups[1], false, 1),
        new Course("C7", "Álgebra Lineal", professors[0], [studentGroups[2], studentGroups[3]], false, 2),
        new Course("C8", "Introducción a Redes", professors[3], studentGroups[3], true, 2),
        new Course("C9", "Expresión Oral y Escrita", professors[4], [studentGroups[0], studentGroups[1]], false, 1),
        new Course("C10", "Metodología de la Investigación", professors[5], studentGroups[2], false, 1),
        new Course("C11", "Ética Profesional", professors[6], studentGroups[3], false, 1),
        new Course("C12", "Lógica Matemática", professors[7], [studentGroups[0], studentGroups[3]], false, 2),

        // Cursos de 2º
        new Course("C13", "Matemáticas II", professors[0], [studentGroups[4], studentGroups[5]], false, 2),
        new Course("C14", "Física II", professors[1], studentGroups[4], false, 2),
        new Course("C15", "Estructuras de Datos", professors[2], [studentGroups[4], studentGroups[7]], true, 2),
        new Course("C16", "Diseño de Bases de Datos", professors[8], [studentGroups[5], studentGroups[6]], true, 2),
        new Course("C17", "Inglés Técnico II", professors[3], [studentGroups[4], studentGroups[5], studentGroups[6]], false, 1),
        new Course("C18", "Arquitectura de Computadoras", professors[9], studentGroups[6], false, 2),
        new Course("C19", "Estadística", professors[10], [studentGroups[5], studentGroups[7]], false, 2),
        new Course("C20", "Redes Avanzadas", professors[3], studentGroups[7], true, 2),
        new Course("C21", "Sistemas Operativos", professors[11], [studentGroups[4], studentGroups[7]], true, 2),
        new Course("C22", "Análisis de Algoritmos", professors[12], [studentGroups[5], studentGroups[6]], false, 2),
        new Course("C23", "Matemáticas Discretas", professors[10], studentGroups[4], false, 1),
        new Course("C24", "Interfaces de Usuario", professors[13], studentGroups[6], true, 2),

        // Cursos de 3º
        new Course("C25", "Programación Avanzada", professors[2], [studentGroups[8], studentGroups[9]], true, 3),
        new Course("C26", "Ingeniería de Software", professors[13], [studentGroups[8], studentGroups[10]], false, 2),
        new Course("C27", "Inteligencia Artificial", professors[14], studentGroups[9], true, 2),
        new Course("C28", "Sistemas Distribuidos", professors[11], [studentGroups[10], studentGroups[11]], true, 2),
        new Course("C29", "Inglés Técnico III", professors[3], [studentGroups[8], studentGroups[9], studentGroups[10]], false, 1),
        new Course("C30", "Seguridad Informática", professors[9], studentGroups[11], true, 2),
        new Course("C31", "Análisis Numérico", professors[0], [studentGroups[8], studentGroups[11]], false, 2),
        new Course("C32", "Gestión de Proyectos", professors[5], studentGroups[10], false, 2),
        new Course("C33", "Programación Web", professors[12], [studentGroups[8], studentGroups[11]], true, 3),
        new Course("C34", "Bases de Datos Avanzadas", professors[8], studentGroups[9], true, 2),
        new Course("C35", "Computación Gráfica", professors[14], studentGroups[10], true, 2),
        new Course("C36", "Interacción Humano-Computadora", professors[13], studentGroups[11], false, 2),

        // Cursos de 4º
        new Course("C37", "Proyecto Final", professors[5], [studentGroups[12], studentGroups[13], studentGroups[14]], false, 4),
        new Course("C38", "Emprendimiento", professors[6], [studentGroups[12], studentGroups[13]], false, 2),
        new Course("C39", "Big Data", professors[8], studentGroups[12], true, 3),
        new Course("C40", "Cloud Computing", professors[11], [studentGroups[13], studentGroups[14]], true, 2),
        new Course("C41", "Inglés Técnico IV", professors[3], [studentGroups[12], studentGroups[13], studentGroups[14]], false, 1),
        new Course("C42", "Ética y Legislación", professors[6], studentGroups[14], false, 1),
        new Course("C43", "Aprendizaje Automático", professors[14], studentGroups[12], true, 3),
        new Course("C44", "Desarrollo Móvil", professors[12], studentGroups[13], true, 3),
        new Course("C45", "Sistemas Embebidos", professors[7], studentGroups[14], true, 2),
        new Course("C46", "Internet de las Cosas", professors[9], [studentGroups[12], studentGroups[14]], true, 2),
        new Course("C47", "Visión por Computadora", professors[14], studentGroups[13], true, 2),
        new Course("C48", "Auditoría de Sistemas", professors[10], studentGroups[12], false, 2),
        new Course("C49", "Minería de Datos", professors[8], studentGroups[13], true, 2),
        new Course("C50", "Calidad de Software", professors[4], studentGroups[14], false, 2),

        // Asignaturas optativas
        new Course("C51", "Blockchain", professors[9], [studentGroups[12], studentGroups[13]], true, 2),
        new Course("C52", "Robótica", professors[7], [studentGroups[10], studentGroups[14]], true, 3),
        new Course("C53", "Realidad Virtual", professors[14], [studentGroups[11], studentGroups[13]], true, 2),
        new Course("C54", "Comercio Electrónico", professors[6], [studentGroups[8], studentGroups[12]], false, 2),
        new Course("C55", "Bioinformática", professors[10], [studentGroups[9], studentGroups[14]], true, 2),
        new Course("C56", "Videojuegos", professors[12], [studentGroups[11], studentGroups[13]], true, 3),
        new Course("C57", "Ciberseguridad", professors[9], [studentGroups[10], studentGroups[12]], true, 2),
        new Course("C58", "Procesamiento de Lenguaje Natural", professors[14], [studentGroups[9], studentGroups[11]], true, 2)
    ];

    // Crear generador de horarios
    const generator = new TimetableGenerator(rooms, professors, studentGroups, courses);

    // Configurar parámetros para un problema más grande
    generator.populationSize = 200;    // Aumentado para manejar más cursos
    generator.maxGenerations = 5000;   // Más generaciones para mejorar convergencia
    generator.mutationRate = 0.15;     // Ligeramente aumentado para mayor diversidad
    generator.elitismCount = 15;       // Mantener más soluciones élite

    // Añadir una restricción dura personalizada (no clases después de las 4 PM para el grupo 1º A)
    generator.addHardConstraint(
        (assignment) => {
            if (assignment.course.studentGroups.some(g => g.id === "G1") && assignment.timeSlot.hourIndex >= 8) {
                return false; // No cumple la restricción
            }
            return true; // Cumple la restricción
        },
        "No clases después de las 4 PM para el grupo 1º A"
    );

    // Añadir una restricción blanda personalizada (preferir aulas con mayor capacidad)
    generator.addSoftConstraint(
        (assignment) => {
            const totalStudents = assignment.course.studentGroups.reduce((sum, group) => sum + group.size, 0);
            const extraCapacity = assignment.room.capacity - totalStudents;
            // Devolver un valor entre 0 y 1 basado en cuán bien se ajusta la capacidad
            if (extraCapacity < 0) return 0; // No hay capacidad suficiente
            if (extraCapacity > 20) return 0.5; // Demasiada capacidad extra (desperdicio)
            return 1 - (extraCapacity / 20); // Valor óptimo cuando hay poca capacidad extra
        },
        0.5, // Peso
        "Preferir aulas con capacidad ajustada al número de estudiantes"
    );

    // Generar horario
    console.log("Generando horario...");
    console.log(`Número total de cursos: ${courses.length}`);
    console.log(`Número total de profesores: ${professors.length}`);
    console.log(`Número total de aulas: ${rooms.length}`);
    console.log(`Número total de grupos: ${studentGroups.length}`);
    console.log("Iniciando algoritmo genético con una población de " + generator.populationSize);
    console.log("Máximo de generaciones: " + generator.maxGenerations);

    // Registrar tiempo de inicio
    const startTime = new Date();

    const bestTimetable = generator.generateTimetable();

    // Registrar tiempo de finalización
    const endTime = new Date();
    const executionTime = (endTime - startTime) / 1000; // en segundos

    console.log(`\nTiempo de ejecución: ${executionTime.toFixed(2)} segundos`);
    console.log(`Mejor fitness alcanzado: ${bestTimetable.fitness.toFixed(4)}`);

    // Análisis de restricciones incumplidas
    console.log("\nAnálisis de restricciones incumplidas:");
    let totalPossibleScore = courses.length * 5;
    let totalActualScore = bestTimetable.classAssignments.reduce((sum, assignment) => sum + assignment.score, 0);
    console.log(`Puntuación total: ${totalActualScore}/${totalPossibleScore}`);

    // Contar cuántas asignaciones tienen cada puntuación
    const scoreDistribution = [0, 0, 0, 0, 0, 0]; // Índice 0 a 5 para cada puntuación posible
    bestTimetable.classAssignments.forEach(assignment => {
        scoreDistribution[assignment.score]++;
    });

    // Mostrar distribución
    console.log("Distribución de puntuaciones:");
    for (let i = 0; i <= 5; i++) {
        console.log(`  Asignaciones con puntuación ${i}: ${scoreDistribution[i]} (${((scoreDistribution[i] / courses.length) * 100).toFixed(2)}%)`);
    }

    // Imprimir horario
    generator.printTimetable(bestTimetable);
}

// Ejecutar ejemplo
runExample();

// Exportar clases para uso en otros módulos
module.exports = {
    Room,
    Professor,
    StudentGroup,
    Course,
    TimeSlot,
    ClassAssignment,
    Chromosome,
    TimetableGenerator
};