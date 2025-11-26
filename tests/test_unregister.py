from fastapi.testclient import TestClient
from src.app import app, activities


client = TestClient(app)


def test_unregister_existing_participant():
    # Use a temporary email to avoid mutating shared initial users
    activity = "Chess Club"
    email = "temp-test-user@example.com"

    # make sure the temp user is not signed up already
    if email in activities[activity]["participants"]:
        activities[activity]["participants"].remove(email)

    # Sign up the test user
    resp = client.post(f"/activities/{activity.replace(' ', '%20')}/signup?email={email}")
    assert resp.status_code == 200
    assert email in activities[activity]["participants"]

    # Now unregister
    resp = client.delete(f"/activities/{activity.replace(' ', '%20')}/unregister?email={email}")
    assert resp.status_code == 200
    assert resp.json().get("message")
    assert email not in activities[activity]["participants"]


def test_unregister_nonexistent_participant():
    activity = "Chess Club"
    email = "definitely-not-registered@example.com"

    # Ensure this email is not present so we get the error case
    if email in activities[activity]["participants"]:
        activities[activity]["participants"].remove(email)

    resp = client.delete(f"/activities/{activity.replace(' ', '%20')}/unregister?email={email}")
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Student is not signed up for this activity"
