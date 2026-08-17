from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from .serializers import ForgotPasswordSerializer, LoginSerializer, LogoutSerializer, ResetPasswordSerializer, UserSerializer

GENERIC_LOGIN_ERROR = "Invalid email or password."
GENERIC_RESET_SENT = "If an account exists with this email, a password reset link has been sent."
GENERIC_RESET_INVALID = "This password reset link is invalid or has expired."


class LoginAPIView(APIView):
    """POST /api/auth/login/ — exchange username/password for an access + refresh token pair."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except AuthenticationFailed:
            # Never reveal whether it was the username or the password that was wrong.
            return Response({"detail": GENERIC_LOGIN_ERROR}, status=status.HTTP_401_UNAUTHORIZED)
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class RefreshAPIView(APIView):
    """POST /api/auth/refresh/ — exchange a valid refresh token for a new access token."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = TokenRefreshSerializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError:
            return Response({"detail": "Refresh token is invalid or expired."}, status=status.HTTP_401_UNAUTHORIZED)
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class LogoutAPIView(APIView):
    """POST /api/auth/logout/ — blacklist the given refresh token so it can no longer be used."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Logged out successfully."}, status=status.HTTP_205_RESET_CONTENT)


class MeAPIView(APIView):
    """GET /api/auth/me/ — return the currently authenticated user."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data, status=status.HTTP_200_OK)


def _send_password_reset_email(user, reset_url):
    display_name = user.get_full_name() or user.username
    message = (
        f"Hello {display_name},\n\n"
        "We received a request to reset your password.\n\n"
        f"Click the link below to create a new password:\n{reset_url}\n\n"
        "This link will expire for security reasons.\n\n"
        "If you did not request this, you can safely ignore this email.\n\n"
        "Regards,\nVantage Customer & Enquiry Desk"
    )
    send_mail(
        subject="Reset your Vantage password",
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )


class ForgotPasswordAPIView(APIView):
    """POST /api/auth/forgot-password/ — email a password reset link.

    Always returns the same generic response regardless of whether the address
    is registered, so the endpoint can't be used to enumerate accounts."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip()

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_url = f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}"
            _send_password_reset_email(user, reset_url)

        return Response({"detail": GENERIC_RESET_SENT}, status=status.HTTP_200_OK)


class ResetPasswordAPIView(APIView):
    """POST /api/auth/reset-password/ — consume a uid/token pair to set a new password."""

    permission_classes = [AllowAny]

    def post(self, request):
        uid = request.data.get("uid", "")
        token = request.data.get("token", "")

        user = None
        try:
            user = User.objects.get(pk=force_str(urlsafe_base64_decode(uid)))
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            user = None

        if user is None or not default_token_generator.check_token(user, token):
            return Response({"detail": GENERIC_RESET_INVALID}, status=status.HTTP_400_BAD_REQUEST)

        serializer = ResetPasswordSerializer(data=request.data, context={"user": user})
        serializer.is_valid(raise_exception=True)

        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])

        # A password reset should end every session that was already open — blacklist
        # every refresh token this user currently holds so they can't keep using them.
        for outstanding in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=outstanding)

        return Response({"detail": "Your password has been updated successfully."}, status=status.HTTP_200_OK)
