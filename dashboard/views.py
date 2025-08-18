from django.shortcuts import render
from django.http import JsonResponse,HttpResponse
from django.db import connection
from django.views.decorators.http import require_GET
import io
import pandas as pd

#Create your views here
TABLE = 'superstore'

def index(request):
    return render(request, 'dashboard/index.html')

def _filters(request):
    return {
        'date_from': request.GET.get('date_from'),
        'date_to': request.GET.get('date_to'),
        'category': request.GET.get('category'),
        'sub_category': request.GET.get('sub_category'),
        'state': request.GET.get('state'),
        'city': request.GET.get('city'),
        'segment': request.GET.get('segment'),
    }

def _where_and_params(f):
    where, params = [], []
    if f['date_from']:
        where.append("order_date >= STR_TO_DATE(%s, '%%Y-%%m-%%d')")
        params.append(f['date_from'])
    if f['date_to']:
        where.append("order_date <= STR_TO_DATE(%s, '%%Y-%%m-%%d')")
        params.append(f['date_to'])
    if f['category']:
        where.append("category = %s"); params.append(f['category'])
    if f['sub_category']:
        where.append("sub_category = %s"); params.append(f['sub_category'])
    if f['state']:
        where.append("state = %s"); params.append(f['state'])
    if f['city']:
        where.append("city = %s"); params.append(f['city'])
    if f['segment']:
        where.append("segment = %s"); params.append(f['segment'])
    clause = (" WHERE " + " AND ".join(where)) if where else ""
    return clause, params

@require_GET
def api_kpis(request):
    f = _filters(request); where, p = _where_and_params(f)
    sql_total = f"SELECT COALESCE(SUM(sales),0) FROM {TABLE}{where}"
    sql_seg = f"""
        SELECT segment, COALESCE(SUM(sales),0) AS total
        FROM {TABLE} {where}
        GROUP BY segment
        ORDER BY total DESC, segment ASC
    """
    with connection.cursor() as c:
        c.execute(sql_total, p); total = c.fetchone()[0] or 0
        c.execute(sql_seg, p); seg = [{'segment': r[0], 'total': float(r[1])} for r in c.fetchall()]
    return JsonResponse({'total_sales': float(total), 'sales_by_segment': seg})

@require_GET
def api_top_customers(request):
    f = _filters(request); where, p = _where_and_params(f)
    sql = f"""
        SELECT customer_name, segment, city, state, SUM(sales) AS total
        FROM {TABLE} {where}
        GROUP BY customer_name, segment, city, state
        ORDER BY total DESC, customer_name ASC
        LIMIT 10
    """
    with connection.cursor() as c:
        c.execute(sql, p); rows = c.fetchall()
    data = [{'customer_name': r[0],'segment': r[1],'city': r[2],'state': r[3],'total': float(r[4])} for r in rows]
    return JsonResponse({'rows': data})

@require_GET
def api_top_products(request):
    f = _filters(request); where, p = _where_and_params(f)
    sql = f"""
        SELECT product_id, category, sub_category, product_name, SUM(sales) AS total_sales
        FROM {TABLE} {where}
        GROUP BY product_id, category, sub_category, product_name
        ORDER BY total_sales DESC, product_name ASC
        LIMIT 20
    """
    with connection.cursor() as c:
        c.execute(sql, p); rows = c.fetchall()
    data = [{'product_id': r[0],'category': r[1],'sub_category': r[2],'product_name': r[3],'total_sales': float(r[4])} for r in rows]
    return JsonResponse({'rows': data})

@require_GET
def api_series_sales(request):
    f = _filters(request); where, p = _where_and_params(f)
    sql = f"""
        SELECT DATE_FORMAT(order_date, '%%Y-%%m') AS period, SUM(sales) AS total
        FROM {TABLE} {where}
        GROUP BY period
        ORDER BY period
    """
    with connection.cursor() as c:
        c.execute(sql, p); rows = c.fetchall()
    return JsonResponse({'points': [{'period': r[0], 'total': float(r[1])} for r in rows]})

