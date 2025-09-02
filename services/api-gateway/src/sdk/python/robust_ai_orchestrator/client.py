"""
Robust AI Orchestrator Python Client
"""

import json
import time
import uuid
from typing import Dict, List, Optional, Any, Union
from urllib.parse import urlencode
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from .types import *
from .exceptions import *


class RobustAIOrchestrator:
    """
    Main client class for interacting with the Robust AI Orchestrator API.
    """

    def __init__(
        self,
        base_url: str,
        api_key: Optional[str] = None,
        access_token: Optional[str] = None,
        version: str = "1.1",
        timeout: int = 30,
        retries: int = 3,
    ):
        """
        Initialize the client.

        Args:
            base_url: Base URL of the API
            api_key: API key for service-to-service authentication
            access_token: JWT access token for user authentication
            version: API version to use
            timeout: Request timeout in seconds
            retries: Number of retry attempts for failed requests
        """
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.access_token = access_token
        self.version = version
        self.timeout = timeout
        self.correlation_id = self._generate_correlation_id()

        # Configure session with retries
        self.session = requests.Session()
        retry_strategy = Retry(
            total=retries,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

    def _generate_correlation_id(self) -> str:
        """Generate a unique correlation ID for requests."""
        return f"py-sdk-{uuid.uuid4().hex[:8]}-{int(time.time())}"

    def _get_headers(self) -> Dict[str, str]:
        """Get default headers for requests."""
        headers = {
            "Content-Type": "application/json",
            "X-Correlation-ID": self.correlation_id,
            "X-API-Version": self.version,
            "User-Agent": "RobustAIOrchestrator-Python-SDK/1.0.0",
        }

        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        elif self.api_key:
            headers["X-API-Key"] = self.api_key

        return headers

    def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> ApiResponse:
        """
        Make an HTTP request to the API.

        Args:
            method: HTTP method
            endpoint: API endpoint
            data: Request body data
            params: Query parameters

        Returns:
            API response

        Raises:
            ApiError: If the request fails
        """
        url = f"{self.base_url}{endpoint}"
        headers = self._get_headers()

        try:
            response = self.session.request(
                method=method,
                url=url,
                headers=headers,
                json=data,
                params=params,
                timeout=self.timeout,
            )

            # Parse JSON response
            try:
                result = response.json()
            except json.JSONDecodeError:
                raise ApiError(
                    f"Invalid JSON response: {response.text}",
                    "INVALID_RESPONSE",
                    status_code=response.status_code,
                )

            # Handle error responses
            if not response.ok:
                error_info = result.get("error", {})
                error_code = error_info.get("code", "UNKNOWN_ERROR")
                error_message = error_info.get("message", f"HTTP {response.status_code}")
                error_details = error_info.get("details")

                # Raise specific exception types
                if response.status_code == 401:
                    raise AuthenticationError(error_message)
                elif response.status_code == 403:
                    raise AuthorizationError(error_message)
                elif response.status_code == 404:
                    raise NotFoundError(error_message)
                elif response.status_code == 422:
                    raise ValidationError(error_message, details=error_details)
                elif response.status_code == 429:
                    reset_time = error_details.get("resetTime") if error_details else None
                    raise RateLimitError(error_message, reset_time=reset_time)
                else:
                    raise ApiError(
                        error_message,
                        error_code,
                        details=error_details,
                        status_code=response.status_code,
                    )

            return ApiResponse(**result)

        except requests.exceptions.Timeout:
            raise ApiError("Request timeout", "TIMEOUT")
        except requests.exceptions.ConnectionError:
            raise ApiError("Connection error", "CONNECTION_ERROR")
        except requests.exceptions.RequestException as e:
            raise ApiError(f"Request failed: {str(e)}", "REQUEST_ERROR")

    # Authentication methods
    def login(self, email: str, password: str) -> LoginResponse:
        """
        Login with email and password.

        Args:
            email: User email
            password: User password

        Returns:
            Login response with tokens and user info
        """
        response = self._make_request("POST", "/auth/login", {"email": email, "password": password})
        
        if response.success and response.data:
            self.access_token = response.data["accessToken"]
        
        return LoginResponse(**response.data)

    def register(
        self,
        email: str,
        password: str,
        name: str,
        organization_name: Optional[str] = None,
    ) -> RegisterResponse:
        """
        Register a new user account.

        Args:
            email: User email
            password: User password
            name: User name
            organization_name: Optional organization name

        Returns:
            Registration response
        """
        data = {"email": email, "password": password, "name": name}
        if organization_name:
            data["organizationName"] = organization_name

        response = self._make_request("POST", "/auth/register", data)
        return RegisterResponse(**response.data)

    def refresh_token(self, refresh_token: str) -> TokenResponse:
        """
        Refresh access token.

        Args:
            refresh_token: Refresh token

        Returns:
            New token response
        """
        response = self._make_request("POST", "/auth/refresh", {"refreshToken": refresh_token})
        
        if response.success and response.data:
            self.access_token = response.data["accessToken"]
        
        return TokenResponse(**response.data)

    def logout(self) -> Dict[str, str]:
        """
        Logout and invalidate tokens.

        Returns:
            Logout confirmation
        """
        response = self._make_request("POST", "/auth/logout")
        self.access_token = None
        return response.data

    # User methods
    def get_user_profile(self) -> User:
        """Get current user profile."""
        response = self._make_request("GET", "/users/profile")
        return User(**response.data)

    def update_user_profile(self, **updates) -> User:
        """Update current user profile."""
        response = self._make_request("PUT", "/users/profile", updates)
        return User(**response.data)

    def list_users(
        self,
        page: int = 1,
        limit: int = 20,
        role: Optional[str] = None,
        organization_id: Optional[str] = None,
    ) -> List[User]:
        """List users (admin only)."""
        params = {"page": page, "limit": limit}
        if role:
            params["role"] = role
        if organization_id:
            params["organizationId"] = organization_id

        response = self._make_request("GET", "/users", params=params)
        return [User(**user) for user in response.data["users"]]

    # Workflow methods
    def list_workflows(
        self,
        page: int = 1,
        limit: int = 20,
        engine_type: Optional[str] = None,
        tags: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[Workflow]:
        """List workflows."""
        params = {"page": page, "limit": limit}
        if engine_type:
            params["engineType"] = engine_type
        if tags:
            params["tags"] = tags
        if search:
            params["search"] = search

        response = self._make_request("GET", "/workflows", params=params)
        return [Workflow(**workflow) for workflow in response.data["workflows"]]

    def get_workflow(self, workflow_id: str) -> Workflow:
        """Get a specific workflow."""
        response = self._make_request("GET", f"/workflows/{workflow_id}")
        return Workflow(**response.data)

    def create_workflow(
        self,
        name: str,
        engine_type: str,
        definition: Dict[str, Any],
        description: Optional[str] = None,
        tags: Optional[List[str]] = None,
        is_public: bool = False,
    ) -> Workflow:
        """Create a new workflow."""
        data = {
            "name": name,
            "engineType": engine_type,
            "definition": definition,
            "isPublic": is_public,
        }
        if description:
            data["description"] = description
        if tags:
            data["tags"] = tags

        response = self._make_request("POST", "/workflows", data)
        return Workflow(**response.data)

    def update_workflow(self, workflow_id: str, **updates) -> Workflow:
        """Update an existing workflow."""
        response = self._make_request("PUT", f"/workflows/{workflow_id}", updates)
        return Workflow(**response.data)

    def delete_workflow(self, workflow_id: str) -> None:
        """Delete a workflow."""
        self._make_request("DELETE", f"/workflows/{workflow_id}")

    def get_workflow_versions(
        self, workflow_id: str, page: int = 1, limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Get workflow versions."""
        params = {"page": page, "limit": limit}
        response = self._make_request("GET", f"/workflows/{workflow_id}/versions", params=params)
        return response.data["versions"]

    # Execution methods
    def list_executions(
        self,
        page: int = 1,
        limit: int = 20,
        workflow_id: Optional[str] = None,
        status: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> List[Execution]:
        """List executions."""
        params = {"page": page, "limit": limit}
        if workflow_id:
            params["workflowId"] = workflow_id
        if status:
            params["status"] = status
        if start_date:
            params["startDate"] = start_date
        if end_date:
            params["endDate"] = end_date

        response = self._make_request("GET", "/executions", params=params)
        return [Execution(**execution) for execution in response.data["executions"]]

    def execute_workflow(
        self,
        workflow_id: str,
        parameters: Optional[Dict[str, Any]] = None,
        version: Optional[int] = None,
    ) -> Execution:
        """Execute a workflow."""
        data = {"workflowId": workflow_id}
        if parameters:
            data["parameters"] = parameters
        if version:
            data["version"] = version

        response = self._make_request("POST", "/executions", data)
        return Execution(**response.data)

    def get_execution(self, execution_id: str) -> Execution:
        """Get execution details."""
        response = self._make_request("GET", f"/executions/{execution_id}")
        return Execution(**response.data)

    def cancel_execution(self, execution_id: str) -> Execution:
        """Cancel a running execution."""
        response = self._make_request("DELETE", f"/executions/{execution_id}")
        return Execution(**response.data)

    def get_execution_logs(
        self,
        execution_id: str,
        level: Optional[str] = None,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Get execution logs."""
        params = {}
        if level:
            params["level"] = level
        if start_time:
            params["startTime"] = start_time
        if end_time:
            params["endTime"] = end_time

        response = self._make_request("GET", f"/executions/{execution_id}/logs", params=params)
        return response.data["logs"]

    # Monitoring methods
    def get_system_metrics(
        self, time_range: str = "1h", metrics: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get system metrics."""
        params = {"timeRange": time_range}
        if metrics:
            params["metrics"] = metrics

        response = self._make_request("GET", "/monitoring/metrics", params=params)
        return response.data["metrics"]

    def list_alerts(
        self,
        page: int = 1,
        limit: int = 20,
        severity: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[Alert]:
        """List alerts."""
        params = {"page": page, "limit": limit}
        if severity:
            params["severity"] = severity
        if status:
            params["status"] = status

        response = self._make_request("GET", "/monitoring/alerts", params=params)
        return [Alert(**alert) for alert in response.data["alerts"]]

    # Marketplace methods
    def browse_marketplace_workflows(
        self,
        page: int = 1,
        limit: int = 20,
        category: Optional[str] = None,
        tags: Optional[str] = None,
        search: Optional[str] = None,
        sort_by: str = "popularity",
    ) -> List[MarketplaceWorkflow]:
        """Browse marketplace workflows."""
        params = {"page": page, "limit": limit, "sortBy": sort_by}
        if category:
            params["category"] = category
        if tags:
            params["tags"] = tags
        if search:
            params["search"] = search

        response = self._make_request("GET", "/marketplace/workflows", params=params)
        return [MarketplaceWorkflow(**workflow) for workflow in response.data["workflows"]]

    # Utility methods
    def get_health(self) -> Dict[str, Any]:
        """Get API health status."""
        response = self._make_request("GET", "/health")
        return response.data

    def get_version(self) -> Dict[str, str]:
        """Get API version information."""
        response = self._make_request("GET", "/version")
        return response.data

    # Configuration methods
    def set_access_token(self, token: str) -> None:
        """Set access token."""
        self.access_token = token

    def set_api_key(self, api_key: str) -> None:
        """Set API key."""
        self.api_key = api_key

    def set_version(self, version: str) -> None:
        """Set API version."""
        self.version = version


def create_client(
    base_url: str,
    api_key: Optional[str] = None,
    access_token: Optional[str] = None,
    **kwargs
) -> RobustAIOrchestrator:
    """
    Create a new client instance.

    Args:
        base_url: Base URL of the API
        api_key: API key for authentication
        access_token: Access token for authentication
        **kwargs: Additional client configuration

    Returns:
        Client instance
    """
    return RobustAIOrchestrator(
        base_url=base_url,
        api_key=api_key,
        access_token=access_token,
        **kwargs
    )