from datetime import date, timedelta
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from config.pagination import DashboardRecentPagination, StandardResultsSetPagination
from customers.models import Customer

from .filters import EnquiryFilter
from .models import Activity, DocumentSequence, Enquiry, Invoice, Order, Quotation, Requirement
from .serializers import (
    ActivitySerializer,
    DashboardCustomerSerializer,
    EnquiryDetailSerializer,
    EnquiryListSerializer,
    EnquiryWriteSerializer,
    InvoiceSerializer,
    OrderSerializer,
    QuotationSerializer,
    RecentActivitySerializer,
    RequirementSerializer,
    RequirementWriteSerializer,
)

DATE_RANGE_PRESETS = (
    "today", "this_week", "this_month", "last_month", "this_quarter", "this_year", "custom",
)


def resolve_date_range(request):
    """Turns ?date_range=this_month (or ?date_range=custom&date_from=...&date_to=...)
    into a concrete (date_from, date_to) pair. Defaults to "this_month"."""
    preset = request.query_params.get("date_range", "this_month")
    if preset not in DATE_RANGE_PRESETS:
        preset = "this_month"
    today = timezone.localdate()

    if preset == "custom":
        date_from = parse_date(request.query_params.get("date_from") or "")
        date_to = parse_date(request.query_params.get("date_to") or "")
        if not date_from or not date_to:
            raise FieldValidationError("A custom date range requires both date_from and date_to (YYYY-MM-DD).")
        if date_from > date_to:
            raise FieldValidationError("date_from cannot be later than date_to.")
        return preset, date_from, date_to

    if preset == "today":
        return preset, today, today
    if preset == "this_week":
        return preset, today - timedelta(days=today.weekday()), today
    if preset == "this_month":
        return preset, today.replace(day=1), today
    if preset == "last_month":
        last_day_prev_month = today.replace(day=1) - timedelta(days=1)
        return preset, last_day_prev_month.replace(day=1), last_day_prev_month
    if preset == "this_quarter":
        quarter_start_month = ((today.month - 1) // 3) * 3 + 1
        return preset, date(today.year, quarter_start_month, 1), today
    # this_year
    return preset, date(today.year, 1, 1), today


def previous_period(date_from, date_to):
    """The immediately preceding period of equal length, for trend comparisons."""
    length = (date_to - date_from).days + 1
    prev_to = date_from - timedelta(days=1)
    prev_from = prev_to - timedelta(days=length - 1)
    return prev_from, prev_to

SEARCH_FIELDS = [
    "enquiry_number", "business_line",
    "customer__company_name", "customer__customer_code", "customer__contact_person",
    "customer__mobile", "customer__email",
    "quotation__quotation_number", "order__order_number", "invoice__invoice_number",
]

# Whitelisted so `ordering` can never be used to inject arbitrary column/SQL.
ORDERING_FIELDS = {
    "enquiry_date": "enquiry_date",
    "-enquiry_date": "-enquiry_date",
    "created_at": "created_at",
    "-created_at": "-created_at",
    "updated_at": "updated_at",
    "-updated_at": "-updated_at",
    "enquiry_number": "enquiry_number",
    "-enquiry_number": "-enquiry_number",
    "customer__company_name": "customer__company_name",
    "-customer__company_name": "-customer__company_name",
    "quotation__total_value": "quotation__total_value",
    "-quotation__total_value": "-quotation__total_value",
    "order__value": "order__value",
    "-order__value": "-order__value",
}
DEFAULT_ORDERING = "-enquiry_date"


def enquiry_base_queryset():
    return (
        Enquiry.objects.select_related("customer", "quotation", "order", "invoice")
        .prefetch_related("requirements")
    )


def apply_ordering(queryset, request):
    ordering = ORDERING_FIELDS.get(request.query_params.get("ordering"), DEFAULT_ORDERING)
    return queryset.order_by(ordering, "-id")


def log_activity(enquiry, action, user=None, description=""):
    Activity.objects.create(enquiry=enquiry, action=action, description=description, created_by=user)


def api_error(detail, code=status.HTTP_400_BAD_REQUEST):
    return Response({"detail": detail}, status=code)


class FieldValidationError(Exception):
    """Raised by the small parse_* helpers below so callers can bail out with a
    single api_error(...) response instead of repeating try/except blocks."""

    def __init__(self, message):
        self.message = message


def parse_money(value, field_label, max_value=Decimal("999999999.99")):
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError):
        raise FieldValidationError(f"{field_label} must be a valid number.")
    if amount < 0 or amount > max_value:
        raise FieldValidationError(f"{field_label} must be between 0 and {max_value}.")
    return amount


