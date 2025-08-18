from django.urls import path
from .views import (
    index, api_kpis, api_top_customers, api_top_products,
    api_series_sales, api_sales_by_category, api_filters, export_xlsx,
)

app_name = "dashboard"

urlpatterns = [
    path("", index, name="index"),
    path("api/kpis", api_kpis, name="api_kpis"),
    path("api/top-customers", api_top_customers, name="api_top_customers"),
    path("api/top-products", api_top_products, name="api_top_products"),
    path("api/series-sales", api_series_sales, name="api_series_sales"),
    path("api/sales-by-category", api_sales_by_category, name="api_sales_by_category"),
    path("api/filters", api_filters, name="api_filters"),
    path("export/xlsx", export_xlsx, name="export_xlsx"),
]
