import re

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "full_name"]

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class LoginSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        token["full_name"] = user.get_full_name() or user.username
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()

    def save(self, **kwargs):
        try:
            RefreshToken(self.validated_data["refresh"]).blacklist()
        except Exception as exc:  # token already invalid/blacklisted
            raise serializers.ValidationError("Invalid or expired refresh token.") from exc


class ForgotPasswordSerializer(serializers.Serializer):
    """Only validates the email *format* — whether an account exists is decided
    later, silently, in the view. Never surface existence here."""

    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    """uid/token are checked in the view (they gate which user this even applies
    to); this serializer only owns the new-password policy and confirmation match."""

    new_password = serializers.CharField(write_only=True, trim_whitespace=False)
    confirm_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_new_password(self, value):
        user = self.context.get("user")
        try:
            validate_password(value, user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))

        rules = [
            (r"[A-Z]", "Password must contain at least one uppercase letter."),
            (r"[a-z]", "Password must contain at least one lowercase letter."),
            (r"[0-9]", "Password must contain at least one number."),
            (r"[^A-Za-z0-9]", "Password must contain at least one special character."),
        ]
        errors = [message for pattern, message in rules if not re.search(pattern, value)]
        if errors:
            raise serializers.ValidationError(errors)
        return value

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return attrs
