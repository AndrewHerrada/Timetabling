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
    constructor(id, name, professor, studentGroups, requiresComputers = false, duration = 1,
        requiresConsecutiveSlots = true, requiredRoomId = null) {
        this.id = id;
        this.name = name;
        this.professor = professor;
        this.studentGroups = Array.isArray(studentGroups) ? studentGroups : [studentGroups];
        this.requiresComputers = requiresComputers;
        this.duration = duration; // Número de slots que ocupa la clase
        this.requiresConsecutiveSlots = requiresConsecutiveSlots; // Si requiere slots consecutivos
        this.requiredRoomId = requiredRoomId; // ID del aula específica requerida (si es necesario)
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
    constructor(course, room, timeSlot, secondaryTimeSlots = []) {
        this.course = course;
        this.room = room;
        this.timeSlot = timeSlot; // Slot principal
        this.secondaryTimeSlots = secondaryTimeSlots; // Array de slots secundarios para clases no consecutivas
        this.score = 0; // Puntuación del asignamiento según restricciones
    }

    // Método para obtener todos los slots de tiempo ocupados por esta asignación
    getAllTimeSlots() {
        const slots = [this.timeSlot];

        if (this.course.requiresConsecutiveSlots) {
            // Para clases con slots consecutivos, generamos los slots siguientes
            for (let i = 1; i < this.course.duration; i++) {
                const hourIndex = this.timeSlot.hourIndex + i;
                // Verificar que no excede las horas por día
                if (hourIndex < HOURS_PER_DAY) {
                    slots.push(new TimeSlot(this.timeSlot.dayIndex, hourIndex));
                }
            }
        } else {
            // Para clases con slots no consecutivos, añadimos los slots secundarios
            slots.push(...this.secondaryTimeSlots);
        }

        return slots;
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

        // 6. Verificar si se cumple el requisito de aula específica
        if (assignment.course.requiredRoomId !== null) {
            // Si se requiere un aula específica, verificar que se haya asignado esa aula
            if (assignment.room.id === assignment.course.requiredRoomId) {
                // Esta es una restricción dura, por lo que penalizamos fuertemente si no se cumple
                score++;
            } else {
                // Penalización severa (eliminamos todos los puntos) si no se asigna el aula requerida
                score = 0;
            }
        }

        // 7. Nueva restricción blanda para verificar si las clases de múltiples slots cumplen con el requisito de consecutividad
        if (assignment.course.duration > 1) {
            if (assignment.course.requiresConsecutiveSlots) {
                // Si requiere slots consecutivos, verificar que todos los slots están en el mismo día y son consecutivos
                const slots = assignment.getAllTimeSlots();
                const isConsecutive = slots.length === assignment.course.duration &&
                    slots.every((slot, index) =>
                        index === 0 ||
                        (slot.dayIndex === slots[index - 1].dayIndex &&
                            slot.hourIndex === slots[index - 1].hourIndex + 1)
                    );

                // Aquí podríamos añadir puntos adicionales, o restarlos si no se cumple
                // Por ejemplo, podríamos modificar el score final basado en esto
                if (!isConsecutive) {
                    score -= 0.5; // Penalización leve para esta restricción blanda
                }
            } else {
                // Si no requiere slots consecutivos, verificar que todos los slots están asignados
                const hasAllSlots = assignment.secondaryTimeSlots.length === assignment.course.duration - 1;
                if (!hasAllSlots) {
                    score -= 0.5; // Penalización leve si faltan slots
                }
            }
        }

        return score;
    }

    // Verificar si el aula está disponible para la asignación
    isRoomAvailableForAssignment(newAssignment) {
        const newSlots = newAssignment.getAllTimeSlots();

        for (const assignment of this.classAssignments) {
            if (assignment === newAssignment) continue;

            if (assignment.room.id === newAssignment.room.id) {
                const existingSlots = assignment.getAllTimeSlots();

                // Verificar si hay superposición entre alguno de los slots nuevos y existentes
                for (const newSlot of newSlots) {
                    for (const existingSlot of existingSlots) {
                        if (newSlot.dayIndex === existingSlot.dayIndex &&
                            newSlot.hourIndex === existingSlot.hourIndex) {
                            return false; // Hay superposición
                        }
                    }
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
                let room;

                // Si el curso requiere un aula específica, asignarla directamente
                if (course.requiredRoomId !== null) {
                    room = this.rooms.find(r => r.id === course.requiredRoomId);
                    // Si no se encuentra el aula requerida, asignar cualquier aula (pero tendrá penalización)
                    if (!room) {
                        const randomRoomIndex = Math.floor(Math.random() * this.rooms.length);
                        room = this.rooms[randomRoomIndex];
                    }
                } else {
                    // Si no requiere aula específica, asignar aleatoriamente
                    const randomRoomIndex = Math.floor(Math.random() * this.rooms.length);
                    room = this.rooms[randomRoomIndex];
                }

                // Elegir un slot de tiempo aleatorio principal
                const randomDayIndex = Math.floor(Math.random() * DAYS_OF_WEEK.length);
                const maxHourIndex = course.requiresConsecutiveSlots ?
                    (HOURS_PER_DAY - course.duration) :
                    (HOURS_PER_DAY - 1);
                const randomHourIndex = Math.floor(Math.random() * (maxHourIndex + 1));
                const timeSlot = new TimeSlot(randomDayIndex, randomHourIndex);

                // Generar slots secundarios para clases no consecutivas
                const secondaryTimeSlots = this.generateSecondaryTimeSlots(course, timeSlot);

                // Crear asignación y añadirla al cromosoma
                const assignment = new ClassAssignment(course, room, timeSlot, secondaryTimeSlots);
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
        let roomsToTry = this.rooms;

        // Si el curso requiere un aula específica, intentar primero con esa aula
        if (course.requiredRoomId !== null) {
            const requiredRoom = this.rooms.find(r => r.id === course.requiredRoomId);
            if (requiredRoom) {
                roomsToTry = [requiredRoom]; // Solo intentar con el aula requerida
            }
        }

        // Intentar diferentes combinaciones hasta encontrar una válida
        for (const room of roomsToTry) {
            for (let dayIndex = 0; dayIndex < DAYS_OF_WEEK.length; dayIndex++) {
                const maxHourIndex = course.requiresConsecutiveSlots ?
                    (HOURS_PER_DAY - course.duration) :
                    (HOURS_PER_DAY - 1);

                for (let hourIndex = 0; hourIndex <= maxHourIndex; hourIndex++) {
                    const timeSlot = new TimeSlot(dayIndex, hourIndex);

                    // Para clases no consecutivas, generar slots secundarios
                    let secondaryTimeSlots = [];
                    if (!course.requiresConsecutiveSlots && course.duration > 1) {
                        secondaryTimeSlots = this.generateSecondaryTimeSlots(course, timeSlot);
                    }

                    const newAssignment = new ClassAssignment(course, room, timeSlot, secondaryTimeSlots);

                    if (this.isValidAssignment(chromosome, newAssignment)) {
                        return newAssignment;
                    }
                }
            }
        }

        // Si no se encontró una combinación válida con el aula requerida, 
        // y hay más aulas disponibles, intentar con otras aulas
        if (course.requiredRoomId !== null && roomsToTry.length === 1 && this.rooms.length > 1) {
            const otherRooms = this.rooms.filter(r => r.id !== course.requiredRoomId);

            for (const room of otherRooms) {
                for (let dayIndex = 0; dayIndex < DAYS_OF_WEEK.length; dayIndex++) {
                    const maxHourIndex = course.requiresConsecutiveSlots ?
                        (HOURS_PER_DAY - course.duration) :
                        (HOURS_PER_DAY - 1);

                    for (let hourIndex = 0; hourIndex <= maxHourIndex; hourIndex++) {
                        const timeSlot = new TimeSlot(dayIndex, hourIndex);

                        // Para clases no consecutivas, generar slots secundarios
                        let secondaryTimeSlots = [];
                        if (!course.requiresConsecutiveSlots && course.duration > 1) {
                            secondaryTimeSlots = this.generateSecondaryTimeSlots(course, timeSlot);
                        }

                        const newAssignment = new ClassAssignment(course, room, timeSlot, secondaryTimeSlots);

                        if (this.isValidAssignment(chromosome, newAssignment)) {
                            return newAssignment;
                        }
                    }
                }
            }
        }

        // Si no se encuentra una combinación válida, devolver la original
        // (esto podría crear un horario inválido, pero es mejor que un error)
        return assignment;
    }
    isRoomRequirementSatisfied(assignment) {
        if (assignment.course.requiredRoomId === null) {
            return true; // No hay requisito específico de aula
        }

        return assignment.room.id === assignment.course.requiredRoomId;
    }

    // 6. Añadir método para verificar si una asignación es válida modificado
    isValidAssignment(chromosome, assignment) {
        // Implementación simple: comprobar si no hay conflictos
        return chromosome.isRoomAvailableForAssignment(assignment) &&
            chromosome.isProfessorAvailableForAssignment(assignment) &&
            chromosome.areStudentGroupsAvailableForAssignment(assignment) &&
            this.isRoomRequirementSatisfied(assignment); // Nueva verificación para aula específica
    }


    // Operador de mutación
    mutate(chromosome) {
        // Elegir una asignación aleatoria para mutar
        const randomIndex = Math.floor(Math.random() * chromosome.classAssignments.length);
        const assignment = chromosome.classAssignments[randomIndex];
        const course = assignment.course;

        // Determinar qué mutar (aula o horario)
        let mutationType;

        // Si el curso requiere un aula específica, solo mutamos el horario
        if (course.requiredRoomId !== null) {
            mutationType = 'timeSlot';
        } else {
            // Si no hay requisito específico, mutamos aleatoriamente aula o horario
            mutationType = Math.random() < 0.5 ? 'room' : 'timeSlot';
        }

        if (mutationType === 'room' && !course.requiredRoomId) {
            // Cambiar el aula solo si no hay requisito específico
            const randomRoomIndex = Math.floor(Math.random() * this.rooms.length);
            const newRoom = this.rooms[randomRoomIndex];
            assignment.room = newRoom;
        } else {
            // Cambiar el horario
            const randomDayIndex = Math.floor(Math.random() * DAYS_OF_WEEK.length);
            const maxHourIndex = course.requiresConsecutiveSlots ?
                (HOURS_PER_DAY - course.duration) :
                (HOURS_PER_DAY - 1);
            const randomHourIndex = Math.floor(Math.random() * (maxHourIndex + 1));
            const newTimeSlot = new TimeSlot(randomDayIndex, randomHourIndex);

            // Para clases no consecutivas, generar nuevos slots secundarios
            if (!course.requiresConsecutiveSlots && course.duration > 1) {
                const newSecondaryTimeSlots = this.generateSecondaryTimeSlots(course, newTimeSlot);
                assignment.secondaryTimeSlots = newSecondaryTimeSlots;
            }

            assignment.timeSlot = newTimeSlot;
        }
    }
    generateSecondaryTimeSlots(course, mainTimeSlot) {
        if (course.requiresConsecutiveSlots || course.duration <= 1) {
            return [];
        }

        const secondarySlots = [];
        const remainingSlots = course.duration - 1;

        // Generar slots secundarios aleatorios diferentes al principal
        while (secondarySlots.length < remainingSlots) {
            const randomDayIndex = Math.floor(Math.random() * DAYS_OF_WEEK.length);
            const randomHourIndex = Math.floor(Math.random() * HOURS_PER_DAY);
            const slot = new TimeSlot(randomDayIndex, randomHourIndex);

            // Verificar que no sea igual al slot principal o a uno ya añadido
            const isUniqueSlot = (
                (slot.dayIndex !== mainTimeSlot.dayIndex || slot.hourIndex !== mainTimeSlot.hourIndex) &&
                !secondarySlots.some(s => s.dayIndex === slot.dayIndex && s.hourIndex === slot.hourIndex)
            );

            if (isUniqueSlot) {
                secondarySlots.push(slot);
            }
        }

        return secondarySlots;
    }
    addSpecificRoomConstraint() {
        this.addHardConstraint(
            (assignment) => {
                if (assignment.course.requiredRoomId === null) {
                    return true; // No hay requisito específico
                }
                return assignment.room.id === assignment.course.requiredRoomId;
            },
            "Asignar aulas específicas a cursos que las requieren"
        );
    }
    addConsecutiveSlotsConstraint() {
        this.addSoftConstraint(
            (assignment) => {
                if (assignment.course.duration <= 1) return 1.0; // No aplica para clases de un solo slot

                if (assignment.course.requiresConsecutiveSlots) {
                    // Verificar que todos los slots son consecutivos
                    const slots = assignment.getAllTimeSlots();
                    const isConsecutive = slots.length === assignment.course.duration &&
                        slots.every((slot, index) =>
                            index === 0 ||
                            (slot.dayIndex === slots[index - 1].dayIndex &&
                                slot.hourIndex === slots[index - 1].hourIndex + 1)
                        );

                    return isConsecutive ? 1.0 : 0.0;
                } else {
                    // Para clases no consecutivas, verificar que todos los slots están en el mismo aula
                    return assignment.secondaryTimeSlots.length === (assignment.course.duration - 1) ? 1.0 : 0.0;
                }
            },
            0.5, // Peso
            "Preferir clases con slots consecutivos cuando sea requerido"
        );
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
            // Procesar el slot principal
            this.addAssignmentToJSON(timetableJSON, assignment, assignment.timeSlot, false);

            // Procesar slots secundarios para clases no consecutivas
            if (!assignment.course.requiresConsecutiveSlots && assignment.secondaryTimeSlots) {
                for (const slot of assignment.secondaryTimeSlots) {
                    this.addAssignmentToJSON(timetableJSON, assignment, slot, false);
                }
            }
            // Procesar slots consecutivos
            else if (assignment.course.requiresConsecutiveSlots && assignment.course.duration > 1) {
                for (let i = 1; i < assignment.course.duration; i++) {
                    const hourIndex = assignment.timeSlot.hourIndex + i;
                    if (hourIndex < HOURS_PER_DAY) {
                        const continuationSlot = new TimeSlot(assignment.timeSlot.dayIndex, hourIndex);
                        this.addAssignmentToJSON(timetableJSON, assignment, continuationSlot, true);
                    }
                }
            }
        }

        // Imprimir la salida JSON formateada
        console.log("\n===== DATOS DEL HORARIO (JSON) =====");
        console.log("Copia estos datos para usar en el visualizador HTML:");
        const jsonOutput = JSON.stringify(timetableJSON, null, 2);
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
    // 9. Modificar el método printTimetable para incluir información sobre aulas específicas
    addAssignmentToJSON(timetableJSON, assignment, slot, isContinuation) {
        const dayName = DAYS_OF_WEEK[slot.dayIndex];
        const hour = slot.hourIndex;

        // Crear la entrada para el horario
        const entry = {
            course: assignment.course.name,
            professor: assignment.course.professor.name,
            room: assignment.room.id,
            groups: assignment.course.studentGroups.map(g => g.name).join(', '),
            duration: assignment.course.duration,
            requiresComputers: assignment.course.requiresComputers,
            requiresConsecutiveSlots: assignment.course.requiresConsecutiveSlots,
            requiredRoomId: assignment.course.requiredRoomId, // Añadir información de aula requerida
            roomRequirementSatisfied: this.isRoomRequirementSatisfied(assignment), // Indicar si se cumple
            continuation: isContinuation,
            score: assignment.score
        };

        // Asegurarse de que el array existe
        if (!timetableJSON[dayName][hour]) {
            timetableJSON[dayName][hour] = [];
        }

        timetableJSON[dayName][hour].push(entry);
    }
}

// Ejemplo de uso
function runExample() {
    // Crear aulas, incluyendo las específicas para música y clases audio-visuales
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
        new Room("LAB104", 40, true),
        new Room("D217", 30, false), // Sala específica para música con teclados
        new Room("D218", 35, false)  // Sala específica para clases audio-visuales
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

    // Crear cursos con la nueva estructura que incluye requiredRoomId
    const courses = [
        // Cursos de 1º - algunos requieren slots consecutivos y otros no
        new Course("C1", "Matemáticas I", professors[0], [studentGroups[0], studentGroups[1]], false, 2, true),
        new Course("C2", "Física I", professors[1], [studentGroups[0], studentGroups[2]], false, 2, false),
        new Course("C3", "Programación Básica", professors[2], [studentGroups[0], studentGroups[3]], true, 3, true),
        new Course("C4", "Introducción a Bases de Datos", professors[2], [studentGroups[1], studentGroups[2]], true, 2, false),
        new Course("C5", "Inglés Técnico I", professors[3], [studentGroups[0], studentGroups[1], studentGroups[2]], false, 1, true),
        new Course("C6", "Historia de la Computación", professors[1], studentGroups[1], false, 1, true),

        // Curso de música que requiere la sala D217 con teclados
        new Course("C7", "Música", professors[3], [studentGroups[2], studentGroups[3]], false, 2, true, "D217"),

        new Course("C8", "Introducción a Redes", professors[3], studentGroups[3], true, 2, false),
        new Course("C9", "Expresión Oral y Escrita", professors[4], [studentGroups[0], studentGroups[1]], false, 1, true),
        new Course("C10", "Metodología de la Investigación", professors[5], studentGroups[2], false, 1, true),

        // Curso de acústica que requiere la sala D218 audiovisual
        new Course("C11", "Acústica", professors[4], studentGroups[3], false, 2, false, "D218"),

        new Course("C12", "Lógica Matemática", professors[7], [studentGroups[0], studentGroups[3]], false, 2, true),

        // Cursos de 2º
        new Course("C13", "Matemáticas II", professors[0], [studentGroups[4], studentGroups[5]], false, 2, true),
        new Course("C14", "Física II", professors[1], studentGroups[4], false, 2, false),
        new Course("C15", "Estructuras de Datos", professors[2], [studentGroups[4], studentGroups[7]], true, 2, true),

        // Curso de piano que requiere la sala D217
        new Course("C16", "Piano", professors[8], [studentGroups[5], studentGroups[6]], false, 2, true, "D217"),

        new Course("C17", "Inglés Técnico II", professors[3], [studentGroups[4], studentGroups[5], studentGroups[6]], false, 1, true),
        new Course("C18", "Arquitectura de Computadoras", professors[9], studentGroups[6], false, 2, false),
        new Course("C19", "Estadística", professors[10], [studentGroups[5], studentGroups[7]], false, 2, true),

        // Curso de producción audiovisual que requiere la sala D218
        new Course("C20", "Producción Audiovisual", professors[9], studentGroups[7], false, 3, true, "D218"),

        // Cursos de 3º
        new Course("C21", "Sistemas Operativos", professors[11], [studentGroups[8], studentGroups[9]], true, 2, true),
        new Course("C22", "Análisis de Algoritmos", professors[12], [studentGroups[8], studentGroups[10]], false, 2, false),

        // Curso de composición musical que requiere D217
        new Course("C23", "Composición Musical", professors[12], studentGroups[11], false, 2, true, "D217"),

        new Course("C24", "Interfaces de Usuario", professors[13], studentGroups[9], true, 2, true)
    ];

    // Crear generador de horarios
    const generator = new TimetableGenerator(rooms, professors, studentGroups, courses);

    // Configurar parámetros
    generator.populationSize = 200;
    generator.maxGenerations = 1000;
    generator.mutationRate = 0.15;
    generator.elitismCount = 15;

    // Añadir restricciones
    generator.addConsecutiveSlotsConstraint();
    generator.addSpecificRoomConstraint(); // Añadir la nueva restricción de aula específica

    // Añadir restricción dura personalizada (no clases después de las 4 PM para el grupo 1º A)
    generator.addHardConstraint(
        (assignment) => {
            if (assignment.course.studentGroups.some(g => g.id === "G1") && assignment.timeSlot.hourIndex >= 8) {
                return false; // No cumple la restricción
            }
            return true; // Cumple la restricción
        },
        "No clases después de las 4 PM para el grupo 1º A"
    );

    // Añadir restricción blanda personalizada (preferir aulas con mayor capacidad)
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
        scoreDistribution[Math.round(assignment.score)]++; // Redondeamos por si hay puntuaciones con decimales
    });

    // Mostrar distribución
    console.log("Distribución de puntuaciones:");
    for (let i = 0; i <= 5; i++) {
        console.log(`  Asignaciones con puntuación ${i}: ${scoreDistribution[i]} (${((scoreDistribution[i] / courses.length) * 100).toFixed(2)}%)`);
    }

    // Análisis de restricción de slots consecutivos/no consecutivos
    console.log("\nAnálisis de restricción de slots consecutivos/no consecutivos:");
    let consecutiveRequired = 0;
    let consecutiveRequiredFulfilled = 0;
    let nonConsecutiveRequired = 0;
    let nonConsecutiveRequiredFulfilled = 0;

    bestTimetable.classAssignments.forEach(assignment => {
        const course = assignment.course;
        if (course.duration > 1) {
            if (course.requiresConsecutiveSlots) {
                consecutiveRequired++;

                // Verificar si todos los slots son consecutivos
                const slots = assignment.getAllTimeSlots();
                const isConsecutive = slots.length === course.duration &&
                    slots.every((slot, index) =>
                        index === 0 ||
                        (slot.dayIndex === slots[index - 1].dayIndex &&
                            slot.hourIndex === slots[index - 1].hourIndex + 1)
                    );

                if (isConsecutive) {
                    consecutiveRequiredFulfilled++;
                }
            } else {
                nonConsecutiveRequired++;

                // Verificar si tiene todos los slots secundarios necesarios
                if (assignment.secondaryTimeSlots &&
                    assignment.secondaryTimeSlots.length === course.duration - 1) {
                    nonConsecutiveRequiredFulfilled++;
                }
            }
        }
    });

    console.log(`  Cursos que requieren slots consecutivos: ${consecutiveRequiredFulfilled}/${consecutiveRequired} cumplidos (${((consecutiveRequiredFulfilled / consecutiveRequired) * 100).toFixed(2)}%)`);
    console.log(`  Cursos que requieren slots NO consecutivos: ${nonConsecutiveRequiredFulfilled}/${nonConsecutiveRequired} cumplidos (${((nonConsecutiveRequiredFulfilled / nonConsecutiveRequired) * 100).toFixed(2)}%)`);

    // Análisis de requisitos de aula específica
    console.log("\nAnálisis de requisitos de aula específica:");
    let coursesWithSpecificRoom = 0;
    let specificRoomRequirementsFulfilled = 0;

    bestTimetable.classAssignments.forEach(assignment => {
        if (assignment.course.requiredRoomId !== null) {
            coursesWithSpecificRoom++;
            if (assignment.room.id === assignment.course.requiredRoomId) {
                specificRoomRequirementsFulfilled++;
            }
        }
    });

    console.log(`  Cursos con requisito de aula específica: ${specificRoomRequirementsFulfilled}/${coursesWithSpecificRoom} cumplidos (${((specificRoomRequirementsFulfilled / coursesWithSpecificRoom) * 100).toFixed(2)}%)`);

    if (specificRoomRequirementsFulfilled < coursesWithSpecificRoom) {
        console.log("\n  Detalles de cursos con requisitos de aula específica no cumplidos:");
        bestTimetable.classAssignments.forEach(assignment => {
            if (assignment.course.requiredRoomId !== null &&
                assignment.room.id !== assignment.course.requiredRoomId) {
                console.log(`    - Curso "${assignment.course.name}" (requiere aula ${assignment.course.requiredRoomId}) asignado a ${assignment.room.id}`);
            }
        });
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