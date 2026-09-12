import logging
import os
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

from route_providers import (
    ErrorCategory,
    PlaceRef,
    ProviderError,
    RouteRequest,
    get_route_provider,
)
from route_providers import ekispert_provider, google_provider


load_dotenv(Path(__file__).with_name(".env"))

DEFAULT_ROUTE_PROVIDER = "auto"
AUTO_FALLBACK_CATEGORIES = {
    ErrorCategory.UNAVAILABLE,
    ErrorCategory.NO_ROUTE,
    ErrorCategory.TRANSIENT,
}
logger = logging.getLogger(__name__)


class RoutesServiceError(Exception):
    """経路検索サービスで発生するエラーの基底クラス。"""


class RoutesApiKeyError(RoutesServiceError):
    """選択したProviderのAPIキーが設定されていない。"""


class RoutesTimeoutError(RoutesServiceError):
    """経路Providerとの通信がタイムアウトした。"""


class RoutesConnectionError(RoutesServiceError):
    """経路Providerへ接続できなかった。"""


class RoutesApiError(RoutesServiceError):
    def __init__(self, status_code, message):
        super().__init__(message)
        self.status_code = status_code


class RouteNotFoundError(RoutesServiceError):
    """条件に合う経路が見つからなかった。"""


class RoutesResponseError(RoutesServiceError):
    """外部レスポンスを共通Routeへ変換できなかった。"""


class RouteProviderError(RoutesServiceError):
    """Providerの設定またはデータ取得に失敗した。"""


def search_route(
    origin,
    destination,
    requested_at,
    provider_name=None,
    origin_display_name=None,
    destination_display_name=None,
    time_type="arrival",
    origin_lat=None,
    origin_lng=None,
    destination_lat=None,
    destination_lng=None,
):
    selected = (
        provider_name
        or os.getenv("ROUTE_PROVIDER_MODE")
        or os.getenv("ROUTE_PROVIDER")
        or DEFAULT_ROUTE_PROVIDER
    ).strip().lower()
    try:
        request = RouteRequest(
            origin=_place_ref(
                origin,
                origin_display_name,
                origin_lat,
                origin_lng,
            ),
            destination=_place_ref(
                destination,
                destination_display_name,
                destination_lat,
                destination_lng,
            ),
            requested_at=requested_at,
            time_type=time_type,
        )
        if selected == "auto":
            result = _search_auto(request)
        else:
            result = _search_explicit(selected, request)
        return result.as_dict()
    except ProviderError as error:
        raise _service_error(error, selected) from error


def _search_explicit(provider_name, request):
    provider = get_route_provider(provider_name)
    if provider_name == "google":
        return provider(request, route_kind="transit")
    return provider(request)


def _search_auto(request):
    candidates = auto_provider_order(request)
    last_error = None
    attempts = []
    for index, (provider_name, route_kind) in enumerate(candidates):
        attempts.append(f"{provider_name}:{route_kind}")
        try:
            result = _call_candidate(provider_name, route_kind, request)
            logger.info("route provider attempts: %s", ", ".join(attempts))
            return result.with_fallback(index > 0)
        except ProviderError as error:
            last_error = error
            if error.category not in AUTO_FALLBACK_CATEGORIES:
                raise
    logger.warning("all route providers failed: %s", ", ".join(attempts))
    if last_error is None or last_error.category == ErrorCategory.NO_ROUTE:
        raise ProviderError(ErrorCategory.NO_ROUTE, "経路が見つかりませんでした")
    raise last_error


def _call_candidate(provider_name, route_kind, request):
    provider = get_route_provider(provider_name)
    attempts = 2 if provider_name == "transit" else 1
    for attempt in range(attempts):
        try:
            if provider_name == "google":
                return provider(request, route_kind=route_kind)
            return provider(request)
        except ProviderError as error:
            if (
                provider_name != "transit"
                or error.category != ErrorCategory.TRANSIENT
                or attempt == attempts - 1
            ):
                raise
    raise AssertionError("unreachable")


def auto_provider_order(request):
    if _is_japan_place(request.origin) and _is_japan_place(request.destination):
        return (("transit", "transit"), ("google", "walk"))
    return (("google", "transit"), ("google", "walk"))


def _is_japan_place(place):
    return (
        place.lat is not None
        and place.lng is not None
        and 20.0 <= place.lat <= 46.0
        and 122.0 <= place.lng <= 154.0
    )


def _place_ref(value, display_name, lat, lng):
    parsed_lat, parsed_lng = _parse_coordinate_value(value)
    return PlaceRef(
        value=value,
        display_name=display_name or value,
        lat=lat if lat is not None else parsed_lat,
        lng=lng if lng is not None else parsed_lng,
    )


def _parse_coordinate_value(value):
    if not isinstance(value, str):
        return None, None
    parts = value.split(",")
    if len(parts) != 2:
        return None, None
    try:
        return float(parts[0]), float(parts[1])
    except ValueError:
        return None, None


def _service_error(error, selected):
    if error.category == ErrorCategory.NO_ROUTE:
        return RouteNotFoundError(str(error))
    if error.category == ErrorCategory.NOT_CONFIGURED and selected in {
        "google",
        "ekispert",
    }:
        return RoutesApiKeyError(str(error))
    if error.category == ErrorCategory.INVALID_RESPONSE:
        return RoutesResponseError(str(error))
    if error.category == ErrorCategory.TRANSIENT:
        return RoutesConnectionError(str(error))
    return RouteProviderError(str(error))


def convert_ekispert_route(response_data, origin, destination):
    """Compatibility entry point; conversion remains owned by the provider."""
    request = RouteRequest(
        origin=PlaceRef(origin, origin),
        destination=PlaceRef(destination, destination),
        requested_at=datetime.now(),
    )
    try:
        return ekispert_provider.convert_route(response_data, request).as_dict()
    except ProviderError as error:
        raise _service_error(error, "ekispert") from error


def search_google_route(
    origin,
    destination,
    arrival_at,
    api_key=None,
    route_kind="transit",
    time_type="arrival",
):
    request = RouteRequest(
        origin=PlaceRef(origin, origin),
        destination=PlaceRef(destination, destination),
        requested_at=arrival_at,
        time_type=time_type,
    )
    try:
        return google_provider.search(
            request,
            route_kind=route_kind,
            api_key=api_key,
        ).as_dict()
    except ProviderError as error:
        if error.category == ErrorCategory.NOT_CONFIGURED:
            raise RoutesApiKeyError(str(error)) from error
        if error.category == ErrorCategory.NO_ROUTE:
            raise RouteNotFoundError(str(error)) from error
        if error.category == ErrorCategory.INVALID_RESPONSE:
            raise RoutesResponseError(str(error)) from error
        if error.category == ErrorCategory.TRANSIENT:
            raise RoutesTimeoutError(str(error)) from error
        raise RoutesApiError(error.status_code, str(error)) from error


def convert_google_route(response_data, origin, destination, desired_arrival_at):
    request = RouteRequest(
        origin=PlaceRef(origin, origin),
        destination=PlaceRef(destination, destination),
        requested_at=desired_arrival_at,
    )
    try:
        return google_provider.convert_route(response_data, request).as_dict()
    except ProviderError as error:
        raise _service_error(error, "google") from error


ROUTES_API_URL = google_provider.ROUTES_API_URL
