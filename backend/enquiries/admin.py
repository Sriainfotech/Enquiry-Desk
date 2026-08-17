from django.contrib import admin

from .models import Activity, Enquiry, Invoice, Order, Quotation, Requirement


class RequirementInline(admin.TabularInline):
    model = Requirement
    extra = 0


@admin.register(Enquiry)
class EnquiryAdmin(admin.ModelAdmin):
    list_display = ("enquiry_number", "customer", "business_line", "status", "enquiry_date")
    list_filter = ("status", "business_line", "priority")
    search_fields = ("enquiry_number", "customer__company_name", "customer__mobile")
    readonly_fields = ("enquiry_number", "created_at", "updated_at")
    inlines = [RequirementInline]


admin.site.register(Quotation)
admin.site.register(Order)
admin.site.register(Invoice)
admin.site.register(Activity)
