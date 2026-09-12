import math
import os
from datetime import datetime, timedelta, timezone

import httpx

from .common import JAPAN_TIMEZONE, as_japan_datetime, format_app_datetime
from .types import ErrorCategory, ProviderError, RouteRequest, RouteResult, RouteSegment


ROUTES_API_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"
REQUEST_TIMEOUT_SECONDS = 10.0
ROUTES_FIELD_MASK = ",".join(
    [
        "routes.duration",
        "routes.legs.steps.staticDuration",
        "routes.legs.steps.travelMode",
        "routes.legs.steps.transitDetails.stopDetails.departureStop.name",
        "routes.legs.steps.transitDetails.stopDetails.departureTime",
        "routes.legs.steps.transitDetails.stopDetails.arrivalStop.name",
        "routes.legs.steps.transitDetails.stopDetails.arrivalTime",
        "routes.legs.steps.transitDetails.transitLine.name",
        "routes.legs.steps.transitDetails.transitLine.nameShort",
    ]
)


def search(request: RouteRequest, *, route_kind="transit", api_key=None):
    if route_kind not in {"transit", "walk"}:
        raise ProviderError(ErrorCategory.INVALID_INPUT, "Googleの経路種別が不正です", provider="google")
    api_key = api_key or os.getenv("GOOGLE_MAPS_API_KEY")
    if not api_key:
        raise ProviderError(ErrorCategory.NOT_CONFIGURED, "GOOGLE_MAPS_API_KEYが設定されていません", provider="google")
    travel_mode = route_kind.upper()
    body = {
        "origin": _google_place(request.origin.value, request.origin.lat, request.origin.lng),
        "destination": _google_place(request.destination.value, request.destination.lat, request.destination.lng),
        "travelMode": travel_mode,
        "computeAlternativeRoutes": False,
        "languageCode": "ja",
        "units": "METRIC",
    }
    timing_key = "arrivalTime" if request.time_type == "arrival" else "departureTime"
    body[timing_key] = _format_google_datetime(request.requested_at)
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": ROUTES_FIELD_MASK,
    }
    try:
        response = httpx.post(ROUTES_API_URL, json=body, headers=headers, timeout=REQUEST_TIMEOUT_SECONDS)
    except (httpx.TimeoutException, httpx.RequestError) as error:
        raise ProviderError(ErrorCategory.TRANSIENT, "Google Routes APIへ接続できませんでした", provider="google") from error
    if not response.is_success:
        category = (
            ErrorCategory.NO_ROUTE
            if response.status_code == 404
            else ErrorCategory.TRANSIENT
            if response.status_code == 429 or response.status_code >= 500
            else ErrorCategory.UNAVAILABLE
        )
        raise ProviderError(category, _error_message(response), provider="google", status_code=response.status_code)
    try:
        data = response.json()
    except ValueError as error:
        raise ProviderError(ErrorCategory.INVALID_RESPONSE, "Google Routes APIのレスポンスがJSONではありません", provider="google") from error
    return convert_route(data, request, route_kind=route_kind)


def convert_route(data, request: RouteRequest, *, route_kind="transit"):
    if not isinstance(data, dict):
        raise ProviderError(ErrorCategory.INVALID_RESPONSE, "Googleのレスポンス形式が不正です", provider="google")
    routes = data.get("routes")
    if routes is None or routes == []:
        raise ProviderError(ErrorCategory.NO_ROUTE, "経路が見つかりませんでした", provider="google")
    if not isinstance(routes, list) or not isinstance(routes[0], dict):
        raise ProviderError(ErrorCategory.INVALID_RESPONSE, "Googleのroutes形式が不正です", provider="google")
    route = routes[0]
    try:
        total_seconds = _duration_seconds(route["duration"])
        raw_steps = [step for leg in route["legs"] for step in leg["steps"]]
    except (KeyError, TypeError) as error:
        raise ProviderError(ErrorCategory.INVALID_RESPONSE, "Googleの経路情報が不足しています", provider="google") from error
    if not raw_steps:
        raise ProviderError(ErrorCategory.INVALID_RESPONSE, "Googleの経路に区間がありません", provider="google")
    parsed = _parse_steps(raw_steps)
    departure, arrival = _route_times(parsed, request, total_seconds)
    _fill_walk_times(parsed, departure)
    _fill_walk_places(parsed, request.origin.display_name, request.destination.display_name)
    segments = tuple(
        RouteSegment(
            type=step["type"],
            from_name=step["from"],
            to_name=step["to"],
            departure_at=format_app_datetime(step["departure_at"]),
            arrival_at=format_app_datetime(step["arrival_at"]),
            duration_minutes=math.ceil(step["duration_seconds"] / 60),
            line_name=step["line_name"],
        )
        for step in parsed
    )
    return RouteResult(
        origin=request.origin.display_name,
        destination=request.destination.display_name,
        departure_at=format_app_datetime(departure),
        arrival_at=format_app_datetime(arrival),
        duration_minutes=math.ceil(total_seconds / 60),
        transport_mode=route_kind.upper(),
        provider="google",
        route_kind=route_kind,
        segments=segments,
        notices=("Google Maps提供情報",),
    )


