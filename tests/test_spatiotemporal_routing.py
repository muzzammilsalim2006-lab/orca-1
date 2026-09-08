from app.engines.routing import RoutingEngine


def test_spatiotemporal_route_lifecycle():
    # Kochi to Offshore PFZ (~21 km)
    route = RoutingEngine.generate_spatiotemporal_route(
        origin_lat=9.9312,
        origin_lon=76.2673,
        dest_lat=9.9800,
        dest_lon=76.1000,
        departure_time_str="05:00",
        vessel_speed_knots=8.0,
        fishing_duration_hours=3.0,
    )

    assert route["departure_time"] == "05:00"
    assert "eta_zone" in route
    assert "etd_zone" in route
    assert "eta_return_port" in route
    assert route["total_duration_hours"] >= 5.0
    assert route["estimated_fuel_liters"] > 0

    legs = route["legs"]
    assert len(legs["outbound"]) == 4
    assert legs["outbound"][0]["waypoint_index"] == 1
    assert legs["on_station"]["phase"] == "ON_STATION_FISHING"
    assert len(legs["inbound"]) == 3
