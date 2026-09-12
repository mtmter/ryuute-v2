import json
import os
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import Mock, patch
from urllib.parse import parse_qs, urlsplit

import httpx

import routes_service
from route_providers import ekispert_provider, google_provider, transit_provider
from route_providers.types import (
    ErrorCategory,
    PlaceRef,
    ProviderError,
    RouteRequest,
    RouteResult,
    RouteSegment,
)


FIXTURES = Path(__file__).parent / "fixtures"


def request(time_type="arrival", *, overseas=False, coordinates=True):
    if overseas:
        origin_coords = (48.2082, 16.3738)
        destination_coords = (48.1850, 16.3122)
    elif coordinates:
        origin_coords = (33.596, 130.215)
        destination_coords = (33.586, 130.398)
    else:
        origin_coords = (None, None)
        destination_coords = (None, None)
    return RouteRequest(
        origin=PlaceRef("33.596,130.215", "出発地", *origin_coords),
        destination=PlaceRef("33.586,130.398", "目的地", *destination_coords),
        requested_at=datetime(2026, 8, 25, 10, 12),
        time_type=time_type,
    )


def response(data, status=200):
    result = Mock()
    result.is_success = 200 <= status < 300
    result.status_code = status
    result.json.return_value = data
    return result


class ProviderTypesTest(unittest.TestCase):
    def test_request_validates_coordinates_and_timing(self):
        with self.assertRaises(ProviderError) as context:
            PlaceRef("東京", "東京", 35.0, None)
        self.assertEqual(context.exception.category, ErrorCategory.INVALID_INPUT)

        with self.assertRaises(ProviderError):
            RouteRequest(
                origin=PlaceRef("東京", "東京"),
                destination=PlaceRef("大阪", "大阪"),
                requested_at=datetime.now(),
                time_type="later",
            )

    def test_result_rejects_negative_duration_and_empty_segments(self):
        with self.assertRaises(ProviderError):
            RouteResult(
                origin="A",
                destination="B",
                departure_at="2026-01-01T10:00",
                arrival_at="2026-01-01T09:00",
                duration_minutes=-1,
                transport_mode="WALK",
                provider="mock",
                route_kind="walk",
                segments=(),
            )


class MockAndEkispertProviderTest(unittest.TestCase):
    def test_mock_returns_common_route_without_network(self):
        with patch("httpx.get", side_effect=AssertionError("network")):
            result = routes_service.search_route(
                "33.596,130.215",
                "33.586,130.398",
                datetime(2026, 8, 25, 10, 12),
                provider_name="mock",
                origin_display_name="九州大学 伊都キャンパス",
                destination_display_name="Garraway F",
            )
        self.assertEqual(result["provider"], "mock")
        self.assertEqual(result["departure_at"], "2026-08-25T08:54")
        self.assertEqual(result["arrival_at"], "2026-08-25T09:57")
        self.assertEqual(len(result["segments"]), 4)

    def test_mock_anchors_departure(self):
        result = routes_service.search_route(
            "京都駅",
            "嵐山",
            datetime(2026, 9, 12, 13, 0),
            provider_name="mock",
            time_type="departure",
        )
        self.assertEqual(result["departure_at"], "2026-09-12T13:00")

    @patch("route_providers.ekispert_provider.httpx.get")
    def test_ekispert_query_and_conversion_are_provider_owned(self, get):
        data = json.loads((FIXTURES / "ekispert_route_demo.json").read_text())
        get.return_value = response(data)
        result = ekispert_provider.search(request(), api_key="test")
        params = parse_qs(urlsplit(get.call_args.args[0]).query)
        self.assertEqual(params["searchType"], ["arrival"])
        self.assertEqual(params["time"], ["1012"])
        self.assertEqual(result.provider, "ekispert")
        self.assertEqual(result.route_kind, "transit")

    def test_ekispert_converter_classifies_no_route(self):
        with self.assertRaises(ProviderError) as context:
            ekispert_provider.convert_route({"ResultSet": {}}, request())
        self.assertEqual(context.exception.category, ErrorCategory.NO_ROUTE)


