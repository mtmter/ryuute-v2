import os
from datetime import datetime, timedelta
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from routes_service import (
    RouteNotFoundError,
    RoutesApiKeyError,
    RoutesServiceError,
    search_route,
)


DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


def get_cors_origins():
    cors_origins_text = os.getenv("CORS_ORIGINS", "")
    cors_origins = [
        origin.strip()
        for origin in cors_origins_text.split(",")
        if origin.strip()
    ]
    return cors_origins or DEFAULT_CORS_ORIGINS


app = FastAPI(title="PlanRail")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class RouteSearchRequest(BaseModel):
    origin_name: str | None = None
    origin_address: str | None = None
    origin_place_id: str | None = None
    origin_lat: float | None = None
    origin_lng: float | None = None


class RouteSearchEvent(BaseModel):
    start_at: str
    location_name: str | None = None
    destination: str | None = None
    destination_lat: float | None = None
    destination_lng: float | None = None
    arrival_buffer_minutes: int | None = None


class PlaceRef(BaseModel):
    name: str | None = None
    address: str | None = None
    place_id: str | None = None
    lat: float | None = None
    lng: float | None = None


class RouteTiming(BaseModel):
    type: Literal["arrival", "departure"]
    at: str


class DirectRouteSearchRequest(RouteSearchRequest):
    origin: PlaceRef | None = None
    destination: PlaceRef | None = None
    timing: RouteTiming | None = None
    event: RouteSearchEvent | None = None


class RouteSegment(BaseModel):
    type: str
    from_: str = Field(alias="from")
    to: str
    departure_at: str
    arrival_at: str
    duration_minutes: int = Field(ge=0)
    line_name: str | None = None


class RouteSearchResponse(BaseModel):
    origin: str
    destination: str
    departure_at: str
    arrival_at: str
    duration_minutes: int = Field(ge=0)
    transport_mode: str
    provider: str | None = None
    route_kind: Literal["transit", "walk"] | None = None
    is_fallback: bool = False
    notices: list[str] = Field(default_factory=list)
    segments: list[RouteSegment]


def clean_optional_text(value):
    if value is None:
        return ""
    return value.strip()


def format_route_coordinates(latitude, longitude):
    if latitude is None or longitude is None:
        return ""
    return f"{latitude},{longitude}"


def resolve_place(place):
    name = clean_optional_text(place.name)
    address = clean_optional_text(place.address)
    coordinates = format_route_coordinates(place.lat, place.lng)
    value = coordinates or address or name
    return value, name or address or coordinates


def parse_app_datetime(value, error_message):
    try:
        return datetime.strptime(value, "%Y-%m-%dT%H:%M")
    except (TypeError, ValueError) as error:
        raise HTTPException(status_code=400, detail=error_message) from error


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post(
    "/api/route-search",
    response_model=RouteSearchResponse,
)
def search_direct_route(request: DirectRouteSearchRequest):
    if request.origin and request.destination and request.timing:
        origin, origin_display_name = resolve_place(request.origin)
        destination, destination_display_name = resolve_place(
            request.destination
        )
        requested_at = parse_app_datetime(
            request.timing.at,
            "検索日時が不正です",
        )
        time_type = request.timing.type
    elif request.event:
        event = request.event
        origin_name = clean_optional_text(request.origin_name)
        origin_address = clean_optional_text(request.origin_address)
        origin_coordinates = format_route_coordinates(
            request.origin_lat,
            request.origin_lng,
        )
        origin = origin_coordinates or origin_address or origin_name
        origin_display_name = origin_name or origin_address or origin
        destination_address = clean_optional_text(event.destination)
        destination_location_name = clean_optional_text(event.location_name)
        destination_coordinates = format_route_coordinates(
            event.destination_lat,
            event.destination_lng,
        )
        destination = (
            destination_coordinates
            or destination_address
            or destination_location_name
        )
        destination_display_name = (
            destination_location_name or destination_address or destination
        )
        event_start = parse_app_datetime(
            event.start_at,
            "予定の開始日時が不正です",
        )
        requested_at = event_start - timedelta(
            minutes=event.arrival_buffer_minutes or 0,
        )
        time_type = "arrival"
    else:
        raise HTTPException(
            status_code=400,
            detail="出発地、目的地、検索日時を入力してください",
        )

    if not origin:
        raise HTTPException(
            status_code=400,
            detail="出発地として利用できる情報を入力してください",
        )
    if not destination:
        raise HTTPException(
            status_code=400,
            detail="目的地として利用できる情報を入力してください",
        )

    try:
        return search_route(
            origin,
            destination,
            requested_at,
            time_type=time_type,
            origin_display_name=origin_display_name,
            destination_display_name=destination_display_name,
        )
    except RouteNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except RoutesApiKeyError as error:
        raise HTTPException(
            status_code=500,
            detail="経路検索のAPIキーが設定されていません",
        ) from error
    except RoutesServiceError as error:
        raise HTTPException(
            status_code=502,
            detail="経路検索サービスとの通信に失敗しました",
        ) from error
