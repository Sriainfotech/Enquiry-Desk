import os
import re
from datetime import date
from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from customers.models import Customer

from .models import Activity, Enquiry, Invoice, Order, Quotation, Requirement

MONEY_VALIDATORS = [MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("999999999.99"))]
MONEY_KWARGS = dict(max_digits=14, decimal_places=2, validators=MONEY_VALIDATORS)

ALLOWED_ATTACHMENT_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png"]
MAX_ATTACHMENT_SIZE_MB = 10


MAX_DOCUMENT_NUMBER_LENGTH = 30
# Quotation/PO/Invoice numbers come from external systems this app doesn't generate.
# Letters (either case)/digits/hyphen/slash/underscore covers real-world formats like
# "INV-2026-0043" and "INV/2026/4387"; no spaces or other special characters.
DOCUMENT_NUMBER_RE = re.compile(r"^[A-Za-z0-9\-_/]+$")


def normalize_optional_number(value, label):
    """Trim whitespace and collapse a blank entry to None (real SQL NULL) rather than
    "", so multiple untracked records don't collide against each other's unique
    constraint the way two empty strings would — then enforce the external document
    number format (length + allowed characters) on whatever's left."""
    value = (value or "").strip()
    if not value:
        return None
    if len(value) > MAX_DOCUMENT_NUMBER_LENGTH:
        raise serializers.ValidationError(f"{label} cannot exceed {MAX_DOCUMENT_NUMBER_LENGTH} characters.")
    if not DOCUMENT_NUMBER_RE.match(value):
        raise serializers.ValidationError(
            f"{label} can only contain letters, numbers, hyphens, slashes and underscores."
        )
    return value


def document_number_field(model, message):
    """A CharField for an externally-sourced, optional, unique document number.
    Declared explicitly (rather than left to ModelSerializer's auto-generation) so it
    can be null/blank — but that means DRF won't auto-attach its usual UniqueValidator,
    so it's added back here explicitly to still catch a duplicate with a clean 400
    instead of an unhandled IntegrityError."""
    return serializers.CharField(
        required=False, allow_null=True, allow_blank=True, max_length=MAX_DOCUMENT_NUMBER_LENGTH,
        validators=[UniqueValidator(queryset=model.objects.all(), message=message)],
    )

# Declared Content-Type is trivially wrong/inconsistent across browsers (especially for
# legacy Office formats), so it's only ever used as a soft signal — a missing or generic
# value never blocks an upload. The magic-byte check below is the real security boundary.
ATTACHMENT_CONTENT_TYPES = {
    "pdf": {"application/pdf"},
    "doc": {"application/msword"},
    "docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip"},
    "xls": {"application/vnd.ms-excel"},
    "xlsx": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip"},
    "jpg": {"image/jpeg"},
    "jpeg": {"image/jpeg"},
    "png": {"image/png"},
}
GENERIC_CONTENT_TYPES = {"application/octet-stream", ""}

