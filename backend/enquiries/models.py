from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models, transaction

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
        "Cloud Services", "AMC", "IT Support", "Hardware", "Cyber Security",
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
    quotation_number = models.CharField(max_length=30, unique=True, null=True, blank=True)
    quotation_date = models.DateField(null=True, blank=True)
    value = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_value = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    valid_until = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Not Prepared", db_index=True)
    remarks = models.TextField(blank=True)

    def __str__(self):
        return self.quotation_number or f"Quotation for {self.enquiry.enquiry_number}"


class Order(models.Model):
    STATUS_CHOICES = [(v, v) for v in [
        "Not Converted", "Pending", "Confirmed", "Partially Confirmed", "Cancelled", "Completed",
    ]]

    enquiry = models.OneToOneField(Enquiry, on_delete=models.CASCADE, related_name="order")
    order_number = models.CharField(max_length=30, unique=True, null=True, blank=True)
    order_date = models.DateField(null=True, blank=True)
    po_number = models.CharField(max_length=100, blank=True)
    po_date = models.DateField(null=True, blank=True)
    value = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    status = models.CharField(max_length=25, choices=STATUS_CHOICES, default="Not Converted", db_index=True)
    remarks = models.TextField(blank=True)

    def __str__(self):
        return self.order_number or f"Order for {self.enquiry.enquiry_number}"


class Invoice(models.Model):
    STATUS_CHOICES = [(v, v) for v in ["Not Generated", "Draft", "Generated", "Sent", "Cancelled"]]
    PAYMENT_STATUS_CHOICES = [(v, v) for v in ["Not Paid", "Partially Paid", "Paid", "Overdue"]]

    enquiry = models.OneToOneField(Enquiry, on_delete=models.CASCADE, related_name="invoice")
    invoice_number = models.CharField(max_length=30, unique=True, null=True, blank=True)
    invoice_date = models.DateField(null=True, blank=True)
    value = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Not Generated", db_index=True)
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default="Not Paid", db_index=True)
    due_date = models.DateField(null=True, blank=True)
    payment_date = models.DateField(null=True, blank=True)
    remarks = models.TextField(blank=True)

    def __str__(self):
        return self.invoice_number or f"Invoice for {self.enquiry.enquiry_number}"


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