def _google_place(value, lat, lng):
    if lat is not None and lng is not None:
        return {"location": {"latLng": {"latitude": lat, "longitude": lng}}}
    return {"address": value}


def _parse_steps(raw_steps):
    parsed = []
    for raw in raw_steps:
        if not isinstance(raw, dict) or not isinstance(raw.get("travelMode"), str):
            raise ProviderError(ErrorCategory.INVALID_RESPONSE, "Googleの区間移動手段が不正です", provider="google")
        mode = raw["travelMode"]
        try:
            seconds = _duration_seconds(raw["staticDuration"])
        except KeyError as error:
            raise ProviderError(ErrorCategory.INVALID_RESPONSE, "Googleの区間時間がありません", provider="google") from error
        if mode != "TRANSIT" and parsed and parsed[-1]["type"] == mode:
            parsed[-1]["duration_seconds"] += seconds
            continue
        item = {
            "type": mode,
            "duration_seconds": seconds,
            "departure_at": None,
            "arrival_at": None,
            "from": None,
            "to": None,
            "line_name": None,
        }
        if mode == "TRANSIT":
            try:
                details = raw["transitDetails"]
                stops = details["stopDetails"]
                item.update(
                    departure_at=_parse_datetime(stops["departureTime"]),
                    arrival_at=_parse_datetime(stops["arrivalTime"]),
                    from_name=stops["departureStop"]["name"],
                    to_name=stops["arrivalStop"]["name"],
                )
                item["from"] = item.pop("from_name")
                item["to"] = item.pop("to_name")
                line = details.get("transitLine", {})
                item["line_name"] = line.get("name") or line.get("nameShort")
            except (KeyError, TypeError, ValueError) as error:
                raise ProviderError(ErrorCategory.INVALID_RESPONSE, "Googleの公共交通区間が不正です", provider="google") from error
        parsed.append(item)
    return parsed


def _route_times(steps, request, total_seconds):
    transit_indexes = [index for index, step in enumerate(steps) if step["type"] == "TRANSIT"]
    if not transit_indexes:
        anchor = as_japan_datetime(request.requested_at)
        if request.time_type == "arrival":
            return anchor - timedelta(seconds=total_seconds), anchor
        return anchor, anchor + timedelta(seconds=total_seconds)
    first, last = transit_indexes[0], transit_indexes[-1]
    departure = steps[first]["departure_at"] - timedelta(
        seconds=sum(step["duration_seconds"] for step in steps[:first])
    )
    arrival = steps[last]["arrival_at"] + timedelta(
        seconds=sum(step["duration_seconds"] for step in steps[last + 1 :])
    )
    return departure, arrival


def _fill_walk_times(steps, route_departure):
    current = route_departure
    for step in steps:
        if step["type"] == "TRANSIT":
            current = step["arrival_at"]
        else:
            step["departure_at"] = current
            current += timedelta(seconds=step["duration_seconds"])
            step["arrival_at"] = current


def _fill_walk_places(steps, origin, destination):
    for index, step in enumerate(steps):
        if step["type"] == "TRANSIT":
            continue
        step["from"] = next((item["to"] for item in reversed(steps[:index]) if item["to"]), origin)
        step["to"] = next((item["from"] for item in steps[index + 1 :] if item["from"]), destination)


def _duration_seconds(value):
    if not isinstance(value, str) or not value.endswith("s"):
        raise ProviderError(ErrorCategory.INVALID_RESPONSE, "Googleの所要時間形式が不正です", provider="google")
    try:
        seconds = float(value[:-1])
    except ValueError as error:
        raise ProviderError(ErrorCategory.INVALID_RESPONSE, "Googleの所要時間形式が不正です", provider="google") from error
    if seconds < 0:
        raise ProviderError(ErrorCategory.INVALID_RESPONSE, "Googleの所要時間が負です", provider="google")
    return seconds


def _parse_datetime(value):
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timezone missing")
    return parsed.astimezone(JAPAN_TIMEZONE)


def _format_google_datetime(value):
    return as_japan_datetime(value).astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _error_message(response):
    default = f"Google Routes APIがエラーを返しました ({response.status_code})"
    try:
        message = response.json().get("error", {}).get("message")
    except (ValueError, AttributeError):
        return default
    return message if isinstance(message, str) and message else default