def parse_required_date(value, field_label):
    if isinstance(value, str):
        parsed = parse_date(value)
        if not parsed:
            raise FieldValidationError(f"{field_label} must be a valid date (YYYY-MM-DD).")
        return parsed
    if isinstance(value, date):
        return value
    raise FieldValidationError(f"{field_label} must be a valid date (YYYY-MM-DD).")


# ---------------------------------------------------------------------------
# Enquiry list / create / detail
# ---------------------------------------------------------------------------

class EnquiryListCreateAPIView(APIView):
    def get(self, request):
        queryset = enquiry_base_queryset()

        search = request.query_params.get("search", "").strip()
        if search:
            q = Q()
            for field in SEARCH_FIELDS:
                q |= Q(**{f"{field}__icontains": search})
            queryset = queryset.filter(q)

        queryset = EnquiryFilter(request.query_params, queryset=queryset).qs.distinct()
        queryset = apply_ordering(queryset, request)

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = EnquiryListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        write_serializer = EnquiryWriteSerializer(data=request.data)
        write_serializer.is_valid(raise_exception=True)

        requirements_data = request.data.get("requirements") or []
        if not requirements_data:
            return api_error("Add at least one requirement.")
        req_serializer = RequirementWriteSerializer(data=requirements_data, many=True)
        req_serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            enquiry = write_serializer.save(status="New", created_by=request.user)
            for row in req_serializer.validated_data:
                row.pop("id", None)
                Requirement.objects.create(enquiry=enquiry, **row)
            Quotation.objects.create(enquiry=enquiry)
            Order.objects.create(enquiry=enquiry)
            Invoice.objects.create(enquiry=enquiry)
            log_activity(enquiry, "Enquiry Created", user=request.user)

        enquiry = enquiry_base_queryset().get(pk=enquiry.pk)
        return Response(EnquiryDetailSerializer(enquiry).data, status=status.HTTP_201_CREATED)


