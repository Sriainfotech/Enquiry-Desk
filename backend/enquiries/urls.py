from django.urls import path

from .views import (
    ActivityListAPIView,
    DashboardAPIView,
    DashboardRecentActivityAPIView,
    DashboardRecentEnquiriesAPIView,
    EnquiryDetailAPIView,
    EnquiryListCreateAPIView,
    InvoiceAPIView,
    OrderAPIView,
    QuotationAPIView,
    RequirementsAPIView,
)

urlpatterns = [
    path("dashboard/", DashboardAPIView.as_view(), name="enquiry-dashboard"),
    path("dashboard/recent-enquiries/", DashboardRecentEnquiriesAPIView.as_view(), name="enquiry-dashboard-recent-enquiries"),
    path("dashboard/recent-activity/", DashboardRecentActivityAPIView.as_view(), name="enquiry-dashboard-recent-activity"),
    path("", EnquiryListCreateAPIView.as_view(), name="enquiry-list-create"),
    path("<int:pk>/", EnquiryDetailAPIView.as_view(), name="enquiry-detail"),
    path("<int:pk>/requirements/", RequirementsAPIView.as_view(), name="enquiry-requirements"),
    path("<int:pk>/quotation/", QuotationAPIView.as_view(), name="enquiry-quotation"),
    path("<int:pk>/order/", OrderAPIView.as_view(), name="enquiry-order"),
    path("<int:pk>/invoice/", InvoiceAPIView.as_view(), name="enquiry-invoice"),
    path("<int:pk>/activity/", ActivityListAPIView.as_view(), name="enquiry-activity"),
]
