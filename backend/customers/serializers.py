import re

from django.core.validators import URLValidator
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import Customer

COMPANY_NAME_RE = re.compile(r"^[A-Za-z0-9&.,()\-\s]+$")
PERSON_NAME_RE = re.compile(r"^[A-Za-z .'\-]+$")
CITY_RE = re.compile(r"^[A-Za-z .'\-]+$")
MOBILE_RE = re.compile(r"^[6-9][0-9]{9}$")
PINCODE_RE = re.compile(r"^[0-9]{6}$")
GST_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")
PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")


def _validate_url(value):
    candidate = value if re.match(r"^https?://", value, re.I) else f"http://{value}"
    try:
        URLValidator(schemes=["http", "https"])(candidate)
    except DjangoValidationError:
        raise serializers.ValidationError("Enter a valid website URL.")


class CustomerSerializer(serializers.ModelSerializer):
    total_enquiries = serializers.IntegerField(read_only=True, default=0)

    company_name = serializers.CharField(min_length=2, max_length=100)
    gst_number = serializers.CharField(required=False, allow_blank=True, max_length=15)
    pan_number = serializers.CharField(required=False, allow_blank=True, max_length=10)
    website = serializers.CharField(required=False, allow_blank=True, max_length=255)

    contact_person = serializers.CharField(min_length=2, max_length=50)
    designation = serializers.CharField(required=False, allow_blank=True, max_length=50)
    mobile = serializers.CharField(max_length=10)
    alternate_mobile = serializers.CharField(required=False, allow_blank=True, max_length=10)
    email = serializers.EmailField(max_length=254)
    alternate_email = serializers.EmailField(required=False, allow_blank=True, max_length=254)

    address_line_1 = serializers.CharField(min_length=5, max_length=150)
    address_line_2 = serializers.CharField(required=False, allow_blank=True, max_length=150)
    city = serializers.CharField(min_length=2, max_length=50)
    pincode = serializers.CharField(max_length=6)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=500)

    class Meta:
        model = Customer
        fields = [
            "id", "customer_code", "company_name", "gst_number", "pan_number", "company_type", "website",
            "contact_person", "designation", "mobile", "alternate_mobile", "email", "alternate_email",
            "address_line_1", "address_line_2", "city", "state", "country", "pincode",
            "customer_type", "industry", "notes", "is_active",
            "total_enquiries", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "customer_code", "created_at", "updated_at"]

    # ---- individual field rules -------------------------------------------------

    def validate_company_name(self, value):
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError("Company name must be at least 2 characters.")
        if not COMPANY_NAME_RE.match(value):
            raise serializers.ValidationError("Company name contains characters that aren't allowed.")
        return value

    def validate_contact_person(self, value):
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError("Contact person must be at least 2 characters.")
        if not PERSON_NAME_RE.match(value):
            raise serializers.ValidationError("Contact person can only contain letters, spaces, apostrophes and hyphens.")
        return value

    def validate_designation(self, value):
        return value.strip()

    def validate_mobile(self, value):
        value = value.strip()
        if not MOBILE_RE.match(value):
            raise serializers.ValidationError("Mobile number must contain exactly 10 digits and start with 6-9.")
        return value

    def validate_alternate_mobile(self, value):
        value = value.strip()
        if value and not MOBILE_RE.match(value):
            raise serializers.ValidationError("Alternate mobile must contain exactly 10 digits and start with 6-9.")
        return value

    def validate_email(self, value):
        return value.strip().lower()

    def validate_alternate_email(self, value):
        return value.strip().lower()

    def validate_gst_number(self, value):
        value = value.strip().upper()
        if not value:
            return value
        if len(value) != 15 or not GST_RE.match(value):
            raise serializers.ValidationError("Enter a valid 15-character GST number.")
        qs = Customer.objects.filter(gst_number__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        existing = qs.first()
        if existing:
            raise serializers.ValidationError(f"GST already used by {existing.company_name}.")
        return value

    def validate_pan_number(self, value):
        value = value.strip().upper()
        if value and (len(value) != 10 or not PAN_RE.match(value)):
            raise serializers.ValidationError("Enter a valid 10-character PAN number.")
        return value

    def validate_website(self, value):
        value = value.strip()
        if value:
            _validate_url(value)
        return value

    def validate_address_line_1(self, value):
        value = value.strip()
        if len(value) < 5:
            raise serializers.ValidationError("Address line 1 must be at least 5 characters.")
        return value

    def validate_address_line_2(self, value):
        return value.strip()

    def validate_city(self, value):
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError("City must be at least 2 characters.")
        if not CITY_RE.match(value):
            raise serializers.ValidationError("City can only contain letters, spaces, apostrophes and hyphens.")
        return value

    def validate_pincode(self, value):
        value = value.strip()
        if not PINCODE_RE.match(value):
            raise serializers.ValidationError("Pincode must contain exactly 6 digits.")
        return value

    def validate_notes(self, value):
        return value.strip()
