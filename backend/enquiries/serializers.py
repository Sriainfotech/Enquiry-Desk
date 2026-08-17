from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from rest_framework import serializers

from customers.models import Customer

from .models import Activity, Enquiry, Invoice, Order, Quotation, Requirement

MONEY_VALIDATORS = [MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("999999999.99"))]
MONEY_KWARGS = dict(max_digits=14, decimal_places=2, validators=MONEY_VALIDATORS)


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
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError("Item must be at least 2 characters.")
        if len(value) > 100:
            raise serializers.ValidationError("Item cannot exceed 100 characters.")
        return value

    def validate_description(self, value):
        value = value.strip()
        if len(value) > 500:
            raise serializers.ValidationError("Description cannot exceed 500 characters.")
        return value

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


class QuotationSerializer(serializers.ModelSerializer):
    value = serializers.DecimalField(**MONEY_KWARGS)
    tax_amount = serializers.DecimalField(**MONEY_KWARGS)
    remarks = serializers.CharField(required=False, allow_blank=True, max_length=500)

    class Meta:
        model = Quotation
        fields = [
            "quotation_number", "quotation_date", "value", "tax_amount",
            "total_value", "valid_until", "status", "remarks",
        ]
        read_only_fields = ["quotation_number", "quotation_date", "total_value", "status"]

    def validate_remarks(self, value):
        return value.strip()

    def validate(self, attrs):
        valid_until = attrs.get("valid_until")
        quotation_date = self.instance.quotation_date if self.instance else None
        if valid_until and quotation_date and valid_until < quotation_date:
            raise serializers.ValidationError({"valid_until": "Valid Until cannot be earlier than the Quotation Date."})
        return attrs


class OrderSerializer(serializers.ModelSerializer):
    value = serializers.DecimalField(**MONEY_KWARGS)
    po_number = serializers.CharField(required=False, allow_blank=True, max_length=50)
    remarks = serializers.CharField(required=False, allow_blank=True, max_length=500)

    class Meta:
        model = Order
        fields = ["order_number", "order_date", "po_number", "po_date", "value", "status", "remarks"]
        read_only_fields = ["order_number", "order_date", "value", "status"]

    def validate_po_number(self, value):
        return value.strip()

    def validate_remarks(self, value):
        return value.strip()

    def validate(self, attrs):
        po_date = attrs.get("po_date")
        order_date = self.instance.order_date if self.instance else None
        if po_date and order_date and po_date > order_date:
            raise serializers.ValidationError({"po_date": "PO Date cannot be later than the Order Date."})
        return attrs


class InvoiceSerializer(serializers.ModelSerializer):
    value = serializers.DecimalField(**MONEY_KWARGS)
    remarks = serializers.CharField(required=False, allow_blank=True, max_length=500)

    class Meta:
        model = Invoice
        fields = [
            "invoice_number", "invoice_date", "value", "status", "payment_status",
            "due_date", "payment_date", "remarks",
        ]
        read_only_fields = ["invoice_number", "invoice_date", "value", "status", "payment_status", "payment_date"]

    def validate_remarks(self, value):
        return value.strip()

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
    enquiry_number = serializers.CharField(source="enquiry.enquiry_number", read_only=True)
    customer_name = serializers.CharField(source="enquiry.customer.company_name", read_only=True)
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = Activity
        fields = ["id", "action", "description", "enquiry", "enquiry_number", "customer_name", "user_name", "created_at"]

    def get_user_name(self, obj):
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
        return value.strip()

    def validate_remarks(self, value):
        return value.strip()

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
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError("Item must be at least 2 characters.")
        if len(value) > 100:
            raise serializers.ValidationError("Item cannot exceed 100 characters.")
        return value

    def validate_description(self, value):
        value = value.strip()
        if len(value) > 500:
            raise serializers.ValidationError("Description cannot exceed 500 characters.")
        return value

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
