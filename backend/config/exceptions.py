from rest_framework.response import Response
from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return Response(
            {"detail": "An unexpected server error occurred. Please try again later."},
            status=500,
        )

    # A many=True serializer (e.g. bulk Requirement rows) raises a LIST of per-item
    # error dicts, not a single dict — e.g. [{}, {"item": ["This field may not be
    # blank."]}] for a 2-row submission where only row 2 failed. Without this branch
    # that list was returned completely unwrapped (no "detail"/"errors" envelope at
    # all), so the frontend's error helpers — which only recognize the wrapped shape —
    # had nothing to parse and silently fell back to a generic message.
    if isinstance(response.data, list):
        response.data = {"detail": "Validation failed.", "errors": response.data}
    elif isinstance(response.data, dict) and "detail" not in response.data:
        response.data = {"detail": "Validation failed.", "errors": response.data}

    return response