class EnquiryDetailAPIView(APIView):
    def get_object(self, pk):
        return get_object_or_404(enquiry_base_queryset(), pk=pk)

    def get(self, request, pk):
        return Response(EnquiryDetailSerializer(self.get_object(pk)).data)

    def patch(self, request, pk):
        enquiry = self.get_object(pk)
        was_cancelled = enquiry.status == "Cancelled"
        serializer = EnquiryWriteSerializer(enquiry, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data.get("status")
        with transaction.atomic():
            serializer.save()
            if new_status == "Cancelled" and not was_cancelled:
                log_activity(enquiry, "Enquiry Cancelled", user=request.user)
        enquiry.refresh_from_db()
        return Response(EnquiryDetailSerializer(enquiry).data)

    def delete(self, request, pk):
        enquiry = self.get_object(pk)
        enquiry.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Requirements
# ---------------------------------------------------------------------------

class RequirementsAPIView(APIView):
    def get_enquiry(self, pk):
        return get_object_or_404(Enquiry.objects.prefetch_related("requirements"), pk=pk)

    def get(self, request, pk):
        enquiry = self.get_enquiry(pk)
        return Response(RequirementSerializer(enquiry.requirements.all(), many=True).data)

    def put(self, request, pk):
        enquiry = self.get_enquiry(pk)
        rows = request.data if isinstance(request.data, list) else request.data.get("requirements", [])
        serializer = RequirementWriteSerializer(data=rows, many=True)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            keep_ids = [row["id"] for row in serializer.validated_data if row.get("id")]
            enquiry.requirements.exclude(id__in=keep_ids).delete()
            for row in serializer.validated_data:
                row_id = row.pop("id", None)
                if row_id:
                    Requirement.objects.filter(id=row_id, enquiry=enquiry).update(**row)
                else:
                    Requirement.objects.create(enquiry=enquiry, **row)

        enquiry.refresh_from_db()
        return Response(RequirementSerializer(enquiry.requirements.all(), many=True).data)


# ---------------------------------------------------------------------------
# Quotation
# ---------------------------------------------------------------------------

QUOTATION_TRANSITIONS = {
    "Draft": {"Prepared": ("Quotation Prepared", "Quotation Marked as Prepared")},
    "Prepared": {"Shared": ("Quotation Shared", "Quotation Shared with Customer")},
    "Shared": {
        "Accepted": ("Negotiation", "Quotation Accepted"),
        "Rejected": ("Lost", "Quotation Rejected"),
        "Expired": ("Lost", "Quotation Expired"),
    },
}


class QuotationAPIView(APIView):
    def get_enquiry(self, pk):
        return get_object_or_404(Enquiry.objects.select_related("quotation").prefetch_related("requirements"), pk=pk)

    def get(self, request, pk):
        return Response(QuotationSerializer(self.get_enquiry(pk).quotation).data)

    def post(self, request, pk):
        enquiry = self.get_enquiry(pk)
        quotation = enquiry.quotation
        if quotation.status not in ("Not Prepared", "Rejected", "Expired"):
            return api_error("A quotation already exists for this enquiry.", status.HTTP_409_CONFLICT)

        value = sum((r.total for r in enquiry.requirements.all()), Decimal("0"))
        today = date.today()
        try:
            tax_amount = parse_money(request.data.get("tax_amount", round(value * Decimal("0.18"), 2)), "Tax Amount")
            valid_until = parse_required_date(request.data.get("valid_until") or (today + timedelta(days=15)), "Valid Until")
        except FieldValidationError as exc:
            return api_error(exc.message)
        if valid_until < today:
            return api_error("Valid Until cannot be earlier than today's Quotation Date.")

        year = today.year
        with transaction.atomic():
            quotation.quotation_number = f"QTN-{year}-{str(DocumentSequence.next_number(f'QTN-{year}')).zfill(4)}"
            quotation.quotation_date = today
            quotation.value = value
            quotation.tax_amount = tax_amount
            quotation.total_value = value + tax_amount
            quotation.valid_until = valid_until
            quotation.status = "Draft"
            quotation.save()
            if enquiry.status == "New":
                enquiry.status = "Quotation Prepared"
                enquiry.save(update_fields=["status"])
            log_activity(enquiry, "Quotation Created (Draft)", user=request.user)

        return Response(QuotationSerializer(quotation).data, status=status.HTTP_201_CREATED)

    def patch(self, request, pk):
        enquiry = self.get_enquiry(pk)
        quotation = enquiry.quotation
        data = request.data

        with transaction.atomic():
            if "status" in data and data["status"] != quotation.status:
                transition = QUOTATION_TRANSITIONS.get(quotation.status, {}).get(data["status"])
                if not transition:
                    return api_error(f"Cannot move quotation from {quotation.status} to {data['status']}.")
                enquiry_status, activity_label = transition
                quotation.status = data["status"]
                quotation.save(update_fields=["status"])
                enquiry.status = enquiry_status
                enquiry.save(update_fields=["status"])
                log_activity(enquiry, activity_label, user=request.user)

            editable_data = {k: v for k, v in data.items() if k != "status"}
            if editable_data:
                if ("value" in editable_data or "tax_amount" in editable_data) and quotation.status in ("Accepted", "Rejected"):
                    return api_error("This quotation is locked and can no longer be edited.")
                serializer = QuotationSerializer(quotation, data=editable_data, partial=True)
                serializer.is_valid(raise_exception=True)
                serializer.save()
                if "value" in editable_data or "tax_amount" in editable_data:
                    quotation.total_value = quotation.value + quotation.tax_amount
                    quotation.save(update_fields=["total_value"])

        return Response(QuotationSerializer(quotation).data)


# ---------------------------------------------------------------------------
# Order
# ---------------------------------------------------------------------------

ORDER_TRANSITIONS = {
    "Pending": {
        "Confirmed": ("Won", "Order Confirmed"),
        "Partially Confirmed": (None, "Order Partially Confirmed"),
        "Cancelled": ("Lost", "Order Cancelled"),
    },
    "Confirmed": {
        "Completed": ("Won", "Order Marked as Completed"),
        "Cancelled": ("Lost", "Order Cancelled"),
    },
    "Partially Confirmed": {
        "Completed": ("Won", "Order Marked as Completed"),
        "Cancelled": ("Lost", "Order Cancelled"),
    },
}


class OrderAPIView(APIView):
    def get_enquiry(self, pk):
        return get_object_or_404(Enquiry.objects.select_related("quotation", "order"), pk=pk)

    def get(self, request, pk):
        return Response(OrderSerializer(self.get_enquiry(pk).order).data)

    def post(self, request, pk):
        enquiry = self.get_enquiry(pk)
        order = enquiry.order
        if enquiry.quotation.status != "Accepted" or order.status != "Not Converted":
            return api_error("An order can only be created once the quotation has been accepted.", status.HTTP_409_CONFLICT)

        today = date.today()
        po_number = (request.data.get("po_number") or "").strip()
        if len(po_number) > 50:
            return api_error("PO Number cannot exceed 50 characters.")
        try:
            po_date = parse_required_date(request.data.get("po_date") or today, "PO Date")
        except FieldValidationError as exc:
            return api_error(exc.message)
        if po_date > today:
            return api_error("PO Date cannot be later than the Order Date.")

        year = today.year
        with transaction.atomic():
            order.order_number = f"ORD-{year}-{str(DocumentSequence.next_number(f'ORD-{year}')).zfill(4)}"
            order.order_date = today
            order.po_number = po_number
            order.po_date = po_date
            order.value = enquiry.quotation.total_value
            order.status = "Pending"
            order.save()
            log_activity(enquiry, "Order Created (Pending)", user=request.user)

        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)

    def patch(self, request, pk):
        enquiry = self.get_enquiry(pk)
        order = enquiry.order
        data = request.data

        with transaction.atomic():
            if "status" in data and data["status"] != order.status:
                transition = ORDER_TRANSITIONS.get(order.status, {}).get(data["status"])
                if not transition:
                    return api_error(f"Cannot move order from {order.status} to {data['status']}.")
                enquiry_status, activity_label = transition
                order.status = data["status"]
                order.save(update_fields=["status"])
                if enquiry_status:
                    enquiry.status = enquiry_status
                    enquiry.save(update_fields=["status"])
                log_activity(enquiry, activity_label, user=request.user)

            editable_data = {k: v for k, v in data.items() if k != "status"}
            if editable_data:
                serializer = OrderSerializer(order, data=editable_data, partial=True)
                serializer.is_valid(raise_exception=True)
                serializer.save()

        return Response(OrderSerializer(order).data)


