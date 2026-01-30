FROM python:3.12-slim

# Evita archivos .pyc y mejora logs
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Directorio de trabajo
WORKDIR /app

# Dependencias del sistema para mysqlclient + netcat
RUN apt-get update && apt-get install -y \
    default-libmysqlclient-dev \
    gcc \
    pkg-config \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# Copiar dependencias Python
COPY requirements.txt .

# Instalar dependencias
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el proyecto
COPY . .

# Puerto de Django
EXPOSE 8000

# Comando de arranque
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]