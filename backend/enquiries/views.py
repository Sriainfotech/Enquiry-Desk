import os
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from config.pagination import DashboardRecentPagination, StandardResultsSetPagination
from customers.models import Customer

from .filters import ActivityFilter, EnquiryFilter
from .models import (
    Activity,
    Enquiry,
    Invoice,
    InvoiceAttachment,
    Order,
    OrderAttachment,
    Quotation,
    QuotationAttachment,
    Requirement,
)
from .serializers import (
    ActivitySerializer,
    AttachmentSerializer,
    AttachmentUploadSerializer,
    DashboardCustomerSerializer,
    DOCUMENT_NUMBER_RE,
    EnquiryDetailSerializer,
    EnquiryListSerializer,
    EnquiryWriteSerializer,
    InvoiceSerializer,
    MAX_DOCUMENT_NUMBER_LENGTH,
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
    "requirements__item",
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

        search = request.query_params.get("search", "").strip()[:100]
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
        # Tax is optional and never guessed — an omitted/blank value means "no tax",
        # not an auto-computed rate. Only a value the user actually typed gets validated.
        raw_tax = request.data.get("tax_amount")
        try:
            tax_amount = parse_money(raw_tax, "Tax Amount") if raw_tax not in (None, "") else Decimal("0")
            valid_until = parse_required_date(request.data.get("valid_until") or (today + timedelta(days=15)), "Valid Until")
        except FieldValidationError as exc:
            return api_error(exc.message)
        if valid_until < today:
            return api_error("Valid Until cannot be earlier than today's Quotation Date.")

        with transaction.atomic():
            # No quotation_number here — the actual quotation is created in a separate
            # application; the user can optionally record its number afterward via PATCH.
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
                update_fields = ["status"]
                # The guarded Prepared->Shared transition is the normal way this gets
                # marked shared; the field also stays independently PATCH-able below
                # for the (rarer) case sharing happened out-of-band and needs recording
                # after the fact — but it can never be True while still Not Prepared.
                if data["status"] == "Shared":
                    quotation.quotation_shared = True
                    update_fields.append("quotation_shared")
                quotation.save(update_fields=update_fields)
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
# Internal reference documents — Quotation/Order/Invoice each carry at most ONE
# attached document (see AttachmentBase's OneToOneField subclasses in models.py).
# A new upload replaces whatever was there before. One generic base view pair
# handles all three; ATTACHMENT_META is the only per-kind configuration needed.
# ---------------------------------------------------------------------------

def safe_delete_file(file_field):
    """attachment.file.delete() can raise on Windows if the file still has an open
    handle (e.g. a download response that hasn't finished closing it yet) — a
    transiently-locked file on disk is not worth failing the user's delete/replace
    action over. The database row (the actual source of truth for "is there an
    attachment") is removed either way; a storage-level failure here is best-effort."""
    try:
        file_field.delete(save=False)
    except OSError:
        pass


ATTACHMENT_META = {
    "quotation": {
        "model": QuotationAttachment,
        "added_label": "Quotation Attachment Added",
        "replaced_label": "Quotation Attachment Replaced",
        "removed_label": "Quotation Attachment Removed",
    },
    "order": {
        "model": OrderAttachment,
        "added_label": "PO/Order Document Added",
        "replaced_label": "PO/Order Document Replaced",
        "removed_label": "PO/Order Document Removed",
    },
    "invoice": {
        "model": InvoiceAttachment,
        "added_label": "Invoice Document Added",
        "replaced_label": "Invoice Document Replaced",
        "removed_label": "Invoice Document Removed",
    },
}


class BaseAttachmentAPIView(APIView):
    """GET/POST/DELETE /api/enquiries/<pk>/<kind>/attachment/ — metadata for the
    single reference document attached to this enquiry's Quotation/Order/Invoice.
    Subclasses just set `kind`. GET returns null when none exists yet (not a 404 —
    "no attachment" is the normal, common state, not an error)."""

    kind = None  # set by concrete subclasses: "quotation" | "order" | "invoice"

    def get_enquiry(self, pk):
        return get_object_or_404(Enquiry.objects.select_related("quotation", "order", "invoice"), pk=pk)

    def get_parent(self, enquiry):
        return getattr(enquiry, self.kind)

    def get(self, request, pk):
        meta = ATTACHMENT_META[self.kind]
        parent = self.get_parent(self.get_enquiry(pk))
        attachment = meta["model"].objects.select_related("uploaded_by").filter(**{self.kind: parent}).first()
        return Response(AttachmentSerializer(attachment).data if attachment else None)

    def post(self, request, pk):
        enquiry = self.get_enquiry(pk)
        parent = self.get_parent(enquiry)
        meta = ATTACHMENT_META[self.kind]

        f = request.FILES.get("file")
        if not f:
            return api_error("Select a file to upload.")

        serializer = AttachmentUploadSerializer(data={"file": f})
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            existing = meta["model"].objects.filter(**{self.kind: parent}).first()
            replacing = existing is not None
            if existing:
                safe_delete_file(existing.file)
                existing.delete()
            attachment = meta["model"].objects.create(
                **{self.kind: parent},
                file=f,
                original_filename=os.path.basename(f.name)[:255],
                file_size=f.size,
                content_type=(f.content_type or "")[:100],
                uploaded_by=request.user,
            )
            log_activity(
                enquiry,
                meta["replaced_label"] if replacing else meta["added_label"],
                user=request.user,
                description=attachment.original_filename,
            )

        return Response(AttachmentSerializer(attachment).data, status=status.HTTP_201_CREATED)

    def delete(self, request, pk):
        enquiry = self.get_enquiry(pk)
        parent = self.get_parent(enquiry)
        meta = ATTACHMENT_META[self.kind]
        attachment = meta["model"].objects.filter(**{self.kind: parent}).first()
        if not attachment:
            return api_error("There is no document to remove.", status.HTTP_404_NOT_FOUND)
        filename = attachment.original_filename
        with transaction.atomic():
            safe_delete_file(attachment.file)
            attachment.delete()
            log_activity(enquiry, meta["removed_label"], user=request.user, description=filename)
        return Response(status=status.HTTP_204_NO_CONTENT)


class QuotationAttachmentAPIView(BaseAttachmentAPIView):
    kind = "quotation"


class OrderAttachmentAPIView(BaseAttachmentAPIView):
    kind = "order"


class InvoiceAttachmentAPIView(BaseAttachmentAPIView):
    kind = "invoice"


class BaseAttachmentDownloadAPIView(APIView):
    """GET /api/enquiries/<pk>/<kind>/attachment/download/ — streams the file through
    an authenticated view rather than a public MEDIA_URL path, so JWT auth (enforced by
    the project-wide IsAuthenticated default) actually gates file access, not just the
    metadata JSON. ?inline=1 requests an inline (View) disposition instead of a forced
    download, for file types the browser can render directly (PDF/images)."""

    kind = None

    def get(self, request, pk):
        meta = ATTACHMENT_META[self.kind]
        enquiry = get_object_or_404(Enquiry.objects.select_related("quotation", "order", "invoice"), pk=pk)
        parent = getattr(enquiry, self.kind)
        attachment = meta["model"].objects.filter(**{self.kind: parent}).first()
        if not attachment or not attachment.file or not attachment.file.storage.exists(attachment.file.name):
            return api_error("The file for this document is no longer available.", status.HTTP_404_NOT_FOUND)

        inline = str(request.query_params.get("inline", "")).lower() in ("1", "true", "yes")
        return FileResponse(
            attachment.file.open("rb"),
            as_attachment=not inline,
            filename=attachment.original_filename,
            content_type=attachment.content_type or None,
        )


class QuotationAttachmentDownloadAPIView(BaseAttachmentDownloadAPIView):
    kind = "quotation"


class OrderAttachmentDownloadAPIView(BaseAttachmentDownloadAPIView):
    kind = "order"


class InvoiceAttachmentDownloadAPIView(BaseAttachmentDownloadAPIView):
    kind = "invoice"


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
        if today < enquiry.enquiry_date:
            return api_error("Order Date cannot be earlier than the Enquiry Date.")
        po_number = (request.data.get("po_number") or "").strip()
        if len(po_number) > MAX_DOCUMENT_NUMBER_LENGTH:
            return api_error(f"PO Number cannot exceed {MAX_DOCUMENT_NUMBER_LENGTH} characters.")
        if po_number and not DOCUMENT_NUMBER_RE.match(po_number):
            return api_error("PO Number can only contain letters, numbers, hyphens, slashes and underscores.")
        try:
            po_date = parse_required_date(request.data.get("po_date") or today, "PO Date")
        except FieldValidationError as exc:
            return api_error(exc.message)
        # The PO is created externally, often before this tracking application even
        # records the enquiry/quotation — only a future date is actually invalid.
        if po_date > timezone.localdate():
            return api_error("PO Date cannot be a future date.")

        with transaction.atomic():
            # No order_number here — the actual order/PO is created in a separate
            # application; the user can optionally record its number afterward via PATCH.
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

# Payment Status follows Not Paid -> Partially Paid -> Paid; Paid is a terminal state
# that can never move backward. "Overdue" is a separate not-yet-settled marker rather
# than part of this forward-only chain, so it isn't restricted by this rule.
def payment_status_backward_error(current, requested):
    if current == requested:
        return None
    if current == "Paid":
        return "Paid invoices cannot be moved to an earlier payment status."
    if current == "Partially Paid" and requested == "Not Paid":
        return "Payment Status cannot move back from Partially Paid to Not Paid."
    return None


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
        with transaction.atomic():
            # No invoice_number here — the actual invoice is created in a separate
            # billing system; the user can optionally record its number afterward via PATCH.
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

            status_changing = "payment_status" in data and data["payment_status"] != invoice.payment_status
            amount_changing = "amount_paid" in data
            if status_changing or amount_changing:
                current_status = invoice.payment_status
                new_payment_status = data["payment_status"] if status_changing else current_status

                if status_changing:
                    valid_payment_statuses = dict(Invoice.PAYMENT_STATUS_CHOICES)
                    if new_payment_status not in valid_payment_statuses:
                        raise serializers.ValidationError(
                            {"payment_status": [f"Payment Status must be one of: {', '.join(valid_payment_statuses)}."]}
                        )
                    backward_error = payment_status_backward_error(current_status, new_payment_status)
                    if backward_error:
                        raise serializers.ValidationError({"payment_status": [backward_error]})

                if new_payment_status == "Paid":
                    # A Paid invoice is, by definition, paid in full — never trust a
                    # client-supplied amount for it, just confirm it isn't contradicted.
                    if amount_changing:
                        try:
                            requested_amount = parse_money(data["amount_paid"], "Amount Paid")
                        except FieldValidationError as exc:
                            raise serializers.ValidationError({"amount_paid": [exc.message]})
                        if requested_amount != invoice.value:
                            raise serializers.ValidationError(
                                {"amount_paid": ["Amount Paid must equal Invoice Value for a paid invoice."]}
                            )
                    if status_changing:
                        invoice.amount_paid = invoice.value
                        invoice.payment_date = date.today()
                        invoice.payment_status = new_payment_status
                        invoice.save(update_fields=["payment_status", "payment_date", "amount_paid"])
                        log_activity(enquiry, "Payment Received in Full", user=request.user)
                    # else: status was already Paid and isn't changing — amount_paid
                    # was already confirmed above to equal the invoice value, so there
                    # is nothing left to persist.
                else:
                    if amount_changing:
                        try:
                            requested_amount = parse_money(data["amount_paid"], "Amount Paid")
                        except FieldValidationError as exc:
                            raise serializers.ValidationError({"amount_paid": [exc.message]})
                        if requested_amount > invoice.value:
                            raise serializers.ValidationError(
                                {"amount_paid": ["Amount Paid cannot exceed Invoice Value."]}
                            )
                        invoice.amount_paid = requested_amount
                    elif status_changing and new_payment_status == "Not Paid":
                        invoice.amount_paid = 0

                    if status_changing:
                        # Only a fully-Paid invoice carries a payment date — any other
                        # status means the balance (or all of it) is still outstanding.
                        invoice.payment_date = None
                        invoice.payment_status = new_payment_status
                        label = "Payment Partially Received" if new_payment_status == "Partially Paid" else f"Payment Status Updated to {new_payment_status}"
                        invoice.save(update_fields=["payment_status", "payment_date", "amount_paid"])
                        log_activity(enquiry, label, user=request.user)
                    elif amount_changing:
                        invoice.save(update_fields=["amount_paid"])

            editable_data = {k: v for k, v in data.items() if k not in ("status", "payment_status", "amount_paid")}
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
    every enquiry (default 8, capped at 50), for the dashboard's compact preview widget.
    The full, paginated/searchable/filterable log lives at ActivityHistoryAPIView below."""

    def get(self, request):
        try:
            limit = min(max(int(request.query_params.get("limit", 8)), 1), 50)
        except (TypeError, ValueError):
            limit = 8
        activities = (
            Activity.objects.select_related("enquiry", "enquiry__customer", "created_by")
            .order_by("-created_at")[:limit]
        )
        return Response({"results": RecentActivitySerializer(activities, many=True).data})


class ActivityHistoryAPIView(APIView):
    """GET /api/enquiries/activity/ — the complete activity audit log: paginated,
    searchable, filterable and sortable. Never loads the full table into memory."""

    def get(self, request):
        queryset = Activity.objects.select_related("enquiry", "enquiry__customer", "created_by")

        search = request.query_params.get("search", "").strip()[:100]
        if search:
            queryset = queryset.filter(
                Q(enquiry__enquiry_number__icontains=search)
                | Q(enquiry__customer__company_name__icontains=search)
                | Q(action__icontains=search)
                | Q(description__icontains=search)
                | Q(created_by__username__icontains=search)
                | Q(created_by__first_name__icontains=search)
                | Q(created_by__last_name__icontains=search)
            )

        queryset = ActivityFilter(request.query_params, queryset=queryset).qs.distinct()

        ordering = "created_at" if request.query_params.get("ordering") == "created_at" else "-created_at"
        queryset = queryset.order_by(ordering, "-id")

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = RecentActivitySerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