# First-bytes signatures so a renamed executable (e.g. payload.exe -> payload.pdf) is
# rejected even though its extension and declared Content-Type both look legitimate.
# DOC/XLS share the OLE compound-file signature; DOCX/XLSX share the plain ZIP signature —
# neither pair is distinguishable without fully parsing the container, which isn't
# necessary here since the goal is catching disguised binaries, not format forgery.
ATTACHMENT_MAGIC_SIGNATURES = {
    "pdf": [b"%PDF"],
    "doc": [b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"],
    "xls": [b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"],
    "docx": [b"PK\x03\x04"],
    "xlsx": [b"PK\x03\x04"],
    "jpg": [b"\xff\xd8\xff"],
    "jpeg": [b"\xff\xd8\xff"],
    "png": [b"\x89PNG\r\n\x1a\n"],
}


def human_file_size(num_bytes):
    size = float(num_bytes or 0)
    for unit in ("B", "KB", "MB"):
        if size < 1024:
            return f"{size:.0f} {unit}" if unit == "B" else f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} GB"


def validate_attachment_file(uploaded_file):
    """Extension + declared-type + magic-byte + size checks for a single uploaded file.
    Shared by the upload serializer below — the extension alone is trivially spoofed
    by renaming a file, so this is the real gate for quotation attachment uploads."""
    name = os.path.basename(uploaded_file.name or "")
    if not name:
        raise serializers.ValidationError("A file name is required.")
    if len(name) > 255:
        raise serializers.ValidationError("Filename is too long (maximum 255 characters).")

    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if ext not in ALLOWED_ATTACHMENT_EXTENSIONS:
        raise serializers.ValidationError(
            f"Unsupported file type. Allowed: {', '.join(ALLOWED_ATTACHMENT_EXTENSIONS)}."
        )

    if uploaded_file.size == 0:
        raise serializers.ValidationError("The selected file is empty.")
    if uploaded_file.size > MAX_ATTACHMENT_SIZE_MB * 1024 * 1024:
        raise serializers.ValidationError(f"File size must not exceed {MAX_ATTACHMENT_SIZE_MB}MB.")

    declared = (uploaded_file.content_type or "").split(";")[0].strip().lower()
    if declared not in GENERIC_CONTENT_TYPES and declared not in ATTACHMENT_CONTENT_TYPES.get(ext, set()):
        raise serializers.ValidationError("The file's content type doesn't match its extension.")

    header = uploaded_file.read(8)
    uploaded_file.seek(0)
    signatures = ATTACHMENT_MAGIC_SIGNATURES.get(ext, [])
    if signatures and not any(header.startswith(sig) for sig in signatures):
        raise serializers.ValidationError("The file's content doesn't match its extension — it may be renamed or corrupted.")

    return name


HTML_TAG_RE = re.compile(r"<[^>]*>")
# Control characters other than tab/newline/carriage-return, which are legitimate in
# multi-line free text (remarks/descriptions) — the NUL byte is covered by this range too.
CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]")


def validate_free_text(value, label):
    """Shared safety net for multiline/free-text fields (remarks, descriptions) — still
    allows normal business punctuation and line breaks, but blocks HTML tags and
    non-printable control characters that have no legitimate business use here."""
    if HTML_TAG_RE.search(value):
        raise serializers.ValidationError(f"{label} cannot contain HTML tags.")
    if CONTROL_CHAR_RE.search(value):
        raise serializers.ValidationError(f"{label} contains invalid control characters.")
    return value

# Product/service names legitimately contain digits and light punctuation
# ("Laptop 14-inch", "Cisco Switch 24 Port", "CCTV Camera 4MP").
ITEM_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 .,&/()-]*$")
# Sales person is free text (not tied to a User FK in the current schema), but should
# still read as a human name, not arbitrary/garbage input.
SALES_PERSON_RE = re.compile(r"^[A-Za-z][A-Za-z .'-]*$")

# Discrete-count units can't have a fractional quantity ("2.5 Nos" doesn't mean anything);
# "Meter" is a physical measurement and legitimately can (e.g. 2.5 meters of cable).
WHOLE_NUMBER_UNITS = {"Nos", "Set", "Box", "License", "Service"}


class CustomerMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ["id", "customer_code", "company_name", "contact_person", "mobile", "email", "gst_number"]


class RequirementSerializer(serializers.ModelSerializer):
    total = serializers.DecimalField(max_digits=16, decimal_places=2, read_only=True)

    class Meta:
        model = Requirement
        fields = ["id", "item", "description", "quantity", "unit", "unit_price", "total"]

    def validate_item(self, value):
        value = re.sub(r"\s+", " ", value.strip())
        if len(value) < 2:
            raise serializers.ValidationError("Item must be at least 2 characters.")
        if len(value) > 100:
            raise serializers.ValidationError("Item cannot exceed 100 characters.")
        if not ITEM_RE.match(value):
            raise serializers.ValidationError("Item contains characters that aren't allowed.")
        return value

    def validate_description(self, value):
        value = value.strip()
        if len(value) > 500:
            raise serializers.ValidationError("Description cannot exceed 500 characters.")
        return validate_free_text(value, "Description")

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be greater than zero.")
        if value > 999999:
            raise serializers.ValidationError("Quantity cannot exceed 999999.")
        return value

    def validate_unit_price(self, value):
        if value < 0:
            raise serializers.ValidationError("Unit price cannot be negative.")
        if value > Decimal("999999999.99"):
            raise serializers.ValidationError("Unit price is too large.")
        return value

    def validate(self, attrs):
        quantity = attrs.get("quantity", getattr(self.instance, "quantity", None))
        unit = attrs.get("unit", getattr(self.instance, "unit", None))
        if quantity is not None and unit in WHOLE_NUMBER_UNITS and quantity != quantity.to_integral_value():
            raise serializers.ValidationError(
                {"quantity": f"Quantity must be a whole number for unit '{unit}'."}
            )
        return attrs