@require_GET
def api_sales_by_category(request):
    f = _filters(request); where, p = _where_and_params(f)
    sql = f"""
        SELECT category, SUM(sales) AS total
        FROM {TABLE} {where}
        GROUP BY category
        ORDER BY total DESC, category ASC
    """
    with connection.cursor() as c:
        c.execute(sql, p); rows = c.fetchall()
    return JsonResponse({'rows': [{'category': r[0], 'total': float(r[1])} for r in rows]})

@require_GET
def api_filters(request):
    f = _filters(request)
    cats, subs, states, cities = [], [], [], []
    with connection.cursor() as c:
        c.execute(f"SELECT DISTINCT category FROM {TABLE} ORDER BY category")
        cats = [r[0] for r in c.fetchall()]
        if f['category']:
            c.execute(f"SELECT DISTINCT sub_category FROM {TABLE} WHERE category=%s ORDER BY sub_category", [f['category']])
            subs = [r[0] for r in c.fetchall()]
        if f['state']:
            c.execute(f"SELECT DISTINCT city FROM {TABLE} WHERE state=%s ORDER BY city", [f['state']])
            cities = [r[0] for r in c.fetchall()]
        else:
            c.execute(f"SELECT DISTINCT state FROM {TABLE} ORDER BY state")
            states = [r[0] for r in c.fetchall()]
    return JsonResponse({'categories': cats, 'subcategories': subs, 'states': states, 'cities': cities})

@require_GET
def export_xlsx(request):
    f = _filters(request)
    where, p = _where_and_params(f)

    sql = f"""
        SELECT
            order_date,
            order_id,
            customer_id,
            customer_name,
            segment,
            state,
            city,
            category,
            sub_category,
            product_id,
            product_name,
            sales
        FROM {TABLE}
        {where}
        ORDER BY order_date, order_id
    """

    with connection.cursor() as c:
        c.execute(sql, p)
        rows = c.fetchall()

    cols = [
        "Fecha", "Order ID", "Customer ID", "Cliente", "Segmento",
        "Estado", "Ciudad", "Categoría", "Subcategoría",
        "Product ID", "Producto", "Ventas"
    ]
    df = pd.DataFrame(rows, columns=cols)

    kpi = (
        df.groupby("Segmento", dropna=False)["Ventas"].sum().reset_index()
        if not df.empty else pd.DataFrame(columns=["Segmento", "Ventas"])
    )
    kpi_total = float(df["Ventas"].sum()) if "Ventas" in df.columns and not df.empty else 0.0

    filt_items = [
        ("Desde", f.get("date_from") or ""),
        ("Hasta", f.get("date_to") or ""),
        ("Categoría", f.get("category") or ""),
        ("Subcategoría", f.get("sub_category") or ""),
        ("Estado", f.get("state") or ""),
        ("Ciudad", f.get("city") or ""),
        ("Segmento", f.get("segment") or ""),
    ]
    df_filtros = pd.DataFrame(filt_items, columns=["Filtro", "Valor"])

    buff = io.BytesIO()
    with pd.ExcelWriter(buff, engine="openpyxl") as writer:
        df_filtros.to_excel(writer, sheet_name="Filtros", index=False)

        resumen = pd.DataFrame(
            [("Total ventas", kpi_total)],
            columns=["Métrica", "Valor"]
        )
        resumen.to_excel(writer, sheet_name="Resumen", index=False)
        if not kpi.empty:
            kpi.to_excel(writer, sheet_name="Resumen", index=False, startrow=len(resumen)+2)

        df.to_excel(writer, sheet_name="Datos", index=False)

        ws = writer.sheets["Datos"]
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = ws.dimensions
        widths = {
            "A":12, "B":16, "C":14, "D":22, "E":12,
            "F":16, "G":16, "H":16, "I":16, "J":16, "K":36, "L":14
        }
        for col, w in widths.items():
            ws.column_dimensions[col].width = w
        for cell in ws["L"][1:]:
            cell.number_format = u'[$$-409]#,##0.00'

        ws_f = writer.sheets["Filtros"]
        ws_f.column_dimensions["A"].width = 18
        ws_f.column_dimensions["B"].width = 30

        ws_r = writer.sheets["Resumen"]
        ws_r.column_dimensions["A"].width = 22
        ws_r.column_dimensions["B"].width = 18

    buff.seek(0)
    resp = HttpResponse(
        buff.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    resp["Content-Disposition"] = 'attachment; filename="reporte_superstore.xlsx"'
    return resp

