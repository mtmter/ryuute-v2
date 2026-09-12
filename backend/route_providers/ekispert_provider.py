import os
from datetime import datetime
from urllib.parse import urlencode

import httpx

from .common import JAPAN_TIMEZONE, as_japan_datetime, duration_minutes, format_app_datetime
from .types import ErrorCategory, PlaceRef, ProviderError, RouteRequest, RouteResult, RouteSegment


EKISPERT_API_URL = "https://api.ekispert.jp/v1/json/search/course/extreme"
REQUEST_TIMEOUT_SECONDS = 10.0


class EkispertProviderError(ProviderError):
    def __init__(self, message, *, category=ErrorCategory.UNAVAILABLE):
        super().__init__(category, message, provider="ekispert")


class EkispertApiKeyError(EkispertProviderError):
    def __init__(self, message="EKISPERT_API_KEYが設定されていません"):
        super().__init__(message, category=ErrorCategory.NOT_CONFIGURED)


def search(request: RouteRequest, *, api_key=None):
    return convert_route(fetch_route(request, api_key=api_key), request)


def fetch_route(request: RouteRequest, *, api_key=None):
    api_key = api_key or os.getenv("EKISPERT_API_KEY")
    if not api_key:
        raise EkispertApiKeyError()
    requested = as_japan_datetime(request.requested_at)
    params = {
        "key": api_key,
        "viaList": f"{request.origin.value}:{request.destination.value}",
        "gcs": "wgs84",
        "date": requested.strftime("%Y%m%d"),
        "time": requested.strftime("%H%M"),
        "searchType": request.time_type,
        "answerCount": "1",
        "sort": "ekispert",
    }
    url = f"{EKISPERT_API_URL}?{urlencode(params, safe=':,')}"
    try:
        response = httpx.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
    except (httpx.TimeoutException, httpx.RequestError) as error:
        raise EkispertProviderError(
            "駅すぱあとAPIへ接続できませんでした",
            category=ErrorCategory.TRANSIENT,
        ) from error
    if not response.is_success:
        category = (
            ErrorCategory.TRANSIENT
            if response.status_code == 429 or response.status_code >= 500
            else ErrorCategory.UNAVAILABLE
        )
        raise EkispertProviderError(
            f"駅すぱあとAPIがエラーを返しました ({response.status_code})",
            category=category,
        )
    try:
        return response.json()
    except ValueError as error:
        raise EkispertProviderError(
            "駅すぱあとAPIのレスポンスがJSONではありません",
            category=ErrorCategory.INVALID_RESPONSE,
        ) from error


def convert_route(data, request: RouteRequest):
    if not isinstance(data, dict) or not isinstance(data.get("ResultSet"), dict):
        raise EkispertProviderError(
            "駅すぱあとのレスポンスにResultSetがありません",
            category=ErrorCategory.INVALID_RESPONSE,
        )
    courses = _as_list(data["ResultSet"].get("Course"))
    if not courses:
        raise EkispertProviderError("経路が見つかりませんでした", category=ErrorCategory.NO_ROUTE)
    route = courses[0].get("Route") if isinstance(courses[0], dict) else None
    if not isinstance(route, dict):
        raise EkispertProviderError("駅すぱあとのRoute形式が不正です", category=ErrorCategory.INVALID_RESPONSE)
    lines = _as_list(route.get("Line"))
    points = _as_list(route.get("Point"))
    if not lines or len(points) != len(lines) + 1:
        raise EkispertProviderError("駅すぱあとの地点と区間の形式が不正です", category=ErrorCategory.INVALID_RESPONSE)
    names = [_point_name(point) for point in points]
    names[0], names[-1] = request.origin.display_name, request.destination.display_name
    segments = tuple(
        _convert_line(line, names[index], names[index + 1])
        for index, line in enumerate(lines)
    )
    departure = _parse_datetime(lines[0], "DepartureState")
    arrival = _parse_datetime(lines[-1], "ArrivalState")
    route_kind = "transit" if any(item.type == "TRANSIT" for item in segments) else "walk"
    return RouteResult(
        origin=request.origin.display_name,
        destination=request.destination.display_name,
        departure_at=format_app_datetime(departure),
        arrival_at=format_app_datetime(arrival),
        duration_minutes=duration_minutes(departure, arrival),
        transport_mode=route_kind.upper(),
        provider="ekispert",
        route_kind=route_kind,
        segments=segments,
        notices=("駅すぱあと提供情報",),
    )


def _as_list(value):
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def _point_name(point):
    station = point.get("Station") if isinstance(point, dict) else None
    name = point.get("Name") if isinstance(point, dict) else None
    name = name or (station.get("Name") if isinstance(station, dict) else None)
    if not isinstance(name, str) or not name:
        raise EkispertProviderError("駅すぱあとのPoint形式が不正です", category=ErrorCategory.INVALID_RESPONSE)
    return name


def _convert_line(line, from_name, to_name):
    if not isinstance(line, dict):
        raise EkispertProviderError("駅すぱあとのLine形式が不正です", category=ErrorCategory.INVALID_RESPONSE)
    departure = _parse_datetime(line, "DepartureState")
    arrival = _parse_datetime(line, "ArrivalState")
    line_name = line.get("Name")
    is_walk = str(line.get("Type", "")).lower() == "walk" or line_name == "徒歩"
    if not is_walk and (not isinstance(line_name, str) or not line_name):
        raise EkispertProviderError("駅すぱあとの公共交通区間に路線名がありません", category=ErrorCategory.INVALID_RESPONSE)
    return RouteSegment(
        type="WALK" if is_walk else "TRANSIT",
        from_name=from_name,
        to_name=to_name,
        departure_at=format_app_datetime(departure),
        arrival_at=format_app_datetime(arrival),
        duration_minutes=duration_minutes(departure, arrival),
        line_name=None if is_walk else line_name,
    )


def _parse_datetime(line, state_name):
    try:
        value = line[state_name]["Datetime"]
        if isinstance(value, dict):
            value = value["text"]
        parsed = datetime.fromisoformat(value)
    except (KeyError, TypeError, ValueError) as error:
        raise EkispertProviderError("駅すぱあとの区間に発着日時がありません", category=ErrorCategory.INVALID_RESPONSE) from error
    if parsed.tzinfo is None:
        raise EkispertProviderError("駅すぱあとの発着日時にタイムゾーンがありません", category=ErrorCategory.INVALID_RESPONSE)
    return parsed.astimezone(JAPAN_TIMEZONE)


def get_route(origin, destination, requested_at, api_key=None, time_type="arrival"):
    request = RouteRequest(
        origin=PlaceRef(origin, origin),
        destination=PlaceRef(destination, destination),
        requested_at=requested_at,
        time_type=time_type,
    )
    return fetch_route(request, api_key=api_key)