class QuotationSerializer(serializers.ModelSerializer):
    value = serializers.DecimalField(**MONEY_KWARGS)
    # Tax is optional — not every quotation carries one, and this app never guesses a
    # rate on the user's behalf. A missing/null/blank value normalizes to 0 rather than
    # blocking the save; a provided value still goes through the normal money bounds.
    tax_amount = serializers.DecimalField(**MONEY_KWARGS, required=False, allow_null=True)
    remarks = serializers.CharField(required=False, allow_blank=True, max_length=500)
    quotation_shared = serializers.BooleanField(required=False)
    # Optional and manually entered — this app doesn't generate the quotation itself,
    # so it never generates the number either. See normalize_optional_number below.
    quotation_number = document_number_field(Quotation, "This quotation number is already in use.")

    class Meta:
        model = Quotation
        fields = [
            "quotation_number", "quotation_date", "value", "tax_amount",
            "total_value", "valid_until", "status", "quotation_shared", "remarks",
        ]
        read_only_fields = ["quotation_date", "total_value", "status"]

    def validate_quotation_number(self, value):
        return normalize_optional_number(value, "Quotation Number")

    def validate_tax_amount(self, value):
        return value if value is not None else Decimal("0")

    def validate_remarks(self, value):
        return validate_free_text(value.strip(), "Remarks")

    def validate(self, attrs):
        # `status` itself is read-only here — the guarded Draft->Prepared->Shared->...
        # transitions are applied directly on the model by QuotationAPIView.patch
        # *before* this serializer runs, so self.instance.status already reflects
        # whatever the request just transitioned it to.
        instance_status = self.instance.status if self.instance else "Not Prepared"
        quotation_date = self.instance.quotation_date if self.instance else None

        valid_until = attrs.get("valid_until")
        if valid_until and quotation_date and valid_until < quotation_date:
            raise serializers.ValidationError({"valid_until": "Valid Until cannot be earlier than the Quotation Date."})
        if "valid_until" in attrs and not valid_until and instance_status != "Not Prepared":
            raise serializers.ValidationError({"valid_until": "Valid Until is required once the quotation has been prepared."})

        if "quotation_shared" in attrs:
            resolved_shared = attrs["quotation_shared"]
        elif self.instance:
            resolved_shared = self.instance.quotation_shared
        else:
            resolved_shared = False
        if resolved_shared and instance_status == "Not Prepared":
            raise serializers.ValidationError(
                {"quotation_shared": "Quotation must be prepared before it can be marked as shared."}
            )

        return attrs


class AttachmentSerializer(serializers.Serializer):
    """Read shape for a single reference document — metadata only, shared by the
    Quotation/Order/Invoice attachment endpoints (see BaseAttachmentAPIView in
    views.py). A plain Serializer rather than ModelSerializer since it's used against
    three different concrete models (QuotationAttachment/OrderAttachment/
    InvoiceAttachment) that all expose the same attribute names. No filesystem path is
    exposed; the frontend downloads/views via the dedicated per-entity download endpoint
    (built from the enquiry id it already has)."""

    id = serializers.IntegerField(read_only=True)
    original_filename = serializers.CharField(read_only=True)
    file_size = serializers.IntegerField(read_only=True)
    file_size_display = serializers.SerializerMethodField()
    content_type = serializers.CharField(read_only=True)
    file_type = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(read_only=True)

    def get_file_size_display(self, obj):
        return human_file_size(obj.file_size)

    def get_file_type(self, obj):
        name = obj.original_filename or ""
        return name.rsplit(".", 1)[-1].upper() if "." in name else ""

    def get_uploaded_by_name(self, obj):
        if not obj.uploaded_by:
            return None
        return obj.uploaded_by.get_full_name() or obj.uploaded_by.username


class AttachmentUploadSerializer(serializers.Serializer):
    """Validates a single uploaded file for any of the Quotation/Order/Invoice
    attachment endpoints. `uploaded_by`/`file_size`/`content_type` are never accepted
    from the client — the view derives them from request.user and the file object
    itself after this validation passes."""

    file = serializers.FileField()

    def validate_file(self, value):
        validate_attachment_file(value)
        return value


