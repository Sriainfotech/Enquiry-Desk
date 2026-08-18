import django_filters

from .models import Activity, Enquiry


class EnquiryFilter(django_filters.FilterSet):
    customer = django_filters.NumberFilter(field_name="customer_id")
    business_line = django_filters.CharFilter(field_name="business_line", lookup_expr="iexact")
    status = django_filters.CharFilter(field_name="status", lookup_expr="iexact")
    priority = django_filters.CharFilter(field_name="priority", lookup_expr="iexact")
    enquiry_source = django_filters.CharFilter(field_name="enquiry_source", lookup_expr="iexact")
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
            "customer", "business_line", "status", "priority", "enquiry_source", "sales_person",
            "quotation_status", "order_status", "invoice_status", "payment_status",
            "date_from", "date_to",
        ]


class ActivityFilter(django_filters.FilterSet):
    enquiry = django_filters.NumberFilter(field_name="enquiry_id")
    customer = django_filters.NumberFilter(field_name="enquiry__customer_id")
    # No dedicated "type" column on Activity — actions are free-text ("Invoice Marked
    # as Sent"), so filtering by category is a substring match against that text.
    activity_type = django_filters.CharFilter(field_name="action", lookup_expr="icontains")
    created_by = django_filters.NumberFilter(field_name="created_by_id")
    date_from = django_filters.DateFilter(field_name="created_at", lookup_expr="date__gte")
    date_to = django_filters.DateFilter(field_name="created_at", lookup_expr="date__lte")

    class Meta:
        model = Activity
        fields = ["enquiry", "customer", "activity_type", "created_by", "date_from", "date_to"]