class TransitProviderTest(unittest.TestCase):
    def fixture(self):
        return json.loads((FIXTURES / "transit_route_demo.json").read_text())

    @patch("route_providers.transit_provider.httpx.get")
    def test_arrival_search_and_iso_response(self, get):
        get.return_value = response(self.fixture())
        result = transit_provider.search(request(), user_agent="PlanRail test")
        self.assertEqual(get.call_args.kwargs["params"]["arriveBy"], "true")
        self.assertEqual(get.call_args.kwargs["headers"]["User-Agent"], "PlanRail test")
        self.assertEqual(result.provider, "transit")
        self.assertEqual(result.departure_at, "2026-08-25T08:54")
        self.assertIn("非公式", result.notices[0])

    def test_service_day_seconds_support_after_midnight(self):
        data = self.fixture()
        itinerary = data["itineraries"][0]
        itinerary.update(serviceDate="2026-08-25", startTime=85800, endTime=90600)
        itinerary["legs"] = [
            {
                "mode": "BUS",
                "serviceDate": "2026-08-25",
                "startTime": 85800,
                "endTime": 90600,
                "from": {"name": "出発地"},
                "to": {"name": "目的地"},
                "routeShortName": "深夜バス",
            }
        ]
        result = transit_provider.convert_route(data, request())
        self.assertEqual(result.departure_at, "2026-08-25T23:50")
        self.assertEqual(result.arrival_at, "2026-08-26T01:10")

    def test_uses_readable_route_label_instead_of_numeric_feed_id(self):
        data = self.fixture()
        data["itineraries"][0]["legs"][1].update(
            displayName="30108114",
            routeLongName="",
            routeShortName="30108114",
            headsign="テスト行き",
        )
        result = transit_provider.convert_route(data, request())
        self.assertEqual(result.segments[1].line_name, "テスト行き")

    @patch("route_providers.transit_provider.httpx.get")
    def test_missing_route_429_timeout_and_invalid_json(self, get):
        cases = [
            (response({"itineraries": []}), ErrorCategory.NO_ROUTE),
            (response({}, 429), ErrorCategory.TRANSIENT),
            (httpx.TimeoutException("timeout"), ErrorCategory.TRANSIENT),
        ]
        for outcome, category in cases:
            with self.subTest(category=category, outcome=type(outcome).__name__):
                if isinstance(outcome, Exception):
                    get.side_effect = outcome
                else:
                    get.side_effect = None
                    get.return_value = outcome
                with self.assertRaises(ProviderError) as context:
                    transit_provider.search(request())
                self.assertEqual(context.exception.category, category)
        invalid = response({})
        invalid.json.side_effect = ValueError("invalid")
        get.side_effect = None
        get.return_value = invalid
        with self.assertRaises(ProviderError) as context:
            transit_provider.search(request())
        self.assertEqual(context.exception.category, ErrorCategory.INVALID_RESPONSE)


class GoogleProviderTest(unittest.TestCase):
    def fixture(self):
        return json.loads((FIXTURES / "google_route_demo.json").read_text())

    @patch("route_providers.google_provider.httpx.post")
    def test_supports_transit_and_walk(self, post):
        post.return_value = response(self.fixture())
        transit = google_provider.search(request(), api_key="test", route_kind="transit")
        self.assertEqual(post.call_args.kwargs["json"]["travelMode"], "TRANSIT")
        self.assertEqual(transit.provider, "google")
        walk_data = {
            "routes": [{"duration": "600s", "legs": [{"steps": [{"staticDuration": "600s", "travelMode": "WALK"}]}]}]
        }
        post.return_value = response(walk_data)
        walk = google_provider.search(request(), api_key="test", route_kind="walk")
        self.assertEqual(post.call_args.kwargs["json"]["travelMode"], "WALK")
        self.assertEqual(walk.route_kind, "walk")
        self.assertEqual(walk.arrival_at, "2026-08-25T10:12")


class RouteOrchestrationTest(unittest.TestCase):
    def successful(self, provider):
        return RouteResult(
            origin="出発地",
            destination="目的地",
            departure_at="2026-08-25T09:00",
            arrival_at="2026-08-25T10:00",
            duration_minutes=60,
            transport_mode="TRANSIT",
            provider=provider,
            route_kind="transit",
            segments=(RouteSegment("TRANSIT", "出発地", "目的地", "2026-08-25T09:00", "2026-08-25T10:00", 60, "路線"),),
        )

    def test_auto_order_for_domestic_overseas_and_missing_coordinates(self):
        self.assertEqual(routes_service.auto_provider_order(request())[0], ("transit", "transit"))
        self.assertEqual(routes_service.auto_provider_order(request(overseas=True))[0], ("google", "transit"))
        self.assertEqual(routes_service.auto_provider_order(request(coordinates=False))[0], ("google", "transit"))

    def test_transit_retries_once_then_falls_back(self):
        calls = []

        def registry(name):
            def provider(_request, **kwargs):
                calls.append((name, kwargs.get("route_kind")))
                if name == "transit":
                    raise ProviderError(ErrorCategory.TRANSIENT, "timeout", provider=name)
                return self.successful("google")
            return provider

        with patch("routes_service.get_route_provider", side_effect=registry):
            result = routes_service._search_auto(request())
        self.assertEqual(calls, [("transit", None), ("transit", None), ("google", "walk")])
        self.assertTrue(result.is_fallback)

    def test_invalid_response_does_not_fallback_and_all_no_route_maps_404(self):
        for category in (ErrorCategory.INVALID_RESPONSE, ErrorCategory.NO_ROUTE):
            with self.subTest(category=category):
                def failing(_name):
                    def provider(_request, **_kwargs):
                        raise ProviderError(category, "failed")
                    return provider
                with patch("routes_service.get_route_provider", side_effect=failing):
                    if category == ErrorCategory.INVALID_RESPONSE:
                        with self.assertRaises(ProviderError):
                            routes_service._search_auto(request())
                    else:
                        with self.assertRaises(ProviderError) as context:
                            routes_service._search_auto(request())
                        self.assertEqual(context.exception.category, ErrorCategory.NO_ROUTE)

    def test_unknown_mode_is_provider_error(self):
        with self.assertRaises(routes_service.RouteProviderError):
            routes_service.search_route("A", "B", datetime.now(), provider_name="unknown")


if __name__ == "__main__":
    unittest.main()