class OrderSerializer(serializers.ModelSerializer):
    value = serializers.DecimalField(**MONEY_KWARGS)
    po_number = serializers.CharField(required=False, allow_blank=True, max_length=MAX_DOCUMENT_NUMBER_LENGTH)
    remarks = serializers.CharField(required=False, allow_blank=True, max_length=500)
    # Optional and manually entered — this app doesn't generate the order/PO itself,
    # so it never generates the number either. See normalize_optional_number below.
    order_number = document_number_field(Order, "This order number is already in use.")

    class Meta:
        model = Order
        fields = [
            "order_number", "order_date", "po_number", "po_date", "expected_delivery_date",
            "value", "status", "remarks",
        ]
        read_only_fields = ["order_date", "value", "status"]

    def validate_order_number(self, value):
        return normalize_optional_number(value, "Order Number")

    def validate_po_number(self, value):
        value = value.strip()
        if not value:
            return value
        if not DOCUMENT_NUMBER_RE.match(value):
            raise serializers.ValidationError(
                "PO Number can only contain letters, numbers, hyphens, slashes and underscores."
            )
        return value

    def validate_remarks(self, value):
        return validate_free_text(value.strip(), "Remarks")

    def validate(self, attrs):
        po_date = attrs.get("po_date")
        order_date = self.instance.order_date if self.instance else None
        if po_date and order_date and po_date > order_date:
            raise serializers.ValidationError({"po_date": "PO Date cannot be later than the Order Date."})

        expected_delivery = attrs.get("expected_delivery_date")
        reference_date = order_date or po_date
        if expected_delivery and reference_date and expected_delivery < reference_date:
            raise serializers.ValidationError(
                {"expected_delivery_date": "Expected Delivery Date cannot be earlier than the Order Date."}
            )
        return attrs


class InvoiceSerializer(serializers.ModelSerializer):
    value = serializers.DecimalField(**MONEY_KWARGS)
    remarks = serializers.CharField(required=False, allow_blank=True, max_length=500)
    # Optional and manually entered — this app doesn't generate the invoice itself,
    # so it never generates the number either. See normalize_optional_number below.
    invoice_number = document_number_field(Invoice, "This invoice number is already in use.")

    class Meta:
        model = Invoice
        fields = [
            "invoice_number", "invoice_date", "value", "status", "payment_status",
            "due_date", "payment_date", "remarks",
        ]
        read_only_fields = ["invoice_date", "value", "status", "payment_status", "payment_date"]

    def validate_invoice_number(self, value):
        return normalize_optional_number(value, "Invoice Number")

    def validate_remarks(self, value):
        return validate_free_text(value.strip(), "Remarks")

    def validate(self, attrs):
        due_date = attrs.get("due_date")
        invoice_date = self.instance.invoice_date if self.instance else None
        if due_date and invoice_date and due_date < invoice_date:
            raise serializers.ValidationError({"due_date": "Due Date cannot be earlier than the Invoice Date."})
        return attrs


class ActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Activity
        fields = ["id", "action", "description", "created_at"]


class DashboardCustomerSerializer(serializers.ModelSerializer):
    """Minimal shape for the dashboard's Recent Customers widget — not the full
    CustomerSerializer, since that widget only ever shows a handful of fields."""

    class Meta:
        model = Customer
        fields = ["id", "customer_code", "company_name", "contact_person", "created_at", "is_active"]


