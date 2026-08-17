import django_filters

from .models import Customer


class CustomerFilter(django_filters.FilterSet):
    state = django_filters.CharFilter(field_name="state", lookup_expr="iexact")
    city = django_filters.CharFilter(field_name="city", lookup_expr="iexact")
    customer_type = django_filters.CharFilter(field_name="customer_type", lookup_expr="iexact")
    company_type = django_filters.CharFilter(field_name="company_type", lookup_expr="iexact")
    industry = django_filters.CharFilter(field_name="industry", lookup_expr="iexact")
    is_active = django_filters.BooleanFilter(field_name="is_active")
    created_from = django_filters.DateFilter(field_name="created_at", lookup_expr="date__gte")
    created_to = django_filters.DateFilter(field_name="created_at", lookup_expr="date__lte")

    class Meta:
        model = Customer
        fields = [
            "state", "city", "customer_type", "company_type", "industry", "is_active",
            "created_from", "created_to",
        ]