# ---------------------------------------------------------------------------
# Invoice
# ---------------------------------------------------------------------------

INVOICE_TRANSITIONS = {
    "Generated": {"Sent": "Invoice Marked as Sent", "Cancelled": "Invoice Cancelled"},
    "Sent": {"Cancelled": "Invoice Cancelled"},
}


class InvoiceAPIView(APIView):
    def get_enquiry(self, pk):
        return get_object_or_404(Enquiry.objects.select_related("order", "invoice"), pk=pk)

    def get(self, request, pk):
        return Response(InvoiceSerializer(self.get_enquiry(pk).invoice).data)

    def post(self, request, pk):
        enquiry = self.get_enquiry(pk)
        invoice = enquiry.invoice
        if enquiry.order.status not in ("Confirmed", "Partially Confirmed", "Completed") or invoice.status != "Not Generated":
            return api_error("An invoice can only be generated once the order has been confirmed.", status.HTTP_409_CONFLICT)

        today = date.today()
        year = today.year
        with transaction.atomic():
            invoice.invoice_number = f"INV-{year}-{str(DocumentSequence.next_number(f'INV-{year}')).zfill(4)}"
            invoice.invoice_date = today
            invoice.value = enquiry.order.value
            invoice.status = "Generated"
            invoice.payment_status = "Not Paid"
            invoice.due_date = today + timedelta(days=15)
            invoice.save()
            log_activity(enquiry, "Invoice Generated", user=request.user)

        return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)

    def patch(self, request, pk):
        enquiry = self.get_enquiry(pk)
        invoice = enquiry.invoice
        data = request.data

        with transaction.atomic():
            if "status" in data and data["status"] != invoice.status:
                label = INVOICE_TRANSITIONS.get(invoice.status, {}).get(data["status"])
                if not label:
                    return api_error(f"Cannot move invoice from {invoice.status} to {data['status']}.")
                invoice.status = data["status"]
                invoice.save(update_fields=["status"])
                log_activity(enquiry, label, user=request.user)

            if "payment_status" in data and data["payment_status"] != invoice.payment_status:
                new_payment_status = data["payment_status"]
                invoice.payment_status = new_payment_status
                if new_payment_status == "Paid":
                    invoice.payment_date = date.today()
                    label = "Payment Received in Full"
                else:
                    # Only a fully-Paid invoice carries a payment date — any other
                    # status means the balance (or all of it) is still outstanding.
                    invoice.payment_date = None
                    label = "Payment Partially Received" if new_payment_status == "Partially Paid" else f"Payment Status Updated to {new_payment_status}"
                invoice.save(update_fields=["payment_status", "payment_date"])
                log_activity(enquiry, label, user=request.user)

            editable_data = {k: v for k, v in data.items() if k not in ("status", "payment_status")}
            if editable_data:
                serializer = InvoiceSerializer(invoice, data=editable_data, partial=True)
                serializer.is_valid(raise_exception=True)
                serializer.save()

        return Response(InvoiceSerializer(invoice).data)