class RecentActivitySerializer(serializers.ModelSerializer):
    """Flat, dashboard/activity-log-friendly shape — pulls in just enough from the
    related Enquiry/Customer/User to render a row without a second round-trip."""

    enquiry_number = serializers.CharField(source="enquiry.enquiry_number", read_only=True)
    customer_id = serializers.IntegerField(source="enquiry.customer_id", read_only=True)
    customer_name = serializers.CharField(source="enquiry.customer.company_name", read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Activity
        fields = [
            "id", "action", "description", "enquiry", "enquiry_number",
            "customer_id", "customer_name", "created_by_name", "created_at",
        ]

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return None
        return obj.created_by.get_full_name() or obj.created_by.username


class EnquiryListSerializer(serializers.ModelSerializer):
    customer_detail = CustomerMiniSerializer(source="customer", read_only=True)
    quotation = QuotationSerializer(read_only=True)
    order = OrderSerializer(read_only=True)
    invoice = InvoiceSerializer(read_only=True)
    first_requirement = serializers.SerializerMethodField()
    total_quantity = serializers.SerializerMethodField()

    class Meta:
        model = Enquiry
        fields = [
            "id", "enquiry_number", "customer", "customer_detail", "enquiry_date", "business_line",
            "status", "quotation", "order", "invoice", "first_requirement", "total_quantity", "created_at",
        ]

    def get_first_requirement(self, obj):
        first = obj.requirements.all()[:1]
        return first[0].item if first else None

    def get_total_quantity(self, obj):
        return sum((r.quantity for r in obj.requirements.all()), 0)


class EnquiryDetailSerializer(serializers.ModelSerializer):
    customer_detail = CustomerMiniSerializer(source="customer", read_only=True)
    requirements = RequirementSerializer(many=True, read_only=True)
    quotation = QuotationSerializer(read_only=True)
    order = OrderSerializer(read_only=True)
    invoice = InvoiceSerializer(read_only=True)
    activities = ActivitySerializer(many=True, read_only=True)
    requirement_total = serializers.SerializerMethodField()

    class Meta:
        model = Enquiry
        fields = [
            "id", "enquiry_number", "customer", "customer_detail", "enquiry_date", "business_line",
            "enquiry_source", "priority", "sales_person", "expected_closing_date", "remarks", "status",
            "requirements", "requirement_total", "quotation", "order", "invoice", "activities",
            "created_at", "updated_at",
        ]

    def get_requirement_total(self, obj):
        return sum((r.total for r in obj.requirements.all()), 0)


class EnquiryWriteSerializer(serializers.ModelSerializer):
    customer = serializers.PrimaryKeyRelatedField(queryset=Customer.objects.filter(is_active=True))
    sales_person = serializers.CharField(required=False, allow_blank=True, max_length=50)
    remarks = serializers.CharField(required=False, allow_blank=True, max_length=500)

    class Meta:
        model = Enquiry
        fields = [
            "customer", "enquiry_date", "business_line", "enquiry_source", "priority",
            "sales_person", "expected_closing_date", "remarks", "status",
        ]

    def validate_sales_person(self, value):
        value = re.sub(r"\s+", " ", value.strip())
        if not value:
            return value
        if len(value) < 2:
            raise serializers.ValidationError("Sales person must be at least 2 characters.")
        if not SALES_PERSON_RE.match(value):
            raise serializers.ValidationError("Sales person can only contain letters, spaces, apostrophes and hyphens.")
        return value

    def validate_remarks(self, value):
        return validate_free_text(value.strip(), "Remarks")

    def validate_enquiry_date(self, value):
        if value > date.today():
            raise serializers.ValidationError("Enquiry date cannot be in the future.")
        return value

    def validate(self, attrs):
        expected_closing = attrs.get("expected_closing_date")
        enquiry_date = attrs.get("enquiry_date") or (self.instance.enquiry_date if self.instance else None)
        if expected_closing and enquiry_date and expected_closing < enquiry_date:
            raise serializers.ValidationError({"expected_closing_date": "Expected Closing Date cannot be earlier than the Enquiry Date."})
        return attrs


class RequirementWriteSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = Requirement
        fields = ["id", "item", "description", "quantity", "unit", "unit_price"]

    def validate_item(self, value):
        value = re.sub(r"\s+", " ", value.strip())
        if len(value) < 2:
            raise serializers.ValidationError("Item must be at least 2 characters.")
        if len(value) > 100:
            raise serializers.ValidationError("Item cannot exceed 100 characters.")
        if not ITEM_RE.match(value):
            raise serializers.ValidationError("Item contains characters that aren't allowed.")
        return value

    def validate_description(self, value):
        value = value.strip()
        if len(value) > 500:
            raise serializers.ValidationError("Description cannot exceed 500 characters.")
        return validate_free_text(value, "Description")

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be greater than zero.")
        if value > 999999:
            raise serializers.ValidationError("Quantity cannot exceed 999999.")
        return value

    def validate_unit_price(self, value):
        if value < 0:
            raise serializers.ValidationError("Unit price cannot be negative.")
        if value > Decimal("999999999.99"):
            raise serializers.ValidationError("Unit price is too large.")
        return value

    def validate(self, attrs):
        quantity = attrs.get("quantity", getattr(self.instance, "quantity", None))
        unit = attrs.get("unit", getattr(self.instance, "unit", None))
        if quantity is not None and unit in WHOLE_NUMBER_UNITS and quantity != quantity.to_integral_value():
            raise serializers.ValidationError(
                {"quantity": f"Quantity must be a whole number for unit '{unit}'."}
            )
        return attrs
