import uuid
from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models, transaction
from django.utils import timezone

from customers.models import Customer

MONEY_VALIDATORS = [MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("999999999.99"))]


class DocumentSequence(models.Model):
    """Generic, transaction-safe counter used to generate sequential document numbers
    (enquiry/quotation/order/invoice) without trusting client-supplied values."""

    key = models.CharField(max_length=30, unique=True)
    last_number = models.PositiveIntegerField(default=0)

    @classmethod
    def next_number(cls, key):
        with transaction.atomic():
            seq, _ = cls.objects.select_for_update().get_or_create(key=key)
            seq.last_number += 1
            seq.save(update_fields=["last_number"])
            return seq.last_number


class Enquiry(models.Model):
    BUSINESS_LINE_CHOICES = [(v, v) for v in [
        "Laptop Sales", "Desktop Sales", "Networking", "CCTV", "Software Services",
        "Cloud Services", "AMC", "IT Support", "Hardware", "Cyber Security", "Other",
    ]]
    SOURCE_CHOICES = [(v, v) for v in [
        "Website", "Referral", "Cold Call", "Email", "Phone", "Walk-in",
        "Existing Client", "Exhibition", "Social Media", "Other",
    ]]
    PRIORITY_CHOICES = [(v, v) for v in ["Low", "Medium", "High", "Urgent"]]
    STATUS_CHOICES = [(v, v) for v in [
        "New", "In Progress", "Quotation Prepared", "Quotation Shared",
        "Negotiation", "Won", "Lost", "Cancelled",
    ]]

    enquiry_number = models.CharField(max_length=20, unique=True, db_index=True, editable=False)
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="enquiries")
    enquiry_date = models.DateField(db_index=True)
    business_line = models.CharField(max_length=50, choices=BUSINESS_LINE_CHOICES, db_index=True)
    enquiry_source = models.CharField(max_length=30, choices=SOURCE_CHOICES, blank=True)
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default="Medium")
    sales_person = models.CharField(max_length=150, blank=True)
    expected_closing_date = models.DateField(null=True, blank=True)
    remarks = models.TextField(blank=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="New", db_index=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="enquiries_created"
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-enquiry_date", "-id"]
        verbose_name_plural = "Enquiries"

    def save(self, *args, **kwargs):
        if not self.enquiry_number:
            self.enquiry_number = f"ENQ-{str(DocumentSequence.next_number('ENQ')).zfill(5)}"
        super().save(*args, **kwargs)

    def __str__(self):
        return self.enquiry_number


class Requirement(models.Model):
    UNIT_CHOICES = [(v, v) for v in ["Nos", "Set", "Box", "License", "Service", "Meter"]]

    enquiry = models.ForeignKey(Enquiry, on_delete=models.CASCADE, related_name="requirements")
    item = models.CharField(max_length=255)
    description = models.CharField(max_length=500, blank=True)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    unit = models.CharField(max_length=20, choices=UNIT_CHOICES, default="Nos")
    unit_price = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    @property
    def total(self):
        return self.quantity * self.unit_price

    def __str__(self):
        return f"{self.item} ({self.enquiry.enquiry_number})"


class Quotation(models.Model):
    STATUS_CHOICES = [(v, v) for v in [
        "Not Prepared", "Draft", "Prepared", "Shared", "Accepted", "Rejected", "Expired",
    ]]

    enquiry = models.OneToOneField(Enquiry, on_delete=models.CASCADE, related_name="quotation")
    # Not auto-generated — the actual quotation is created in a separate application;
    # this is an optional manual note of that external document's number, if known.
    quotation_number = models.CharField(max_length=30, unique=True, null=True, blank=True)
    quotation_date = models.DateField(null=True, blank=True)
    value = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_value = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    valid_until = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Not Prepared", db_index=True)
    # Tracked independently of `status` — this app only records that sharing happened
    # (often out-of-band, e.g. over email/WhatsApp from the separate quotation-generation
    # tool), it doesn't drive or replace the guarded status transitions below.
    quotation_shared = models.BooleanField(default=False)
    remarks = models.TextField(blank=True)

    def __str__(self):
        return self.quotation_number or f"Quotation for {self.enquiry.enquiry_number}"


class Order(models.Model):
    STATUS_CHOICES = [(v, v) for v in [
        "Not Converted", "Pending", "Confirmed", "Partially Confirmed", "Cancelled", "Completed",
    ]]

    enquiry = models.OneToOneField(Enquiry, on_delete=models.CASCADE, related_name="order")
    # Not auto-generated — see Quotation.quotation_number.
    order_number = models.CharField(max_length=30, unique=True, null=True, blank=True)
    order_date = models.DateField(null=True, blank=True)
    po_number = models.CharField(max_length=30, blank=True)
    po_date = models.DateField(null=True, blank=True)
    expected_delivery_date = models.DateField(null=True, blank=True)
    value = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    status = models.CharField(max_length=25, choices=STATUS_CHOICES, default="Not Converted", db_index=True)
    remarks = models.TextField(blank=True)

    def __str__(self):
        return self.order_number or f"Order for {self.enquiry.enquiry_number}"


class Invoice(models.Model):
    STATUS_CHOICES = [(v, v) for v in ["Not Generated", "Draft", "Generated", "Sent", "Cancelled"]]
    PAYMENT_STATUS_CHOICES = [(v, v) for v in ["Not Paid", "Partially Paid", "Paid", "Overdue"]]

    enquiry = models.OneToOneField(Enquiry, on_delete=models.CASCADE, related_name="invoice")
    # Not auto-generated — see Quotation.quotation_number.
    invoice_number = models.CharField(max_length=30, unique=True, null=True, blank=True)
    invoice_date = models.DateField(null=True, blank=True)
    value = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Not Generated", db_index=True)
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default="Not Paid", db_index=True)
    # Always kept consistent with payment_status by the view layer (never trusted
    # verbatim from the client) — equals `value` once Paid, 0 once Not Paid.
    amount_paid = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    due_date = models.DateField(null=True, blank=True)
    payment_date = models.DateField(null=True, blank=True)
    remarks = models.TextField(blank=True)

    def __str__(self):
        return self.invoice_number or f"Invoice for {self.enquiry.enquiry_number}"


