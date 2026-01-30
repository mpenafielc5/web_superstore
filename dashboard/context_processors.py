from django.conf import settings

def feature_flags(request):
    return {
        'ENABLE_TOTAL_SALES': getattr(settings, 'ENABLE_TOTAL_SALES', False),
        'ENABLE_CATEGORY_CHART': getattr(settings, 'ENABLE_CATEGORY_CHART', False),
        'ENABLE_TIME_SERIES': getattr(settings, 'ENABLE_TIME_SERIES', False),
        'ENABLE_SEGMENT_CHART': getattr(settings, 'ENABLE_SEGMENT_CHART', False),
        'ENABLE_TOP_CUSTOMERS': getattr(settings, 'ENABLE_TOP_CUSTOMERS', False),
        'ENABLE_TOP_PRODUCTS': getattr(settings, 'ENABLE_TOP_PRODUCTS', False),
    }