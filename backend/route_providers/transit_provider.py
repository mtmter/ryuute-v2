import math
import os
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx

from .common import JAPAN_TIMEZONE, as_japan_datetime, format_app_datetime
from .types import ErrorCategory, ProviderError, RouteRequest, RouteResult, RouteSegment


DEFAULT_API_URL = "https://api.transitous.org/api/v1/plan"
REQUEST_TIMEOUT_SECONDS = 7.0
DEFAULT_USER_AGENT = "PlanRail/1.0 (https://github.com/awkwyrm/ryuute-v2)"
NOTICE = "Transitousの非公式経路情報です。重要な移動は交通事業者の案内も確認してください。"


def search(request: RouteRequest, *, api_url=None, user_agent=None):
    url = api_url or os.getenv("TRANSIT_API_URL", DEFAULT_API_URL)
    headers = {
        "Accept": "application/json",
        "User-Agent": user_agent or os.getenv("TRANSIT_USER_AGENT", DEFAULT_USER_AGENT),
    }
    params = {
        "fromPlace": request.origin.value,
        "toPlace": request.destination.value,
        "time": as_japan_datetime(request.requested_at).isoformat(timespec="seconds"),
        "arriveBy": str(request.time_type == "arrival").lower(),
        "detailedTransfers": "false",
        "numItineraries": "1",
    }
    try:
        response = httpx.get(url, params=params, headers=headers, timeout=REQUEST_TIMEOUT_SECONDS)
    except (httpx.TimeoutException, httpx.RequestError) as error:
        raise ProviderError(ErrorCategory.TRANSIENT, "Transit APIへ接続できませんでした", provider="transit") from error
    if not response.is_success:
        category = (
            ErrorCategory.NO_ROUTE
            if response.status_code == 404
            else ErrorCategory.TRANSIENT
            if response.status_code == 429 or response.status_code >= 500
            else ErrorCategory.UNAVAILABLE
        )
        raise ProviderError(
            category,
            f"Transit APIがエラーを返しました ({response.status_code})",
            provider="transit",
            status_code=response.status_code,
        )
    try:
        data = response.json()
    except ValueError as error:
        raise ProviderError(ErrorCategory.INVALID_RESPONSE, "Transit APIのレスポンスがJSONではありません", provider="transit") from error
    return convert_route(data, request)


def convert_route(data, request: RouteRequest):
    if not isinstance(data, dict):
        raise ProviderError(ErrorCategory.INVALID_RESPONSE, "Transit APIのレスポンス形式が不正です", provider="transit")
    itineraries = data.get("itineraries")
    if itineraries is None and isinstance(data.get("plan"), dict):
        itineraries = data["plan"].get("itineraries")
    if itineraries is None or itineraries == []:
        raise ProviderError(ErrorCategory.NO_ROUTE, "経路が見つかりませんでした", provider="transit")
    if not isinstance(itineraries, list) or not isinstance(itineraries[0], dict):
        raise ProviderError(ErrorCategory.INVALID_RESPONSE, "Transit APIのitineraries形式が不正です", provider="transit")
    itinerary = itineraries[0]
    legs = itinerary.get("legs")
    if not isinstance(legs, list) or not legs:
        raise ProviderError(ErrorCategory.INVALID_RESPONSE, "Transit APIの経路に区間がありません", provider="transit")
    service_date = itinerary.get("serviceDate") or as_japan_datetime(request.requested_at).date().isoformat()
    timezone_name = itinerary.get("timezone") or os.getenv("TRANSIT_TIMEZONE", "Asia/Tokyo")
    timezone_info = _timezone(timezone_name)
    segments = tuple(
        _convert_leg(leg, service_date, timezone_info, request, index, len(legs))
        for index, leg in enumerate(legs)
    )
    departure = _parse_service_time(itinerary.get("startTime"), service_date, timezone_info)
    arrival = _parse_service_time(itinerary.get("endTime"), service_date, timezone_info)
    try:
        duration = int(itinerary.get("duration", (arrival - departure).total_seconds()))
    except (TypeError, ValueError) as error:
        raise ProviderError(ErrorCategory.INVALID_RESPONSE, "Transit APIの所要時間が不正です", provider="transit") from error
    if duration < 0:
        raise ProviderError(ErrorCategory.INVALID_RESPONSE, "Transit APIの所要時間が負です", provider="transit")
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


def _convert_leg(leg, service_date, timezone_info, request, index, leg_count):
    if not isinstance(leg, dict):
        raise ProviderError(ErrorCategory.INVALID_RESPONSE, "Transit APIの区間形式が不正です", provider="transit")
    mode = leg.get("mode")
    if not isinstance(mode, str) or not mode:
        raise ProviderError(ErrorCategory.INVALID_RESPONSE, "Transit APIの区間移動手段がありません", provider="transit")
    departure = _parse_service_time(leg.get("startTime"), leg.get("serviceDate", service_date), timezone_info)
    arrival = _parse_service_time(leg.get("endTime"), leg.get("serviceDate", service_date), timezone_info)
    from_place = leg.get("from")
    to_place = leg.get("to")
    from_name = _place_name(from_place) or (request.origin.display_name if index == 0 else None)
    to_name = _place_name(to_place) or (request.destination.display_name if index == leg_count - 1 else None)
    if not from_name or not to_name:
        raise ProviderError(ErrorCategory.INVALID_RESPONSE, "Transit APIの区間地点が不足しています", provider="transit")
    is_walk = mode.upper() in {"WALK", "FOOT"}
    line_name = None if is_walk else _display_route_name(leg)
    return RouteSegment(
        type="WALK" if is_walk else "TRANSIT",
        from_name=from_name,
        to_name=to_name,
        departure_at=format_app_datetime(departure),
        arrival_at=format_app_datetime(arrival),
        duration_minutes=math.ceil((arrival - departure).total_seconds() / 60),
        line_name=line_name,
    )


def _display_route_name(leg):
    for value in (leg.get("routeLongName"), leg.get("routeShortName"), leg.get("displayName")):
        if isinstance(value, str) and value.strip() and not value.strip().isdigit():
            return value.strip()
    headsign = leg.get("headsign")
    agency_name = leg.get("agencyName")
    if isinstance(headsign, str) and headsign.strip():
        return headsign.strip()
    if isinstance(agency_name, str) and agency_name.strip():
        return agency_name.strip()
    return None


def _parse_service_time(value, service_date, timezone_info):
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as error:
            raise ProviderError(ErrorCategory.INVALID_RESPONSE, "Transit APIの日時形式が不正です", provider="transit") from error
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone_info)
        return parsed.astimezone(JAPAN_TIMEZONE)
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        try:
            day = date.fromisoformat(service_date)
        except (TypeError, ValueError) as error:
            raise ProviderError(ErrorCategory.INVALID_RESPONSE, "Transit APIのserviceDateが不正です", provider="transit") from error
        return (datetime.combine(day, time.min, timezone_info) + timedelta(seconds=value)).astimezone(JAPAN_TIMEZONE)
    raise ProviderError(ErrorCategory.INVALID_RESPONSE, "Transit APIの日時がありません", provider="transit")


def _timezone(name):
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, TypeError) as error:
        raise ProviderError(ErrorCategory.INVALID_RESPONSE, "Transit APIのtimezoneが不正です", provider="transit") from error


def _place_name(place):
    if not isinstance(place, dict):
        return None
    name = place.get("name") or place.get("displayName")
    return name if isinstance(name, str) and name else None
