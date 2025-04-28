// Proyecto de Timetabling en JavaScript
// Estructura principal del proyecto

// Constantes
const fs = (typeof require !== 'undefined') ? require('fs') : null;
const DAYS_OF_WEEK = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
//const HOURS_PER_DAY = 9; // Ej: 8:00 AM - 5:00 PM
const HOURS_PER_DAY = 6; // 15:00 - 21:00
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

    // toString() {
    //     return `${DAYS_OF_WEEK[this.dayIndex]}, ${this.hourIndex + 8}:00`; // Asumiendo que el día comienza a las 8:00
    // }
    toString() {
        return `${DAYS_OF_WEEK[this.dayIndex]}, ${this.hourIndex + 15}:00`; // Día comienza a las 15:00
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

        // Calcular el total de estudiantes en esta asignación
        const totalStudents = assignment.course.studentGroups.reduce((sum, group) => sum + group.size, 0);

        // 1. RESTRICCIÓN DURA: Verificar si hay un aula disponible (no hay conflicto)
        if (this.isRoomAvailableForAssignment(assignment)) {
            score += 1;
        } else {
            // Penalización severa: si el aula no está disponible, puntuación cero
            return 0;
        }

        // 2. Verificar si el aula tiene computadoras si se requieren
        if (!assignment.course.requiresComputers ||
            (assignment.course.requiresComputers && assignment.room.hasComputers)) {
            score += 1;
        }

        // 3. Verificar si el aula tiene capacidad suficiente
        if (assignment.room.capacity >= totalStudents) {
            score += 1;
        } else {
            // Si el aula no tiene capacidad suficiente, penalización severa
            return 0;
        }

        // 4. Verificar si el profesor no tiene otra clase al mismo tiempo
        if (this.isProfessorAvailableForAssignment(assignment)) {
            score += 1;
        }

        // 5. Verificar si los grupos de estudiantes no tienen otras clases al mismo tiempo
        if (this.areStudentGroupsAvailableForAssignment(assignment)) {
            score += 1;
        } else {
            // Penalización severa
            return 0;
        }

        // 6. Verificar si se cumple el requisito de aula específica
        if (assignment.course.requiredRoomId !== null) {
            if (assignment.room.id === assignment.course.requiredRoomId) {
                score += 1;
            } else {
                score = 0; // Penalización severa
            }
        }

        // 7. Restricción de slots consecutivos
        if (assignment.course.duration > 1) {
            if (assignment.course.requiresConsecutiveSlots) {
                const slots = assignment.getAllTimeSlots();
                const isConsecutive = slots.length === assignment.course.duration &&
                    slots.every((slot, index) =>
                        index === 0 ||
                        (slot.dayIndex === slots[index - 1].dayIndex &&
                            slot.hourIndex === slots[index - 1].hourIndex + 1)
                    );

                if (!isConsecutive) {
                    score -= 0.5;
                }
            } else {
                const hasAllSlots = assignment.secondaryTimeSlots.length === assignment.course.duration - 1;
                if (!hasAllSlots) {
                    score -= 0.5;
                }
            }
        }

        // 8. Restricción de horario para grupos específicos
        const restrictedGroups = ["G7", "G8", "G9", "G10", "G11", "G12", "G13", "G14"];
        if (assignment.course.studentGroups.some(g => restrictedGroups.includes(g.id))) {
            if (assignment.timeSlot.hourIndex >= 4) {
                score = 0;
            }

            const allSlots = assignment.getAllTimeSlots();
            for (const slot of allSlots) {
                if (slot.hourIndex >= 4) {
                    score = 0;
                    break;
                }
            }
        }

        return score;
    }

    // Verificar si el aula está disponible para la asignación
    isRoomAvailableForAssignment(newAssignment) {
        // Obtener todos los slots de tiempo que ocupará la nueva asignación
        const newSlots = newAssignment.getAllTimeSlots();

        // Verificar contra todas las asignaciones existentes
        for (const assignment of this.classAssignments) {
            // Ignorar la asignación que estamos evaluando
            if (assignment === newAssignment) continue;

            // Sólo verificar si es la misma aula
            if (assignment.room.id === newAssignment.room.id) {
                const existingSlots = assignment.getAllTimeSlots();

                // Comprobación más explícita de la superposición
                for (const newSlot of newSlots) {
                    for (const existingSlot of existingSlots) {
                        // Si coincide el día y la hora, hay un conflicto
                        if (newSlot.dayIndex === existingSlot.dayIndex &&
                            newSlot.hourIndex === existingSlot.hourIndex) {
                            // console.log(`Conflicto de aula detectado: ${newAssignment.course.name} y ${assignment.course.name} en aula ${assignment.room.id} en slot ${newSlot.dayIndex},${newSlot.hourIndex}`);
                            return false; // Aula ocupada
                        }
                    }
                }
            }
        }

        // Si no encontramos conflictos, el aula está disponible
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

    // Método corregido para verificar la disponibilidad de grupos de estudiantes
    // 1. MEJORAR EL MÉTODO DE VERIFICACIÓN DE CONFLICTOS DE GRUPOS
    areStudentGroupsAvailableForAssignment(newAssignment) {
        // Obtener todos los slots de tiempo que ocupará la nueva asignación
        const newSlots = newAssignment.getAllTimeSlots();

        // Para cada grupo de estudiantes en la nueva asignación
        for (const group of newAssignment.course.studentGroups) {
            // Buscar todas las asignaciones existentes que involucran a este grupo
            for (const existingAssignment of this.classAssignments) {
                // Ignorar la asignación que estamos evaluando
                if (existingAssignment === newAssignment) continue;

                // Verificar si este grupo está en la asignación existente
                if (existingAssignment.course.studentGroups.some(g => g.id === group.id)) {
                    // Obtener todos los slots que ocupa la asignación existente
                    const existingSlots = existingAssignment.getAllTimeSlots();

                    // Comprobar si hay alguna superposición entre los slots
                    for (const newSlot of newSlots) {
                        for (const existingSlot of existingSlots) {
                            // Si el día y la hora coinciden, hay un conflicto
                            if (newSlot.dayIndex === existingSlot.dayIndex &&
                                newSlot.hourIndex === existingSlot.hourIndex) {
                                // Agregar log para verificar
                                // console.log(`Conflicto detectado para grupo ${group.id}: ${newSlot.dayIndex},${newSlot.hourIndex}`);
                                return false; // Conflicto encontrado
                            }
                        }
                    }
                }
            }
        }

        // Si llegamos aquí, no se encontraron conflictos
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

            // Mantener un contador de uso de cada aula para mejor distribución
            const roomUsageCount = {};
            this.rooms.forEach(room => {
                roomUsageCount[room.id] = 0;
            });

            // Asignar cada curso a un aula y horario aleatorio
            for (const course of this.courses) {
                let room;

                // Calcular el total de estudiantes en este curso
                const totalStudents = course.studentGroups.reduce((sum, group) => sum + group.size, 0);

                // Si el curso requiere un aula específica, asignarla directamente
                if (course.requiredRoomId !== null) {
                    room = this.rooms.find(r => r.id === course.requiredRoomId);
                    // Si no se encuentra el aula requerida, asignar cualquier aula con capacidad suficiente
                    if (!room) {
                        const suitableRooms = this.rooms.filter(r => r.capacity >= totalStudents);
                        if (suitableRooms.length > 0) {
                            // Preferir las aulas menos utilizadas
                            suitableRooms.sort((a, b) => roomUsageCount[a.id] - roomUsageCount[b.id]);
                            room = suitableRooms[0];
                        } else {
                            // Si no hay aulas con capacidad suficiente, elegir la más grande
                            room = this.rooms.reduce((largest, current) =>
                                current.capacity > largest.capacity ? current : largest, this.rooms[0]);
                        }
                    }
                } else {
                    // MODIFICACIÓN: Distribución balanceada entre todas las aulas
                    // Filtrar aulas con capacidad suficiente
                    let suitableRooms = this.rooms.filter(r => r.capacity >= totalStudents);

                    // Si no hay aulas con capacidad suficiente, usar todas
                    if (suitableRooms.length === 0) {
                        suitableRooms = this.rooms;
                    }

                    // Ordenar por uso (primero las menos utilizadas)
                    suitableRooms.sort((a, b) => roomUsageCount[a.id] - roomUsageCount[b.id]);

                    // Para cursos con múltiples grupos, considerar aulas grandes pero seguir prefiriendo las menos usadas
                    if (course.studentGroups.length > 1 || totalStudents > 50) {
                        // Primero intentar con aulas grandes menos utilizadas
                        const largeRooms = suitableRooms.filter(r => r.capacity >= 100);
                        if (largeRooms.length > 0) {
                            // Elegir entre el 20% de las menos utilizadas para mantener variedad
                            const candidateCount = Math.max(1, Math.ceil(largeRooms.length * 0.2));
                            const randomIndex = Math.floor(Math.random() * candidateCount);
                            room = largeRooms[randomIndex];
                        } else {
                            // Si no hay aulas grandes, elegir entre las disponibles menos utilizadas
                            const candidateCount = Math.max(1, Math.ceil(suitableRooms.length * 0.2));
                            const randomIndex = Math.floor(Math.random() * candidateCount);
                            room = suitableRooms[randomIndex];
                        }
                    } else {
                        // Para cursos normales, elegir entre el 30% de las menos utilizadas
                        const candidateCount = Math.max(1, Math.ceil(suitableRooms.length * 0.3));
                        const randomIndex = Math.floor(Math.random() * candidateCount);
                        room = suitableRooms[randomIndex];
                    }
                }

                // Actualizar el contador de uso para el aula seleccionada
                roomUsageCount[room.id] = (roomUsageCount[room.id] || 0) + 1;

                // Elegir un slot de tiempo aleatorio principal
                const randomDayIndex = Math.floor(Math.random() * 5); // 5 días
                const maxHourIndex = course.requiresConsecutiveSlots ?
                    (6 - course.duration) : // 6 horas por día
                    (6 - 1);
                let randomHourIndex = Math.floor(Math.random() * (maxHourIndex + 1));

                // Restricción para grupos específicos
                const restrictedGroups = ["G7", "G8", "G9", "G10", "G11", "G12", "G13", "G14"];
                if (course.studentGroups.some(g => restrictedGroups.includes(g.id))) {
                    // Limitar a slots antes de las 19:00 (índice < 4)
                    const maxAllowedHourIndex = Math.min(maxHourIndex, 3);
                    randomHourIndex = Math.floor(Math.random() * (maxAllowedHourIndex + 1));
                }

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

            // VERIFICAR EXPLÍCITAMENTE CONFLICTOS DE AULA EN CADA GENERACIÓN
            for (const chromosome of population) {
                this.checkRoomConflicts(chromosome);
            }

            // Volver a ordenar después de verificar conflictos
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

                // VERIFICAR EXPLÍCITAMENTE CONFLICTOS DE AULA EN CADA NUEVO HIJO
                this.checkRoomConflicts(child);

                // Añadir a la nueva población
                newPopulation.push(child);
            }

            // Reemplazar población
            population = newPopulation;
        }

        // VERIFICAR UNA VEZ MÁS EL MEJOR CROMOSOMA
        if (bestChromosome) {
            this.checkRoomConflicts(bestChromosome);
            bestChromosome.calculateFitness();

            // Aplicar post-procesamiento para eliminar conflictos residuales
            bestChromosome = this.postProcessSchedule(bestChromosome);
        }

        return bestChromosome;
    }
    postProcessSchedule(chromosome) {
        // Copiar el cromosoma
        const newChromosome = new Chromosome();
        const processedAssignments = [];

        // Ordenar asignaciones por complejidad (número de grupos, duración, etc.)
        const sortedAssignments = [...chromosome.classAssignments];
        sortedAssignments.sort((a, b) => {
            // Priorizar asignaciones con más grupos
            const groupDiff = b.course.studentGroups.length - a.course.studentGroups.length;
            if (groupDiff !== 0) return groupDiff;

            // Luego por duración (primero las más largas)
            const durationDiff = b.course.duration - a.course.duration;
            if (durationDiff !== 0) return durationDiff;

            // Finalmente por tamaño total de estudiantes
            const sizeA = a.course.studentGroups.reduce((sum, g) => sum + g.size, 0);
            const sizeB = b.course.studentGroups.reduce((sum, g) => sum + g.size, 0);
            return sizeB - sizeA;
        });

        // Primero agregar todas las asignaciones una por una, verificando que no causen conflictos
        for (const assignment of sortedAssignments) {
            const tempChromosome = new Chromosome();
            for (const processed of processedAssignments) {
                tempChromosome.addClassAssignment(processed);
            }

            // Verificar si esta asignación causa conflictos
            const hasRoomConflict = !tempChromosome.isRoomAvailableForAssignment(assignment);
            const hasGroupConflict = !tempChromosome.areStudentGroupsAvailableForAssignment(assignment);
            const hasProfessorConflict = !tempChromosome.isProfessorAvailableForAssignment(assignment);

            if (!hasRoomConflict && !hasGroupConflict && !hasProfessorConflict) {
                // Si no hay conflictos, agregar la asignación tal cual
                processedAssignments.push(assignment);
            } else {
                // Si hay conflictos, intentar reparar la asignación
                const repairedAssignment = this.repairAssignment(tempChromosome, assignment);

                // Verificar si la asignación reparada es válida
                if (this.isValidAssignment(tempChromosome, repairedAssignment)) {
                    processedAssignments.push(repairedAssignment);
                } else {
                    // Si no podemos repararla, registrar una advertencia
                    console.log(`ADVERTENCIA: No se pudo reparar el conflicto para el curso ${assignment.course.name}`);

                    // Como último recurso, intentamos solo cambiar el aula o el horario
                    let fixed = false;

                    // Intentar con todas las aulas disponibles
                    for (const room of this.rooms) {
                        const newAssignment = new ClassAssignment(
                            assignment.course,
                            room,
                            assignment.timeSlot,
                            assignment.secondaryTimeSlots
                        );

                        if (this.isValidAssignment(tempChromosome, newAssignment)) {
                            processedAssignments.push(newAssignment);
                            fixed = true;
                            break;
                        }
                    }

                    // Si no funcionó cambiar el aula, intentar con todos los horarios posibles
                    if (!fixed) {
                        for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
                            for (let hourIndex = 0; hourIndex < 6; hourIndex++) {
                                const timeSlot = new TimeSlot(dayIndex, hourIndex);

                                // Para clases consecutivas, verificar si hay espacio suficiente
                                if (assignment.course.requiresConsecutiveSlots &&
                                    assignment.course.duration > 1 &&
                                    hourIndex + assignment.course.duration > 6) {
                                    continue; // No hay espacio suficiente para clase consecutiva
                                }

                                // Para clases no consecutivas, generar nuevos slots secundarios
                                let secondaryTimeSlots = [];
                                if (!assignment.course.requiresConsecutiveSlots && assignment.course.duration > 1) {
                                    // Esta es una simplificación; en un caso real, necesitaríamos generar slots válidos
                                    secondaryTimeSlots = [];
                                }

                                const newAssignment = new ClassAssignment(
                                    assignment.course,
                                    assignment.room,
                                    timeSlot,
                                    secondaryTimeSlots
                                );

                                if (this.isValidAssignment(tempChromosome, newAssignment)) {
                                    processedAssignments.push(newAssignment);
                                    fixed = true;
                                    break;
                                }
                            }
                            if (fixed) break;
                        }
                    }

                    // Si todavía no pudimos arreglarlo, lo omitimos (última opción)
                    if (!fixed) {
                        console.log(`ADVERTENCIA GRAVE: Se omitió el curso ${assignment.course.name} por conflictos irresolubles`);
                    }
                }
            }
        }

        // Agregar todas las asignaciones procesadas al nuevo cromosoma
        for (const assignment of processedAssignments) {
            newChromosome.addClassAssignment(assignment);
        }

        // Verificar una vez más si hay conflictos
        this.checkRoomConflicts(newChromosome);

        // Recalcular el fitness
        newChromosome.calculateFitness();

        return newChromosome;
    }
    analyzeRoomConflicts(chromosome) {
        console.log("\n=== ANÁLISIS DE CONFLICTOS DE AULA ===");

        // Estructura para rastrear qué aula está asignada a qué slot
        const roomAssignments = {};
        let totalRoomConflicts = 0;

        // Para cada asignación en el cromosoma
        for (const assignment of chromosome.classAssignments) {
            // Obtener todos los slots ocupados por esta asignación
            const slots = assignment.getAllTimeSlots();
            const roomId = assignment.room.id;

            // Si es la primera vez que vemos esta aula, inicializar su registro
            if (!roomAssignments[roomId]) {
                roomAssignments[roomId] = {};
            }

            // Para cada slot ocupado por esta asignación
            for (const slot of slots) {
                const slotKey = `${slot.dayIndex},${slot.hourIndex}`;

                // Si esta aula ya tiene una asignación en este slot, hay un conflicto
                if (roomAssignments[roomId][slotKey]) {
                    totalRoomConflicts++;
                    console.log(`· CONFLICTO: Aula ${roomId} tiene asignadas las materias "${roomAssignments[roomId][slotKey].course.name}" y "${assignment.course.name}" en el slot ${DAYS_OF_WEEK[slot.dayIndex]}, ${slot.hourIndex + 15}:00`);
                }

                // Registrar esta asignación (incluso si hay conflicto, para detectar más de 2 asignaturas)
                if (!roomAssignments[roomId][slotKey]) {
                    roomAssignments[roomId][slotKey] = assignment;
                } else if (!roomAssignments[roomId][slotKey].conflicts) {
                    roomAssignments[roomId][slotKey].conflicts = [assignment];
                } else {
                    roomAssignments[roomId][slotKey].conflicts.push(assignment);
                }
            }
        }

        console.log(`\nTotal de conflictos de aula detectados: ${totalRoomConflicts}`);

        // Calcular utilización de aulas
        console.log("\nUtilización de aulas:");
        for (const roomId in roomAssignments) {
            const slotsOcupados = Object.keys(roomAssignments[roomId]).length;
            const porcentajeUtilizacion = (slotsOcupados / (5 * 6) * 100).toFixed(1); // 5 días * 6 horas
            console.log(`· Aula ${roomId}: ${slotsOcupados} slots ocupados (${porcentajeUtilizacion}% de utilización)`);
        }

        return totalRoomConflicts;
    }
    analyzeConstraintViolations(chromosome) {
        console.log("\n=== ANÁLISIS DE RESTRICCIONES ===");

        // 1. Capacidad de aulas
        let capacityViolations = 0;
        let totalCapacityViolation = 0;

        for (const assignment of chromosome.classAssignments) {
            const totalStudents = assignment.course.studentGroups.reduce((sum, group) => sum + group.size, 0);
            if (assignment.room.capacity < totalStudents) {
                capacityViolations++;
                totalCapacityViolation += (totalStudents - assignment.room.capacity);
                console.log(`  · El curso "${assignment.course.name}" con ${totalStudents} estudiantes está asignado al aula ${assignment.room.id} (capacidad ${assignment.room.capacity})`);
                console.log(`    Grupos: ${assignment.course.studentGroups.map(g => `${g.id}:${g.size}`).join(', ')}`);
            }
        }

        console.log(`\nViolaciones de capacidad: ${capacityViolations}/${chromosome.classAssignments.length} (${(capacityViolations / chromosome.classAssignments.length * 100).toFixed(2)}%)`);
        if (capacityViolations > 0) {
            console.log(`Déficit total de capacidad: ${totalCapacityViolation} asientos`);
        }

        // 2. Conflictos de horario entre grupos
        const groupTimeConflicts = {};

        for (const assignment of chromosome.classAssignments) {
            const slots = assignment.getAllTimeSlots();

            for (const group of assignment.course.studentGroups) {
                const groupId = group.id;

                if (!groupTimeConflicts[groupId]) {
                    groupTimeConflicts[groupId] = [];
                }

                for (const slot of slots) {
                    const slotKey = `${slot.dayIndex},${slot.hourIndex}`;
                    const existingAssignment = groupTimeConflicts[groupId].find(a =>
                        a.slot === slotKey && a.assignment !== assignment);

                    if (existingAssignment) {
                        console.log(`  · Conflicto para grupo ${groupId}: tiene asignado ${existingAssignment.assignment.course.name} y ${assignment.course.name} en ${slotKey}`);
                    } else {
                        groupTimeConflicts[groupId].push({
                            slot: slotKey,
                            assignment: assignment
                        });
                    }
                }
            }
        }

        // Contar conflictos únicos de horario
        let uniqueTimeConflicts = 0;
        const conflictsSeen = new Set();

        for (const groupId in groupTimeConflicts) {
            const slots = {};

            for (const entry of groupTimeConflicts[groupId]) {
                if (!slots[entry.slot]) {
                    slots[entry.slot] = [];
                }
                slots[entry.slot].push(entry.assignment);
            }

            for (const slotKey in slots) {
                if (slots[slotKey].length > 1) {
                    const conflictKey = `${groupId}-${slotKey}`;
                    if (!conflictsSeen.has(conflictKey)) {
                        uniqueTimeConflicts++;
                        conflictsSeen.add(conflictKey);
                    }
                }
            }
        }

        console.log(`\nConflictos de horario: ${uniqueTimeConflicts}`);

        // 3. Uso de las aulas grandes
        const largeRooms = this.rooms.filter(r => r.capacity >= 100);
        console.log(`\nUso de aulas grandes (capacidad >= 100):`);

        for (const room of largeRooms) {
            const assignments = chromosome.classAssignments.filter(a => a.room.id === room.id);
            console.log(`  · Aula ${room.id} (capacidad ${room.capacity}):`);

            if (assignments.length === 0) {
                console.log("    No utilizada");
            } else {
                let totalUtilization = 0;
                let totalHours = 0;

                for (const assignment of assignments) {
                    const slots = assignment.getAllTimeSlots();
                    const totalStudents = assignment.course.studentGroups.reduce((sum, group) => sum + group.size, 0);
                    const utilization = totalStudents / room.capacity;

                    totalUtilization += utilization * slots.length;
                    totalHours += slots.length;

                    console.log(`    - ${assignment.course.name}: ${totalStudents} estudiantes (${(utilization * 100).toFixed(1)}% de capacidad)`);
                }

                if (totalHours > 0) {
                    console.log(`    Utilización promedio: ${(totalUtilization / totalHours * 100).toFixed(1)}%`);
                }
            }
        }
    }
    addRoomBalancingConstraint() {
        this.addSoftConstraint(
            (assignment, chromosome) => {
                // Calcular uso actual de cada aula en este cromosoma
                const roomUsageCount = {};
                this.rooms.forEach(room => {
                    roomUsageCount[room.id] = 0;
                });

                for (const a of chromosome.classAssignments) {
                    roomUsageCount[a.room.id] = (roomUsageCount[a.room.id] || 0) + 1;
                }

                // Calcular uso promedio y desviación estándar
                const usageValues = Object.values(roomUsageCount);
                const averageUsage = usageValues.reduce((sum, val) => sum + val, 0) / usageValues.length;

                // Calcular qué tan alejado está el uso de esta aula del promedio
                const thisRoomUsage = roomUsageCount[assignment.room.id];
                const deviation = Math.abs(thisRoomUsage - averageUsage) / averageUsage;

                // Puntuación: 1.0 si el uso está cerca del promedio, disminuye con la desviación
                return Math.max(0, 1 - deviation);
            },
            0.3, // Peso moderado
            "Equilibrar el uso de aulas para evitar sobreutilización/subutilización"
        );
    }
    checkRoomConflicts(chromosome) {
        // Estructura para rastrear qué aula está asignada a qué slot
        const roomAssignments = {};

        // Para cada asignación en el cromosoma
        for (const assignment of chromosome.classAssignments) {
            // Obtener todos los slots ocupados por esta asignación
            const slots = assignment.getAllTimeSlots();
            const roomId = assignment.room.id;

            // Si es la primera vez que vemos esta aula, inicializar su registro
            if (!roomAssignments[roomId]) {
                roomAssignments[roomId] = {};
            }

            // Para cada slot ocupado por esta asignación
            for (const slot of slots) {
                const slotKey = `${slot.dayIndex},${slot.hourIndex}`;

                // Si esta aula ya tiene una asignación en este slot, hay un conflicto
                if (roomAssignments[roomId][slotKey]) {
                    // Encontramos un conflicto
                    // console.log(`CONFLICTO: Aula ${roomId} tiene múltiples asignaturas en ${slotKey}`);

                    // Penalizar ambas asignaciones
                    assignment.score = 0;
                    roomAssignments[roomId][slotKey].score = 0;
                } else {
                    // Registrar esta asignación
                    roomAssignments[roomId][slotKey] = assignment;
                }
            }
        }

        // Recalcular el fitness después de ajustar las puntuaciones
        chromosome.calculateFitness();
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
        // Primero verificar disponibilidad de aula (RESTRICCIÓN DURA)
        if (!chromosome.isRoomAvailableForAssignment(assignment)) {
            return false; // Rechazar inmediatamente si el aula no está disponible
        }

        // Calcular el total de estudiantes en esta asignación
        const totalStudents = assignment.course.studentGroups.reduce((sum, group) => sum + group.size, 0);

        // Verificar capacidad del aula (otra restricción dura)
        if (assignment.room.capacity < totalStudents) {
            return false;
        }

        // Verificar conflictos de estudiantes 
        if (!chromosome.areStudentGroupsAvailableForAssignment(assignment)) {
            return false;
        }

        // Verificar disponibilidad del profesor
        if (!chromosome.isProfessorAvailableForAssignment(assignment)) {
            return false;
        }

        // Verificar requisito de aula específica
        return this.isRoomRequirementSatisfied(assignment);
    }

    // Reparar una asignación problemática
    repairAssignment(chromosome, assignment) {
        const course = assignment.course;
        const totalStudents = course.studentGroups.reduce((sum, group) => sum + group.size, 0);

        // Calcular uso actual de cada aula en este cromosoma
        const roomUsageCount = {};
        this.rooms.forEach(room => {
            roomUsageCount[room.id] = 0;
        });

        for (const existingAssignment of chromosome.classAssignments) {
            if (existingAssignment === assignment) continue;
            roomUsageCount[existingAssignment.room.id] = (roomUsageCount[existingAssignment.room.id] || 0) + 1;
        }

        // Filtrar aulas con capacidad suficiente
        let roomsToTry = this.rooms.filter(r => r.capacity >= totalStudents);

        // Si no hay aulas con capacidad suficiente, usar todas las aulas (aunque será penalizado)
        if (roomsToTry.length === 0) {
            roomsToTry = this.rooms;
        }

        // Si el curso requiere un aula específica, verificar si tiene capacidad suficiente
        if (course.requiredRoomId !== null) {
            const requiredRoom = this.rooms.find(r => r.id === course.requiredRoomId);
            if (requiredRoom) {
                roomsToTry = [requiredRoom]; // Solo intentar con el aula requerida
            }
        } else {
            // Ordenar aulas por uso (primero las menos utilizadas)
            roomsToTry.sort((a, b) => roomUsageCount[a.id] - roomUsageCount[b.id]);

            // Para cursos grupales, priorizar aulas grandes pero seguir considerando uso
            if (course.studentGroups.length > 1) {
                const largeRooms = roomsToTry.filter(r => r.capacity >= 100);
                if (largeRooms.length > 0) {
                    // Mezclar aulas grandes colocando las menos usadas primero
                    largeRooms.sort((a, b) => roomUsageCount[a.id] - roomUsageCount[b.id]);
                    // Poner aulas grandes al principio de la lista
                    roomsToTry = [...largeRooms, ...roomsToTry.filter(r => r.capacity < 100)];
                }
            }
        }

        // Determinar el rango de horas permitido según los grupos
        const restrictedGroups = ["G7", "G8", "G9", "G10", "G11", "G12", "G13", "G14"];
        const isRestricted = course.studentGroups.some(g => restrictedGroups.includes(g.id));

        // Intentar diferentes combinaciones hasta encontrar una válida
        for (const room of roomsToTry) {
            for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
                // Determinar el rango de horas permitido
                let maxPossibleHourIndex = course.requiresConsecutiveSlots ?
                    (6 - course.duration) : (6 - 1);

                // Restringir el horario para grupos específicos
                if (isRestricted) {
                    maxPossibleHourIndex = Math.min(maxPossibleHourIndex, 3); // Máximo hasta las 19:00 (índice 3)
                }

                for (let hourIndex = 0; hourIndex <= maxPossibleHourIndex; hourIndex++) {
                    const timeSlot = new TimeSlot(dayIndex, hourIndex);

                    // Para clases no consecutivas, generar slots secundarios
                    let secondaryTimeSlots = [];
                    if (!course.requiresConsecutiveSlots && course.duration > 1) {
                        // Asegurarse de que los slots secundarios también respeten la restricción
                        secondaryTimeSlots = this.generateSecondaryTimeSlots(course, timeSlot, isRestricted);
                    }

                    const newAssignment = new ClassAssignment(course, room, timeSlot, secondaryTimeSlots);

                    if (this.isValidAssignment(chromosome, newAssignment)) {
                        return newAssignment;
                    }
                }
            }
        }

        // Como último recurso, probar con todas las aulas ignorando el orden de uso
        // pero aún respetando las restricciones de capacidad
        for (const room of this.rooms) {
            // Saltar si ya intentamos esta aula y tiene capacidad insuficiente
            if (room.capacity < totalStudents && roomsToTry.includes(room)) continue;

            for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
                const maxHourIndex = course.requiresConsecutiveSlots ?
                    (6 - course.duration) : (6 - 1);

                const actualMaxHourIndex = isRestricted ? Math.min(maxHourIndex, 3) : maxHourIndex;

                for (let hourIndex = 0; hourIndex <= actualMaxHourIndex; hourIndex++) {
                    const timeSlot = new TimeSlot(dayIndex, hourIndex);

                    let secondaryTimeSlots = [];
                    if (!course.requiresConsecutiveSlots && course.duration > 1) {
                        secondaryTimeSlots = this.generateSecondaryTimeSlots(course, timeSlot, isRestricted);
                    }

                    const newAssignment = new ClassAssignment(course, room, timeSlot, secondaryTimeSlots);

                    if (this.isValidAssignment(chromosome, newAssignment)) {
                        return newAssignment;
                    }
                }
            }
        }

        // Como último recurso, devolver la asignación original
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

        // Contar uso de aulas en este cromosoma
        const roomUsageCount = {};
        this.rooms.forEach(room => {
            roomUsageCount[room.id] = 0;
        });

        for (const a of chromosome.classAssignments) {
            if (a === assignment) continue; // No contar la asignación que vamos a mutar
            roomUsageCount[a.room.id] = (roomUsageCount[a.room.id] || 0) + 1;
        }

        // Determinar qué mutar con mayor probabilidad para aulas sobreutilizadas
        let mutationType;

        // Calcular uso promedio
        const usageValues = Object.values(roomUsageCount);
        const averageUsage = usageValues.reduce((sum, val) => sum + val, 0) / usageValues.length;

        // Si el aula está sobreutilizada, mayor probabilidad de mutar el aula
        const currentRoomUsage = roomUsageCount[assignment.room.id] || 0;
        const isOverused = currentRoomUsage > averageUsage * 1.2; // 20% más que el promedio

        // Si el curso requiere un aula específica, solo mutamos el horario
        if (course.requiredRoomId !== null) {
            mutationType = 'timeSlot';
        } else if (isOverused) {
            // Si el aula está sobreutilizada, 80% de probabilidad de cambiar el aula
            mutationType = Math.random() < 0.8 ? 'room' : 'timeSlot';
        } else {
            // Caso normal: 50% probabilidad
            mutationType = Math.random() < 0.5 ? 'room' : 'timeSlot';
        }

        if (mutationType === 'room' && !course.requiredRoomId) {
            // Encontrar aulas menos utilizadas con capacidad suficiente
            const totalStudents = course.studentGroups.reduce((sum, group) => sum + group.size, 0);
            let candidateRooms = this.rooms.filter(r => r.capacity >= totalStudents);

            if (candidateRooms.length === 0) {
                candidateRooms = this.rooms; // Si no hay opciones, usar todas
            }

            // Ordenar por uso (menor a mayor)
            candidateRooms.sort((a, b) => (roomUsageCount[a.id] || 0) - (roomUsageCount[b.id] || 0));

            // Seleccionar un aula de entre el 30% menos utilizado
            const candidateCount = Math.max(1, Math.ceil(candidateRooms.length * 0.3));
            const randomRoomIndex = Math.floor(Math.random() * candidateCount);
            const newRoom = candidateRooms[randomRoomIndex];

            assignment.room = newRoom;
        } else {
            // Cambiar el horario
            const randomDayIndex = Math.floor(Math.random() * 5);
            const maxHourIndex = course.requiresConsecutiveSlots ?
                (6 - course.duration) : (6 - 1);
            let randomHourIndex = Math.floor(Math.random() * (maxHourIndex + 1));

            // Restricción para grupos específicos
            const restrictedGroups = ["G7", "G8", "G9", "G10", "G11", "G12", "G13", "G14"];
            if (course.studentGroups.some(g => restrictedGroups.includes(g.id))) {
                // Limitar a slots antes de las 19:00 (índice < 4)
                const maxAllowedHourIndex = Math.min(maxHourIndex, 3);
                randomHourIndex = Math.floor(Math.random() * (maxAllowedHourIndex + 1));
            }

            const newTimeSlot = new TimeSlot(randomDayIndex, randomHourIndex);

            // Para clases no consecutivas, generar nuevos slots secundarios
            if (!course.requiresConsecutiveSlots && course.duration > 1) {
                const isRestricted = course.studentGroups.some(g => restrictedGroups.includes(g.id));
                const newSecondaryTimeSlots = this.generateSecondaryTimeSlots(course, newTimeSlot, isRestricted);
                assignment.secondaryTimeSlots = newSecondaryTimeSlots;
            }

            assignment.timeSlot = newTimeSlot;
        }
    }
    analyzeRoomDistribution(chromosome) {
        console.log("\n=== DISTRIBUCIÓN DE USO DE AULAS ===");

        // Contar asignaciones por aula
        const roomAssignments = {};
        const roomTimeUsage = {}; // Para contar horas de uso total

        // Inicializar contadores
        this.rooms.forEach(room => {
            roomAssignments[room.id] = [];
            roomTimeUsage[room.id] = 0;
        });

        // Contar asignaciones y slots utilizados
        for (const assignment of chromosome.classAssignments) {
            const roomId = assignment.room.id;

            // Si no existe la entrada para esta aula, inicializarla
            if (!roomAssignments[roomId]) {
                roomAssignments[roomId] = [];
            }

            // Añadir la asignación
            roomAssignments[roomId].push(assignment);

            // Contar slots utilizados
            roomTimeUsage[roomId] += assignment.getAllTimeSlots().length;
        }

        // Estadísticas generales
        const totalSlots = 5 * 6; // 5 días x 6 horas/día
        let totalRoomHours = 0;
        let maxUsage = 0;
        let minUsage = totalSlots;

        // Ordenar aulas por uso (de mayor a menor)
        const sortedRooms = [...this.rooms].sort((a, b) =>
            (roomTimeUsage[b.id] || 0) - (roomTimeUsage[a.id] || 0)
        );

        // Mostrar uso de cada aula
        console.log("Uso de aulas (ordenadas por utilización):");
        console.log("| Aula    | Capacidad | Asignaciones | Horas de uso | % Utilización |");
        console.log("|---------|-----------|--------------|--------------|---------------|");

        for (const room of sortedRooms) {
            const roomId = room.id;
            const assignments = roomAssignments[roomId] || [];
            const hoursUsed = roomTimeUsage[roomId] || 0;
            const utilization = (hoursUsed / totalSlots * 100).toFixed(1);

            console.log(`| ${roomId.padEnd(7)} | ${room.capacity.toString().padEnd(9)} | ${assignments.length.toString().padEnd(12)} | ${hoursUsed.toString().padEnd(12)} | ${utilization.toString().padEnd(13)}% |`);

            totalRoomHours += hoursUsed;
            maxUsage = Math.max(maxUsage, hoursUsed);
            minUsage = Math.min(minUsage, hoursUsed);
        }

        // Calcular estadísticas
        const avgUsage = totalRoomHours / this.rooms.length;
        const usageDeviation = maxUsage - minUsage;
        const utilizationPercentage = (totalRoomHours / (this.rooms.length * totalSlots) * 100).toFixed(1);

        console.log("\nEstadísticas de utilización:");
        console.log(`· Promedio de horas por aula: ${avgUsage.toFixed(1)}`);
        console.log(`· Diferencia entre máx y mín: ${usageDeviation} horas`);
        console.log(`· Coeficiente de variación: ${(usageDeviation / avgUsage).toFixed(2)}`);
        console.log(`· Utilización total de aulas: ${utilizationPercentage}%`);

        // Aulas sin uso
        const unusedRooms = sortedRooms.filter(room => (roomTimeUsage[room.id] || 0) === 0);
        if (unusedRooms.length > 0) {
            console.log(`\n⚠️ Aulas sin utilizar (${unusedRooms.length}): ${unusedRooms.map(r => r.id).join(', ')}`);
        } else {
            console.log("\n✅ Todas las aulas tienen al menos una asignación");
        }

        return unusedRooms.length;
    }
    generateSecondaryTimeSlots(course, mainTimeSlot, isRestricted = false) {
        if (course.requiresConsecutiveSlots || course.duration <= 1) {
            return [];
        }

        const secondarySlots = [];
        const remainingSlots = course.duration - 1;
        let maxAttempts = 100; // Evitar bucle infinito

        // Generar slots secundarios aleatorios diferentes al principal
        while (secondarySlots.length < remainingSlots && maxAttempts > 0) {
            maxAttempts--;
            const randomDayIndex = Math.floor(Math.random() * DAYS_OF_WEEK.length);

            // Limitar el rango de horas si es grupo restringido
            let maxHourIndex = HOURS_PER_DAY - 1;
            if (isRestricted) {
                maxHourIndex = 3; // Máximo hasta las 19:00 (índice 3)
            }

            const randomHourIndex = Math.floor(Math.random() * (maxHourIndex + 1));
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

        // Análisis de restricciones generales
        this.analyzeConstraintViolations(chromosome);

        // Análisis específico de conflictos de aula
        const roomConflicts = this.analyzeRoomConflicts(chromosome);

        // Análisis de distribución de aulas
        const unusedRooms = this.analyzeRoomDistribution(chromosome);

        // Mensaje final sobre calidad del horario
        if (roomConflicts === 0) {
            console.log("\n✅ EL HORARIO NO TIENE CONFLICTOS DE AULA");
        } else {
            console.log(`\n❌ EL HORARIO TIENE ${roomConflicts} CONFLICTOS DE AULA`);
        }

        if (unusedRooms === 0) {
            console.log("✅ TODAS LAS AULAS ESTÁN SIENDO UTILIZADAS");
        } else {
            console.log(`⚠️ HAY ${unusedRooms} AULAS SIN UTILIZAR`);
        }

        // Resto del método igual que antes...
        // Estructura para almacenar el horario en formato JSON
        const timetableJSON = {};

        // Inicializar la estructura JSON con todos los días y horas
        const DAYS_OF_WEEK = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
        DAYS_OF_WEEK.forEach(day => {
            timetableJSON[day] = {};
            for (let hour = 0; hour < 6; hour++) {
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
                    if (hourIndex < 6) { // 6 horas por día
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
        if (typeof require !== 'undefined' && require('fs')) {
            try {
                require('fs').writeFileSync('horario-data.json', jsonOutput, 'utf8');
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
        const dayName = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"][slot.dayIndex];
        const hour = slot.hourIndex;

        // Calcular total de estudiantes
        const totalStudents = assignment.course.studentGroups.reduce((sum, group) => sum + group.size, 0);
        const capacityUtilization = (totalStudents / assignment.room.capacity * 100).toFixed(1);
        const hasCapacityIssue = totalStudents > assignment.room.capacity;

        // Crear la entrada para el horario
        const entry = {
            course: assignment.course.name,
            professor: assignment.course.professor.name,
            room: assignment.room.id,
            roomCapacity: assignment.room.capacity,
            totalStudents: totalStudents,
            capacityUtilization: `${capacityUtilization}%`,
            capacityIssue: hasCapacityIssue,
            groups: assignment.course.studentGroups.map(g => `${g.name}(${g.size})`).join(', '),
            duration: assignment.course.duration,
            requiresComputers: assignment.course.requiresComputers,
            requiresConsecutiveSlots: assignment.course.requiresConsecutiveSlots,
            requiredRoomId: assignment.course.requiredRoomId,
            roomRequirementSatisfied: this.isRoomRequirementSatisfied(assignment),
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
        // new Room("F-101", 25, false),
        // new Room("F-102", 25, false),
        // new Room("F-103", 25, false),
        // new Room("F-104", 25, false),
        new Room("B-101", 33, false),
        new Room("B-102", 33, false),
        new Room("B-103", 33, false),
        new Room("B-104", 33, false),
        new Room("B-105", 33, false),
        new Room("B-201", 33, false),
        new Room("B-202", 33, false),
        new Room("B-203", 33, false),
        new Room("B-204", 33, false),
        new Room("B-205", 33, false),
        new Room("A-203", 25, false),
        new Room("A-302", 20, false),
        new Room("A-303", 20, false),
        new Room("A-304", 20, false),
        new Room("A-305", 20, false),
        new Room("D-217", 30, false),
        new Room("D-218", 30, false),
        new Room("E-101", 200, false),
        new Room("C-101", 200, false)
    ];

    // Crear profesores
    const professors = [
        new Professor("P1", "Juan Oscar Guzman"),
        new Professor("P2", "Daniel  Condori"),
        new Professor("P3", "Ivan Katery"),
        new Professor("P4", "Cecilia  Padilla"),
        new Professor("P5", "David  Gonzales"),
        new Professor("P6", "Andrea Paiva"),
        new Professor("P7", "Ronald  Nuñez"),
        new Professor("P8", "Antonio Claros"),
        new Professor("P9", "Manuel Gonzales"),
        new Professor("P10", "Jose Carlos Gonzales"),
        new Professor("P11", "Edwin  Canaza"),
        new Professor("P12", "Melanie Loayza"),
        new Professor("P13", "Sarah Daza"),
        new Professor("P14", "Wendy Valencia"),
        new Professor("P15", "Octavio Montaño"),
        new Professor("P16", "Milenka Garcia"),
        new Professor("P17", "Augusto  Guzman"),
        new Professor("P18", "Andrew Herrada"),
        new Professor("P19", "Adriana Arias"),
        new Professor("P20", "Josue Ortiz"),
        new Professor("P21", "Diana Avila"),
        new Professor("P22", "Arturo  Arando"),
        new Professor("P23", "Denise Avila"),
        new Professor("P24", "Joseph Herrada"),
        new Professor("P25", "David  Janco"),
        new Professor("P26", "Libertad Aguilar"),
        new Professor("P27", "Jose Armando"),
        new Professor("P28", "Kevin Torrico"),
        new Professor("P29", "4-5 profesores")
    ];

    // // Establecer algunas restricciones de disponibilidad para los profesores
    // professors[0].setAvailability(0, 0, false); // El Prof. Juan Oscar no está disponible los lunes a primera hora
    // professors[1].setAvailability(4, 8, false); // El Prof. Daniel Condori no está disponible los viernes a última hora
    // professors[2].setAvailability(2, 3, false); // El Prof. Ivan Katery no está disponible los miércoles a la cuarta hora
    // professors[3].setAvailability(1, 7, false); // La Prof. Cecilia Padilla no está disponible los martes a la octava hora
    // professors[4].setAvailability(3, 0, false); // El Prof. David Gonzales no está disponible los jueves a primera hora

    // Crear grupos de estudiantes
    const studentGroups = [
        new StudentGroup("G1", "1°Inf (A)", 15),
        new StudentGroup("G2", "1°Inf (B)", 15),
        new StudentGroup("G3", "2°Inf (A)", 18),
        new StudentGroup("G4", "2°Inf (B)", 6),
        new StudentGroup("G5", "3°Inf (A)", 23),
        new StudentGroup("G6", "3°Inf (B)", 10),
        new StudentGroup("G7", "1°Ini (A)", 29),
        new StudentGroup("G8", "1°Ini (B)", 28),
        new StudentGroup("G9", "2°Ini (A)", 21),
        new StudentGroup("G10", "2°Ini (B)", 21),
        new StudentGroup("G11", "3°Ini", 20),
        new StudentGroup("G12", "1°Bas", 29),
        new StudentGroup("G13", "2°Bas", 28),
        new StudentGroup("G14", "3°Bas", 9),
        new StudentGroup("G15", "1°Inv (A)", 32),
        new StudentGroup("G16", "1°Inv (B)", 32),
        new StudentGroup("G17", "2°Inv", 32),
        new StudentGroup("G18", "3°Inv", 33),
        new StudentGroup("G19", "1°Int", 27),
        new StudentGroup("G20", "2°Int", 17),
        new StudentGroup("G21", "3°Int", 7)
    ];

    // Crear cursos con la nueva estructura que incluye requiredRoomId
    const courses = [
        // new Course("C1", "Canto Infantil", professors[3], studentGroups[0], false, 2, false),
        // new Course("C2", "Canto Infantil", professors[3], studentGroups[1], false, 2, false),
        // new Course("C3", "Teclado", professors[24], studentGroups[0], false, 2, false, "F-101"),
        // new Course("C4", "Teclado", professors[22], studentGroups[1], false, 2, false, "F-101"),
        // new Course("C5", "Creatividad Artistica", professors[25], studentGroups[0], false, 2, false),
        // new Course("C6", "Creatividad Artistica", professors[25], studentGroups[1], false, 2, false),
        // new Course("C7", "Ritmica Infantil", professors[5], studentGroups[0], false, 2, false),
        // new Course("C8", "Ritmica Infantil", professors[5], studentGroups[1], false, 2, false),
        // new Course("C9", "Apreciacion Musical", professors[22], studentGroups[0], false, 1, true, "F-103"),
        // new Course("C10", "Apreciacion Musical", professors[24], studentGroups[1], false, 1, true, "F-103"),
        // new Course("C11", "Ritmica Infantil", professors[5], studentGroups[2], false, 2, false),
        // new Course("C12", "Ritmica Infantil", professors[5], studentGroups[3], false, 2, false),
        // new Course("C13", "Teclado", professors[17], studentGroups[2], false, 2, false, "F-101"),
        // new Course("C14", "Teclado", professors[17], studentGroups[3], false, 2, false, "F-101"),
        // new Course("C15", "Creatividad Artistica", professors[17], studentGroups[2], false, 2, false),
        // new Course("C16", "Creatividad Artistica", professors[17], studentGroups[3], false, 2, false),
        // new Course("C17", "Apreciacion Musical", professors[10], studentGroups[2], false, 1, true, "F-103"),
        // new Course("C18", "Apreciacion Musical", professors[10], studentGroups[3], false, 1, true, "F-103"),
        // new Course("C19", "Canto Infantil", professors[3], studentGroups[2], false, 2, false),
        // new Course("C20", "Canto Infantil", professors[3], studentGroups[3], false, 2, false),
        // new Course("C21", "Ritmica Infantil", professors[5], studentGroups[4], false, 2, false),
        // new Course("C22", "Ritmica Infantil", professors[5], studentGroups[5], false, 2, false),
        // new Course("C23", "Teclado ", professors[14], studentGroups[4], false, 1, true, "F-101"),
        // new Course("C24", "Teclado ", professors[17], studentGroups[5], false, 1, true, "F-101"),
        // new Course("C25", "Desarrollo Intelectual", professors[18], studentGroups[4], false, 1, true),
        // new Course("C26", "Desarrollo Intelectual", professors[25], studentGroups[5], false, 1, true),
        // new Course("C27", "Apreciacion Musical", professors[10], studentGroups[4], false, 1, true, "F-103"),
        // new Course("C28", "Apreciacion Musical", professors[17], studentGroups[5], false, 1, true, "F-103"),
        // new Course("C29", "Canto Infantil", professors[3], studentGroups[4], false, 2, false),
        // new Course("C30", "Canto Infantil", professors[3], studentGroups[5], false, 2, false),
        // new Course("C31", "Flauta Dulce", professors[13], studentGroups[4], false, 2, false),
        // new Course("C32", "Flauta Dulce", professors[13], studentGroups[5], false, 2, false),
        new Course("C33", "Solfeo-Ritmica", professors[1], studentGroups[6], false, 2, false),
        new Course("C34", "Solfeo-Ritmica", professors[1], studentGroups[7], false, 2, false),
        new Course("C35", "Lecto-Escritura", professors[15], studentGroups[6], false, 1, true),
        new Course("C36", "Lecto-Escritura", professors[15], studentGroups[7], false, 1, true),
        new Course("C37", "Flauta Dulce", professors[13], studentGroups[6], false, 1, true),
        new Course("C38", "Flauta Dulce", professors[13], studentGroups[7], false, 1, true),
        new Course("C39", "Teclado", professors[0], studentGroups[6], false, 2, false, "D-218"),
        new Course("C40", "Teclado", professors[0], studentGroups[7], false, 2, false, "D-218"),
        new Course("C41", "Apreciacion Musical", professors[6], studentGroups[6], false, 1, true, "D-217"),
        new Course("C42", "Apreciacion Musical", professors[6], studentGroups[7], false, 1, true, "D-217"),
        new Course("C43", "Desarrollo Intelectual", professors[21], studentGroups[6], false, 1, true),
        new Course("C44", "Desarrollo Intelectual", professors[21], studentGroups[7], false, 1, true),
        new Course("C45", "Practica Coral", professors[8], [studentGroups[6], studentGroups[7], studentGroups[8], studentGroups[9], studentGroups[10]], false, 2, true),
        new Course("C46", "Iniciacion Instrumental", professors[28], [studentGroups[6], studentGroups[7]], false, 2, false),
        new Course("C47", "Solfeo-Ritmica", professors[1], studentGroups[8], false, 2, false),
        new Course("C48", "Solfeo-Ritmica", professors[1], studentGroups[9], false, 2, false),
        new Course("C49", "Lecto-Escritura", professors[10], studentGroups[8], false, 2, false),
        new Course("C50", "Lecto-Escritura", professors[15], studentGroups[9], false, 2, false),
        new Course("C51", "Flauta Dulce", professors[13], studentGroups[8], false, 2, false),
        new Course("C52", "Flauta Dulce", professors[13], studentGroups[9], false, 2, false),
        new Course("C53", "Teclado", professors[0], studentGroups[8], false, 2, false, "D-218"),
        new Course("C54", "Teclado", professors[24], studentGroups[9], false, 2, false, "D-218"),
        new Course("C55", "Apreciacion Musical", professors[6], studentGroups[8], false, 1, true, "D-217"),
        new Course("C56", "Apreciacion Musical", professors[6], studentGroups[9], false, 1, true, "D-217"),
        new Course("C57", "Desarrollo Intelectual", professors[21], studentGroups[8], false, 1, true),
        new Course("C58", "Desarrollo Intelectual", professors[17], studentGroups[9], false, 1, true),
        new Course("C59", "Solfeo-Ritmica", professors[11], studentGroups[10], false, 2, false),
        new Course("C60", "Teoria de la Musica", professors[7], studentGroups[10], false, 2, false),
        new Course("C61", "Flauta Dulce", professors[24], studentGroups[10], false, 2, false),
        new Course("C62", "Teclado", professors[24], studentGroups[10], false, 2, false, "D-218"),
        new Course("C63", "Apreciacion Musical", professors[6], studentGroups[10], false, 1, true, "D-217"),
        new Course("C64", "Desarrollo Intelectual", professors[21], studentGroups[10], false, 1, true),
        new Course("C65", "Solfeo-Ritmica", professors[16], studentGroups[11], false, 2, false),
        new Course("C66", "Teoria de la Musica", professors[15], studentGroups[11], false, 2, false),
        new Course("C67", "Dictado Musical", professors[9], studentGroups[11], false, 2, false),
        new Course("C68", "Apreciacion Musical", professors[18], studentGroups[11], false, 1, true, "D-217"),
        new Course("C69", "Practica Coral (CN)", professors[7], [studentGroups[11], studentGroups[12], studentGroups[13]], false, 2, true),
        new Course("C70", "Orquesta Folklorica (A)", professors[9], [studentGroups[11], studentGroups[12], studentGroups[13], studentGroups[16], studentGroups[17]], false, 2, true),
        new Course("C71", "Solfeo-Ritmica", professors[8], studentGroups[12], false, 2, false),
        new Course("C72", "Teoria de la Musica", professors[7], studentGroups[12], false, 2, false),
        new Course("C73", "Dictado Musical", professors[9], studentGroups[12], false, 2, false),
        new Course("C74", "Apreciacion Musical", professors[6], studentGroups[12], false, 1, true, "D-217"),
        new Course("C75", "Solfeo-Ritmica", professors[25], studentGroups[13], false, 2, false),
        new Course("C76", "Teoria de la Musica", professors[23], studentGroups[13], false, 2, false),
        new Course("C77", "Dictado Musical", professors[26], studentGroups[13], false, 2, false),
        new Course("C78", "Iniciación a la Tecnica Vocal", professors[14], studentGroups[13], false, 1, true),
        new Course("C79", "Solfeo-Ritmica", professors[1], studentGroups[14], false, 2, false),
        new Course("C80", "Solfeo-Ritmica", professors[18], studentGroups[15], false, 2, false),
        new Course("C81", "Teoria de la Musica", professors[15], studentGroups[14], false, 1, true),
        new Course("C82", "Teoria de la Musica", professors[10], studentGroups[15], false, 1, true),
        new Course("C83", "Dictado Musical", professors[4], studentGroups[14], false, 1, true),
        new Course("C84", "Dictado Musical", professors[9], studentGroups[15], false, 1, true),
        new Course("C85", "Apreciacion Musical", professors[9], studentGroups[14], false, 1, true, "D-217"),
        new Course("C86", "Apreciacion Musical", professors[10], studentGroups[15], false, 1, true, "D-217"),
        new Course("C87", "Flauta Dulce", professors[9], studentGroups[14], false, 2, false),
        new Course("C88", "Flauta Dulce", professors[9], studentGroups[15], false, 2, false),
        new Course("C89", "Teclado", professors[0], studentGroups[14], false, 2, false, "D-218"),
        new Course("C90", "Teclado", professors[0], studentGroups[15], false, 2, false, "D-218"),
        new Course("C91", "Practica Coral (J)", professors[14], [studentGroups[14], studentGroups[15]], false, 2, true),
        new Course("C92", "Iniciacion Instrumental", professors[28], [studentGroups[14], studentGroups[15]], false, 1, true),
        new Course("C93", "Solfeo-Ritmica", professors[19], studentGroups[16], false, 2, false),
        new Course("C94", "Teoria de la Musica", professors[10], studentGroups[16], false, 2, false),
        new Course("C95", "Dictado Musical", professors[23], studentGroups[16], false, 2, false),
        new Course("C96", "Flauta Dulce", professors[2], studentGroups[16], false, 1, true),
        new Course("C97", "Teclado", professors[24], studentGroups[16], false, 1, true, "D-218"),
        new Course("C98", "Practica Coral (CJ)", professors[0], [studentGroups[16], studentGroups[17], studentGroups[18], studentGroups[19], studentGroups[20]], false, 2, true),
        new Course("C99", "Solfeo-Ritmica", professors[27], studentGroups[17], false, 2, false),
        new Course("C100", "Teoria de la Musica", professors[10], studentGroups[17], false, 2, false),
        new Course("C101", "Dictado Musical", professors[27], studentGroups[17], false, 2, false),
        new Course("C102", "Flauta Dulce", professors[13], studentGroups[17], false, 1, true),
        new Course("C103", "Teclado", professors[24], studentGroups[17], false, 1, true, "D-218"),
        new Course("C104", "Solfeo-Ritmica", professors[21], studentGroups[18], false, 2, false),
        new Course("C105", "Dictado Musical", professors[14], studentGroups[18], false, 1, true),
        new Course("C106", "Armonia", professors[12], studentGroups[18], false, 1, true),
        new Course("C107", "Tecnica Vocal", professors[14], studentGroups[18], false, 1, true),
        new Course("C108", "Historia del Arte y Música", professors[12], studentGroups[18], false, 1, true),
        new Course("C109", "Orquesta Folklorica (B)", professors[0], [studentGroups[18], studentGroups[19], studentGroups[20]], false, 2, true),
        new Course("C110", "Solfeo-Ritmica", professors[7], studentGroups[19], false, 2, false),
        new Course("C111", "Dictado Musical", professors[17], studentGroups[19], false, 1, true),
        new Course("C112", "Armonia", professors[6], studentGroups[19], false, 1, true),
        new Course("C113", "Analisis Musical", professors[26], studentGroups[19], false, 1, true),
        new Course("C114", "Historia del Arte y Música", professors[6], [studentGroups[19], studentGroups[20]], false, 1, true),
        new Course("C115", "Solfeo-Ritmica", professors[7], studentGroups[20], false, 2, false),
        new Course("C116", "Dictado Musical", professors[22], studentGroups[20], false, 1, true),
        new Course("C117", "Armonia", professors[23], studentGroups[20], false, 1, true),
        new Course("C118", "Analisis Musical", professors[26], studentGroups[20], false, 1, true),
        new Course("C119", "Inc. Orquestal (General)", professors[28], [studentGroups[6], studentGroups[7], studentGroups[14], studentGroups[15]], false, 2, true),
        new Course("C120", "Inc. Orquestal (Seccional)", professors[28], [studentGroups[6], studentGroups[7], studentGroups[14], studentGroups[15]], false, 2, true),
        new Course("C121", "Orquesta A (General)", professors[28], [studentGroups[11], studentGroups[12], studentGroups[13], studentGroups[16], studentGroups[17]], false, 2, true),
        new Course("C122", "Orquesta A (Seccional)", professors[28], [studentGroups[11], studentGroups[12], studentGroups[13], studentGroups[16], studentGroups[17]], false, 2, true),
        new Course("C123", "Orquesta B (General)", professors[28], [studentGroups[18], studentGroups[19], studentGroups[20]], false, 2, true),
        new Course("C124", "Orquesta B (Seccional)", professors[28], [studentGroups[18], studentGroups[19], studentGroups[20]], false, 2, true),
        new Course("C125", "Orquesta Sinfonica", professors[16], [studentGroups[18], studentGroups[19], studentGroups[20]], false, 2, true, "E-101"),

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

    // Añadir restricción dura para que ciertos grupos no tengan clase después de las 19:00
    generator.addHardConstraint(
        (assignment) => {
            // Grupos que no deben tener clases después de las 19:00
            const restrictedGroups = ["G7", "G8", "G9", "G10", "G11", "G12", "G13", "G14"];

            // Si alguno de los grupos de la asignación está en la lista de restricción
            if (assignment.course.studentGroups.some(g => restrictedGroups.includes(g.id))) {
                // Verificar que la hora del slot principal no sea después de las 19:00 (slots 4 y 5)
                if (assignment.timeSlot.hourIndex >= 4) {
                    return false; // No cumple la restricción
                }

                // También verificar los slots secundarios o consecutivos
                const allSlots = assignment.getAllTimeSlots();
                for (const slot of allSlots) {
                    if (slot.hourIndex >= 4) {
                        return false; // No cumple la restricción
                    }
                }
            }
            return true; // Cumple la restricción
        },
        "No clases después de las 19:00 para los grupos de iniciación y básico"
    );
    generator.addHardConstraint(
        (assignment) => {
            // Esta restricción será verificada por el método areStudentGroupsAvailableForAssignment
            // por lo que simplemente devolvemos true aquí, ya que la verificación principal
            // se realiza en el método anterior
            return true;
        },
        "Un grupo no puede tener dos asignaturas a la misma hora"
    );
    generator.addHardConstraint(
        (assignment) => {
            const totalStudents = assignment.course.studentGroups.reduce((sum, group) => sum + group.size, 0);
            return assignment.room.capacity >= totalStudents;
        },
        "El aula debe tener capacidad suficiente para todos los estudiantes"
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
    generator.addRoomBalancingConstraint();

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

