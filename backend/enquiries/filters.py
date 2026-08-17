import django_filters

from .models import Enquiry


class EnquiryFilter(django_filters.FilterSet):
    customer = django_filters.NumberFilter(field_name="customer_id")
    business_line = django_filters.CharFilter(field_name="business_line", lookup_expr="iexact")
    status = django_filters.CharFilter(field_name="status", lookup_expr="iexact")
    priority = django_filters.CharFilter(field_name="priority", lookup_expr="iexact")
    sales_person = django_filters.CharFilter(field_name="sales_person", lookup_expr="icontains")
    quotation_status = django_filters.CharFilter(field_name="quotation__status", lookup_expr="iexact")
    order_status = django_filters.CharFilter(field_name="order__status", lookup_expr="iexact")
    invoice_status = django_filters.CharFilter(field_name="invoice__status", lookup_expr="iexact")
    payment_status = django_filters.CharFilter(field_name="invoice__payment_status", lookup_expr="iexact")
    date_from = django_filters.DateFilter(field_name="enquiry_date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="enquiry_date", lookup_expr="lte")

    class Meta:
        model = Enquiry
        fields = [
            "customer", "business_line", "status", "priority", "sales_person",
            "quotation_status", "order_status", "invoice_status", "payment_status",
            "date_from", "date_to",
        ]
