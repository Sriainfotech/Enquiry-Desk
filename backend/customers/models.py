from django.conf import settings
from django.db import models, transaction


class CustomerSequence(models.Model):
    """Single-row counter used to safely generate sequential, unique customer codes."""

    last_number = models.PositiveIntegerField(default=0)

    @classmethod
    def next_code(cls):
        with transaction.atomic():
            seq, _ = cls.objects.select_for_update().get_or_create(pk=1)
            seq.last_number += 1
            seq.save(update_fields=["last_number"])
            return f"CUST-{str(seq.last_number).zfill(4)}"


class Customer(models.Model):
    COMPANY_TYPE_CHOICES = [
        ("Private Limited", "Private Limited"),
        ("Public Limited", "Public Limited"),
        ("Partnership", "Partnership"),
        ("Proprietorship", "Proprietorship"),
        ("LLP", "LLP"),
        ("Government", "Government"),
        ("Other", "Other"),
    ]
    CUSTOMER_TYPE_CHOICES = [
        ("Corporate", "Corporate"),
        ("Enterprise", "Enterprise"),
        ("Government", "Government"),
        ("SME", "SME"),
        ("Individual", "Individual"),
        ("Reseller", "Reseller"),
    ]
    INDUSTRY_CHOICES = [
        ("IT & Software", "IT & Software"),
        ("Manufacturing", "Manufacturing"),
        ("Healthcare", "Healthcare"),
        ("Education", "Education"),
        ("BFSI", "BFSI"),
        ("Retail", "Retail"),
        ("Logistics", "Logistics"),
        ("Government", "Government"),
        ("Real Estate", "Real Estate"),
        ("Hospitality", "Hospitality"),
    ]
    STATE_CHOICES = [(v, v) for v in [
        "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
        "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
        "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
        "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
        "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
        "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh",
        "Lakshadweep", "Puducherry",
    ]]
    COUNTRY_CHOICES = [("India", "India")]

    customer_code = models.CharField(max_length=20, unique=True, db_index=True, editable=False)
    company_name = models.CharField(max_length=100, db_index=True)
    gst_number = models.CharField(max_length=15, blank=True, db_index=True)
    pan_number = models.CharField(max_length=10, blank=True)
    company_type = models.CharField(max_length=30, choices=COMPANY_TYPE_CHOICES, blank=True)
    website = models.CharField(max_length=255, blank=True)

    contact_person = models.CharField(max_length=50)
    designation = models.CharField(max_length=50, blank=True)
    mobile = models.CharField(max_length=10, db_index=True)
    alternate_mobile = models.CharField(max_length=10, blank=True)
    email = models.EmailField(max_length=254, db_index=True)
    alternate_email = models.EmailField(max_length=254, blank=True)

    address_line_1 = models.CharField(max_length=150)
    address_line_2 = models.CharField(max_length=150, blank=True)
    city = models.CharField(max_length=50, db_index=True)
    state = models.CharField(max_length=100, choices=STATE_CHOICES, db_index=True)
    country = models.CharField(max_length=100, choices=COUNTRY_CHOICES, default="India")
    pincode = models.CharField(max_length=6, blank=True)

    customer_type = models.CharField(max_length=30, choices=CUSTOMER_TYPE_CHOICES, blank=True)
    industry = models.CharField(max_length=50, choices=INDUSTRY_CHOICES, blank=True)
    notes = models.TextField(blank=True)

    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="customers_created"
    )

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            # PAN is optional, so plain unique=True would break the moment a second
            # customer was saved with a blank PAN (blank stores as "", not NULL, and
            # two ""s collide under a normal unique index). The condition excludes
            # blank values from the constraint entirely, so any number of customers
            # can have no PAN, but any two with the SAME real PAN are rejected at the
            # database level — the final backstop behind the serializer-level check.
            models.UniqueConstraint(
                fields=["pan_number"],
                condition=~models.Q(pan_number=""),
                name="unique_pan_number_when_set",
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.customer_code:
            self.customer_code = CustomerSequence.next_code()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.customer_code} — {self.company_name}"
