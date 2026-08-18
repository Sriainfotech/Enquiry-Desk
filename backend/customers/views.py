from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from config.pagination import StandardResultsSetPagination

from .filters import CustomerFilter
from .models import Customer
from .serializers import CustomerSerializer


def save_customer_or_conflict(serializer, **save_kwargs):
    """The serializer's own validate_pan_number already rejects the common case, but
    two concurrent requests can both pass that check before either has committed —
    the database's UniqueConstraint is the actual final backstop for that race, and an
    IntegrityError from it must still come back as a clean 400, not a generic 500."""
    try:
        with transaction.atomic():
            serializer.save(**save_kwargs)
        return None
    except IntegrityError as exc:
        if "pan_number" in str(exc).lower():
            return Response(
                {"detail": "Validation failed.", "errors": {"pan_number": ["Customer with this PAN number already exists."]}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            {"detail": "Could not save this customer due to a data conflict. Please try again."},
            status=status.HTTP_400_BAD_REQUEST,
        )

SEARCH_FIELDS = [
    "company_name", "customer_code", "contact_person", "mobile", "email",
    "gst_number", "pan_number", "city",
]

# Whitelisted so `ordering` can never be used to inject arbitrary column/SQL.
ORDERING_FIELDS = {
    "company_name": "company_name",
    "-company_name": "-company_name",
    "created_at": "created_at",
    "-created_at": "-created_at",
    "updated_at": "updated_at",
    "-updated_at": "-updated_at",
}
DEFAULT_ORDERING = "-created_at"


def base_queryset():
    return Customer.objects.annotate(total_enquiries=Count("enquiries", distinct=True))


def apply_ordering(queryset, request):
    ordering = ORDERING_FIELDS.get(request.query_params.get("ordering"), DEFAULT_ORDERING)
    return queryset.order_by(ordering, "id")


class CustomerListCreateAPIView(APIView):
    """GET  /api/customers/  — paginated, searchable, filterable list.
    POST /api/customers/  — create a new customer."""

    def get(self, request):
        queryset = base_queryset()

        search = request.query_params.get("search", "").strip()[:100]
        if search:
            q = Q()
            for field in SEARCH_FIELDS:
                q |= Q(**{f"{field}__icontains": search})
            queryset = queryset.filter(q)

        queryset = CustomerFilter(request.query_params, queryset=queryset).qs
        queryset = apply_ordering(queryset, request)

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = CustomerSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        serializer = CustomerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        conflict = save_customer_or_conflict(serializer, created_by=request.user)
        if conflict:
            return conflict
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class CustomerDetailAPIView(APIView):
    """GET/PUT/PATCH/DELETE /api/customers/<id>/"""

    def get_object(self, pk):
        return get_object_or_404(base_queryset(), pk=pk)

    def get(self, request, pk):
        customer = self.get_object(pk)
        return Response(CustomerSerializer(customer).data)

    def put(self, request, pk):
        customer = self.get_object(pk)
        serializer = CustomerSerializer(customer, data=request.data)
        serializer.is_valid(raise_exception=True)
        conflict = save_customer_or_conflict(serializer)
        if conflict:
            return conflict
        return Response(serializer.data)

    def patch(self, request, pk):
        customer = self.get_object(pk)
        serializer = CustomerSerializer(customer, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        conflict = save_customer_or_conflict(serializer)
        if conflict:
            return conflict
        return Response(serializer.data)

    def delete(self, request, pk):
        customer = self.get_object(pk)
        customer.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