# ---------------------------------------------------------------------------
# Activity (read-only timeline)
# ---------------------------------------------------------------------------

class ActivityListAPIView(APIView):
    def get(self, request, pk):
        enquiry = get_object_or_404(Enquiry, pk=pk)
        return Response(ActivitySerializer(enquiry.activities.all(), many=True).data)


# ---------------------------------------------------------------------------
# Dashboard aggregation
# ---------------------------------------------------------------------------

def trend_from(current, previous):
    if not current and not previous:
        return None
    if previous == 0:
        return {"up": True, "pct": 100} if current > 0 else None
    pct = round(((current - previous) / previous) * 100)
    return {"up": pct >= 0, "pct": abs(pct)}


PENDING_QUOTATION_STATUSES = ["Draft", "Prepared", "Shared"]
CONFIRMED_ORDER_STATUSES = ["Confirmed", "Completed"]
ACTIVE_ORDER_STATUSES = ["Confirmed", "Partially Confirmed", "Completed"]
PENDING_PAYMENT_STATUSES = ["Not Paid", "Partially Paid", "Overdue"]


def aggregate_period(date_from, date_to):
    """One query: every KPI + pipeline number for a single date_from..date_to window,
    via conditional aggregation — not one query per metric, not a Python loop over rows."""
    totals = Enquiry.objects.filter(enquiry_date__gte=date_from, enquiry_date__lte=date_to).aggregate(
        total_enquiries=Count("id"),
        quotations_prepared=Count("id", filter=~Q(quotation__status="Not Prepared")),
        pending_quotations=Count("id", filter=Q(quotation__status__in=PENDING_QUOTATION_STATUSES)),
        quotation_value=Sum("quotation__total_value", filter=~Q(quotation__status="Not Prepared")),
        orders_converted=Count("id", filter=~Q(order__status="Not Converted")),
        orders_confirmed=Count("id", filter=Q(order__status__in=CONFIRMED_ORDER_STATUSES)),
        order_value=Sum("order__value", filter=Q(order__status__in=ACTIVE_ORDER_STATUSES)),
        invoices_generated=Count("id", filter=~Q(invoice__status="Not Generated")),
        pending_invoice_value=Sum(
            "invoice__value",
            filter=Q(invoice__payment_status__in=PENDING_PAYMENT_STATUSES) & ~Q(invoice__status="Not Generated"),
        ),
        completed=Count("id", filter=Q(invoice__payment_status="Paid")),
    )
    for key in ("quotation_value", "order_value", "pending_invoice_value"):
        totals[key] = totals[key] or 0
    return totals


