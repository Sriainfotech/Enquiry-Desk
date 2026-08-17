from django.contrib import admin

from .models import Customer


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("customer_code", "company_name", "contact_person", "mobile", "email", "city", "state", "is_active")
    list_filter = ("is_active", "customer_type", "company_type", "state")
    search_fields = ("customer_code", "company_name", "contact_person", "mobile", "email", "gst_number")
    readonly_fields = ("customer_code", "created_at", "updated_at")
