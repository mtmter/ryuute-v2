"""Opt-in live route-provider smoke check; never imported by default tests."""

import json
import os
import sys
from datetime import datetime

from routes_service import search_route


def main():
    if os.getenv("RUN_LIVE_ROUTE_SMOKE") != "1":
        raise SystemExit(
            "外部APIを呼ぶにはRUN_LIVE_ROUTE_SMOKE=1を明示してください"
        )
    provider = os.getenv("ROUTE_PROVIDER_MODE", "transit")
    route = search_route(
        "35.681236,139.767125",
        "35.710063,139.8107",
        datetime.now().replace(second=0, microsecond=0),
        provider_name=provider,
        origin_display_name="東京駅",
        destination_display_name="東京スカイツリー",
        time_type="departure",
        origin_lat=35.681236,
        origin_lng=139.767125,
        destination_lat=35.710063,
        destination_lng=139.8107,
    )
    json.dump(route, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
