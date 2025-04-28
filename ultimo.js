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

        // 8. NUEVO: Verificar restricción de horario para grupos específicos
        const restrictedGroups = ["G7", "G8", "G9", "G10", "G11", "G12", "G13", "G14"];
        if (assignment.course.studentGroups.some(g => restrictedGroups.includes(g.id))) {
            // Verificar que la hora del slot principal no sea después de las 19:00 (slots 4 y 5)
            if (assignment.timeSlot.hourIndex >= 4) {
                score = 0; // Penalización severa (restricción dura)
            }

            // También verificar los slots secundarios o consecutivos
            const allSlots = assignment.getAllTimeSlots();
            for (const slot of allSlots) {
                if (slot.hourIndex >= 4) {
                    score = 0; // Penalización severa (restricción dura)
                    break;
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
                let randomHourIndex = Math.floor(Math.random() * (maxHourIndex + 1));

                // AÑADIR ESTO: Restricción para grupos específicos
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
        // Verificación básica
        const basicValidation = chromosome.isRoomAvailableForAssignment(assignment) &&
            chromosome.isProfessorAvailableForAssignment(assignment) &&
            chromosome.areStudentGroupsAvailableForAssignment(assignment) &&
            this.isRoomRequirementSatisfied(assignment);

        if (!basicValidation) return false;

        // Verificar todas las restricciones duras personalizadas
        for (const constraint of this.hardConstraints) {
            if (!constraint.evaluate(assignment)) {
                return false;
            }
        }

        // Verificar la restricción de horario para grupos específicos (para redundancia)
        const restrictedGroups = ["G7", "G8", "G9", "G10", "G11", "G12", "G13", "G14"];
        if (assignment.course.studentGroups.some(g => restrictedGroups.includes(g.id))) {
            // Verificar que la hora del slot principal no sea después de las 19:00 (slots 4 y 5)
            if (assignment.timeSlot.hourIndex >= 4) {
                return false;
            }

            // También verificar los slots secundarios o consecutivos
            const allSlots = assignment.getAllTimeSlots();
            for (const slot of allSlots) {
                if (slot.hourIndex >= 4) {
                    return false;
                }
            }
        }

        return true;
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

        // Determinar el rango de horas permitido según los grupos
        const restrictedGroups = ["G7", "G8", "G9", "G10", "G11", "G12", "G13", "G14"];
        const isRestricted = course.studentGroups.some(g => restrictedGroups.includes(g.id));

        // Intentar diferentes combinaciones hasta encontrar una válida
        for (const room of roomsToTry) {
            for (let dayIndex = 0; dayIndex < DAYS_OF_WEEK.length; dayIndex++) {
                // Determinar el rango de horas permitido
                let maxPossibleHourIndex = course.requiresConsecutiveSlots ?
                    (HOURS_PER_DAY - course.duration) :
                    (HOURS_PER_DAY - 1);

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
            let randomHourIndex = Math.floor(Math.random() * (maxHourIndex + 1));

            // AÑADIR ESTO: Restricción para grupos específicos
            const restrictedGroups = ["G7", "G8", "G9", "G10", "G11", "G12", "G13", "G14"];
            if (course.studentGroups.some(g => restrictedGroups.includes(g.id))) {
                // Limitar a slots antes de las 19:00 (índice < 4)
                const maxAllowedHourIndex = Math.min(maxHourIndex, 3);
                randomHourIndex = Math.floor(Math.random() * (maxAllowedHourIndex + 1));
            }

            const newTimeSlot = new TimeSlot(randomDayIndex, randomHourIndex);

            // Para clases no consecutivas, generar nuevos slots secundarios
            if (!course.requiresConsecutiveSlots && course.duration > 1) {
                const newSecondaryTimeSlots = this.generateSecondaryTimeSlots(course, newTimeSlot);
                assignment.secondaryTimeSlots = newSecondaryTimeSlots;
            }

            assignment.timeSlot = newTimeSlot;
        }
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

// Clase para gestionar y calcular métricas
class TimetableMetrics {
    constructor(timetableGenerator) {
        this.generator = timetableGenerator;

        // Métricas de evolución del algoritmo
        this.generationHistory = [];
        this.timeHistory = [];
        this.fitnessHistory = [];
        this.diversityHistory = [];
        this.startTime = null;

        // Métricas del horario final
        this.finalMetrics = {
            hardConstraintsSatisfaction: 0,
            softConstraintsSatisfaction: 0,
            roomUtilization: {},
            professorLoad: {},
            dailyDistribution: {},
            hourlyDistribution: {},
            groupScheduleBalance: {}
        };
    }

    // Iniciar recolección de métricas
    startCollecting() {
        this.startTime = new Date();
        this.generationHistory = [];
        this.timeHistory = [];
        this.fitnessHistory = [];
        this.diversityHistory = [];
    }

    // Registrar métricas para cada generación
    recordGeneration(generation, population) {
        // Calcular tiempo transcurrido
        const currentTime = new Date();
        const elapsedTime = (currentTime - this.startTime) / 1000; // en segundos

        // Ordenar población por fitness
        population.sort((a, b) => b.fitness - a.fitness);
        const bestFitness = population[0].fitness;

        // Calcular diversidad (promedio de la distancia entre cromosomas)
        const diversity = this.calculateDiversity(population);

        // Guardar métricas
        this.generationHistory.push(generation);
        this.timeHistory.push(elapsedTime);
        this.fitnessHistory.push(bestFitness);
        this.diversityHistory.push(diversity);
    }

    // Calcular diversidad de la población (puede ser computacionalmente costoso)
    calculateDiversity(population) {
        // Implementación simplificada: desviación estándar de fitness
        const fitnessValues = population.map(chromosome => chromosome.fitness);
        const mean = fitnessValues.reduce((sum, value) => sum + value, 0) / fitnessValues.length;
        const variance = fitnessValues.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / fitnessValues.length;
        return Math.sqrt(variance);
    }

    // Analizar el horario final generado
    analyzeSchedule(bestChromosome) {
        // 1. Calcular satisfacción de restricciones duras
        this.calculateHardConstraintsSatisfaction(bestChromosome);

        // 2. Calcular satisfacción de restricciones blandas
        this.calculateSoftConstraintsSatisfaction(bestChromosome);

        // 3. Analizar utilización de aulas
        this.analyzeRoomUtilization(bestChromosome);

        // 4. Analizar carga de profesores
        this.analyzeProfessorLoad(bestChromosome);

        // 5. Analizar distribución diaria y horaria
        this.analyzeTimeDistribution(bestChromosome);

        // 6. Analizar balance de horario por grupo
        this.analyzeGroupScheduleBalance(bestChromosome);

        return this.finalMetrics;
    }

    // Calcular porcentaje de restricciones duras cumplidas
    calculateHardConstraintsSatisfaction(chromosome) {
        let totalConstraints = 0;
        let satisfiedConstraints = 0;

        // Contar restricciones duras incorporadas en el código
        const basicConstraints = [
            'isRoomAvailableForAssignment',
            'isProfessorAvailableForAssignment',
            'areStudentGroupsAvailableForAssignment',
            'isRoomRequirementSatisfied'
        ];

        // Para cada asignación, verificar restricciones básicas
        for (const assignment of chromosome.classAssignments) {
            for (const constraint of basicConstraints) {
                totalConstraints++;
                if (chromosome[constraint](assignment)) {
                    satisfiedConstraints++;
                }
            }

            // Verificar requisitos de computadoras
            if (assignment.course.requiresComputers) {
                totalConstraints++;
                if (assignment.room.hasComputers) {
                    satisfiedConstraints++;
                }
            }

            // Verificar capacidad del aula
            totalConstraints++;
            const totalStudents = assignment.course.studentGroups.reduce((sum, group) => sum + group.size, 0);
            if (assignment.room.capacity >= totalStudents) {
                satisfiedConstraints++;
            }
        }

        // Contar restricciones duras personalizadas
        for (const constraint of this.generator.hardConstraints) {
            for (const assignment of chromosome.classAssignments) {
                totalConstraints++;
                if (constraint.evaluate(assignment)) {
                    satisfiedConstraints++;
                }
            }
        }

        this.finalMetrics.hardConstraintsSatisfaction = {
            total: totalConstraints,
            satisfied: satisfiedConstraints,
            percentage: (satisfiedConstraints / totalConstraints) * 100
        };
    }

    // Calcular satisfacción de restricciones blandas
    calculateSoftConstraintsSatisfaction(chromosome) {
        let totalConstraints = 0;
        let satisfiedConstraints = 0;
        let weightedScore = 0;
        let maxWeightedScore = 0;

        // Para cada restricción blanda personalizada
        for (const constraint of this.generator.softConstraints) {
            for (const assignment of chromosome.classAssignments) {
                totalConstraints++;
                const satisfaction = constraint.evaluate(assignment);

                // Consideramos cumplida si la satisfacción es mayor a 0.5 (umbral arbitrario)
                if (satisfaction > 0.5) {
                    satisfiedConstraints++;
                }

                // Calcular puntuación ponderada
                weightedScore += satisfaction * constraint.weight;
                maxWeightedScore += constraint.weight;
            }
        }

        // Restricción de slots consecutivos/no consecutivos (ya implementada en el código)
        for (const assignment of chromosome.classAssignments) {
            if (assignment.course.duration > 1) {
                totalConstraints++;

                if (assignment.course.requiresConsecutiveSlots) {
                    const slots = assignment.getAllTimeSlots();
                    const isConsecutive = slots.length === assignment.course.duration &&
                        slots.every((slot, index) =>
                            index === 0 ||
                            (slot.dayIndex === slots[index - 1].dayIndex &&
                                slot.hourIndex === slots[index - 1].hourIndex + 1)
                        );

                    if (isConsecutive) {
                        satisfiedConstraints++;
                        weightedScore += 0.5; // Peso especificado en el código original
                    }
                    maxWeightedScore += 0.5;
                } else {
                    const hasAllSlots = assignment.secondaryTimeSlots.length === assignment.course.duration - 1;
                    if (hasAllSlots) {
                        satisfiedConstraints++;
                        weightedScore += 0.5;
                    }
                    maxWeightedScore += 0.5;
                }
            }
        }

        this.finalMetrics.softConstraintsSatisfaction = {
            total: totalConstraints,
            satisfied: satisfiedConstraints,
            percentage: (satisfiedConstraints / totalConstraints) * 100,
            weightedScore: weightedScore,
            maxWeightedScore: maxWeightedScore,
            weightedPercentage: (weightedScore / maxWeightedScore) * 100
        };
    }

    // Analizar utilización de aulas
    analyzeRoomUtilization(chromosome) {
        const roomStats = {};
        const totalSlots = DAYS_OF_WEEK.length * HOURS_PER_DAY;

        // Inicializar estadísticas para cada aula
        for (const room of this.generator.rooms) {
            roomStats[room.id] = {
                capacity: room.capacity,
                hasComputers: room.hasComputers,
                assignedSlots: 0,
                utilization: 0,
                averageStudents: 0,
                totalStudents: 0,
                assignments: []
            };
        }

        // Contar slots asignados y estudiantes por aula
        for (const assignment of chromosome.classAssignments) {
            const slots = assignment.getAllTimeSlots();
            const totalStudents = assignment.course.studentGroups.reduce((sum, group) => sum + group.size, 0);

            roomStats[assignment.room.id].assignedSlots += slots.length;
            roomStats[assignment.room.id].totalStudents += totalStudents * slots.length;
            roomStats[assignment.room.id].assignments.push({
                course: assignment.course.name,
                slots: slots.length,
                students: totalStudents
            });
        }

        // Calcular porcentaje de utilización y promedio de estudiantes
        for (const roomId in roomStats) {
            const stats = roomStats[roomId];
            stats.utilization = (stats.assignedSlots / totalSlots) * 100;
            stats.averageStudents = stats.totalStudents / (stats.assignedSlots || 1);

            // Calcular eficiencia (qué tan bien se usa la capacidad)
            const capacity = stats.capacity;
            stats.efficiency = (stats.averageStudents / capacity) * 100;
        }

        this.finalMetrics.roomUtilization = roomStats;
    }

    // Analizar carga de profesores
    analyzeProfessorLoad(chromosome) {
        const professorStats = {};

        // Inicializar estadísticas para cada profesor
        for (const professor of this.generator.professors) {
            professorStats[professor.id] = {
                name: professor.name,
                totalHours: 0,
                totalCourses: 0,
                coursesByDay: Array(DAYS_OF_WEEK.length).fill(0),
                hoursByDay: Array(DAYS_OF_WEEK.length).fill(0),
                courses: []
            };
        }

        // Contar horas y cursos por profesor
        for (const assignment of chromosome.classAssignments) {
            const professor = assignment.course.professor;
            const slots = assignment.getAllTimeSlots();

            professorStats[professor.id].totalHours += slots.length;
            professorStats[professor.id].totalCourses += 1;
            professorStats[professor.id].courses.push({
                name: assignment.course.name,
                hours: slots.length
            });

            // Contar por día
            for (const slot of slots) {
                professorStats[professor.id].coursesByDay[slot.dayIndex] += 1;
                professorStats[professor.id].hoursByDay[slot.dayIndex] += 1;
            }
        }

        // Calcular estadísticas adicionales
        for (const professorId in professorStats) {
            const stats = professorStats[professorId];

            // Calcular distribución porcentual por día
            stats.hoursDistribution = stats.hoursByDay.map(hours =>
                (hours / stats.totalHours) * 100
            );

            // Calcular factor de balance (0-1, 1 = perfectamente balanceado)
            const idealHoursPerDay = stats.totalHours / DAYS_OF_WEEK.length;
            const sumOfSquaredDifferences = stats.hoursByDay.reduce((sum, hours) =>
                sum + Math.pow(hours - idealHoursPerDay, 2), 0);
            stats.balanceFactor = 1 - (Math.sqrt(sumOfSquaredDifferences) / (stats.totalHours || 1));
        }

        this.finalMetrics.professorLoad = professorStats;
    }

    // Analizar distribución diaria y horaria de clases
    analyzeTimeDistribution(chromosome) {
        // Inicializar matrices para distribución
        const dailyDistribution = Array(DAYS_OF_WEEK.length).fill(0);
        const hourlyDistribution = Array(HOURS_PER_DAY).fill(0);
        const timeMatrix = Array(DAYS_OF_WEEK.length).fill().map(() => Array(HOURS_PER_DAY).fill(0));

        // Contar asignaciones por día y hora
        for (const assignment of chromosome.classAssignments) {
            const slots = assignment.getAllTimeSlots();

            for (const slot of slots) {
                dailyDistribution[slot.dayIndex]++;
                hourlyDistribution[slot.hourIndex]++;
                timeMatrix[slot.dayIndex][slot.hourIndex]++;
            }
        }

        // Calcular porcentajes
        const totalSlots = chromosome.classAssignments.reduce((sum, assignment) =>
            sum + assignment.getAllTimeSlots().length, 0);

        const dailyPercentage = dailyDistribution.map(count => (count / totalSlots) * 100);
        const hourlyPercentage = hourlyDistribution.map(count => (count / totalSlots) * 100);

        // Calcular factor de balance
        const idealSlotsPerDay = totalSlots / DAYS_OF_WEEK.length;
        const dayBalanceFactor = 1 - (
            Math.sqrt(
                dailyDistribution.reduce((sum, count) =>
                    sum + Math.pow(count - idealSlotsPerDay, 2), 0)
            ) / (totalSlots || 1)
        );

        const idealSlotsPerHour = totalSlots / HOURS_PER_DAY;
        const hourBalanceFactor = 1 - (
            Math.sqrt(
                hourlyDistribution.reduce((sum, count) =>
                    sum + Math.pow(count - idealSlotsPerHour, 2), 0)
            ) / (totalSlots || 1)
        );

        this.finalMetrics.dailyDistribution = {
            counts: dailyDistribution,
            percentages: dailyPercentage,
            balanceFactor: dayBalanceFactor
        };

        this.finalMetrics.hourlyDistribution = {
            counts: hourlyDistribution,
            percentages: hourlyPercentage,
            balanceFactor: hourBalanceFactor
        };

        this.finalMetrics.timeMatrix = timeMatrix;
    }

    // Analizar balance de horario por grupo de estudiantes
    analyzeGroupScheduleBalance(chromosome) {
        const groupStats = {};

        // Inicializar estadísticas para cada grupo
        for (const group of this.generator.studentGroups) {
            groupStats[group.id] = {
                name: group.name,
                size: group.size,
                totalHours: 0,
                hoursByDay: Array(DAYS_OF_WEEK.length).fill(0),
                hoursByTimeSlot: Array(HOURS_PER_DAY).fill(0),
                courses: [],
                consecutiveHours: {
                    max: 0,
                    average: 0
                },
                gaps: {
                    total: 0,
                    average: 0
                }
            };
        }

        // Contar horas y distribuir por día y hora
        for (const assignment of chromosome.classAssignments) {
            const slots = assignment.getAllTimeSlots();

            for (const group of assignment.course.studentGroups) {
                groupStats[group.id].totalHours += slots.length;
                groupStats[group.id].courses.push({
                    name: assignment.course.name,
                    hours: slots.length
                });

                // Distribuir por día y hora
                for (const slot of slots) {
                    groupStats[group.id].hoursByDay[slot.dayIndex]++;
                    groupStats[group.id].hoursByTimeSlot[slot.hourIndex]++;
                }
            }
        }

        // Analizar horario completo por día para cada grupo
        for (const groupId in groupStats) {
            const scheduleByDay = Array(DAYS_OF_WEEK.length).fill().map(() => Array(HOURS_PER_DAY).fill(false));

            // Marcar slots ocupados para este grupo
            for (const assignment of chromosome.classAssignments) {
                if (assignment.course.studentGroups.some(g => g.id === groupId)) {
                    const slots = assignment.getAllTimeSlots();
                    for (const slot of slots) {
                        scheduleByDay[slot.dayIndex][slot.hourIndex] = true;
                    }
                }
            }

            // Analizar horas consecutivas y gaps
            let maxConsecutive = 0;
            let totalConsecutiveSequences = 0;
            let sumConsecutiveLength = 0;
            let totalGaps = 0;

            for (let dayIndex = 0; dayIndex < DAYS_OF_WEEK.length; dayIndex++) {
                let currentConsecutive = 0;
                let inGap = false;

                for (let hourIndex = 0; hourIndex < HOURS_PER_DAY; hourIndex++) {
                    if (scheduleByDay[dayIndex][hourIndex]) {
                        // Si estábamos en un gap, lo terminamos
                        if (inGap) {
                            inGap = false;
                        }

                        // Incrementar secuencia consecutiva
                        currentConsecutive++;
                    } else {
                        // Verificar si empezamos un gap (después de clases)
                        if (currentConsecutive > 0 && hourIndex < HOURS_PER_DAY - 1 &&
                            scheduleByDay[dayIndex].slice(hourIndex + 1).some(slot => slot)) {
                            inGap = true;
                            totalGaps++;
                        }

                        // Si teníamos una secuencia, la registramos
                        if (currentConsecutive > 0) {
                            maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
                            sumConsecutiveLength += currentConsecutive;
                            totalConsecutiveSequences++;
                            currentConsecutive = 0;
                        }
                    }
                }

                // Si terminamos el día con una secuencia activa
                if (currentConsecutive > 0) {
                    maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
                    sumConsecutiveLength += currentConsecutive;
                    totalConsecutiveSequences++;
                }
            }

            groupStats[groupId].consecutiveHours = {
                max: maxConsecutive,
                average: sumConsecutiveLength / (totalConsecutiveSequences || 1)
            };

            groupStats[groupId].gaps = {
                total: totalGaps,
                average: totalGaps / DAYS_OF_WEEK.length
            };

            // Calcular balance
            const idealHoursPerDay = groupStats[groupId].totalHours / DAYS_OF_WEEK.length;
            const sumOfSquaredDifferences = groupStats[groupId].hoursByDay.reduce((sum, hours) =>
                sum + Math.pow(hours - idealHoursPerDay, 2), 0);

            groupStats[groupId].balanceFactor = 1 - (
                Math.sqrt(sumOfSquaredDifferences) / (groupStats[groupId].totalHours || 1)
            );
        }

        this.finalMetrics.groupScheduleBalance = groupStats;
    }

    // Generar reporte de métricas
    generateReport() {
        // Estructurar datos para análisis y visualización
        const report = {
            algorithm: {
                generations: this.generationHistory.length,
                totalTime: this.timeHistory[this.timeHistory.length - 1],
                convergence: {
                    generationHistory: this.generationHistory,
                    fitnessHistory: this.fitnessHistory,
                    timeHistory: this.timeHistory,
                    diversityHistory: this.diversityHistory
                }
            },
            constraints: {
                hard: this.finalMetrics.hardConstraintsSatisfaction,
                soft: this.finalMetrics.softConstraintsSatisfaction
            },
            timeDistribution: {
                daily: this.finalMetrics.dailyDistribution,
                hourly: this.finalMetrics.hourlyDistribution,
                matrix: this.finalMetrics.timeMatrix
            },
            resources: {
                rooms: this.finalMetrics.roomUtilization,
                professors: this.finalMetrics.professorLoad,
                groups: this.finalMetrics.groupScheduleBalance
            }
        };

        return report;
    }

    // Visualizar datos (versión simple para consola)
    logSummary() {
        console.log("\n===== RESUMEN DE MÉTRICAS DEL HORARIO =====");

        // 1. Restricciones
        const hardSatisfaction = this.finalMetrics.hardConstraintsSatisfaction;
        const softSatisfaction = this.finalMetrics.softConstraintsSatisfaction;

        console.log(`\nRESTRICCIONES:`);
        console.log(`  Restricciones duras: ${hardSatisfaction.satisfied}/${hardSatisfaction.total} cumplidas (${hardSatisfaction.percentage.toFixed(2)}%)`);
        console.log(`  Restricciones blandas: ${softSatisfaction.satisfied}/${softSatisfaction.total} cumplidas (${softSatisfaction.percentage.toFixed(2)}%)`);
        console.log(`  Puntuación ponderada de restricciones blandas: ${softSatisfaction.weightedScore.toFixed(2)}/${softSatisfaction.maxWeightedScore.toFixed(2)} (${softSatisfaction.weightedPercentage.toFixed(2)}%)`);

        // 2. Distribución de tiempo
        const dailyDist = this.finalMetrics.dailyDistribution;
        const hourlyDist = this.finalMetrics.hourlyDistribution;

        console.log(`\nDISTRIBUCIÓN DE CLASES:`);
        console.log(`  Factor de balance diario: ${dailyDist.balanceFactor.toFixed(4)} (1.0 = perfecto)`);
        console.log(`  Distribución por día:`);
        dailyDist.counts.forEach((count, i) => {
            console.log(`    ${DAYS_OF_WEEK[i]}: ${count} clases (${dailyDist.percentages[i].toFixed(2)}%)`);
        });

        console.log(`  Factor de balance horario: ${hourlyDist.balanceFactor.toFixed(4)} (1.0 = perfecto)`);
        console.log(`  Distribución por hora:`);
        hourlyDist.counts.forEach((count, i) => {
            // Asumiendo que la función toString de TimeSlot devuelve la hora formateada
            const timeSlot = new TimeSlot(0, i);
            const time = i + 15; // Hora de inicio (15:00)
            console.log(`    ${time}:00: ${count} clases (${hourlyDist.percentages[i].toFixed(2)}%)`);
        });

        // 3. Top estadísticas relevantes
        console.log(`\nESTADÍSTICAS DE RECURSOS:`);

        // 3.1 Aulas más/menos utilizadas
        const roomStats = Object.entries(this.finalMetrics.roomUtilization);
        const mostUsedRoom = roomStats.reduce((prev, curr) =>
            prev[1].utilization > curr[1].utilization ? prev : curr);
        const leastUsedRoom = roomStats.reduce((prev, curr) =>
            prev[1].utilization < curr[1].utilization ? prev : curr);

        console.log(`  Aula más utilizada: ${mostUsedRoom[0]} (${mostUsedRoom[1].utilization.toFixed(2)}%)`);
        console.log(`  Aula menos utilizada: ${leastUsedRoom[0]} (${leastUsedRoom[1].utilization.toFixed(2)}%)`);

        // 3.2 Profesores con más/menos carga
        const profStats = Object.entries(this.finalMetrics.professorLoad);
        const mostBusyProf = profStats.reduce((prev, curr) =>
            prev[1].totalHours > curr[1].totalHours ? prev : curr);
        const leastBusyProf = profStats.reduce((prev, curr) =>
            prev[1].totalHours < curr[1].totalHours ? prev : curr);

        console.log(`  Profesor con más horas: ${mostBusyProf[1].name} (${mostBusyProf[1].totalHours} horas)`);
        console.log(`  Profesor con menos horas: ${leastBusyProf[1].name} (${leastBusyProf[1].totalHours} horas)`);

        // 3.3 Grupos con horarios más/menos balanceados
        const groupStats = Object.entries(this.finalMetrics.groupScheduleBalance);
        const mostBalancedGroup = groupStats.reduce((prev, curr) =>
            prev[1].balanceFactor > curr[1].balanceFactor ? prev : curr);
        const leastBalancedGroup = groupStats.reduce((prev, curr) =>
            prev[1].balanceFactor < curr[1].balanceFactor ? prev : curr);

        console.log(`  Grupo con horario más balanceado: ${mostBalancedGroup[1].name} (factor: ${mostBalancedGroup[1].balanceFactor.toFixed(4)})`);
        console.log(`  Grupo con horario menos balanceado: ${leastBalancedGroup[1].name} (factor: ${leastBalancedGroup[1].balanceFactor.toFixed(4)})`);

        // 4. Resumen del algoritmo
        console.log(`\nRENDIMIENTO DEL ALGORITMO:`);
        console.log(`  Generaciones totales: ${this.generationHistory.length}`);
        console.log(`  Tiempo total de ejecución: ${this.timeHistory[this.timeHistory.length - 1].toFixed(2)} segundos`);
        console.log(`  Fitness final: ${this.fitnessHistory[this.fitnessHistory.length - 1].toFixed(4)}`);

        console.log("===========================================");
    }
}

// Implementación para visualización en HTML
class TimetableVisualizer {
    constructor(metricsReport) {
        this.report = metricsReport;
    }

    // Generar HTML para visualizar las métricas
    generateHTML() {
        // Aquí se puede generar un HTML completo con gráficos
        // Usando bibliotecas como Chart.js, D3.js, etc.

        let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Análisis de Métricas del Horario</title>
            <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .section { margin-bottom: 30px; }
                .chart-container { width: 600px; height: 400px; margin: 20px 0; }
                .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
                .stat-card { 
                    border: 1px solid #ddd; 
                    border-radius: 5px; 
                    padding: 15px;
                    background-color: #f9f9f9;
                }
                .good { background-color: #d4edda; }
                .medium { background-color: #fff3cd; }
                .poor { background-color: #f8d7da; }
                h1, h2, h3 { color: #333; }
                table { border-collapse: collapse; width: 100%; }
                table, th, td { border: 1px solid #ddd; padding: 8px; }
                th { background-color: #f2f2f2; text-align: left; }
                tr:nth-child(even) { background-color: #f9f9f9; }
            </style>
        </head>
        <body>
            <h1>Análisis de Métricas del Horario</h1>
            
            <div class="section">
                <h2>Resumen General</h2>
                <div class="stats-grid">
                    <div class="stat-card ${this.getConstraintSatisfactionClass(this.report.constraints.hard.percentage)}">
                        <h3>Restricciones Duras</h3>
                        <p>${this.report.constraints.hard.satisfied}/${this.report.constraints.hard.total} cumplidas</p>
                        <p><strong>${this.report.constraints.hard.percentage.toFixed(2)}%</strong></p>
                    </div>
                    <div class="stat-card ${this.getConstraintSatisfactionClass(this.report.constraints.soft.percentage)}">
                        <h3>Restricciones Blandas</h3>
                        <p>${this.report.constraints.soft.satisfied}/${this.report.constraints.soft.total} cumplidas</p>
                        <p><strong>${this.report.constraints.soft.percentage.toFixed(2)}%</strong></p>
                    </div>
                    <div class="stat-card">
                        <h3>Tiempo de Ejecución</h3>
                        <p><strong>${this.report.algorithm.totalTime.toFixed(2)}</strong> segundos</p>
                        <p>Generaciones: ${this.report.algorithm.generations}</p>
                    </div>
                </div>
            </div>
            
            <div class="section">
                <h2>Evolución del Algoritmo</h2>
                <div class="chart-container">
                    <canvas id="fitnessChart"></canvas>
                </div>
                <div class="chart-container">
                    <canvas id="diversityChart"></canvas>
                </div>
            </div>
            
            <div class="section">
                <h2>Distribución de Clases</h2>
                <div class="chart-container">
                    <canvas id="dailyDistributionChart"></canvas>
                </div>
                <div class="chart-container">
                    <canvas id="hourlyDistributionChart"></canvas>
                </div>
                <h3>Matriz de Asignaciones por Día y Hora</h3>
                <table>
                    <tr>
                        <th>Hora/Día</th>
                        ${DAYS_OF_WEEK.map(day => `<th>${day}</th>`).join('')}
                    </tr>
                    ${this.generateTimeMatrixRows()}
                </table>
            </div>
            
            <div class="section">
                <h2>Utilización de Aulas</h2>
                <div class="chart-container">
                    <canvas id="roomUtilizationChart"></canvas>
                </div>
                <table>
                    <tr>
                        <th>Aula</th>
                        <th>Capacidad</th>
                        <th>Horas Asignadas</th>
                        <th>Utilización (%)</th>
                        <th>Promedio Estudiantes</th>
                        <th>Eficiencia (%)</th>
                    </tr>
                    ${this.generateRoomUtilizationRows()}
                </table>
            </div>
            
            <div class="section">
                <h2>Carga de Profesores</h2>
                <div class="chart-container">
                    <canvas id="professorLoadChart"></canvas>
                </div>
                <div class="chart-container">
                    <canvas id="professorBalanceChart"></canvas>
                </div>
                <table>
                    <tr>
                        <th>Profesor</th>
                        <th>Total Horas</th>
                        <th>Total Cursos</th>
                        <th>Factor de Balance</th>
                        <th>Distribución por Día</th>
                    </tr>
                    ${this.generateProfessorLoadRows()}
                </table>
            </div>
            
            <div class="section">
                <h2>Análisis de Horarios por Grupo</h2>
                <div class="chart-container">
                    <canvas id="groupHoursChart"></canvas>
                </div>
                <div class="chart-container">
                    <canvas id="groupGapsChart"></canvas>
                </div>
                <table>
                    <tr>
                        <th>Grupo</th>
                        <th>Total Horas</th>
                        <th>Factor de Balance</th>
                        <th>Máx. Horas Consecutivas</th>
                        <th>Gaps Totales</th>
                    </tr>
                    ${this.generateGroupAnalysisRows()}
                </table>
            </div>
            
            <script>
                // Inicializar gráficos cuando se cargue la página
                document.addEventListener('DOMContentLoaded', function() {
                    ${this.generateChartScripts()}
                });
            </script>
        </body>
        </html>
        `;

        return html;
    }

    // Generar las filas de la matriz de distribución de tiempo
    generateTimeMatrixRows() {
        let rows = '';

        for (let hour = 0; hour < HOURS_PER_DAY; hour++) {
            const time = hour + 15; // Hora de inicio (15:00)
            rows += `<tr>
                <td>${time}:00</td>
                ${DAYS_OF_WEEK.map((day, dayIndex) => {
                const count = this.report.timeDistribution.matrix[dayIndex][hour];
                const colorIntensity = Math.min(255, 255 - count * 40);
                return `<td style="background-color: rgba(66, 133, 244, ${count / 10});">${count}</td>`;
            }).join('')}
            </tr>`;
        }

        return rows;
    }

    // Generar las filas de utilización de aulas
    generateRoomUtilizationRows() {
        let rows = '';

        const roomStats = Object.entries(this.report.resources.rooms);

        for (const [roomId, stats] of roomStats) {
            const utilizationClass = this.getUtilizationClass(stats.utilization);
            const efficiencyClass = this.getEfficiencyClass(stats.efficiency);

            rows += `<tr>
                <td>${roomId}</td>
                <td>${stats.capacity}</td>
                <td>${stats.assignedSlots}</td>
                <td class="${utilizationClass}">${stats.utilization.toFixed(2)}%</td>
                <td>${stats.averageStudents.toFixed(1)}</td>
                <td class="${efficiencyClass}">${stats.efficiency.toFixed(2)}%</td>
            </tr>`;
        }

        return rows;
    }

    // Generar las filas de carga de profesores
    generateProfessorLoadRows() {
        let rows = '';

        const profStats = Object.entries(this.report.resources.professors);

        for (const [profId, stats] of profStats) {
            const balanceClass = this.getBalanceClass(stats.balanceFactor);

            rows += `<tr>
                <td>${stats.name}</td>
                <td>${stats.totalHours}</td>
                <td>${stats.totalCourses}</td>
                <td class="${balanceClass}">${stats.balanceFactor.toFixed(4)}</td>
                <td>${stats.hoursByDay.map((hours, i) =>
                `${DAYS_OF_WEEK[i]}: ${hours}`).join(', ')}</td>
            </tr>`;
        }

        return rows;
    }

    // Generar las filas de análisis de grupo
    generateGroupAnalysisRows() {
        let rows = '';

        const groupStats = Object.entries(this.report.resources.groups);

        for (const [groupId, stats] of groupStats) {
            const balanceClass = this.getBalanceClass(stats.balanceFactor);

            rows += `<tr>
                <td>${stats.name} (${stats.size} est.)</td>
                <td>${stats.totalHours}</td>
                <td class="${balanceClass}">${stats.balanceFactor.toFixed(4)}</td>
                <td>${stats.consecutiveHours.max} (prom: ${stats.consecutiveHours.average.toFixed(1)})</td>
                <td>${stats.gaps.total} (prom: ${stats.gaps.average.toFixed(1)}/día)</td>
            </tr>`;
        }

        return rows;
    }

    // Generar los scripts para Chart.js
    generateChartScripts() {
        return `
            // Gráfico de evolución del fitness
            new Chart(document.getElementById('fitnessChart'), {
                type: 'line',
                data: {
                    labels: ${JSON.stringify(this.report.algorithm.convergence.generationHistory)},
                    datasets: [{
                        label: 'Fitness',
                        data: ${JSON.stringify(this.report.algorithm.convergence.fitnessHistory)},
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Evolución del Fitness'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            suggestedMax: 1.0
                        }
                    }
                }
            });
            
            // Gráfico de diversidad
            new Chart(document.getElementById('diversityChart'), {
                type: 'line',
                data: {
                    labels: ${JSON.stringify(this.report.algorithm.convergence.generationHistory)},
                    datasets: [{
                        label: 'Diversidad',
                        data: ${JSON.stringify(this.report.algorithm.convergence.diversityHistory)},
                        borderColor: 'rgb(255, 99, 132)',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Evolución de la Diversidad'
                        }
                    }
                }
            });
            
            // Gráfico de distribución diaria
            new Chart(document.getElementById('dailyDistributionChart'), {
                type: 'bar',
                data: {
                    labels: ${JSON.stringify(DAYS_OF_WEEK)},
                    datasets: [{
                        label: 'Clases por día',
                        data: ${JSON.stringify(this.report.timeDistribution.daily.counts)},
                        backgroundColor: 'rgba(54, 162, 235, 0.5)',
                        borderColor: 'rgb(54, 162, 235)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Distribución de Clases por Día'
                        }
                    }
                }
            });
            
            // Gráfico de distribución horaria
            new Chart(document.getElementById('hourlyDistributionChart'), {
                type: 'bar',
                data: {
                    labels: ${JSON.stringify([...Array(HOURS_PER_DAY)].map((_, i) => `${i + 15}:00`))},
                    datasets: [{
                        label: 'Clases por hora',
                        data: ${JSON.stringify(this.report.timeDistribution.hourly.counts)},
                        backgroundColor: 'rgba(255, 159, 64, 0.5)',
                        borderColor: 'rgb(255, 159, 64)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Distribución de Clases por Hora'
                        }
                    }
                }
            });
            
            // Gráfico de utilización de aulas
            new Chart(document.getElementById('roomUtilizationChart'), {
                type: 'bar',
                data: {
                    labels: ${JSON.stringify(Object.keys(this.report.resources.rooms))},
                    datasets: [{
                        label: 'Utilización (%)',
                        data: ${JSON.stringify(Object.values(this.report.resources.rooms).map(r => r.utilization.toFixed(2)))},
                        backgroundColor: 'rgba(75, 192, 192, 0.5)',
                        borderColor: 'rgb(75, 192, 192)',
                        borderWidth: 1
                    }, {
                        label: 'Eficiencia (%)',
                        data: ${JSON.stringify(Object.values(this.report.resources.rooms).map(r => r.efficiency.toFixed(2)))},
                        backgroundColor: 'rgba(153, 102, 255, 0.5)',
                        borderColor: 'rgb(153, 102, 255)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Utilización y Eficiencia de Aulas'
                        }
                    }
                }
            });
            
            // Gráfico de carga de profesores
            new Chart(document.getElementById('professorLoadChart'), {
                type: 'bar',
                data: {
                    labels: ${JSON.stringify(Object.values(this.report.resources.professors).map(p => p.name))},
                    datasets: [{
                        label: 'Horas totales',
                        data: ${JSON.stringify(Object.values(this.report.resources.professors).map(p => p.totalHours))},
                        backgroundColor: 'rgba(255, 99, 132, 0.5)',
                        borderColor: 'rgb(255, 99, 132)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    indexAxis: 'y',
                    plugins: {
                        title: {
                            display: true,
                            text: 'Carga Horaria por Profesor'
                        }
                    }
                }
            });
            
            // Gráfico de balance de profesores
            new Chart(document.getElementById('professorBalanceChart'), {
                type: 'radar',
                data: {
                    labels: ${JSON.stringify(DAYS_OF_WEEK)},
                    datasets: ${JSON.stringify(Object.values(this.report.resources.professors).map((p, i) => ({
            label: p.name,
            data: p.hoursDistribution.map(h => h.toFixed(1)),
            fill: true,
            backgroundColor: `rgba(${50 + i * 40}, ${150 - i * 10}, ${200 - i * 15}, 0.2)`,
            borderColor: `rgb(${50 + i * 40}, ${150 - i * 10}, ${200 - i * 15})`,
            pointBackgroundColor: `rgb(${50 + i * 40}, ${150 - i * 10}, ${200 - i * 15})`,
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: `rgb(${50 + i * 40}, ${150 - i * 10}, ${200 - i * 15})`
        })).slice(0, 5))}
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Distribución de Carga por Día (5 primeros profesores)'
                        }
                    }
                }
            });
            
            // Gráfico de horas por grupo
            new Chart(document.getElementById('groupHoursChart'), {
                type: 'bar',
                data: {
                    labels: ${JSON.stringify(Object.values(this.report.resources.groups).map(g => g.name))},
                    datasets: [{
                        label: 'Horas totales',
                        data: ${JSON.stringify(Object.values(this.report.resources.groups).map(g => g.totalHours))},
                        backgroundColor: 'rgba(54, 162, 235, 0.5)',
                        borderColor: 'rgb(54, 162, 235)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Horas Totales por Grupo'
                        }
                    }
                }
            });
            
            // Gráfico de gaps por grupo
            new Chart(document.getElementById('groupGapsChart'), {
                type: 'bar',
                data: {
                    labels: ${JSON.stringify(Object.values(this.report.resources.groups).map(g => g.name))},
                    datasets: [{
                        label: 'Gaps (huecos) totales',
                        data: ${JSON.stringify(Object.values(this.report.resources.groups).map(g => g.gaps.total))},
                        backgroundColor: 'rgba(255, 206, 86, 0.5)',
                        borderColor: 'rgb(255, 206, 86)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Huecos (Gaps) en el Horario por Grupo'
                        }
                    }
                }
            });
        `;
    }

    // Determinar clase CSS basada en satisfacción de restricciones
    getConstraintSatisfactionClass(percentage) {
        if (percentage >= 95) return 'good';
        if (percentage >= 80) return 'medium';
        return 'poor';
    }

    // Determinar clase CSS basada en utilización
    getUtilizationClass(utilization) {
        if (utilization >= 70) return 'good';
        if (utilization >= 40) return 'medium';
        return 'poor';
    }

    // Determinar clase CSS basada en eficiencia
    getEfficiencyClass(efficiency) {
        if (efficiency >= 80 && efficiency <= 100) return 'good';
        if (efficiency >= 60 || efficiency <= 120) return 'medium';
        return 'poor';
    }

    // Determinar clase CSS basada en balance
    getBalanceClass(balanceFactor) {
        if (balanceFactor >= 0.8) return 'good';
        if (balanceFactor >= 0.6) return 'medium';
        return 'poor';
    }

    // Guardar HTML a archivo
    saveHTMLToFile(filename) {
        const html = this.generateHTML();

        if (fs) {
            try {
                fs.writeFileSync(filename, html, 'utf8');
                console.log(`Archivo '${filename}' guardado exitosamente.`);
                return true;
            } catch (error) {
                console.error(`Error al guardar el archivo '${filename}':`, error);
                return false;
            }
        } else {
            console.log(`Guardado de archivo no disponible en este entorno (requiere Node.js).`);
            return false;
        }
    }
}

// Implementación de uso de las métricas en el algoritmo existente
function integrarMetricas() {
    // 1. Modificar TimetableGenerator para incluir métricas
    const originalGenerateTimetable = TimetableGenerator.prototype.generateTimetable;

    TimetableGenerator.prototype.generateTimetable = function () {
        // Crear objeto de métricas
        this.metrics = new TimetableMetrics(this);
        this.metrics.startCollecting();

        let population = this.generateInitialPopulation();
        let bestChromosome = null;
        let bestFitness = 0;
        let generationsWithoutImprovement = 0;
        const maxGenerationsWithoutImprovement = 200;

        for (let generation = 0; generation < this.maxGenerations; generation++) {
            // Ordenar población por fitness (descendente)
            population.sort((a, b) => b.fitness - a.fitness);

            // Registrar métricas para esta generación
            this.metrics.recordGeneration(generation, population);

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

        // Al final, analizar el mejor horario
        if (bestChromosome) {
            this.metrics.analyzeSchedule(bestChromosome);
        }

        return bestChromosome;
    };

    // 2. Modificar el método printTimetable para incluir métricas
    const originalPrintTimetable = TimetableGenerator.prototype.printTimetable;

    TimetableGenerator.prototype.printTimetable = function (chromosome) {
        // Llamar al método original
        originalPrintTimetable.call(this, chromosome);

        // Imprimir resumen de métricas
        if (this.metrics) {
            this.metrics.logSummary();

            // Generar informe HTML
            const visualizer = new TimetableVisualizer(this.metrics.generateReport());
            visualizer.saveHTMLToFile('metricas-horario.html');
            console.log("Se ha generado un informe detallado en 'metricas-horario.html'");
        }
    };

    // 3. Añadir método para evaluar todas las restricciones duras
    TimetableGenerator.prototype.evaluateHardConstraints = function (assignment) {
        for (const constraint of this.hardConstraints) {
            if (!constraint.evaluate(assignment)) {
                return false;
            }
        }
        return true;
    };

    // 4. Modificar isValidAssignment para incluir las restricciones duras
    TimetableGenerator.prototype.isValidAssignment = function (chromosome, assignment) {
        return chromosome.isRoomAvailableForAssignment(assignment) &&
            chromosome.isProfessorAvailableForAssignment(assignment) &&
            chromosome.areStudentGroupsAvailableForAssignment(assignment) &&
            this.isRoomRequirementSatisfied(assignment) &&
            this.evaluateHardConstraints(assignment);
    };

    console.log("Métricas integradas con éxito en el algoritmo de generación de horarios");
}

// Ejemplo de uso con la restricción para grupos de iniciación y básico
function runExampleWithMetrics() {
    // Crear aulas, profesores, grupos, etc. (como en el ejemplo original)
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

    // Establecer algunas restricciones de disponibilidad para los profesores
    professors[0].setAvailability(0, 0, false); // El Prof. Juan Oscar no está disponible los lunes a primera hora
    professors[1].setAvailability(4, 8, false); // El Prof. Daniel Condori no está disponible los viernes a última hora
    professors[2].setAvailability(2, 3, false); // El Prof. Ivan Katery no está disponible los miércoles a la cuarta hora
    professors[3].setAvailability(1, 7, false); // La Prof. Cecilia Padilla no está disponible los martes a la octava hora
    professors[4].setAvailability(3, 0, false); // El Prof. David Gonzales no está disponible los jueves a primera hora

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
    // ...

    // Crear generador de horarios
    const generator = new TimetableGenerator(rooms, professors, studentGroups, courses);

    // Configurar parámetros
    generator.populationSize = 200;
    generator.maxGenerations = 1000;
    generator.mutationRate = 0.15;
    generator.elitismCount = 15;

    // Añadir restricciones
    generator.addConsecutiveSlotsConstraint();
    generator.addSpecificRoomConstraint();

    // Añadir restricción para grupos de iniciación y básico (no clases después de las 19:00)
    generator.addHardConstraint(
        (assignment) => {
            // Grupos restringidos: G7 a G14 (iniciación y básico)
            const restrictedGroups = ["G7", "G8", "G9", "G10", "G11", "G12", "G13", "G14"];

            // Si alguno de los grupos de esta asignación está en la lista de restricción
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

    // Integrar las métricas con el algoritmo
    integrarMetricas();

    // Generar horario
    console.log("Generando horario con métricas...");
    const bestTimetable = generator.generateTimetable();

    // Imprimir horario y métricas
    generator.printTimetable(bestTimetable);
}

// Ejemplo de funciones de análisis específicas
// Continuación de analizarCargaProfesores

function analizarCargaProfesores(timetable, professors) {
    console.log("\n===== ANÁLISIS DE CARGA DE PROFESORES =====");

    // Contar horas por profesor
    const professorHours = {};

    for (const professor of professors) {
        professorHours[professor.id] = {
            name: professor.name,
            totalHours: 0,
            hoursByDay: Array(DAYS_OF_WEEK.length).fill(0),
            courses: []
        };
    }

    for (const assignment of timetable.classAssignments) {
        const professorId = assignment.course.professor.id;
        const slots = assignment.getAllTimeSlots();

        professorHours[professorId].totalHours += slots.length;
        professorHours[professorId].courses.push({
            name: assignment.course.name,
            hours: slots.length
        });

        // Contar por día
        for (const slot of slots) {
            professorHours[professorId].hoursByDay[slot.dayIndex] += 1;
        }
    }

    // Estadísticas generales
    const totalAssignedHours = Object.values(professorHours).reduce((sum, prof) => sum + prof.totalHours, 0);
    const averageHoursPerProfessor = totalAssignedHours / professors.length;

    console.log(`Total de horas asignadas: ${totalAssignedHours}`);
    console.log(`Promedio de horas por profesor: ${averageHoursPerProfessor.toFixed(2)}`);

    // Desviación estándar
    const variance = Object.values(professorHours).reduce((sum, prof) =>
        sum + Math.pow(prof.totalHours - averageHoursPerProfessor, 2), 0) / professors.length;
    const stdDev = Math.sqrt(variance);
    console.log(`Desviación estándar: ${stdDev.toFixed(2)} horas`);

    // Profesor con más/menos horas
    let maxHoursProf = null;
    let minHoursProf = null;
    let maxHours = -1;
    let minHours = Number.MAX_VALUE;

    for (const profId in professorHours) {
        const hours = professorHours[profId].totalHours;

        if (hours > maxHours) {
            maxHours = hours;
            maxHoursProf = professorHours[profId];
        }

        if (hours < minHours && hours > 0) { // Solo considerar profesores con al menos una hora
            minHours = hours;
            minHoursProf = professorHours[profId];
        }
    }

    console.log(`\nProfesor con más horas: ${maxHoursProf.name} (${maxHours} horas)`);
    console.log(`Profesor con menos horas: ${minHoursProf.name} (${minHours} horas)`);

    // Análisis de distribución por día
    console.log("\nDistribución por día:");

    // Tabla de profesores con más de 10 horas
    console.log("\nProfesores con carga significativa (>10 horas):");
    console.log("Nombre | Total | L | M | X | J | V | Balance");
    console.log("-------|-------|---|---|---|---|---|-------");

    for (const profId in professorHours) {
        const prof = professorHours[profId];

        if (prof.totalHours > 10) {
            // Calcular factor de balance (0-1, 1 = perfectamente balanceado)
            const idealHoursPerDay = prof.totalHours / DAYS_OF_WEEK.length;
            const sumOfSquaredDifferences = prof.hoursByDay.reduce((sum, hours) =>
                sum + Math.pow(hours - idealHoursPerDay, 2), 0);
            const balanceFactor = 1 - (Math.sqrt(sumOfSquaredDifferences) / (prof.totalHours || 1));

            console.log(`${prof.name.padEnd(7)} | ${prof.totalHours.toString().padEnd(5)} | ${prof.hoursByDay.join(' | ')} | ${balanceFactor.toFixed(2)}`);
        }
    }

    // Análisis de problemas y recomendaciones
    console.log("\nAnálisis de problemas potenciales:");

    for (const profId in professorHours) {
        const prof = professorHours[profId];

        // Verificar cargas muy desbalanceadas (más del 70% de horas en un solo día)
        prof.hoursByDay.forEach((hours, dayIndex) => {
            if (hours > 0 && (hours / prof.totalHours) > 0.7) {
                console.log(`⚠️ ${prof.name} tiene el ${((hours / prof.totalHours) * 100).toFixed(0)}% de sus horas (${hours}/${prof.totalHours}) concentradas en ${DAYS_OF_WEEK[dayIndex]}`);
            }
        });

        // Verificar sobrecarga (más de 8 horas en un día)
        prof.hoursByDay.forEach((hours, dayIndex) => {
            if (hours > 8) {
                console.log(`⚠️ ${prof.name} tiene ${hours} horas en ${DAYS_OF_WEEK[dayIndex]}, lo que podría ser excesivo`);
            }
        });

        // Verificar carga muy baja (profesor subutilizado)
        if (prof.totalHours > 0 && prof.totalHours < 5) {
            console.log(`ℹ️ ${prof.name} tiene solo ${prof.totalHours} horas asignadas, posiblemente subutilizado`);
        }
    }

    // Retornar los datos para posible uso posterior
    return {
        professorHours,
        totalAssignedHours,
        averageHoursPerProfessor,
        stdDev
    };
}

// Análisis de distribución de aulas
function analizarDistribucionAulas(timetable, rooms) {
    console.log("\n===== ANÁLISIS DE UTILIZACIÓN DE AULAS =====");

    const roomUtilization = {};
    const totalSlots = DAYS_OF_WEEK.length * HOURS_PER_DAY;

    // Inicializar estadísticas para cada aula
    for (const room of rooms) {
        roomUtilization[room.id] = {
            capacity: room.capacity,
            hasComputers: room.hasComputers,
            assignedSlots: 0,
            utilization: 0,
            hoursByDay: Array(DAYS_OF_WEEK.length).fill(0),
            hoursByTimeSlot: Array(HOURS_PER_DAY).fill(0),
            totalStudents: 0,
            averageStudents: 0,
            assignments: []
        };
    }

    // Contar slots asignados y estudiantes por aula
    for (const assignment of timetable.classAssignments) {
        const slots = assignment.getAllTimeSlots();
        const totalStudents = assignment.course.studentGroups.reduce((sum, group) => sum + group.size, 0);

        roomUtilization[assignment.room.id].assignedSlots += slots.length;
        roomUtilization[assignment.room.id].totalStudents += totalStudents * slots.length;
        roomUtilization[assignment.room.id].assignments.push({
            course: assignment.course.name,
            professor: assignment.course.professor.name,
            slots: slots.length,
            students: totalStudents
        });

        // Contar por día y hora
        for (const slot of slots) {
            roomUtilization[assignment.room.id].hoursByDay[slot.dayIndex] += 1;
            roomUtilization[assignment.room.id].hoursByTimeSlot[slot.hourIndex] += 1;
        }
    }

    // Calcular porcentaje de utilización y promedio de estudiantes
    for (const roomId in roomUtilization) {
        const stats = roomUtilization[roomId];
        stats.utilization = (stats.assignedSlots / totalSlots) * 100;
        stats.averageStudents = stats.totalStudents / (stats.assignedSlots || 1);

        // Calcular eficiencia (qué tan bien se usa la capacidad)
        const capacity = stats.capacity;
        stats.efficiency = (stats.averageStudents / capacity) * 100;
    }

    // Estadísticas generales
    const totalAssignedSlots = Object.values(roomUtilization).reduce((sum, room) => sum + room.assignedSlots, 0);
    const totalCapacitySlots = rooms.reduce((sum, room) => sum + room.capacity * totalSlots, 0);
    const overallUtilization = (totalAssignedSlots / (rooms.length * totalSlots)) * 100;

    console.log(`Total de slots asignados: ${totalAssignedSlots} de ${rooms.length * totalSlots} disponibles`);
    console.log(`Utilización general: ${overallUtilization.toFixed(2)}%`);

    // Aulas más/menos utilizadas
    let maxUtilizationRoom = null;
    let minUtilizationRoom = null;
    let maxUtilization = -1;
    let minUtilization = 101; // Más del 100% no es posible

    for (const roomId in roomUtilization) {
        const utilization = roomUtilization[roomId].utilization;

        if (utilization > maxUtilization) {
            maxUtilization = utilization;
            maxUtilizationRoom = { id: roomId, stats: roomUtilization[roomId] };
        }

        if (utilization < minUtilization && roomUtilization[roomId].assignedSlots > 0) {
            minUtilization = utilization;
            minUtilizationRoom = { id: roomId, stats: roomUtilization[roomId] };
        }
    }

    console.log(`\nAula más utilizada: ${maxUtilizationRoom.id} (${maxUtilization.toFixed(2)}% de utilización)`);
    console.log(`Aula menos utilizada: ${minUtilizationRoom.id} (${minUtilization.toFixed(2)}% de utilización)`);

    // Tabla de utilización (top 5 más utilizadas y 5 menos utilizadas)
    console.log("\nTop 5 aulas más utilizadas:");
    console.log("Aula | Capacidad | Slots Asignados | Utilización | Eficiencia");
    console.log("-----|-----------|----------------|-------------|----------");

    const sortedRoomsByUtilization = Object.entries(roomUtilization)
        .filter(([_, stats]) => stats.assignedSlots > 0)
        .sort((a, b) => b[1].utilization - a[1].utilization);

    for (let i = 0; i < Math.min(5, sortedRoomsByUtilization.length); i++) {
        const [roomId, stats] = sortedRoomsByUtilization[i];
        console.log(`${roomId.padEnd(5)} | ${stats.capacity.toString().padEnd(9)} | ${stats.assignedSlots.toString().padEnd(14)} | ${stats.utilization.toFixed(2).padEnd(11)}% | ${stats.efficiency.toFixed(2)}%`);
    }

    console.log("\nTop 5 aulas menos utilizadas (con al menos una asignación):");
    console.log("Aula | Capacidad | Slots Asignados | Utilización | Eficiencia");
    console.log("-----|-----------|----------------|-------------|----------");

    for (let i = Math.max(0, sortedRoomsByUtilization.length - 5); i < sortedRoomsByUtilization.length; i++) {
        const [roomId, stats] = sortedRoomsByUtilization[sortedRoomsByUtilization.length - 1 - (i - Math.max(0, sortedRoomsByUtilization.length - 5))];
        console.log(`${roomId.padEnd(5)} | ${stats.capacity.toString().padEnd(9)} | ${stats.assignedSlots.toString().padEnd(14)} | ${stats.utilization.toFixed(2).padEnd(11)}% | ${stats.efficiency.toFixed(2)}%`);
    }

    // Análisis de problemas y recomendaciones
    console.log("\nAnálisis de problemas potenciales:");

    for (const roomId in roomUtilization) {
        const stats = roomUtilization[roomId];

        // Verificar aulas con baja utilización
        if (stats.assignedSlots > 0 && stats.utilization < 20) {
            console.log(`ℹ️ El aula ${roomId} está siendo subutilizada (${stats.utilization.toFixed(2)}%)`);
        }

        // Verificar aulas con alta utilización
        if (stats.utilization > 85) {
            console.log(`⚠️ El aula ${roomId} tiene una utilización muy alta (${stats.utilization.toFixed(2)}%), lo que podría generar problemas si se necesitan cambios`);
        }

        // Verificar aulas con eficiencia muy baja (muchos estudiantes menos que capacidad)
        if (stats.assignedSlots > 0 && stats.efficiency < 40) {
            console.log(`ℹ️ El aula ${roomId} (capacidad: ${stats.capacity}) está teniendo en promedio solo ${stats.averageStudents.toFixed(1)} estudiantes (${stats.efficiency.toFixed(2)}% de eficiencia)`);
        }

        // Verificar aulas con eficiencia muy alta (posible sobrecarga)
        if (stats.efficiency > 95) {
            console.log(`⚠️ El aula ${roomId} está cerca de su capacidad máxima (${stats.efficiency.toFixed(2)}% de eficiencia)`);
        }
    }

    return {
        roomUtilization,
        totalAssignedSlots,
        overallUtilization
    };
}

// Análisis de horarios de grupos de estudiantes
function analizarHorariosGrupos(timetable, studentGroups) {
    console.log("\n===== ANÁLISIS DE HORARIOS DE GRUPOS =====");

    const groupSchedules = {};

    // Inicializar estadísticas para cada grupo
    for (const group of studentGroups) {
        groupSchedules[group.id] = {
            name: group.name,
            size: group.size,
            totalHours: 0,
            hoursByDay: Array(DAYS_OF_WEEK.length).fill(0),
            hoursByTimeSlot: Array(HOURS_PER_DAY).fill(0),
            slotMatrix: Array(DAYS_OF_WEEK.length).fill().map(() => Array(HOURS_PER_DAY).fill(false)),
            courses: [],
            consecutiveHours: {
                max: 0,
                average: 0
            },
            gaps: {
                total: 0,
                average: 0
            }
        };
    }

    // Procesar cada asignación
    for (const assignment of timetable.classAssignments) {
        const slots = assignment.getAllTimeSlots();

        for (const group of assignment.course.studentGroups) {
            groupSchedules[group.id].totalHours += slots.length;
            groupSchedules[group.id].courses.push({
                name: assignment.course.name,
                professor: assignment.course.professor.name,
                room: assignment.room.id,
                hours: slots.length
            });

            // Registrar slots ocupados
            for (const slot of slots) {
                groupSchedules[group.id].hoursByDay[slot.dayIndex]++;
                groupSchedules[group.id].hoursByTimeSlot[slot.hourIndex]++;
                groupSchedules[group.id].slotMatrix[slot.dayIndex][slot.hourIndex] = true;
            }
        }
    }

    // Calcular estadísticas adicionales para cada grupo
    for (const groupId in groupSchedules) {
        const stats = groupSchedules[groupId];

        // Analizar horas consecutivas y gaps
        let maxConsecutive = 0;
        let totalConsecutiveSequences = 0;
        let sumConsecutiveLength = 0;
        let totalGaps = 0;

        for (let dayIndex = 0; dayIndex < DAYS_OF_WEEK.length; dayIndex++) {
            let currentConsecutive = 0;
            let inGap = false;
            let hasClassBeforeGap = false;

            for (let hourIndex = 0; hourIndex < HOURS_PER_DAY; hourIndex++) {
                if (stats.slotMatrix[dayIndex][hourIndex]) {
                    // Si estábamos en un gap, lo terminamos
                    if (inGap && hasClassBeforeGap) {
                        inGap = false;
                    }

                    hasClassBeforeGap = true;
                    // Incrementar secuencia consecutiva
                    currentConsecutive++;
                } else {
                    // Verificar si empezamos un gap (después de clases y antes de otra clase)
                    let hasClassLater = false;
                    for (let h = hourIndex + 1; h < HOURS_PER_DAY; h++) {
                        if (stats.slotMatrix[dayIndex][h]) {
                            hasClassLater = true;
                            break;
                        }
                    }

                    if (currentConsecutive > 0 && hasClassLater) {
                        inGap = true;
                        totalGaps++;
                    }

                    // Si teníamos una secuencia, la registramos
                    if (currentConsecutive > 0) {
                        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
                        sumConsecutiveLength += currentConsecutive;
                        totalConsecutiveSequences++;
                        currentConsecutive = 0;
                    }
                }
            }

            // Si terminamos el día con una secuencia activa
            if (currentConsecutive > 0) {
                maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
                sumConsecutiveLength += currentConsecutive;
                totalConsecutiveSequences++;
            }
        }

        stats.consecutiveHours = {
            max: maxConsecutive,
            average: sumConsecutiveLength / (totalConsecutiveSequences || 1)
        };

        stats.gaps = {
            total: totalGaps,
            average: totalGaps / DAYS_OF_WEEK.length
        };

        // Calcular balance
        const idealHoursPerDay = stats.totalHours / DAYS_OF_WEEK.length;
        const sumOfSquaredDifferences = stats.hoursByDay.reduce((sum, hours) =>
            sum + Math.pow(hours - idealHoursPerDay, 2), 0);

        stats.balanceFactor = 1 - (
            Math.sqrt(sumOfSquaredDifferences) / (stats.totalHours || 1)
        );
    }

    // Estadísticas generales
    console.log("Resumen general de horas por grupo:");
    console.log("Grupo | Total | L | M | X | J | V | Balance | Máx. Consecutivas | Gaps");
    console.log("------|-------|---|---|---|---|---|---------|-------------------|------");

    for (const groupId in groupSchedules) {
        const stats = groupSchedules[groupId];

        console.log(`${stats.name.padEnd(6)} | ${stats.totalHours.toString().padEnd(5)} | ${stats.hoursByDay.join(' | ')} | ${stats.balanceFactor.toFixed(2).padEnd(7)} | ${stats.consecutiveHours.max.toString().padEnd(17)} | ${stats.gaps.total}`);
    }

    // Análisis de problemas y recomendaciones
    console.log("\nAnálisis de problemas potenciales:");

    // Grupos específicos de iniciación y básico (G7-G14)
    const initiationAndBasicGroups = ["G7", "G8", "G9", "G10", "G11", "G12", "G13", "G14"];
    const restrictedHours = [4, 5]; // Slots correspondientes a 19:00 y 20:00

    for (const groupId in groupSchedules) {
        const stats = groupSchedules[groupId];

        // Verificar horarios desbalanceados
        if (stats.balanceFactor < 0.6 && stats.totalHours > 10) {
            console.log(`⚠️ El grupo ${stats.name} tiene un horario muy desbalanceado (factor: ${stats.balanceFactor.toFixed(2)})`);
        }

        // Verificar carga diaria excesiva
        stats.hoursByDay.forEach((hours, dayIndex) => {
            if (hours > 8) {
                console.log(`⚠️ El grupo ${stats.name} tiene ${hours} horas en ${DAYS_OF_WEEK[dayIndex]}, lo que podría ser excesivo`);
            }
        });

        // Verificar muchos gaps
        if (stats.gaps.total > 5) {
            console.log(`⚠️ El grupo ${stats.name} tiene ${stats.gaps.total} huecos en su horario, lo que podría no ser ideal`);
        }

        // Verificar restricciones específicas para grupos de iniciación y básico
        if (initiationAndBasicGroups.includes(groupId)) {
            let violationsFound = false;

            // Verificar si tienen clases después de las 19:00
            for (let dayIndex = 0; dayIndex < DAYS_OF_WEEK.length; dayIndex++) {
                for (const hourIndex of restrictedHours) {
                    if (stats.slotMatrix[dayIndex][hourIndex]) {
                        if (!violationsFound) {
                            console.log(`❌ RESTRICCIÓN VIOLADA: El grupo ${stats.name} tiene clases después de las 19:00:`);
                            violationsFound = true;
                        }
                        console.log(`   - ${DAYS_OF_WEEK[dayIndex]} a las ${hourIndex + 15}:00`);
                    }
                }
            }
        }
    }

    return groupSchedules;
}

// Función para exportar todos los datos a un archivo JSON para análisis posterior
function exportarDatosAnalisis(timetable, roomData, professorData, groupData, filename = "analisis-horario.json") {
    const analysisData = {
        overview: {
            totalCourses: timetable.classAssignments.length,
            totalRooms: Object.keys(roomData.roomUtilization).length,
            totalProfessors: Object.keys(professorData.professorHours).length,
            totalGroups: Object.keys(groupData).length,
            roomUtilization: roomData.overallUtilization,
            professorAverageHours: professorData.averageHoursPerProfessor
        },
        rooms: roomData.roomUtilization,
        professors: professorData.professorHours,
        groups: groupData,
        timetable: {
            // Versión simplificada del horario para análisis
            assignments: timetable.classAssignments.map(assignment => ({
                course: assignment.course.name,
                room: assignment.room.id,
                professor: assignment.course.professor.name,
                groups: assignment.course.studentGroups.map(g => g.name),
                day: assignment.timeSlot.dayIndex,
                hour: assignment.timeSlot.hourIndex,
                duration: assignment.course.duration,
                slots: assignment.getAllTimeSlots().map(slot => ({
                    day: slot.dayIndex,
                    hour: slot.hourIndex
                }))
            }))
        }
    };

    if (fs) {
        try {
            fs.writeFileSync(filename, JSON.stringify(analysisData, null, 2), 'utf8');
            console.log(`\nDatos de análisis guardados en '${filename}' para procesamiento adicional.`);
            return true;
        } catch (error) {
            console.error(`Error al guardar el análisis en '${filename}':`, error);
            return false;
        }
    } else {
        console.log(`\nGuardado de archivo no disponible en este entorno (requiere Node.js).`);
        return false;
    }
}

// Función principal para realizar análisis completo
function realizarAnalisisCompleto(timetable, rooms, professors, studentGroups) {
    console.log("\n=========== ANÁLISIS COMPLETO DEL HORARIO ===========");

    // 1. Análisis de carga de profesores
    const professorAnalysis = analizarCargaProfesores(timetable, professors);

    // 2. Análisis de utilización de aulas
    const roomAnalysis = analizarDistribucionAulas(timetable, rooms);

    // 3. Análisis de horarios de grupos
    const groupAnalysis = analizarHorariosGrupos(timetable, studentGroups);

    // 4. Exportar todos los datos a JSON
    exportarDatosAnalisis(timetable, roomAnalysis, professorAnalysis, groupAnalysis);

    console.log("\n=========== FIN DEL ANÁLISIS ===========");
}

// Integrar la funcionalidad en el código existente
function integrarAnalisisEnTimetableGenerator() {
    // Modificar el método printTimetable para incluir el análisis
    const originalPrintTimetable = TimetableGenerator.prototype.printTimetable;

    TimetableGenerator.prototype.printTimetable = function (chromosome) {
        // Llamar al método original
        originalPrintTimetable.call(this, chromosome);

        // Realizar análisis completo
        realizarAnalisisCompleto(chromosome, this.rooms, this.professors, this.studentGroups);
    };

    console.log("Análisis de horarios integrado con éxito");
}

// Función de ejemplo con análisis avanzado completo
function runExampleWithAdvancedAnalysis() {
    // Crear aulas, incluyendo las específicas para música y clases audio-visuales
    const rooms = [
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
        new Professor("P2", "Daniel Condori"),
        new Professor("P3", "Ivan Katery"),
        new Professor("P4", "Cecilia Padilla"),
        new Professor("P5", "David Gonzales"),
        new Professor("P6", "Andrea Paiva"),
        new Professor("P7", "Ronald Nuñez"),
        new Professor("P8", "Antonio Claros"),
        new Professor("P9", "Manuel Gonzales"),
        new Professor("P10", "Jose Carlos Gonzales"),
        new Professor("P11", "Edwin Canaza"),
        new Professor("P12", "Melanie Loayza"),
        new Professor("P13", "Sarah Daza"),
        new Professor("P14", "Wendy Valencia"),
        new Professor("P15", "Octavio Montaño"),
        new Professor("P16", "Milenka Garcia"),
        new Professor("P17", "Augusto Guzman"),
        new Professor("P18", "Andrew Herrada"),
        new Professor("P19", "Adriana Arias"),
        new Professor("P20", "Josue Ortiz"),
        new Professor("P21", "Diana Avila"),
        new Professor("P22", "Arturo Arando"),
        new Professor("P23", "Denise Avila"),
        new Professor("P24", "Joseph Herrada"),
        new Professor("P25", "David Janco"),
        new Professor("P26", "Libertad Aguilar"),
        new Professor("P27", "Jose Armando"),
        new Professor("P28", "Kevin Torrico"),
        new Professor("P29", "4-5 profesores")
    ];

    // Establecer algunas restricciones de disponibilidad para los profesores
    professors[0].setAvailability(0, 0, false); // El Prof. Juan Oscar no está disponible los lunes a primera hora
    professors[1].setAvailability(4, 5, false); // El Prof. Daniel Condori no está disponible los viernes a última hora
    professors[2].setAvailability(2, 3, false); // El Prof. Ivan Katery no está disponible los miércoles a la cuarta hora
    professors[3].setAvailability(1, 5, false); // La Prof. Cecilia Padilla no está disponible los martes a la última hora
    professors[4].setAvailability(3, 0, false); // El Prof. David Gonzales no está disponible los jueves a primera hora

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

    // Crear cursos con la estructura que incluye requiredRoomId
    const courses = [
        // Solo incluyo algunos cursos para mantener el ejemplo breve

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
        new Course("C125", "Orquesta Sinfonica", professors[16], [studentGroups[18], studentGroups[19], studentGroups[20]], false, 2, true, "E-101")

    ];

    // Crear generador de horarios
    const generator = new TimetableGenerator(rooms, professors, studentGroups, courses);

    // Configurar parámetros del algoritmo genético
    generator.populationSize = 200;
    generator.maxGenerations = 1000;
    generator.mutationRate = 0.15;
    generator.elitismCount = 15;

    // Añadir restricciones
    generator.addConsecutiveSlotsConstraint();
    generator.addSpecificRoomConstraint();

    // RESTRICCIÓN CLAVE: Añadir restricción para grupos de iniciación y básico
    // (no clases después de las 19:00)
    generator.addHardConstraint(
        (assignment) => {
            // Grupos restringidos: G7 a G14 (iniciación y básico)
            const restrictedGroups = ["G7", "G8", "G9", "G10", "G11", "G12", "G13", "G14"];

            // Si alguno de los grupos de esta asignación está en la lista de restricción
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

    // Añadir restricción blanda: Tratar de concentrar las clases para cada grupo en días consecutivos
    generator.addSoftConstraint(
        (assignment) => {
            // Esta es una restricción simplificada que solo evalúa la asignación actual
            // Para una implementación completa, se necesitaría considerar todas las asignaciones
            // del grupo, lo que requeriría modificar el evaluateAssignment para tener contexto
            // de todas las asignaciones

            // Por ahora, priorizamos asignaciones en los días del medio de la semana
            const dayIndex = assignment.timeSlot.dayIndex;
            // Preferimos martes, miércoles y jueves (índices 1, 2, 3)
            if (dayIndex >= 1 && dayIndex <= 3) {
                return 1.0; // Restricción completamente satisfecha
            } else {
                return 0.5; // Parcialmente satisfecha
            }
        },
        0.3, // Peso bajo para no afectar demasiado las restricciones más importantes
        "Concentrar clases en días consecutivos para cada grupo"
    );

    // Implementar nuestra clase de métricas
    class TimetableMetricsCustom {
        constructor(generator, chromosome) {
            this.generator = generator;
            this.chromosome = chromosome;
            this.metrics = {};
        }

        // Calcular todas las métricas
        calculateAllMetrics() {
            this.metrics = {
                generalStats: this.calculateGeneralStats(),
                roomUtilization: this.calculateRoomUtilization(),
                professorLoad: this.calculateProfessorLoad(),
                groupSchedules: this.calculateGroupSchedules(),
                constraintsSatisfaction: this.calculateConstraintsSatisfaction(),
                timeDistribution: this.calculateTimeDistribution()
            };
            return this.metrics;
        }

        // Estadísticas generales del horario
        calculateGeneralStats() {
            const totalAssignments = this.chromosome.classAssignments.length;
            const totalSlots = this.chromosome.classAssignments.reduce(
                (sum, assignment) => sum + assignment.getAllTimeSlots().length, 0
            );

            return {
                fitness: this.chromosome.fitness,
                totalCourses: totalAssignments,
                totalSlots: totalSlots,
                slotsPerDay: DAYS_OF_WEEK.map(day => 0)
            };
        }

        // Análisis de utilización de aulas
        calculateRoomUtilization() {
            const roomStats = {};
            const totalAvailableSlots = DAYS_OF_WEEK.length * HOURS_PER_DAY;

            // Inicializar estadísticas para cada aula
            for (const room of this.generator.rooms) {
                roomStats[room.id] = {
                    capacity: room.capacity,
                    hasComputers: room.hasComputers,
                    assignedSlots: 0,
                    utilization: 0,
                    dailyUtilization: DAYS_OF_WEEK.map(() => 0),
                    hourlyUtilization: Array(HOURS_PER_DAY).fill(0),
                    courses: []
                };
            }

            // Contar asignaciones por aula
            for (const assignment of this.chromosome.classAssignments) {
                const slots = assignment.getAllTimeSlots();
                roomStats[assignment.room.id].assignedSlots += slots.length;
                roomStats[assignment.room.id].courses.push(assignment.course.name);

                // Contar por día y hora
                for (const slot of slots) {
                    roomStats[assignment.room.id].dailyUtilization[slot.dayIndex]++;
                    roomStats[assignment.room.id].hourlyUtilization[slot.hourIndex]++;
                }
            }

            // Calcular porcentajes de utilización
            for (const roomId in roomStats) {
                const stats = roomStats[roomId];
                stats.utilization = (stats.assignedSlots / totalAvailableSlots) * 100;
                stats.dailyUtilizationPercent = stats.dailyUtilization.map(
                    count => (count / HOURS_PER_DAY) * 100
                );
                stats.hourlyUtilizationPercent = stats.hourlyUtilization.map(
                    count => (count / DAYS_OF_WEEK.length) * 100
                );
            }

            return roomStats;
        }

        // Análisis de carga de profesores
        calculateProfessorLoad() {
            const professorStats = {};

            // Inicializar estadísticas para cada profesor
            for (const professor of this.generator.professors) {
                professorStats[professor.id] = {
                    name: professor.name,
                    totalHours: 0,
                    courseCount: 0,
                    hoursByDay: DAYS_OF_WEEK.map(() => 0),
                    hoursByTimeSlot: Array(HOURS_PER_DAY).fill(0),
                    courses: []
                };
            }

            // Contar horas por profesor
            for (const assignment of this.chromosome.classAssignments) {
                const professor = assignment.course.professor;
                const slots = assignment.getAllTimeSlots();

                professorStats[professor.id].totalHours += slots.length;
                professorStats[professor.id].courseCount++;
                professorStats[professor.id].courses.push(assignment.course.name);

                // Contar por día y hora
                for (const slot of slots) {
                    professorStats[professor.id].hoursByDay[slot.dayIndex]++;
                    professorStats[professor.id].hoursByTimeSlot[slot.hourIndex]++;
                }
            }

            // Calcular balance
            for (const professorId in professorStats) {
                const stats = professorStats[professorId];
                if (stats.totalHours > 0) {
                    // Coeficiente de variación para medir el balance
                    const mean = stats.hoursByDay.reduce((sum, count) => sum + count, 0) / DAYS_OF_WEEK.length;
                    const variance = stats.hoursByDay.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / DAYS_OF_WEEK.length;
                    const stdDev = Math.sqrt(variance);
                    stats.balanceFactor = 1 - (stdDev / (mean + 0.01)); // +0.01 para evitar división por cero
                    stats.balanceFactor = Math.max(0, stats.balanceFactor); // Asegurar valor no negativo
                }
            }

            return professorStats;
        }

        // Análisis de horarios de grupos
        calculateGroupSchedules() {
            const groupStats = {};

            // Inicializar estadísticas para cada grupo
            for (const group of this.generator.studentGroups) {
                groupStats[group.id] = {
                    name: group.name,
                    size: group.size,
                    totalHours: 0,
                    courseCount: 0,
                    hoursByDay: DAYS_OF_WEEK.map(() => 0),
                    hoursByTimeSlot: Array(HOURS_PER_DAY).fill(0),
                    courses: [],
                    schedule: Array(DAYS_OF_WEEK.length).fill().map(() => Array(HOURS_PER_DAY).fill(null))
                };
            }

            // Procesar asignaciones para cada grupo
            for (const assignment of this.chromosome.classAssignments) {
                const slots = assignment.getAllTimeSlots();

                for (const group of assignment.course.studentGroups) {
                    groupStats[group.id].totalHours += slots.length;
                    groupStats[group.id].courseCount++;
                    groupStats[group.id].courses.push({
                        name: assignment.course.name,
                        professor: assignment.course.professor.name,
                        room: assignment.room.id,
                        slots: slots.map(slot => ({
                            day: slot.dayIndex,
                            hour: slot.hourIndex
                        }))
                    });

                    // Registrar horario detallado y contar por día/hora
                    for (const slot of slots) {
                        groupStats[group.id].hoursByDay[slot.dayIndex]++;
                        groupStats[group.id].hoursByTimeSlot[slot.hourIndex]++;
                        groupStats[group.id].schedule[slot.dayIndex][slot.hourIndex] = {
                            course: assignment.course.name,
                            professor: assignment.course.professor.name,
                            room: assignment.room.id
                        };
                    }
                }
            }

            // Calcular métricas adicionales para cada grupo
            for (const groupId in groupStats) {
                const stats = groupStats[groupId];

                // Balance entre días
                if (stats.totalHours > 0) {
                    const mean = stats.hoursByDay.reduce((sum, count) => sum + count, 0) / DAYS_OF_WEEK.length;
                    const variance = stats.hoursByDay.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / DAYS_OF_WEEK.length;
                    const stdDev = Math.sqrt(variance);
                    stats.balanceFactor = 1 - (stdDev / (mean + 0.01));
                    stats.balanceFactor = Math.max(0, stats.balanceFactor);
                }

                // Contar horas consecutivas y gaps (huecos)
                stats.maxConsecutiveHours = 0;
                stats.totalGaps = 0;

                for (let dayIndex = 0; dayIndex < DAYS_OF_WEEK.length; dayIndex++) {
                    let consecutive = 0;
                    let hasClassBefore = false;
                    let lastClassHour = -1;

                    for (let hourIndex = 0; hourIndex < HOURS_PER_DAY; hourIndex++) {
                        if (stats.schedule[dayIndex][hourIndex]) {
                            // Si hay clase en esta hora
                            consecutive++;

                            // Verificar si hay un hueco antes
                            if (hasClassBefore && hourIndex > lastClassHour + 1) {
                                stats.totalGaps += hourIndex - lastClassHour - 1;
                            }

                            hasClassBefore = true;
                            lastClassHour = hourIndex;
                        } else {
                            // Actualizar máximo consecutivo
                            stats.maxConsecutiveHours = Math.max(stats.maxConsecutiveHours, consecutive);
                            consecutive = 0;
                        }
                    }

                    // Actualizar al final del día
                    stats.maxConsecutiveHours = Math.max(stats.maxConsecutiveHours, consecutive);
                }

                // Verificar restricción de grupos de iniciación y básico (no clases después de 19:00)
                const restrictedGroups = ["G7", "G8", "G9", "G10", "G11", "G12", "G13", "G14"];
                if (restrictedGroups.includes(groupId)) {
                    stats.hasLateClasses = false;
                    stats.lateClassesCount = 0;

                    // Revisar si hay clases después de las 19:00 (índices 4 y 5)
                    for (let dayIndex = 0; dayIndex < DAYS_OF_WEEK.length; dayIndex++) {
                        for (let hourIndex = 4; hourIndex < HOURS_PER_DAY; hourIndex++) {
                            if (stats.schedule[dayIndex][hourIndex]) {
                                stats.hasLateClasses = true;
                                stats.lateClassesCount++;
                            }
                        }
                    }
                }
            }

            return groupStats;
        }

        // Análisis de satisfacción de restricciones
        calculateConstraintsSatisfaction() {
            // Restricciones duras
            const hardConstraints = {
                roomConflicts: 0,
                professorConflicts: 0,
                groupConflicts: 0,
                roomRequirements: 0,
                customConstraints: Array(this.generator.hardConstraints.length).fill(0)
            };

            // Verificar cada asignación
            for (const assignment of this.chromosome.classAssignments) {
                // Verificar si hay conflictos de aula
                if (!this.chromosome.isRoomAvailableForAssignment(assignment)) {
                    hardConstraints.roomConflicts++;
                }

                // Verificar si hay conflictos de profesor
                if (!this.chromosome.isProfessorAvailableForAssignment(assignment)) {
                    hardConstraints.professorConflicts++;
                }

                // Verificar si hay conflictos de grupo
                if (!this.chromosome.areStudentGroupsAvailableForAssignment(assignment)) {
                    hardConstraints.groupConflicts++;
                }

                // Verificar requisitos de aula específica
                if (assignment.course.requiredRoomId &&
                    assignment.course.requiredRoomId !== assignment.room.id) {
                    hardConstraints.roomRequirements++;
                }

                // Verificar restricciones personalizadas
                this.generator.hardConstraints.forEach((constraint, index) => {
                    if (!constraint.evaluate(assignment)) {
                        hardConstraints.customConstraints[index]++;
                    }
                });
            }

            // Calcular porcentajes de cumplimiento
            const totalAssignments = this.chromosome.classAssignments.length;
            const hardConstraintsSatisfaction = {
                roomConflicts: {
                    count: hardConstraints.roomConflicts,
                    percentage: 100 * (1 - hardConstraints.roomConflicts / totalAssignments)
                },
                professorConflicts: {
                    count: hardConstraints.professorConflicts,
                    percentage: 100 * (1 - hardConstraints.professorConflicts / totalAssignments)
                },
                groupConflicts: {
                    count: hardConstraints.groupConflicts,
                    percentage: 100 * (1 - hardConstraints.groupConflicts / totalAssignments)
                },
                roomRequirements: {
                    count: hardConstraints.roomRequirements,
                    percentage: 100 * (1 - hardConstraints.roomRequirements / totalAssignments)
                },
                customConstraints: this.generator.hardConstraints.map((constraint, index) => ({
                    description: constraint.description,
                    count: hardConstraints.customConstraints[index],
                    percentage: 100 * (1 - hardConstraints.customConstraints[index] / totalAssignments)
                }))
            };

            // Verificar específicamente la restricción de grupos de iniciación y básico
            const initiationBasicGroups = ["G7", "G8", "G9", "G10", "G11", "G12", "G13", "G14"];
            const lateHourViolations = [];

            for (const assignment of this.chromosome.classAssignments) {
                // Si alguno de los grupos de esta asignación está en la lista de restricción
                if (assignment.course.studentGroups.some(g => initiationBasicGroups.includes(g.id))) {
                    const slots = assignment.getAllTimeSlots();

                    // Verificar si alguno de los slots es después de las 19:00 (índices 4 y 5)
                    for (const slot of slots) {
                        if (slot.hourIndex >= 4) {
                            lateHourViolations.push({
                                course: assignment.course.name,
                                groups: assignment.course.studentGroups
                                    .filter(g => initiationBasicGroups.includes(g.id))
                                    .map(g => g.name),
                                day: DAYS_OF_WEEK[slot.dayIndex],
                                hour: slot.hourIndex + 15 // Convertir a hora real (15:00 + índice)
                            });
                            break; // Solo contar una violación por asignación
                        }
                    }
                }
            }

            return {
                hard: hardConstraintsSatisfaction,
                initiationBasicGroupsRestriction: {
                    violations: lateHourViolations,
                    count: lateHourViolations.length,
                    satisfied: lateHourViolations.length === 0
                }
            };
        }

        // Análisis de distribución de tiempo
        calculateTimeDistribution() {
            // Inicializar matrices
            const dailyDistribution = DAYS_OF_WEEK.map(() => 0);
            const hourlyDistribution = Array(HOURS_PER_DAY).fill(0);
            const timeMatrix = Array(DAYS_OF_WEEK.length).fill().map(() => Array(HOURS_PER_DAY).fill(0));

            // Contar asignaciones por día y hora
            for (const assignment of this.chromosome.classAssignments) {
                const slots = assignment.getAllTimeSlots();

                for (const slot of slots) {
                    dailyDistribution[slot.dayIndex]++;
                    hourlyDistribution[slot.hourIndex]++;
                    timeMatrix[slot.dayIndex][slot.hourIndex]++;
                }
            }

            // Calcular porcentajes
            const totalSlots = dailyDistribution.reduce((a, b) => a + b, 0);
            const dailyPercentages = dailyDistribution.map(count => (count / totalSlots) * 100);
            const hourlyPercentages = hourlyDistribution.map(count => (count / totalSlots) * 100);

            // Calcular medidas de balance
            const idealPerDay = totalSlots / DAYS_OF_WEEK.length;
            const sumSquaredDiffDays = dailyDistribution.reduce(
                (sum, count) => sum + Math.pow(count - idealPerDay, 2), 0
            );
            const dayBalanceFactor = 1 - Math.sqrt(sumSquaredDiffDays) / (totalSlots || 1);

            const idealPerHour = totalSlots / HOURS_PER_DAY;
            const sumSquaredDiffHours = hourlyDistribution.reduce(
                (sum, count) => sum + Math.pow(count - idealPerHour, 2), 0
            );
            const hourBalanceFactor = 1 - Math.sqrt(sumSquaredDiffHours) / (totalSlots || 1);

            return {
                daily: {
                    counts: dailyDistribution,
                    percentages: dailyPercentages,
                    balanceFactor: dayBalanceFactor
                },
                hourly: {
                    counts: hourlyDistribution,
                    percentages: hourlyPercentages,
                    balanceFactor: hourBalanceFactor
                },
                matrix: timeMatrix,
                totalSlots: totalSlots
            };
        }

        // Generar reporte en formato para HTML/JSON
        // Continuación del método generateReport en la clase TimetableMetricsCustom
        generateReport() {
            // Asegurar que las métricas estén calculadas
            if (Object.keys(this.metrics).length === 0) {
                this.calculateAllMetrics();
            }

            // Generar resumen para consola
            console.log("\n===== RESUMEN DE MÉTRICAS DEL HORARIO =====");
            console.log(`Fitness: ${this.metrics.generalStats.fitness.toFixed(4)}`);
            console.log(`Total de cursos: ${this.metrics.generalStats.totalCourses}`);
            console.log(`Total de horas asignadas: ${this.metrics.generalStats.totalSlots}`);

            // Restricciones
            const constraints = this.metrics.constraintsSatisfaction;
            console.log("\nCumplimiento de Restricciones:");
            console.log(`- Conflictos de aula: ${constraints.hard.roomConflicts.count} (${constraints.hard.roomConflicts.percentage.toFixed(2)}% satisfecha)`);
            console.log(`- Conflictos de profesor: ${constraints.hard.professorConflicts.count} (${constraints.hard.professorConflicts.percentage.toFixed(2)}% satisfecha)`);
            console.log(`- Conflictos de grupo: ${constraints.hard.groupConflicts.count} (${constraints.hard.groupConflicts.percentage.toFixed(2)}% satisfecha)`);
            console.log(`- Requisitos de aula específica: ${constraints.hard.roomRequirements.count} (${constraints.hard.roomRequirements.percentage.toFixed(2)}% satisfecha)`);

            // Restricción específica de grupos de iniciación y básico
            const initiationBasicRestriction = constraints.initiationBasicGroupsRestriction;
            if (initiationBasicRestriction.satisfied) {
                console.log("- Restricción de grupos de iniciación y básico: CUMPLIDA ✓");
            } else {
                console.log(`- Restricción de grupos de iniciación y básico: NO CUMPLIDA ✗ (${initiationBasicRestriction.count} violaciones)`);
                initiationBasicRestriction.violations.forEach(violation => {
                    console.log(`  * ${violation.course} (${violation.groups.join(', ')}) - ${violation.day} ${violation.hour}:00`);
                });
            }

            // Distribución de tiempo
            const timeDistribution = this.metrics.timeDistribution;
            console.log("\nDistribución de Clases:");
            console.log("Día       | Clases | Porcentaje");
            console.log("----------|--------|------------");
            DAYS_OF_WEEK.forEach((day, index) => {
                console.log(`${day.padEnd(10)}| ${timeDistribution.daily.counts[index].toString().padEnd(6)} | ${timeDistribution.daily.percentages[index].toFixed(2)}%`);
            });
            console.log(`Factor de balance diario: ${timeDistribution.daily.balanceFactor.toFixed(4)} (1.0 = perfecto)`);

            console.log("\nHora  | Clases | Porcentaje");
            console.log("------|--------|------------");
            for (let i = 0; i < HOURS_PER_DAY; i++) {
                const hour = i + 15; // Hora de inicio (15:00)
                console.log(`${hour}:00 | ${timeDistribution.hourly.counts[i].toString().padEnd(6)} | ${timeDistribution.hourly.percentages[i].toFixed(2)}%`);
            }
            console.log(`Factor de balance horario: ${timeDistribution.hourly.balanceFactor.toFixed(4)} (1.0 = perfecto)`);

            // Utilización de aulas
            const roomUtilization = this.metrics.roomUtilization;
            console.log("\nUtilización de Aulas:");
            console.log("Aula   | Capacidad | Slots Asignados | Utilización");
            console.log("-------|-----------|----------------|------------");

            // Ordenar aulas por utilización
            const sortedRooms = Object.entries(roomUtilization)
                .sort((a, b) => b[1].utilization - a[1].utilization);

            for (const [roomId, stats] of sortedRooms) {
                if (stats.assignedSlots > 0) {
                    console.log(`${roomId.padEnd(7)}| ${stats.capacity.toString().padEnd(9)} | ${stats.assignedSlots.toString().padEnd(14)} | ${stats.utilization.toFixed(2)}%`);
                }
            }

            // Carga de profesores
            const professorLoad = this.metrics.professorLoad;
            console.log("\nCarga de Profesores:");
            console.log("Profesor      | Total Horas | Cursos | Factor de Balance");
            console.log("--------------|-------------|--------|------------------");

            // Ordenar profesores por horas totales
            const sortedProfessors = Object.entries(professorLoad)
                .filter(([_, stats]) => stats.totalHours > 0) // Solo mostrar profesores con clases asignadas
                .sort((a, b) => b[1].totalHours - a[1].totalHours);

            for (const [profId, stats] of sortedProfessors) {
                console.log(`${stats.name.padEnd(14)}| ${stats.totalHours.toString().padEnd(11)} | ${stats.courseCount.toString().padEnd(6)} | ${(stats.balanceFactor || 0).toFixed(4)}`);
            }

            // Horarios de grupos
            const groupSchedules = this.metrics.groupSchedules;
            console.log("\nHorarios de Grupos:");
            console.log("Grupo    | Total Horas | Cursos | Balance | Máx. Consecutivas | Gaps");
            console.log("---------|-------------|--------|---------|-------------------|------");

            // Ordenar grupos por código
            const sortedGroups = Object.entries(groupSchedules)
                .sort((a, b) => a[0].localeCompare(b[0]));

            for (const [groupId, stats] of sortedGroups) {
                const balanceStr = stats.balanceFactor !== undefined ? stats.balanceFactor.toFixed(4) : "N/A";
                console.log(`${stats.name.padEnd(9)}| ${stats.totalHours.toString().padEnd(11)} | ${stats.courseCount.toString().padEnd(6)} | ${balanceStr.padEnd(7)} | ${stats.maxConsecutiveHours.toString().padEnd(17)} | ${stats.totalGaps}`);

                // Resaltar violaciones de restricción para grupos de iniciación y básico
                if (stats.hasLateClasses) {
                    console.log(`  ⚠️ ¡ALERTA! Este grupo tiene ${stats.lateClassesCount} clases después de las 19:00`);
                }
            }

            console.log("\n=========================================");
            return this.metrics;
        }

        // Método para exportar datos a JSON
        exportToJSON(filename = "metricas-horario.json") {
            const metricsData = this.metrics;

            if (fs) {
                try {
                    fs.writeFileSync(filename, JSON.stringify(metricsData, null, 2), 'utf8');
                    console.log(`\nMétricas exportadas a ${filename}`);
                    return true;
                } catch (error) {
                    console.error(`Error al exportar métricas: ${error.message}`);
                    return false;
                }
            } else {
                console.log("\nExportación de archivo no disponible en este entorno.");
                return false;
            }
        }

        // Método para generar visualización HTML
        generateHTMLReport(filename = "metricas-horario.html") {
            const metrics = this.metrics;

            // HTML base
            let html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Análisis de Métricas del Horario</title>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
            .container { max-width: 1200px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 30px; }
            .section { margin-bottom: 40px; border: 1px solid #ddd; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .section-title { border-bottom: 2px solid #3498db; padding-bottom: 10px; color: #2c3e50; }
            .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
            .metric-card { background-color: #f8f9fa; border-radius: 8px; padding: 20px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
            .metric-value { font-size: 24px; font-weight: bold; margin: 10px 0; color: #3498db; }
            .metric-label { font-size: 14px; color: #7f8c8d; }
            .chart-container { height: 400px; margin: 20px 0; }
            .table-container { overflow-x: auto; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th { background-color: #3498db; color: white; text-align: left; padding: 10px; }
            td { padding: 10px; border-bottom: 1px solid #ddd; }
            tr:nth-child(even) { background-color: #f2f2f2; }
            .good { background-color: #d4edda; color: #155724; }
            .warning { background-color: #fff3cd; color: #856404; }
            .danger { background-color: #f8d7da; color: #721c24; }
            .timetable { display: grid; grid-template-columns: repeat(${DAYS_OF_WEEK.length + 1}, 1fr); gap: 2px; margin: 20px 0; }
            .timetable-header { background-color: #3498db; color: white; padding: 10px; text-align: center; font-weight: bold; }
            .timetable-hour { background-color: #3498db; color: white; padding: 10px; text-align: center; }
            .timetable-cell { padding: 10px; text-align: center; background-color: #f8f9fa; }
            .timetable-cell.occupied { background-color: #d4edda; }
            .footer { text-align: center; margin-top: 50px; font-size: 14px; color: #7f8c8d; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Análisis de Métricas del Horario</h1>
                <p>Generado el ${new Date().toLocaleString()}</p>
            </div>
            
            <div class="section">
                <h2 class="section-title">Resumen General</h2>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="metric-label">Fitness</div>
                        <div class="metric-value">${metrics.generalStats.fitness.toFixed(4)}</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-label">Total de Cursos</div>
                        <div class="metric-value">${metrics.generalStats.totalCourses}</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-label">Total de Horas Asignadas</div>
                        <div class="metric-value">${metrics.generalStats.totalSlots}</div>
                    </div>
                    <div class="metric-card ${this.getConstraintClass(metrics.constraintsSatisfaction.initiationBasicGroupsRestriction.satisfied ? 100 : 0)}">
                        <div class="metric-label">Restricción de Iniciación y Básico</div>
                        <div class="metric-value">${metrics.constraintsSatisfaction.initiationBasicGroupsRestriction.satisfied ? "✓" : "✗"}</div>
                        <div>${metrics.constraintsSatisfaction.initiationBasicGroupsRestriction.count} violaciones</div>
                    </div>
                </div>
                
                <h3>Cumplimiento de Restricciones</h3>
                <div class="table-container">
                    <table>
                        <tr>
                            <th>Restricción</th>
                            <th>Violaciones</th>
                            <th>Cumplimiento</th>
                        </tr>
                        <tr class="${this.getConstraintClass(metrics.constraintsSatisfaction.hard.roomConflicts.percentage)}">
                            <td>Sin conflictos de aula</td>
                            <td>${metrics.constraintsSatisfaction.hard.roomConflicts.count}</td>
                            <td>${metrics.constraintsSatisfaction.hard.roomConflicts.percentage.toFixed(2)}%</td>
                        </tr>
                        <tr class="${this.getConstraintClass(metrics.constraintsSatisfaction.hard.professorConflicts.percentage)}">
                            <td>Sin conflictos de profesor</td>
                            <td>${metrics.constraintsSatisfaction.hard.professorConflicts.count}</td>
                            <td>${metrics.constraintsSatisfaction.hard.professorConflicts.percentage.toFixed(2)}%</td>
                        </tr>
                        <tr class="${this.getConstraintClass(metrics.constraintsSatisfaction.hard.groupConflicts.percentage)}">
                            <td>Sin conflictos de grupo</td>
                            <td>${metrics.constraintsSatisfaction.hard.groupConflicts.count}</td>
                            <td>${metrics.constraintsSatisfaction.hard.groupConflicts.percentage.toFixed(2)}%</td>
                        </tr>
                        <tr class="${this.getConstraintClass(metrics.constraintsSatisfaction.hard.roomRequirements.percentage)}">
                            <td>Requisitos de aulas específicas</td>
                            <td>${metrics.constraintsSatisfaction.hard.roomRequirements.count}</td>
                            <td>${metrics.constraintsSatisfaction.hard.roomRequirements.percentage.toFixed(2)}%</td>
                        </tr>
                    </table>
                </div>
                
                ${this.generateViolationsHTML(metrics.constraintsSatisfaction.initiationBasicGroupsRestriction)}
            </div>
            
            <div class="section">
                <h2 class="section-title">Distribución Temporal</h2>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="metric-label">Balance Diario</div>
                        <div class="metric-value">${metrics.timeDistribution.daily.balanceFactor.toFixed(4)}</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-label">Balance Horario</div>
                        <div class="metric-value">${metrics.timeDistribution.hourly.balanceFactor.toFixed(4)}</div>
                    </div>
                </div>
                
                <div class="chart-container">
                    <canvas id="dailyDistributionChart"></canvas>
                </div>
                
                <div class="chart-container">
                    <canvas id="hourlyDistributionChart"></canvas>
                </div>
                
                <h3>Matriz de Ocupación</h3>
                <div class="timetable">
                    <div class="timetable-header">Hora / Día</div>
                    ${DAYS_OF_WEEK.map(day => `<div class="timetable-header">${day}</div>`).join('')}
                    
                    ${this.generateTimeMatrixHTML(metrics.timeDistribution.matrix)}
                </div>
            </div>
            
            <div class="section">
                <h2 class="section-title">Utilización de Aulas</h2>
                <div class="chart-container">
                    <canvas id="roomUtilizationChart"></canvas>
                </div>
                
                <div class="table-container">
                    <table>
                        <tr>
                            <th>Aula</th>
                            <th>Capacidad</th>
                            <th>Slots Asignados</th>
                            <th>Utilización</th>
                        </tr>
                        ${this.generateRoomUtilizationHTML(metrics.roomUtilization)}
                    </table>
                </div>
            </div>
            
            <div class="section">
                <h2 class="section-title">Carga de Profesores</h2>
                <div class="chart-container">
                    <canvas id="professorLoadChart"></canvas>
                </div>
                
                <div class="table-container">
                    <table>
                        <tr>
                            <th>Profesor</th>
                            <th>Total Horas</th>
                            <th>Cursos</th>
                            <th>Balance</th>
                            <th>Distribución Diaria</th>
                        </tr>
                        ${this.generateProfessorLoadHTML(metrics.professorLoad)}
                    </table>
                </div>
            </div>
            
            <div class="section">
                <h2 class="section-title">Análisis de Grupos</h2>
                <div class="chart-container">
                    <canvas id="groupHoursChart"></canvas>
                </div>
                
                <div class="table-container">
                    <table>
                        <tr>
                            <th>Grupo</th>
                            <th>Total Horas</th>
                            <th>Balance</th>
                            <th>Máx. Consecutivas</th>
                            <th>Gaps</th>
                            <th>Clases Tarde</th>
                        </tr>
                        ${this.generateGroupAnalysisHTML(metrics.groupSchedules)}
                    </table>
                </div>
                
                <h3>Grupos con Restricción de Horario Tarde</h3>
                <div class="metrics-grid">
                    ${this.generateGroupRestrictionHTML(metrics.groupSchedules)}
                </div>
            </div>
            
            <div class="footer">
                <p>Generado por Timetable Metrics System - ${new Date().toLocaleDateString()}</p>
            </div>
        </div>
        
        <script>
            // Inicializar gráficos
            document.addEventListener('DOMContentLoaded', function() {
                // Distribución Diaria
                new Chart(document.getElementById('dailyDistributionChart'), {
                    type: 'bar',
                    data: {
                        labels: ${JSON.stringify(DAYS_OF_WEEK)},
                        datasets: [{
                            label: 'Clases por día',
                            data: ${JSON.stringify(metrics.timeDistribution.daily.counts)},
                            backgroundColor: 'rgba(52, 152, 219, 0.6)',
                            borderColor: 'rgba(52, 152, 219, 1)',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            title: {
                                display: true,
                                text: 'Distribución de Clases por Día'
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true
                            }
                        }
                    }
                });
                
                // Distribución Horaria
                new Chart(document.getElementById('hourlyDistributionChart'), {
                    type: 'bar',
                    data: {
                        labels: ${JSON.stringify([...Array(HOURS_PER_DAY)].map((_, i) => `${i + 15}:00`))},
                        datasets: [{
                            label: 'Clases por hora',
                            data: ${JSON.stringify(metrics.timeDistribution.hourly.counts)},
                            backgroundColor: 'rgba(46, 204, 113, 0.6)',
                            borderColor: 'rgba(46, 204, 113, 1)',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            title: {
                                display: true,
                                text: 'Distribución de Clases por Hora'
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true
                            }
                        }
                    }
                });
                
                // Utilización de Aulas
                new Chart(document.getElementById('roomUtilizationChart'), {
                    type: 'bar',
                    data: {
                        labels: ${JSON.stringify(Object.keys(metrics.roomUtilization))},
                        datasets: [{
                            label: 'Utilización (%)',
                            data: ${JSON.stringify(Object.values(metrics.roomUtilization).map(r => r.utilization.toFixed(2)))},
                            backgroundColor: 'rgba(155, 89, 182, 0.6)',
                            borderColor: 'rgba(155, 89, 182, 1)',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            title: {
                                display: true,
                                text: 'Porcentaje de Utilización de Aulas'
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                max: 100
                            }
                        }
                    }
                });
                
                // Carga de Profesores
                new Chart(document.getElementById('professorLoadChart'), {
                    type: 'bar',
                    data: {
                        labels: ${JSON.stringify(Object.values(metrics.professorLoad)
                .filter(p => p.totalHours > 0)
                .sort((a, b) => b.totalHours - a.totalHours)
                .slice(0, 15) // Mostrar solo los primeros 15 para legibilidad
                .map(p => p.name))},
                        datasets: [{
                            label: 'Horas asignadas',
                            data: ${JSON.stringify(Object.values(metrics.professorLoad)
                    .filter(p => p.totalHours > 0)
                    .sort((a, b) => b.totalHours - a.totalHours)
                    .slice(0, 15)
                    .map(p => p.totalHours))},
                            backgroundColor: 'rgba(230, 126, 34, 0.6)',
                            borderColor: 'rgba(230, 126, 34, 1)',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        indexAxis: 'y',
                        plugins: {
                            title: {
                                display: true,
                                text: 'Carga Horaria por Profesor (Top 15)'
                            }
                        },
                        scales: {
                            x: {
                                beginAtZero: true
                            }
                        }
                    }
                });
                
                // Horas por Grupo
                new Chart(document.getElementById('groupHoursChart'), {
                    type: 'bar',
                    data: {
                        labels: ${JSON.stringify(Object.values(metrics.groupSchedules).map(g => g.name))},
                        datasets: [{
                            label: 'Horas asignadas',
                            data: ${JSON.stringify(Object.values(metrics.groupSchedules).map(g => g.totalHours))},
                            backgroundColor: 'rgba(52, 73, 94, 0.6)',
                            borderColor: 'rgba(52, 73, 94, 1)',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            title: {
                                display: true,
                                text: 'Horas Totales por Grupo'
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true
                            }
                        }
                    }
                });
            });
        </script>
    </body>
    </html>
    `;

            if (fs) {
                try {
                    fs.writeFileSync(filename, html, 'utf8');
                    console.log(`\nReporte HTML generado en ${filename}`);
                    return true;
                } catch (error) {
                    console.error(`Error al generar el reporte HTML: ${error.message}`);
                    return false;
                }
            } else {
                console.log("\nGeneración de archivo HTML no disponible en este entorno.");
                return false;
            }
        }

        // Métodos auxiliares para generar HTML
        getConstraintClass(percentage) {
            if (percentage >= 95) return 'good';
            if (percentage >= 80) return 'warning';
            return 'danger';
        }

        generateViolationsHTML(initiationBasicRestriction) {
            if (initiationBasicRestriction.violations.length === 0) {
                return '<div class="good" style="padding: 10px; margin-top: 20px; border-radius: 5px;">No hay violaciones de la restricción de horario para grupos de iniciación y básico.</div>';
            }

            let html = '<h3>Violaciones de Restricción para Grupos de Iniciación y Básico</h3>';
            html += '<div class="danger" style="padding: 10px; margin-top: 10px; border-radius: 5px;">';
            html += '<p>Se encontraron las siguientes violaciones:</p>';
            html += '<ul>';

            initiationBasicRestriction.violations.forEach(violation => {
                html += `<li>${violation.course} (${violation.groups.join(', ')}) - ${violation.day} ${violation.hour}:00</li>`;
            });

            html += '</ul></div>';
            return html;
        }

        generateTimeMatrixHTML(matrix) {
            let html = '';

            for (let hourIndex = 0; hourIndex < HOURS_PER_DAY; hourIndex++) {
                const hour = hourIndex + 15; // Hora de inicio (15:00)
                html += `<div class="timetable-hour">${hour}:00</div>`;

                for (let dayIndex = 0; dayIndex < DAYS_OF_WEEK.length; dayIndex++) {
                    const count = matrix[dayIndex][hourIndex];
                    const cellClass = count > 0 ? 'occupied' : '';
                    const opacity = Math.min(1, count / 5); // Ajustar según la densidad máxima esperada

                    html += `<div class="timetable-cell ${cellClass}" style="background-color: rgba(46, 204, 113, ${opacity});">${count}</div>`;
                }
            }

            return html;
        }

        generateRoomUtilizationHTML(roomUtilization) {
            // Ordenar aulas por utilización
            const sortedRooms = Object.entries(roomUtilization)
                .sort((a, b) => b[1].utilization - a[1].utilization);

            let html = '';
            for (const [roomId, stats] of sortedRooms) {
                const utilizationClass = stats.utilization > 75 ? 'good' :
                    stats.utilization > 40 ? '' : 'warning';

                html += `
        <tr class="${utilizationClass}">
            <td>${roomId}</td>
            <td>${stats.capacity}</td>
            <td>${stats.assignedSlots}</td>
            <td>${stats.utilization.toFixed(2)}%</td>
        </tr>`;
            }

            return html;
        }

        generateProfessorLoadHTML(professorLoad) {
            // Filtrar y ordenar profesores por carga horaria
            const sortedProfessors = Object.entries(professorLoad)
                .filter(([_, stats]) => stats.totalHours > 0)
                .sort((a, b) => b[1].totalHours - a[1].totalHours);

            let html = '';
            for (const [profId, stats] of sortedProfessors) {
                const balanceClass = stats.balanceFactor > 0.8 ? 'good' :
                    stats.balanceFactor > 0.6 ? '' : 'warning';

                html += `
        <tr>
            <td>${stats.name}</td>
            <td>${stats.totalHours}</td>
            <td>${stats.courseCount}</td>
            <td class="${balanceClass}">${(stats.balanceFactor || 0).toFixed(4)}</td>
            <td>${stats.hoursByDay.map((hours, i) => `${DAYS_OF_WEEK[i]}: ${hours}`).join(', ')}</td>
        </tr>`;
            }

            return html;
        }

        // Continuación del método generateGroupAnalysisHTML

        generateGroupAnalysisHTML(groupSchedules) {
            // Ordenar grupos por código
            const sortedGroups = Object.entries(groupSchedules)
                .sort((a, b) => a[0].localeCompare(b[0]));

            let html = '';
            for (const [groupId, stats] of sortedGroups) {
                const balanceClass = stats.balanceFactor > 0.8 ? 'good' :
                    stats.balanceFactor > 0.6 ? '' : 'warning';

                const lateClassClass = stats.hasLateClasses ? 'danger' : 'good';
                const lateClassText = stats.hasLateClasses ? `${stats.lateClassesCount} ⚠️` : 'No';

                html += `
        <tr>
            <td>${stats.name}</td>
            <td>${stats.totalHours}</td>
            <td class="${balanceClass}">${(stats.balanceFactor || 0).toFixed(4)}</td>
            <td>${stats.maxConsecutiveHours}</td>
            <td>${stats.totalGaps}</td>
            <td class="${lateClassClass}">${lateClassText}</td>
        </tr>`;
            }

            return html;
        }

        generateGroupRestrictionHTML(groupSchedules) {
            // Filtrar sólo los grupos con restricción (G7-G14)
            const restrictedGroups = ["G7", "G8", "G9", "G10", "G11", "G12", "G13", "G14"];
            const filteredGroups = Object.entries(groupSchedules)
                .filter(([groupId, _]) => restrictedGroups.includes(groupId));

            let html = '';
            for (const [groupId, stats] of filteredGroups) {
                const statusClass = stats.hasLateClasses ? 'danger' : 'good';
                const statusIcon = stats.hasLateClasses ? '✗' : '✓';

                html += `
        <div class="metric-card ${statusClass}">
            <div class="metric-label">${stats.name}</div>
            <div class="metric-value">${statusIcon}</div>
            <div>${stats.hasLateClasses ? `${stats.lateClassesCount} clases después de 19:00` : 'Cumple restricción'}</div>
        </div>`;
            }

            return html;
        }
    }

    // Continuación de la función runExampleWithAdvancedAnalysis
    // Integrar el análisis de métricas
    TimetableGenerator.prototype.analyzeSchedule = function (chromosome) {
        console.log("\nRealizando análisis avanzado del horario...");
        const metrics = new TimetableMetricsCustom(this, chromosome);
        metrics.calculateAllMetrics();
        metrics.generateReport();
        metrics.exportToJSON("metricas-horario.json");
        metrics.generateHTMLReport("metricas-horario.html");

        return metrics;
    };

    // Generar horario
    console.log("Generando horario con análisis avanzado...");
    const bestTimetable = generator.generateTimetable();

    // Imprimir horario básico
    generator.printTimetable(bestTimetable);

    // Realizar análisis avanzado
    const metricsAnalysis = generator.analyzeSchedule(bestTimetable);

    console.log("\nEvaluación de la restricción para grupos de iniciación y básico:");
    const initiationBasicRestriction = metricsAnalysis.metrics.constraintsSatisfaction.initiationBasicGroupsRestriction;

    if (initiationBasicRestriction.satisfied) {
        console.log("✅ La restricción se cumple correctamente. Ningún grupo de iniciación o básico tiene clases después de las 19:00.");
    } else {
        console.log(`❌ La restricción NO se cumple. Se encontraron ${initiationBasicRestriction.violations.length} violaciones:`);
        initiationBasicRestriction.violations.forEach(violation => {
            console.log(`   - ${violation.course} (${violation.groups.join(', ')}) - ${violation.day} ${violation.hour}:00`);
        });
    }

    // Si la restricción no se cumple, modificar el código para corregir el problema
    if (!initiationBasicRestriction.satisfied) {
        console.log("\n🔧 El problema de implementación puede estar en alguno de estos componentes:");
        console.log("1. La función de evaluación de la restricción dura no se está aplicando correctamente");
        console.log("2. El método isValidAssignment no está incorporando las restricciones duras personalizadas");
        console.log("3. La restricción no se está verificando durante la generación inicial o mutación");

        console.log("\n📝 Soluciones recomendadas:");
        console.log("1. Implementar el método evaluateHardConstraints en TimetableGenerator");
        console.log("2. Modificar isValidAssignment para incluir las restricciones duras");
        console.log("3. Agregar verificaciones directas en generateInitialPopulation y mutate");

        // Código para resolver el problema:
        console.log("\n🛠️ Modificando el código para resolver el problema (solución directa):");

        // Solución directa: Modificar los métodos clave del generador para aplicar la restricción

        // 1. Añadir método para evaluar todas las restricciones duras
        TimetableGenerator.prototype.evaluateHardConstraints = function (assignment) {
            for (const constraint of this.hardConstraints) {
                if (!constraint.evaluate(assignment)) {
                    return false; // Si alguna restricción no se cumple, la asignación no es válida
                }
            }
            return true; // Todas las restricciones se cumplen
        };

        // 2. Modificar isValidAssignment para incluir las restricciones duras
        TimetableGenerator.prototype.isValidAssignment = function (chromosome, assignment) {
            return chromosome.isRoomAvailableForAssignment(assignment) &&
                chromosome.isProfessorAvailableForAssignment(assignment) &&
                chromosome.areStudentGroupsAvailableForAssignment(assignment) &&
                this.isRoomRequirementSatisfied(assignment) &&
                this.evaluateHardConstraints(assignment); // Añadir verificación de restricciones duras
        };

        // 3. Modificar generateInitialPopulation para verificar restricciones en la generación
        const originalGenerateInitialPopulation = TimetableGenerator.prototype.generateInitialPopulation;
        TimetableGenerator.prototype.generateInitialPopulation = function () {
            // Implementación original con verificación adicional para grupos restringidos
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

                    // MODIFICACIÓN: Verificar restricción de grupos específicos
                    const restrictedGroups = ["G7", "G8", "G9", "G10", "G11", "G12", "G13", "G14"];
                    const isRestrictedGroup = course.studentGroups.some(g => restrictedGroups.includes(g.id));

                    let maxHourIndex;
                    if (isRestrictedGroup) {
                        // Para grupos restringidos, limitar a slots antes de las 19:00 (índices 0-3)
                        maxHourIndex = course.requiresConsecutiveSlots ?
                            Math.min(3 - course.duration + 1, HOURS_PER_DAY - course.duration) :
                            Math.min(3, HOURS_PER_DAY - 1);
                    } else {
                        maxHourIndex = course.requiresConsecutiveSlots ?
                            (HOURS_PER_DAY - course.duration) :
                            (HOURS_PER_DAY - 1);
                    }

                    const randomHourIndex = Math.floor(Math.random() * (maxHourIndex + 1));
                    const timeSlot = new TimeSlot(randomDayIndex, randomHourIndex);

                    // Generar slots secundarios para clases no consecutivas
                    const secondaryTimeSlots = this.generateSecondaryTimeSlots(course, timeSlot, isRestrictedGroup);

                    // Crear asignación y añadirla al cromosoma
                    const assignment = new ClassAssignment(course, room, timeSlot, secondaryTimeSlots);
                    chromosome.addClassAssignment(assignment);
                }

                // Calcular fitness del cromosoma
                chromosome.calculateFitness();
                population.push(chromosome);
            }

            return population;
        };

        // 4. Modificar generateSecondaryTimeSlots para respetar restricciones
        TimetableGenerator.prototype.generateSecondaryTimeSlots = function (course, mainTimeSlot, isRestrictedGroup = false) {
            if (course.requiresConsecutiveSlots || course.duration <= 1) {
                return [];
            }

            const secondarySlots = [];
            const remainingSlots = course.duration - 1;

            // Generar slots secundarios aleatorios diferentes al principal
            let attempts = 0;
            const maxAttempts = 100;

            while (secondarySlots.length < remainingSlots && attempts < maxAttempts) {
                attempts++;
                const randomDayIndex = Math.floor(Math.random() * DAYS_OF_WEEK.length);

                // Limitar horas si es grupo restringido
                let maxHourIndex = HOURS_PER_DAY - 1;
                if (isRestrictedGroup) {
                    maxHourIndex = 3; // Hasta las 18:00 (índice 3)
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
        };

        // 5. Modificar mutate para respetar restricciones
        const originalMutate = TimetableGenerator.prototype.mutate;
        TimetableGenerator.prototype.mutate = function (chromosome) {
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

                // MODIFICACIÓN: Verificar restricción de grupos específicos
                const restrictedGroups = ["G7", "G8", "G9", "G10", "G11", "G12", "G13", "G14"];
                const isRestrictedGroup = course.studentGroups.some(g => restrictedGroups.includes(g.id));

                let maxHourIndex;
                if (isRestrictedGroup) {
                    // Para grupos restringidos, limitar a slots antes de las 19:00 (índices 0-3)
                    maxHourIndex = course.requiresConsecutiveSlots ?
                        Math.min(3 - course.duration + 1, HOURS_PER_DAY - course.duration) :
                        Math.min(3, HOURS_PER_DAY - 1);
                } else {
                    maxHourIndex = course.requiresConsecutiveSlots ?
                        (HOURS_PER_DAY - course.duration) :
                        (HOURS_PER_DAY - 1);
                }

                const randomHourIndex = Math.floor(Math.random() * (maxHourIndex + 1));
                const newTimeSlot = new TimeSlot(randomDayIndex, randomHourIndex);

                // Para clases no consecutivas, generar nuevos slots secundarios
                if (!course.requiresConsecutiveSlots && course.duration > 1) {
                    const newSecondaryTimeSlots = this.generateSecondaryTimeSlots(course, newTimeSlot, isRestrictedGroup);
                    assignment.secondaryTimeSlots = newSecondaryTimeSlots;
                }

                assignment.timeSlot = newTimeSlot;
            }
        };

    }

    return bestTimetable;
}

// Función principal para ejecutar el ejemplo
function main() {
    console.log("=============== Sistema de Generación y Análisis de Horarios ===============");
    console.log("Inicializando el ejemplo con análisis avanzado...");

    try {
        // Ejecutar el ejemplo con análisis avanzado
        runExampleWithAdvancedAnalysis();

        console.log("\n✅ El ejemplo se ejecutó correctamente.");
        console.log("✅ Se generaron los archivos de métricas:");
        console.log("   - metricas-horario.json (para análisis adicional)");
        console.log("   - metricas-horario.html (visualización interactiva)");
    } catch (error) {
        console.error("\n❌ Error durante la ejecución:", error);
        console.error("Stack trace:", error.stack);
    }

    console.log("\n======================================================");
    console.log("Para usar el sistema de métricas en tu código, añade estas funciones al final de timetabling.js");
    console.log("y llama a generator.analyzeSchedule(bestTimetable) después de generar el horario.");
    console.log("======================================================");
}

// Punto de entrada
main();