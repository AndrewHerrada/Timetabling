from config import DIAS_SEMANA, HORAS_DIA # Necesario para inicializar disponibilidad

class Profesor:
    """
    Clase que representa a un profesor con sus atributos y disponibilidad.
    """
    def __init__(self, id, nombre, categoria, **kwargs):
        """
        Inicializa un nuevo profesor.

        Args:
            id: Identificador único del profesor (string)
            nombre: Nombre completo del profesor (string)
            categoria: Categoría ('Item' o 'Contrato') (string)
            **kwargs: Para atributos adicionales como seccion_primaria
        """
        self.id = str(id) # Asegurar que ID es string
        self.nombre = nombre
        # Normalizar categoría para consistencia
        self.categoria = 'Item' if categoria.lower() == 'item' else 'Contrato'
        self.tiene_item = (self.categoria == 'Item') # Añadido para conveniencia

        # Disponibilidad inicial (se modifica al añadir eventos al horario)
        # Asume disponibilidad total según Punto 2 del usuario
        self.disponibilidad_inicial = [[True for _ in range(len(HORAS_DIA))] for _ in range(len(DIAS_SEMANA))]

        self.horas_asignadas = 0 # Se actualizará al construir el horario
        self.seccion_primaria = kwargs.get('seccion_primaria', '') # Opcional

    def incrementar_horas(self, cantidad=1):
        """Incrementa el contador de horas asignadas al profesor."""
        self.horas_asignadas += cantidad

    def reset_horas_asignadas(self):
         """Resetea las horas para re-evaluación."""
         self.horas_asignadas = 0

    def cumple_horas_minimas(self):
        """Verifica si el profesor cumple con el requisito de horas mínimas."""
        if not self.tiene_item:
            return True
        return self.horas_asignadas >= 14 # Requisito de 14 horas para 'Item'

    def __str__(self):
        """Representación en string del profesor."""
        return f"Profesor({self.id}): {self.nombre} [{self.categoria}] ({self.horas_asignadas} hrs)"

    def __repr__(self):
        return f"Profesor(id='{self.id}', nombre='{self.nombre}', categoria='{self.categoria}')"