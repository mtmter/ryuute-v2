import math
import os
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx

from .common import JAPAN_TIMEZONE, as_japan_datetime, format_app_datetime
from .types import ErrorCategory, ProviderError, RouteRequest, RouteResult, RouteSegment


DEFAULT_API_URL = "https://api.transit.ls8h.com/api/v1/plan"
REQUEST_TIMEOUT_SECONDS = 20.0
NOTICE = "LS8H Transit APIによる非公式経路情報です。重要な移動は交通事業者の案内も確認してください。"


def search(request: RouteRequest, *, api_url=None):
    """Search LS8H Transit API using its coordinate-based plan endpoint."""
    requested_at = as_japan_datetime(request.requested_at)
    url = api_url or os.getenv("LS8H_TRANSIT_API_URL", DEFAULT_API_URL)
    params = {
        "from": _endpoint(request.origin),
        "to": _endpoint(request.destination),
        "fromLabel": request.origin.display_name,
        "toLabel": request.destination.display_name,
        "date": requested_at.strftime("%Y%m%d"),
        "time": requested_at.strftime("%H:%M:%S"),
        "type": request.time_type,
        "numItineraries": "1",
    }
    try:
        response = httpx.get(url, params=params, timeout=REQUEST_TIMEOUT_SECONDS)
    except (httpx.TimeoutException, httpx.RequestError) as error:
        raise ProviderError(ErrorCategory.TRANSIENT, "LS8H Transit APIへ接続できませんでした", provider="transit") from error
    if not response.is_success:
        category = ErrorCategory.NO_ROUTE if response.status_code == 404 else (
            ErrorCategory.TRANSIENT if response.status_code == 429 or response.status_code >= 500 else ErrorCategory.UNAVAILABLE
        )
        raise ProviderError(category, f"LS8H Transit APIがエラーを返しました ({response.status_code})", provider="transit", status_code=response.status_code)
    try:
        data = response.json()
    except ValueError as error:
        raise ProviderError(ErrorCategory.INVALID_RESPONSE, "LS8H Transit APIのレスポンスがJSONではありません", provider="transit") from error
    return convert_route(data, request)


def convert_route(data, request: RouteRequest):
    if not isinstance(data, dict):
        raise ProviderError(ErrorCategory.INVALID_RESPONSE, "LS8H Transit APIのレスポンス形式が不正です", provider="transit")
    journeys = data.get("journeys")
    if journeys is None or journeys == []:
        raise ProviderError(ErrorCategory.NO_ROUTE, "経路が見つかりませんでした", provider="transit")
    if not isinstance(journeys, list) or not isinstance(journeys[0], dict):
        raise ProviderError(ErrorCategory.INVALID_RESPONSE, "LS8H Transit APIのjourneys形式が不正です", provider="transit")
    journey = journeys[0]
    legs = journey.get("legs")
    if not isinstance(legs, list) or not legs:
        raise ProviderError(ErrorCategory.INVALID_RESPONSE, "LS8H Transit APIの経路に区間がありません", provider="transit")
    service_date = data.get("date") or as_japan_datetime(request.requested_at).strftime("%Y%m%d")
    timezone_info = _timezone(data.get("timezone") or "Asia/Tokyo")
    segments = tuple(_convert_leg(leg, service_date, timezone_info, request, index, len(legs)) for index, leg in enumerate(legs))
    departure = _parse_service_time(journey.get("departureSecs"), service_date, timezone_info)
    arrival = _parse_service_time(journey.get("arrivalSecs"), service_date, timezone_info)
    try:
        duration = int(journey.get("durationSecs", (arrival - departure).total_seconds()))
    except (TypeError, ValueError) as error:
        raise ProviderError(ErrorCategory.INVALID_RESPONSE, "LS8H Transit APIの所要時間が不正です", provider="transit") from error
    if duration < 0:
        raise ProviderError(ErrorCategory.INVALID_RESPONSE, "LS8H Transit APIの所要時間が負です", provider="transit")
    return RouteResult(
        origin=request.origin.display_name,
        destination=request.destination.display_name,
        departure_at=format_app_datetime(departure),
        arrival_at=format_app_datetime(arrival),
        duration_minutes=math.ceil(duration / 60),
        transport_mode="TRANSIT",
        provider="transit",
        route_kind="transit",
        segments=segments,
        notices=(NOTICE,),
    )


def _endpoint(place):
    if place.lat is not None and place.lng is not None:
        return f"geo:{place.lat},{place.lng}"
    return place.value


def _convert_leg(leg, service_date, timezone_info, request, index, leg_count):
    if not isinstance(leg, dict):
        raise ProviderError(ErrorCategory.INVALID_RESPONSE, "LS8H Transit APIの区間形式が不正です", provider="transit")
    kind = leg.get("kind")
    if not isinstance(kind, str) or not kind:
        raise ProviderError(ErrorCategory.INVALID_RESPONSE, "LS8H Transit APIの区間移動手段がありません", provider="transit")
    departure = _parse_service_time(leg.get("departureSecs"), service_date, timezone_info)
    arrival = _parse_service_time(leg.get("arrivalSecs"), service_date, timezone_info)
    from_name = _place_name(leg.get("from")) or (request.origin.display_name if index == 0 else None)
    to_name = _place_name(leg.get("to")) or (request.destination.display_name if index == leg_count - 1 else None)
    if not from_name or not to_name:
        raise ProviderError(ErrorCategory.INVALID_RESPONSE, "LS8H Transit APIの区間地点が不足しています", provider="transit")
    is_walk = kind.lower() == "walk"
    return RouteSegment(
        type="WALK" if is_walk else "TRANSIT",
        from_name=from_name,
        to_name=to_name,
        departure_at=format_app_datetime(departure),
        arrival_at=format_app_datetime(arrival),
        duration_minutes=math.ceil((arrival - departure).total_seconds() / 60),
        line_name=None if is_walk else _display_route_name(leg),
    )


def _display_route_name(leg):
    for value in (leg.get("routeName"), leg.get("headsign"), leg.get("mode")):
        if isinstance(value, str) and value.strip() and not value.strip().isdigit():
            return value.strip()
    return None


def _parse_service_time(value, service_date, timezone_info):
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise ProviderError(ErrorCategory.INVALID_RESPONSE, "LS8H Transit APIの日時がありません", provider="transit")
    try:
        service_day = datetime.strptime(str(service_date), "%Y%m%d").date()
    except (TypeError, ValueError) as error:
        raise ProviderError(ErrorCategory.INVALID_RESPONSE, "LS8H Transit APIのdateが不正です", provider="transit") from error
    return (datetime.combine(service_day, time.min, timezone_info) + timedelta(seconds=value)).astimezone(JAPAN_TIMEZONE)


def _timezone(name):
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, TypeError) as error:
        raise ProviderError(ErrorCategory.INVALID_RESPONSE, "LS8H Transit APIのtimezoneが不正です", provider="transit") from error


def _place_name(place):
    if not isinstance(place, dict):
        return None
    name = place.get("name")
    return name if isinstance(name, str) and name else None
