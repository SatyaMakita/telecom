import pytest
import httpx

BASE_URL = "http://127.0.0.1:8000"

@pytest.mark.asyncio
async def test_health_check():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        res = await client.get("/api/health")
        assert res.status_code == 200
        data = res.json()
        assert "uptime_seconds" in data
        assert "cpu_percent" in data

@pytest.mark.asyncio
async def test_eir_check_whitelisted_user_device():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        # Check User Device 1 (+91 89175 88693)
        res1 = await client.get("/api/eir/check-imei", params={"imei": "355780160674584"})
        assert res1.status_code == 200
        assert res1.json()["imei"] == "355780160674584"
        assert res1.json()["status"] == "WHITELISTED"

        # Check User Device 2 (+91 86908 62153)
        res2 = await client.get("/api/eir/check-imei", params={"imei": "357177508853343"})
        assert res2.status_code == 200
        assert res2.json()["imei"] == "357177508853343"
        assert res2.json()["status"] == "WHITELISTED"

@pytest.mark.asyncio
async def test_eir_check_blacklisted_stolen_device():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        res = await client.get("/api/eir/check-imei", params={"imei": "356938035643803"})
        assert res.status_code == 200
        data = res.json()
        assert data["imei"] == "356938035643803"
        assert data["status"] == "BLACKLISTED"

@pytest.mark.asyncio
async def test_eir_check_custom_arbitrary_imei():
    """Verify ANY arbitrary IMEI entered by the user is accepted and handled cleanly."""
    custom_imei = "867530999999999"
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        res = await client.get("/api/eir/check-imei", params={"imei": custom_imei})
        assert res.status_code == 200
        data = res.json()
        assert data["imei"] == custom_imei
        assert data["status"] in ["UNKNOWN", "WHITELISTED"]
        assert data["decision"] == "PERMIT_ATTACH"

@pytest.mark.asyncio
async def test_eir_check_identity_procedure_clean_vs_barred():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        # 1. Clean device attach check
        res_clean = await client.post("/api/eir/check-identity", json={
            "imei": "356938035643801",
            "supi": "imsi-999700000000001",
            "cell_id": "LAB_SITE_A"
        })
        assert res_clean.status_code == 200
        assert res_clean.json()["decision"] == "PERMIT_ATTACH"
        assert res_clean.json()["alert_dispatched"] is False

        # 2. Blacklisted stolen device check
        res_barred = await client.post("/api/eir/check-identity", json={
            "imei": "356938035643803",
            "supi": "imsi-999700000000001",
            "cell_id": "LAB_SITE_A"
        })
        assert res_barred.status_code == 200
        data_barred = res_barred.json()
        assert data_barred["decision"] == "BAR_EQUIPMENT"
        assert data_barred["nas_cause_code"] == 6
        assert "Cause #6" in data_barred["nas_cause_message"]
        assert data_barred["alert_dispatched"] is True

@pytest.mark.asyncio
async def test_arbitrary_device_telemetry_post_and_get():
    """Verify ANY arbitrary phone number and IMEI can submit and retrieve telemetry."""
    test_phone = "+1 415 555 7890"
    test_imei = "990001123456789"
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        post_res = await client.post("/api/tracker/device-telemetry", json={
            "phone_number": test_phone,
            "imei": test_imei,
            "latitude": 20.3010,
            "longitude": 85.8300,
            "accuracy": 3.2,
            "speed": 28
        })
        assert post_res.status_code == 200
        assert post_res.json()["status"] == "received"

        get_res = await client.get("/api/tracker/device-telemetry")
        assert get_res.status_code == 200
        data = get_res.json()
        assert data["phone_number"] == test_phone
        assert data["imei"] == test_imei
        assert data["latitude"] == 20.3010
        assert data["longitude"] == 85.8300
        assert data["speed"] == 28
