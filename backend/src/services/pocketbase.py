import logging
from typing import Any, Optional

import httpx

from src.config import settings

logger = logging.getLogger(__name__)


class PocketbaseError(Exception):
    """Custom exception for Pocketbase errors."""

    def __init__(self, message: str, status_code: Optional[int] = None):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class PocketbaseService:
    """Async client for Pocketbase REST API with admin authentication."""

    def __init__(self, base_url: Optional[str] = None):
        self.base_url = (base_url or settings.pocketbase_url).rstrip("/")
        self._admin_token: Optional[str] = None

    async def _ensure_admin_auth(self) -> Optional[str]:
        """
        Authenticate as admin and get token.

        Returns the admin token or None if authentication fails.
        """
        if self._admin_token:
            return self._admin_token

        email = settings.pocketbase_admin_email
        password = settings.pocketbase_admin_password

        if not email or not password:
            logger.debug("No admin credentials configured")
            return None

        try:
            async with httpx.AsyncClient() as client:
                # Pocketbase v0.20+ uses _superusers collection
                response = await client.post(
                    f"{self.base_url}/api/collections/_superusers/auth-with-password",
                    json={"identity": email, "password": password},
                    timeout=30.0,
                )

                if response.status_code == 200:
                    data = response.json()
                    self._admin_token = data.get("token")
                    logger.info("Pocketbase admin authentication successful")
                    return self._admin_token
                else:
                    logger.warning("Pocketbase admin auth failed: %s", response.text)
                    return None

        except Exception as e:
            logger.warning("Failed to authenticate as admin: %s", e)
            return None

    async def _request(
        self,
        method: str,
        path: str,
        json: Optional[dict] = None,
        params: Optional[dict] = None,
        require_admin: bool = False,
    ) -> Any:
        """Make an HTTP request to Pocketbase."""
        url = f"{self.base_url}{path}"

        headers = {}
        if require_admin:
            token = await self._ensure_admin_auth()
            if token:
                headers["Authorization"] = token

        async with httpx.AsyncClient() as client:
            try:
                response = await client.request(
                    method=method,
                    url=url,
                    json=json,
                    params=params,
                    headers=headers,
                    timeout=30.0,
                )

                if response.status_code >= 400:
                    error_data = response.json() if response.text else {}
                    error_msg = error_data.get("message", response.text or "Unknown error")
                    raise PocketbaseError(error_msg, response.status_code)

                if response.text:
                    return response.json()
                return None

            except httpx.RequestError as e:
                raise PocketbaseError(f"Connection error: {str(e)}")

    # ==================== Health ====================

    async def health_check(self) -> dict:
        """Check if Pocketbase is healthy."""
        return await self._request("GET", "/api/health")

    # ==================== Collections ====================

    async def list_collections(self) -> list[dict]:
        """Get list of all collections (requires admin auth)."""
        result = await self._request("GET", "/api/collections", require_admin=True)
        return result.get("items", []) if result else []

    async def get_collection(self, name: str) -> dict:
        """Get collection info by name (requires admin auth)."""
        return await self._request("GET", f"/api/collections/{name}", require_admin=True)

    async def create_collection(self, name: str, schema: list[dict]) -> dict:
        """Create a new collection (requires admin auth)."""
        data = {
            "name": name,
            "type": "base",
            "fields": schema,  # Pocketbase v0.20+ uses 'fields' instead of 'schema'
            # Allow all operations without auth for user-created collections
            "listRule": "",
            "viewRule": "",
            "createRule": "",
            "updateRule": "",
            "deleteRule": "",
        }
        return await self._request("POST", "/api/collections", json=data, require_admin=True)

    # ==================== Records ====================

    async def list_records(
        self,
        collection: str,
        filter: Optional[str] = None,
        sort: Optional[str] = None,
        page: int = 1,
        per_page: int = 50,
    ) -> dict:
        """Get list of records from a collection."""
        params = {"page": page, "perPage": per_page}
        if filter:
            params["filter"] = filter
        if sort:
            params["sort"] = sort

        return await self._request("GET", f"/api/collections/{collection}/records", params=params)

    async def get_record(self, collection: str, record_id: str) -> dict:
        """Get a single record by ID."""
        return await self._request("GET", f"/api/collections/{collection}/records/{record_id}")

    async def create_record(self, collection: str, data: dict) -> dict:
        """Create a new record in a collection."""
        return await self._request("POST", f"/api/collections/{collection}/records", json=data)

    async def update_record(self, collection: str, record_id: str, data: dict) -> dict:
        """Update an existing record."""
        return await self._request("PATCH", f"/api/collections/{collection}/records/{record_id}", json=data)

    async def delete_record(self, collection: str, record_id: str) -> None:
        """Delete a record."""
        await self._request("DELETE", f"/api/collections/{collection}/records/{record_id}")


# Singleton instance
pocketbase = PocketbaseService()
