from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Literal


ProviderName = Literal["transit", "google", "ekispert", "mock"]
RouteKind = Literal["transit", "walk"]
TimingType = Literal["arrival", "departure"]


class ErrorCategory(str, Enum):
    INVALID_INPUT = "invalid_input"
    UNAVAILABLE = "unavailable"
    NOT_CONFIGURED = "not_configured"
    NO_ROUTE = "no_route"
    TRANSIENT = "transient"
    INVALID_RESPONSE = "invalid_response"


class ProviderError(Exception):
    """Provider failures with orchestration-safe categories."""

    def __init__(
        self,
        category: ErrorCategory,
        message: str,
        *,
        provider: str | None = None,
        status_code: int | None = None,
    ):
        super().__init__(message)
        self.category = category
        self.provider = provider
        self.status_code = status_code


@dataclass(frozen=True)
class PlaceRef:
    value: str
    display_name: str
    lat: float | None = None
    lng: float | None = None

    def __post_init__(self):
        if not isinstance(self.value, str) or not self.value.strip():
            raise ProviderError(
                ErrorCategory.INVALID_INPUT,
                "経路検索地点が空です",
            )
        if not isinstance(self.display_name, str) or not self.display_name.strip():
            raise ProviderError(
                ErrorCategory.INVALID_INPUT,
                "経路検索地点の表示名が空です",
            )
        if (self.lat is None) != (self.lng is None):
            raise ProviderError(
                ErrorCategory.INVALID_INPUT,
                "緯度と経度は両方指定してください",
            )
        if self.lat is not None and not -90 <= self.lat <= 90:
            raise ProviderError(ErrorCategory.INVALID_INPUT, "緯度が範囲外です")
        if self.lng is not None and not -180 <= self.lng <= 180:
            raise ProviderError(ErrorCategory.INVALID_INPUT, "経度が範囲外です")


@dataclass(frozen=True)
class RouteRequest:
    origin: PlaceRef
    destination: PlaceRef
    requested_at: datetime
    time_type: TimingType = "arrival"

    def __post_init__(self):
        if not isinstance(self.requested_at, datetime):
            raise ProviderError(
                ErrorCategory.INVALID_INPUT,
                "検索日時がdatetimeではありません",
            )
        if self.time_type not in {"arrival", "departure"}:
            raise ProviderError(
                ErrorCategory.INVALID_INPUT,
                "検索時刻種別が不正です",
            )


@dataclass(frozen=True)
class RouteSegment:
    type: str
    from_name: str
    to_name: str
    departure_at: str
    arrival_at: str
    duration_minutes: int
    line_name: str | None = None

    def __post_init__(self):
        if self.duration_minutes < 0:
            raise ProviderError(
                ErrorCategory.INVALID_RESPONSE,
                "区間の所要時間が負の値です",
            )

    def as_dict(self):
        return {
            "type": self.type,
            "from": self.from_name,
            "to": self.to_name,
            "departure_at": self.departure_at,
            "arrival_at": self.arrival_at,
            "duration_minutes": self.duration_minutes,
            "line_name": self.line_name,
        }


@dataclass(frozen=True)
class RouteResult:
    origin: str
    destination: str
    departure_at: str
    arrival_at: str
    duration_minutes: int
    transport_mode: str
    provider: ProviderName
    route_kind: RouteKind
    segments: tuple[RouteSegment, ...]
    is_fallback: bool = False
    notices: tuple[str, ...] = field(default_factory=tuple)

    def __post_init__(self):
        if self.duration_minutes < 0:
            raise ProviderError(
                ErrorCategory.INVALID_RESPONSE,
                "経路の所要時間が負の値です",
            )
        if not self.segments:
            raise ProviderError(
                ErrorCategory.INVALID_RESPONSE,
                "経路に区間情報がありません",
            )

    def with_fallback(self, is_fallback: bool):
        return RouteResult(
            origin=self.origin,
            destination=self.destination,
            departure_at=self.departure_at,
            arrival_at=self.arrival_at,
            duration_minutes=self.duration_minutes,
            transport_mode=self.transport_mode,
            provider=self.provider,
            route_kind=self.route_kind,
            segments=self.segments,
            is_fallback=is_fallback,
            notices=self.notices,
        )

    def as_dict(self):
        return {
            "origin": self.origin,
            "destination": self.destination,
            "departure_at": self.departure_at,
            "arrival_at": self.arrival_at,
            "duration_minutes": self.duration_minutes,
            "transport_mode": self.transport_mode,
            "provider": self.provider,
            "route_kind": self.route_kind,
            "is_fallback": self.is_fallback,
            "notices": list(self.notices),
            "segments": [segment.as_dict() for segment in self.segments],
        }
