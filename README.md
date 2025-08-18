Superstore Dashboard (Django + MySQL)

Dashboard analítico para ventas de Superstore con filtros (fecha, categoría/subcategoría, estado/ciudad), KPIs, tablas y gráficos.
Backend en Django con SQL crudo (sin ORM). Frontend con HTML/JS + Chart.js.

Requisitos
-Python 3.12
-MySQL 
-(Opcional) MySQL Workbench/VS Code

Instalación rápida
# 1 Clonar o copiar el proyecto
cd ~/Downloads/PruebaPasantia

# 2 Virtualenv
python -m venv .venv
.\.venv\Scripts\Activate

# 3 Dependencias
pip install -r requirements.txt

Configuración

# 1 Duplica .env.example a .env y completa:
SECRET_KEY=changeme
DEBUG=True
DB_NAME=superstore_db
DB_USER=root
DB_PASSWORD=tu_contrasena_mysql
DB_HOST=127.0.0.1
DB_PORT=3306

# 2 Crea la base de datos:
mysql -u root -p -e "CREATE DATABASE superstore_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"


# 3 Migraciones:
python manage.py migrate

Datos

# 1 Coloca el CSV en data/superstore_final_dataset (1).csv (la carpeta data/ está ignorada; el repo incluye data/.keep).

# 2 Carga a MySQL:
python manage.py load_superstore --csv ".\data\superstore_final_dataset (1).csv"

# 3 Ejecutar
python manage.py runserver

# 4 Visita http://127.0.0.1:8000/

Licencia y datos

Código bajo la licencia del repositorio.

El CSV se descarga por cuenta del usuario (no se redistribuye en este repo).