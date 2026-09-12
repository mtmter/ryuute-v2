from datetime import datetime, timedelta

from .common import JAPAN_TIMEZONE, format_app_datetime
from .types import PlaceRef, RouteRequest, RouteResult, RouteSegment


BASE_DEPARTURE = datetime(2026, 8, 25, 8, 54, tzinfo=JAPAN_TIMEZONE)
BASE_ARRIVAL = datetime(2026, 8, 25, 9, 57, tzinfo=JAPAN_TIMEZONE)
BASE_REQUESTED_ARRIVAL = datetime(2026, 8, 25, 10, 12, tzinfo=JAPAN_TIMEZONE)
BASE_SEGMENTS = (
    ("WALK", "出発地", "九大学研都市駅", 2, None),
    (
        "TRANSIT",
        "九大学研都市駅",
        "博多駅",
        26,
        "昭和バス・九州大学線 2M（九大学研都市駅行）",
    ),
    (
        "TRANSIT",
        "博多駅",
        "天神駅",
        27,
        "JR筑肥線・福岡市地下鉄空港線（福岡空港行）",
    ),
    ("WALK", "天神駅", "目的地", 8, None),
)


def search(request: RouteRequest):
    """Return a deterministic common route without files or network calls."""
    requested = request.requested_at
    if requested.tzinfo is None:
        requested = requested.replace(tzinfo=JAPAN_TIMEZONE)
    else:
        requested = requested.astimezone(JAPAN_TIMEZONE)
    anchor = (
        BASE_REQUESTED_ARRIVAL
        if request.time_type == "arrival"
        else BASE_DEPARTURE
    )
    departure = BASE_DEPARTURE + (requested - anchor)
    arrival = BASE_ARRIVAL + (requested - anchor)
    current = departure
    segments = []
    for index, (mode, from_name, to_name, minutes, line_name) in enumerate(
        BASE_SEGMENTS
    ):
        segment_arrival = current + timedelta(minutes=minutes)
        segments.append(
            RouteSegment(
                type=mode,
                from_name=request.origin.display_name if index == 0 else from_name,
                to_name=(
                    request.destination.display_name
                    if index == len(BASE_SEGMENTS) - 1
                    else to_name
                ),
                departure_at=format_app_datetime(current),
                arrival_at=format_app_datetime(segment_arrival),
                duration_minutes=minutes,
                line_name=line_name,
            )
        )
        current = segment_arrival
    return RouteResult(
        origin=request.origin.display_name,
        destination=request.destination.display_name,
        departure_at=format_app_datetime(departure),
        arrival_at=format_app_datetime(arrival),
        duration_minutes=63,
        transport_mode="TRANSIT",
        provider="mock",
        route_kind="transit",
        segments=tuple(segments),
        notices=("開発用の固定経路です",),
    )


def get_route(origin, destination, requested_at, time_type="arrival"):
    request = RouteRequest(
        origin=PlaceRef(origin, origin),
        destination=PlaceRef(destination, destination),
        requested_at=requested_at,
        time_type=time_type,
    )
    return search(request).as_dict()
