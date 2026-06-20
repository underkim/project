def test_career_routes_registered(app):
    routes = {route.path for route in app.routes}
    assert "/api/v1/career/settings" in routes
    assert "/api/v1/career/cf-ratings" in routes
    assert "/api/v1/career/summary" in routes


def test_dashboard_routes_registered(app):
    routes = {route.path for route in app.routes}
    assert "/api/v1/dashboard/overview" in routes
