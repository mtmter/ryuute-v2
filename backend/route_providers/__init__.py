from . import ekispert_provider, google_provider, mock_provider, transit_provider
from .types import ErrorCategory, PlaceRef, ProviderError, RouteRequest, RouteResult


ROUTE_PROVIDERS = {
    "transit": transit_provider.search,
    "google": google_provider.search,
    "ekispert": ekispert_provider.search,
    "mock": mock_provider.search,
}


def get_route_provider(provider_name):
    try:
        return ROUTE_PROVIDERS[provider_name]
    except KeyError as error:
        supported = ", ".join(ROUTE_PROVIDERS)
        raise ProviderError(
            ErrorCategory.NOT_CONFIGURED,
            f"ROUTE_PROVIDER_MODEはauto, {supported}のいずれかを指定してください",
        ) from error


__all__ = [
    "ErrorCategory",
    "PlaceRef",
    "ProviderError",
    "RouteRequest",
    "RouteResult",
    "get_route_provider",
]
