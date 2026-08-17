from rest_framework.response import Response
from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return Response(
            {"detail": "An unexpected server error occurred. Please try again later."},
            status=500,
        )

    if isinstance(response.data, dict) and "detail" not in response.data:
        response.data = {"detail": "Validation failed.", "errors": response.data}

    return response
