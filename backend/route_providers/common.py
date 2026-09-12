import math
from datetime import datetime, timedelta, timezone

from .types import ErrorCategory, ProviderError


JAPAN_TIMEZONE = timezone(timedelta(hours=9))


def as_japan_datetime(value):
    if not isinstance(value, datetime):
        raise ProviderError(ErrorCategory.INVALID_INPUT, "検索日時がdatetimeではありません")
    if value.tzinfo is None:
        return value.replace(tzinfo=JAPAN_TIMEZONE)
    return value.astimezone(JAPAN_TIMEZONE)


def format_app_datetime(value):
    if not isinstance(value, datetime) or value.tzinfo is None:
        raise ProviderError(
            ErrorCategory.INVALID_RESPONSE,
            "発着日時にタイムゾーンがありません",
        )
    return value.astimezone(JAPAN_TIMEZONE).strftime("%Y-%m-%dT%H:%M")


def duration_minutes(departure_at, arrival_at):
    seconds = (arrival_at - departure_at).total_seconds()
    if seconds < 0:
        raise ProviderError(
            ErrorCategory.INVALID_RESPONSE,
            "到着日時が出発日時より前です",
        )
    return math.ceil(seconds / 60)