class DashboardAPIView(APIView):
    """GET /api/enquiries/dashboard/ — KPI cards, pipeline and recent customers.
    Recent enquiries / activity live in their own (paginated) endpoints below."""

    def get(self, request):
        try:
            preset, date_from, date_to = resolve_date_range(request)
        except FieldValidationError as exc:
            return api_error(exc.message)

        current = aggregate_period(date_from, date_to)
        prev_from, prev_to = previous_period(date_from, date_to)
        previous = aggregate_period(prev_from, prev_to)

        # "Total Customers" is a current snapshot (the whole active customer base), not
        # scoped to the selected period — only its trend arrow compares period-over-period.
        total_customers = Customer.objects.filter(is_active=True).count()
        cust_current = Customer.objects.filter(created_at__date__gte=date_from, created_at__date__lte=date_to).count()
        cust_previous = Customer.objects.filter(created_at__date__gte=prev_from, created_at__date__lte=prev_to).count()

        # Actionable-item counts for the notification bell — these are "what needs
        # attention right now", so they're intentionally NOT scoped to the date filter.
        invoices_overdue_count = Invoice.objects.exclude(status__in=["Not Generated", "Cancelled"]).filter(
            due_date__lt=date.today()
        ).exclude(payment_status="Paid").count()
        quotations_ready_to_convert_count = Enquiry.objects.filter(
            quotation__status="Accepted", order__status="Not Converted"
        ).count()

        recent_customers = Customer.objects.order_by("-created_at")[:5]

        pipeline = [
            {"label": "New Enquiry", "count": current["total_enquiries"]},
            {"label": "Quotation", "count": current["quotations_prepared"]},
            {"label": "Order", "count": current["orders_converted"]},
            {"label": "Invoice", "count": current["invoices_generated"]},
            {"label": "Completed", "count": current["completed"]},
        ]

        return Response({
            "date_range": {"preset": preset, "date_from": date_from, "date_to": date_to},
            "total_customers": total_customers,
            "total_enquiries": current["total_enquiries"],
            "pending_quotations": current["pending_quotations"],
            "quotation_value": current["quotation_value"],
            "orders_confirmed": current["orders_confirmed"],
            "order_value": current["order_value"],
            "invoices_generated": current["invoices_generated"],
            "pending_invoice_value": current["pending_invoice_value"],
            "invoices_overdue_count": invoices_overdue_count,
            "quotations_ready_to_convert_count": quotations_ready_to_convert_count,
            "trends": {
                "customers": trend_from(cust_current, cust_previous),
                "enquiries": trend_from(current["total_enquiries"], previous["total_enquiries"]),
                "orders_confirmed": trend_from(current["orders_confirmed"], previous["orders_confirmed"]),
                "invoices_generated": trend_from(current["invoices_generated"], previous["invoices_generated"]),
            },
            "pipeline": pipeline,
            "recent_customers": DashboardCustomerSerializer(recent_customers, many=True).data,
        })


class DashboardRecentEnquiriesAPIView(APIView):
    """GET /api/enquiries/dashboard/recent-enquiries/?page=&page_size= — the dashboard's
    Recent Enquiries widget, backed by real pagination instead of a client-side slice."""

    def get(self, request):
        queryset = enquiry_base_queryset().order_by("-enquiry_date", "-id")
        paginator = DashboardRecentPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = EnquiryListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class DashboardRecentActivityAPIView(APIView):
    """GET /api/enquiries/dashboard/recent-activity/?limit= — latest activity across
    every enquiry (capped at 50), for the dashboard's Recent Activity widget."""

    def get(self, request):
        try:
            limit = min(max(int(request.query_params.get("limit", 10)), 1), 50)
        except (TypeError, ValueError):
            limit = 10
        activities = (
            Activity.objects.select_related("enquiry", "enquiry__customer", "created_by")
            .order_by("-created_at")[:limit]
        )
        return Response(RecentActivitySerializer(activities, many=True).data)