def quotation_attachment_upload_path(instance, filename):
    """Kept only so already-applied historical migrations (which froze a direct
    reference to this name as their FileField's `upload_to`) can still resolve it on
    import. New code always uses attachment_upload_path below."""
    return attachment_upload_path(instance, filename)


def attachment_upload_path(instance, filename):
    """<kind>_attachments/<year>/<month>/<kind>_<parent-id>/<uuid>.<ext> — the storage
    name is fully server-generated (never the client's filename) so a replacement
    upload can never collide with or overwrite another record's file. `ATTACHMENT_KIND`
    (set per concrete subclass below) picks which FK on the instance is the parent id."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    unique_name = f"{uuid.uuid4().hex}.{ext}" if ext else uuid.uuid4().hex
    now = timezone.now()
    kind = instance.ATTACHMENT_KIND
    parent_id = getattr(instance, f"{kind}_id")
    return f"{kind}_attachments/{now.year}/{now.month:02d}/{kind}_{parent_id}/{unique_name}"


class AttachmentBase(models.Model):
    """This is a tracking app, not a document management system — each of
    Quotation/Order/Invoice carries at most ONE reference document (the actual
    document is produced in a separate application), so every concrete subclass below
    is a OneToOne to its parent, not a one-to-many table. A new upload replaces the
    existing row (see BaseAttachmentAPIView in views.py) rather than appending another.

    Shared as an abstract base — not a single generic-FK table — so each attachment
    type keeps a real, indexed, join-able FK to its specific parent (Quotation/Order/
    Invoice) rather than a loosely-typed (content_type, object_id) pair."""

    ATTACHMENT_KIND = None  # set by each concrete subclass: "quotation" | "order" | "invoice"

    file = models.FileField(upload_to=attachment_upload_path, max_length=500)
    original_filename = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField()
    content_type = models.CharField(max_length=100, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        abstract = True

    def __str__(self):
        return self.original_filename


class QuotationAttachment(AttachmentBase):
    ATTACHMENT_KIND = "quotation"
    quotation = models.OneToOneField(Quotation, on_delete=models.CASCADE, related_name="attachment")


class OrderAttachment(AttachmentBase):
    ATTACHMENT_KIND = "order"
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name="attachment")


class InvoiceAttachment(AttachmentBase):
    ATTACHMENT_KIND = "invoice"
    invoice = models.OneToOneField(Invoice, on_delete=models.CASCADE, related_name="attachment")


class Activity(models.Model):
    enquiry = models.ForeignKey(Enquiry, on_delete=models.CASCADE, related_name="activities")
    action = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["created_at"]
        verbose_name_plural = "Activities"

    def __str__(self):
        return f"{self.enquiry.enquiry_number}: {self.action}"
