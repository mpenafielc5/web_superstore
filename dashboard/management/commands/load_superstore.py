import csv
from pathlib import Path
from datetime import datetime
from decimal import Decimal, InvalidOperation
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction

TABLE = 'superstore'

def norm_key(s: str) -> str:
    return '' if s is None else s.strip().lower().replace(' ', '_').replace('-', '_')

def parse_ddmmyyyy(s: str):
    if not s:
        return None
    s = s.strip()
    try:
        return datetime.strptime(s, '%d/%m/%Y').strftime('%Y-%m-%d')
    except ValueError:
        return None

def to_dec(x):
    if x is None:
        return None
    try:
        return Decimal(str(x).strip())
    except (InvalidOperation, AttributeError):
        return None

def open_text(path: Path):
    try:
        f = open(path, 'r', encoding='utf-8-sig', newline='')
        f.read(1); f.seek(0)
        return f
    except UnicodeDecodeError:
        f = open(path, 'r', encoding='cp1252', newline='')
        f.read(1); f.seek(0)
        return f

class Command(BaseCommand):
    help = 'Carga CSV a MySQL con SQL puro'

    def add_arguments(self, parser):
        parser.add_argument('--csv', type=str, required=True)

    def handle(self, *args, **opts):
        p = Path(opts['csv'])
        if not p.exists():
            raise CommandError(f'No existe el archivo: {p}')

        ddl_drop_create = f"""
        DROP TABLE IF EXISTS {TABLE};
        CREATE TABLE {TABLE} (
            order_id     VARCHAR(64),
            order_date   DATE,
            ship_date    DATE,
            ship_mode    VARCHAR(64),
            customer_id  VARCHAR(64),
            customer_name VARCHAR(255),
            segment      VARCHAR(64),
            country      VARCHAR(64),
            city         VARCHAR(128),
            state        VARCHAR(128),
            postal_code  VARCHAR(32),
            region       VARCHAR(64),
            product_id   VARCHAR(64),
            category     VARCHAR(64),
            sub_category VARCHAR(64),
            product_name VARCHAR(255),
            sales        DECIMAL(18,3)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """

        sql_insert = f"""
        INSERT INTO {TABLE} (
            order_id, order_date, ship_date, ship_mode, customer_id, customer_name,
            segment, country, city, state, postal_code, region, product_id,
            category, sub_category, product_name, sales
        ) VALUES ({",".join(["%s"]*17)});
        """

        with transaction.atomic():
            with connection.cursor() as cur:
                for stmt in ddl_drop_create.strip().split(';'):
                    s = stmt.strip()
                    if s:
                        cur.execute(s)

                with open_text(p) as f:
                    sample = f.read(4096); f.seek(0)
                    try:
                        dialect = csv.Sniffer().sniff(sample)
                    except csv.Error:
                        dialect = csv.excel

                    reader = csv.DictReader(f, dialect=dialect)
                    rows = []
                    for row in reader:
                        g = {}
                        for k, v in row.items():
                            nk = norm_key(k)
                            if isinstance(v, str):
                                v = v.replace('\xa0', ' ').strip()
                            g[nk] = v

                        rows.append([
                            g.get('order_id'),
                            parse_ddmmyyyy(g.get('order_date')),
                            parse_ddmmyyyy(g.get('ship_date')),
                            g.get('ship_mode'),
                            g.get('customer_id'),
                            g.get('customer_name'),
                            g.get('segment'),
                            g.get('country'),
                            g.get('city'),
                            g.get('state'),
                            g.get('postal_code'),
                            g.get('region'),
                            g.get('product_id'),
                            g.get('category'),
                            g.get('sub_category'),
                            g.get('product_name'),
                            to_dec(g.get('sales')),
                        ])

                    if rows:
                        cur.executemany(sql_insert, rows)

                for col in ('order_date', 'category', 'sub_category', 'state', 'city', 'segment'):
                    try:
                        cur.execute(f'CREATE INDEX idx_{TABLE}_{col} ON {TABLE}({col});')
                    except Exception:
                        pass

        self.stdout.write(self.style.SUCCESS(f'Cargados {len(rows)} registros en {TABLE}'))
