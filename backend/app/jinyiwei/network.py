"""Pinned, bounded HTTPS access for public Jinyiwei evidence sources.

External access is fail-closed.  The feature flag accepts exactly ``1``,
``true``, ``yes``, or ``on``.  This module deliberately uses raw sockets so a
validated DNS answer is the address that is actually connected.
"""

from __future__ import annotations

import http.client
import ipaddress
import math
import os
import re
import socket
import ssl
import threading
import time
from collections.abc import Callable, Collection, Mapping
from dataclasses import dataclass
from dataclasses import field as dataclass_field
from numbers import Real
from types import MappingProxyType
from typing import Protocol, cast
from urllib.parse import SplitResult, urljoin, urlsplit, urlunsplit

from app.jinyiwei.errors import JinyiweiError

EXTERNAL_NETWORK_FLAG = "JINYIWEI_EXTERNAL_NETWORK_ENABLED"
EXTERNAL_NETWORK_TRUTHY_VALUES = frozenset({"1", "true", "yes", "on"})
DEFAULT_MAX_BYTES = 1024 * 1024
DEFAULT_TOTAL_TIMEOUT = 10.0
DEFAULT_CONNECT_TIMEOUT = 3.0
DEFAULT_READ_TIMEOUT = 5.0
MAX_REDIRECTS = 3

_ALLOWED_MEDIA_TYPES = frozenset(
    {"application/json", "text/event-stream", "text/html", "text/plain"}
)
_REDIRECT_STATUSES = frozenset({301, 302, 303, 307, 308})
_ALLOWED_CALLER_HEADERS = frozenset(
    {
        "accept",
        "authorization",
        "cookie",
        "if-none-match",
        "if-modified-since",
        "mcp-protocol-version",
        "mcp-session-id",
        "user-agent",
        "x-api-key",
    }
)
_SENSITIVE_CALLER_HEADERS = frozenset(
    {"authorization", "cookie", "mcp-protocol-version", "mcp-session-id", "x-api-key"}
)
_BLOCKED_HOSTS = frozenset(
    {
        "localhost",
        "metadata.google.internal",
        "metadata.google.internal.",
        "instance-data",
        "instance-data.ec2.internal",
    }
)
_METADATA_IPS = frozenset(
    {
        ipaddress.ip_address("169.254.169.254"),
        ipaddress.ip_address("100.100.100.200"),
        ipaddress.ip_address("168.63.129.16"),
    }
)
_HEADER_NAME = re.compile(r"^[!#$%&'*+.^_`|~0-9A-Za-z-]+$")
_DNS_LABEL = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")


class NetworkAccessDisabledError(JinyiweiError):
    """Raised before URL parsing or network work when external access is off."""


class UnsafeNetworkRequestError(JinyiweiError):
    """Raised when a target violates the public HTTPS safety policy."""


class NetworkRequestError(JinyiweiError):
    """Raised for a sanitized remote protocol or bounded-response failure."""


class NetworkTimeoutError(NetworkRequestError):
    """Raised when a connect, read, or total request budget expires."""


@dataclass(frozen=True, slots=True)
class PinnedHTTPSResponse:
    """Minimal immutable response returned by :class:`PinnedHTTPSClient`."""

    final_url: str
    status: int
    headers: Mapping[str, str] = dataclass_field(repr=False)
    body: bytes = dataclass_field(repr=False)

    def __post_init__(self) -> None:
        if type(self.status) is not int or not 100 <= self.status <= 599:
            raise ValueError("invalid_response_status")
        normalized: dict[str, str] = {}
        for name, value in self.headers.items():
            if not isinstance(name, str) or not isinstance(value, str):
                raise TypeError("invalid_response_headers")
            lowered = name.casefold()
            if (
                not _HEADER_NAME.fullmatch(lowered)
                or any(character in value for character in "\r\n")
                or lowered in normalized
            ):
                raise ValueError("invalid_response_headers")
            normalized[lowered] = value
        if not isinstance(self.body, (bytes, bytearray, memoryview)):
            raise TypeError("invalid_response_body")
        object.__setattr__(self, "headers", MappingProxyType(normalized))
        object.__setattr__(self, "body", bytes(self.body))

    def __copy__(self) -> PinnedHTTPSResponse:
        return self

    def __deepcopy__(self, memo: dict[int, object] | None = None) -> PinnedHTTPSResponse:
        del memo
        return self


class _SocketLike(Protocol):
    def settimeout(self, value: float) -> None: ...

    def connect(self, address: tuple[object, ...]) -> None: ...

    def sendall(self, value: bytes) -> None: ...

    def getpeername(self) -> tuple[object, ...]: ...

    def close(self) -> None: ...


class _TLSSocketLike(_SocketLike, Protocol):
    def do_handshake(self) -> None: ...


class _Closable(Protocol):
    def close(self) -> None: ...


class _TLSContextLike(Protocol):
    def wrap_socket(
        self,
        sock: _SocketLike,
        *,
        server_hostname: str,
        do_handshake_on_connect: bool,
    ) -> _TLSSocketLike: ...


class _ResponseLike(Protocol):
    status: int

    def begin(self) -> None: ...

    def getheaders(self) -> list[tuple[str, str]]: ...

    def read(self, size: int) -> bytes: ...

    def close(self) -> None: ...


class _TimerLike(Protocol):
    def cancel(self) -> None: ...


class _WatchdogLike(Protocol):
    @property
    def expired(self) -> bool: ...

    def arm(self, delay: float, sock: _SocketLike) -> None: ...

    def replace(self, sock: _SocketLike) -> None: ...

    def disarm(self) -> None: ...


Resolver = Callable[[str, int, int, int], list[tuple[int, int, int, str, tuple[object, ...]]]]
SocketFactory = Callable[[int, int, int], _SocketLike]
TLSContextFactory = Callable[[], _TLSContextLike]
ResponseFactory = Callable[[_SocketLike], _ResponseLike]
ResolverOperation = Callable[[], list[tuple[int, int, int, str, tuple[object, ...]]]]
ResolverWait = Callable[
    [ResolverOperation, float], list[tuple[int, int, int, str, tuple[object, ...]]]
]
WatchdogFactory = Callable[[], _WatchdogLike]
TimerFactory = Callable[[float, Callable[[], None]], _TimerLike]
RedirectValidator = Callable[[str, str], bool]
ResolvedAddress = tuple[
    int,
    int,
    int,
    tuple[object, ...],
    ipaddress.IPv4Address | ipaddress.IPv6Address,
]


@dataclass(frozen=True, slots=True)
class _Target:
    url: str
    hostname: str
    port: int
    request_target: str
    host_header: str


@dataclass(slots=True)
class _ResolverJob:
    done: threading.Event
    succeeded: bool = False
    value: object | None = None


class _BoundedResolverWait:
    """Per-client resolver gate with at most one daemon worker in flight."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._job: _ResolverJob | None = None
        self._worker_name = f"jinyiwei-dns-{id(self):x}"

    def __call__(
        self, operation: ResolverOperation, timeout: float
    ) -> list[tuple[int, int, int, str, tuple[object, ...]]]:
        with self._lock:
            if self._job is not None and not self._job.done.is_set():
                raise TimeoutError("resolver worker is still busy")
            job = _ResolverJob(done=threading.Event())
            self._job = job

        def resolve() -> None:
            try:
                job.value = operation()
                job.succeeded = True
            except Exception as exc:  # pragma: no cover - mapped by caller
                job.value = exc
            finally:
                job.done.set()

        worker = threading.Thread(target=resolve, name=self._worker_name, daemon=True)
        worker.start()
        if not job.done.wait(timeout):
            raise TimeoutError("resolver wait expired")

        with self._lock:
            if self._job is job:
                self._job = None
        if job.succeeded:
            return cast(list[tuple[int, int, int, str, tuple[object, ...]]], job.value)
        raise cast(Exception, job.value)


def _start_timer(delay: float, callback: Callable[[], None]) -> threading.Timer:
    timer = threading.Timer(delay, callback)
    timer.daemon = True
    timer.start()
    return timer


class SocketDeadlineWatchdog:
    """Synchronize deadline expiry with socket replacement and disarming."""

    def __init__(self, *, timer_factory: TimerFactory = _start_timer) -> None:
        self._timer_factory = timer_factory
        self._lock = threading.Lock()
        self._timer: _TimerLike | None = None
        self._socket: _SocketLike | None = None
        self._generation = 0
        self._expired = False

    @property
    def expired(self) -> bool:
        with self._lock:
            return self._expired

    def arm(self, delay: float, sock: _SocketLike) -> None:
        with self._lock:
            _safe_cancel_timer(self._timer)
            self._generation += 1
            generation = self._generation
            self._socket = sock
            self._expired = False
            self._timer = self._timer_factory(delay, lambda: self._expire(generation))

    def replace(self, sock: _SocketLike) -> None:
        with self._lock:
            if self._socket is None:
                raise RuntimeError("deadline watchdog is not armed")
            self._socket = sock

    def disarm(self) -> None:
        with self._lock:
            self._generation += 1
            _safe_cancel_timer(self._timer)
            self._timer = None
            self._socket = None

    def _expire(self, generation: int) -> None:
        with self._lock:
            if generation != self._generation or self._socket is None:
                return
            self._expired = True
            _safe_close(self._socket)


class PinnedHTTPSClient:
    """Synchronous bounded HTTPS client with DNS and peer-address pinning."""

    def __init__(
        self,
        *,
        resolver: Resolver = socket.getaddrinfo,
        socket_factory: SocketFactory = socket.socket,
        ssl_context_factory: TLSContextFactory = ssl.create_default_context,
        response_factory: ResponseFactory = http.client.HTTPResponse,
        environ: Mapping[str, str] = os.environ,
        monotonic: Callable[[], float] = time.monotonic,
        resolver_wait: ResolverWait | None = None,
        watchdog_factory: WatchdogFactory = SocketDeadlineWatchdog,
    ) -> None:
        self._resolver = resolver
        self._socket_factory = socket_factory
        self._ssl_context_factory = ssl_context_factory
        self._response_factory = response_factory
        self._environ = environ
        self._monotonic = monotonic
        self._resolver_wait = resolver_wait or _BoundedResolverWait()
        self._watchdog_factory = watchdog_factory

    def fetch(
        self,
        url: str,
        *,
        headers: Mapping[str, str] | None = None,
        allowed_ports: Collection[int] = (),
        total_timeout: float = DEFAULT_TOTAL_TIMEOUT,
        connect_timeout: float = DEFAULT_CONNECT_TIMEOUT,
        read_timeout: float = DEFAULT_READ_TIMEOUT,
        max_bytes: int = DEFAULT_MAX_BYTES,
        redirect_validator: RedirectValidator | None = None,
    ) -> PinnedHTTPSResponse:
        """Fetch one public HTTPS resource, revalidating every redirect."""

        return self.request(
            "GET",
            url,
            headers=headers,
            allowed_ports=allowed_ports,
            total_timeout=total_timeout,
            connect_timeout=connect_timeout,
            read_timeout=read_timeout,
            max_bytes=max_bytes,
            redirect_validator=redirect_validator,
        )

    def request(
        self,
        method: str,
        url: str,
        *,
        headers: Mapping[str, str] | None = None,
        json_body: bytes | None = None,
        allowed_ports: Collection[int] = (),
        total_timeout: float = DEFAULT_TOTAL_TIMEOUT,
        connect_timeout: float = DEFAULT_CONNECT_TIMEOUT,
        read_timeout: float = DEFAULT_READ_TIMEOUT,
        max_bytes: int = DEFAULT_MAX_BYTES,
        redirect_validator: RedirectValidator | None = None,
        private_network_cidrs: Collection[str] = (),
        allow_sensitive_headers: bool = False,
    ) -> PinnedHTTPSResponse:
        """Issue a GET or JSON POST under one absolute bounded deadline."""

        if self._environ.get(EXTERNAL_NETWORK_FLAG) not in EXTERNAL_NETWORK_TRUTHY_VALUES:
            raise NetworkAccessDisabledError("External network access is disabled")
        if method not in {"GET", "POST"}:
            raise UnsafeNetworkRequestError("Unsupported HTTPS method rejected")
        if method == "POST" and not isinstance(json_body, bytes):
            raise UnsafeNetworkRequestError("POST requires an explicit JSON body")
        if method == "GET" and json_body is not None:
            raise UnsafeNetworkRequestError("GET must not include a request body")
        self._validate_budgets(total_timeout, connect_timeout, read_timeout, max_bytes)
        approved_private_networks = _parse_private_networks(private_network_cidrs)

        started_at = self._monotonic()
        current_url = url
        visited: set[str] = set()
        redirect_count = 0
        while True:
            target = self._validate_url(current_url, allowed_ports)
            if target.url in visited:
                raise UnsafeNetworkRequestError("Redirect loop rejected")
            visited.add(target.url)

            status, response_headers, body = self._request_once(
                target,
                headers or {},
                method=method,
                body=json_body,
                started_at=started_at,
                total_timeout=total_timeout,
                connect_timeout=connect_timeout,
                read_timeout=read_timeout,
                max_bytes=max_bytes,
                approved_private_networks=approved_private_networks,
                allow_sensitive_headers=allow_sensitive_headers,
            )
            if status not in _REDIRECT_STATUSES:
                return PinnedHTTPSResponse(
                    final_url=target.url,
                    status=status,
                    headers=MappingProxyType(response_headers),
                    body=body,
                )

            if redirect_count >= MAX_REDIRECTS:
                raise NetworkRequestError("Maximum redirect count exceeded")
            location = response_headers.get("location")
            if not location or any(character in location for character in "\r\n"):
                raise UnsafeNetworkRequestError("Invalid redirect location rejected")
            candidate = urljoin(target.url, location)
            try:
                redirect_target = self._validate_url(candidate, allowed_ports)
            except UnsafeNetworkRequestError as exc:
                raise UnsafeNetworkRequestError("Unsafe redirect rejected") from exc
            if redirect_validator is not None:
                try:
                    approved = redirect_validator(target.url, redirect_target.url)
                except Exception as exc:
                    raise UnsafeNetworkRequestError("Redirect rejected by caller policy") from exc
                if approved is not True:
                    raise UnsafeNetworkRequestError("Redirect rejected by caller policy")
            if redirect_target.url in visited:
                raise UnsafeNetworkRequestError("Redirect loop rejected")
            current_url = redirect_target.url
            if status in {301, 302, 303}:
                method = "GET"
                json_body = None
            redirect_count += 1

    @staticmethod
    def _validate_budgets(
        total_timeout: float, connect_timeout: float, read_timeout: float, max_bytes: int
    ) -> None:
        for value in (total_timeout, connect_timeout, read_timeout):
            if (
                isinstance(value, bool)
                or not isinstance(value, Real)
                or not math.isfinite(value)
                or value <= 0
            ):
                raise ValueError("timeout budget must be a finite positive real number")
        if isinstance(max_bytes, bool) or not isinstance(max_bytes, int) or max_bytes <= 0:
            raise ValueError("max_bytes must be a positive integer")

    @staticmethod
    def _validate_url(url: str, allowed_ports: Collection[int]) -> _Target:
        if not isinstance(url, str) or not url or any(character.isspace() for character in url):
            raise UnsafeNetworkRequestError("Unsafe HTTPS URL rejected")
        lowered = url.lower()
        if "\\" in url or "%0d" in lowered or "%0a" in lowered:
            raise UnsafeNetworkRequestError("Ambiguous HTTPS URL rejected")
        try:
            parsed = urlsplit(url)
            port = parsed.port
            raw_hostname = parsed.hostname
        except (ValueError, UnicodeError) as exc:
            raise UnsafeNetworkRequestError("Malformed HTTPS URL rejected") from exc
        if (
            parsed.scheme != "https"
            or not parsed.netloc
            or raw_hostname is None
            or parsed.username is not None
            or parsed.password is not None
            or parsed.fragment
        ):
            raise UnsafeNetworkRequestError("Only HTTPS URLs without userinfo are allowed")

        hostname = _normalize_hostname(raw_hostname)
        effective_port = 443 if port is None else port
        if effective_port != 443 and effective_port not in allowed_ports:
            raise UnsafeNetworkRequestError("The requested HTTPS port is not allowed")
        if not 1 <= effective_port <= 65535:
            raise UnsafeNetworkRequestError("The requested HTTPS port is not allowed")

        path = parsed.path or "/"
        request_target = path + (f"?{parsed.query}" if parsed.query else "")
        bracketed_host = f"[{hostname}]" if ":" in hostname else hostname
        host_header = (
            bracketed_host if effective_port == 443 else f"{bracketed_host}:{effective_port}"
        )
        normalized_netloc = host_header if effective_port != 443 else bracketed_host
        normalized_url = urlunsplit(
            SplitResult("https", normalized_netloc, parsed.path, parsed.query, "")
        )
        return _Target(normalized_url, hostname, effective_port, request_target, host_header)

    def _request_once(
        self,
        target: _Target,
        caller_headers: Mapping[str, str],
        *,
        method: str,
        body: bytes | None,
        started_at: float,
        total_timeout: float,
        connect_timeout: float,
        read_timeout: float,
        max_bytes: int,
        approved_private_networks: tuple[ipaddress.IPv4Network | ipaddress.IPv6Network, ...],
        allow_sensitive_headers: bool,
    ) -> tuple[int, dict[str, str], bytes]:
        remaining = self._remaining(started_at, total_timeout)
        addresses = self._resolve_addresses(
            target.hostname,
            target.port,
            remaining,
            approved_private_networks=approved_private_networks,
        )
        family, kind, proto, sockaddr, pinned_ip = addresses[0]
        raw_socket: _SocketLike | None = None
        tls_socket: _TLSSocketLike | None = None
        response: _ResponseLike | None = None
        watchdog: _WatchdogLike | None = None

        try:
            raw_socket = self._socket_factory(family, kind, proto)
            remaining = self._remaining(started_at, total_timeout)
            watchdog = self._watchdog_factory()
            watchdog.arm(remaining, raw_socket)
            raw_socket.settimeout(min(connect_timeout, remaining))
            raw_socket.connect(sockaddr)
            tls_socket = self._ssl_context_factory().wrap_socket(
                raw_socket,
                server_hostname=target.hostname,
                do_handshake_on_connect=False,
            )
            watchdog.replace(tls_socket)
            tls_socket.settimeout(min(read_timeout, self._remaining(started_at, total_timeout)))
            tls_socket.do_handshake()
            peer = _parse_ip(str(tls_socket.getpeername()[0]))
            validated_ips = {item[4] for item in addresses}
            if peer != pinned_ip or peer not in validated_ips:
                raise UnsafeNetworkRequestError("Connected peer did not match the pinned address")

            tls_socket.settimeout(min(read_timeout, self._remaining(started_at, total_timeout)))
            tls_socket.sendall(
                _build_request(
                    target,
                    caller_headers,
                    method=method,
                    body=body,
                    allow_sensitive_headers=allow_sensitive_headers,
                )
            )
            response = self._response_factory(tls_socket)
            response.begin()
            self._remaining(started_at, total_timeout)
            normalized_headers = _normalize_response_headers(response.getheaders())
            if response.status in _REDIRECT_STATUSES:
                return response.status, normalized_headers, b""
            body = _read_bounded_body(
                response,
                normalized_headers,
                max_bytes,
                before_read=lambda: tls_socket.settimeout(
                    min(read_timeout, self._remaining(started_at, total_timeout))
                ),
            )
            return response.status, normalized_headers, body
        except (NetworkRequestError, UnsafeNetworkRequestError):
            raise
        except TimeoutError as exc:
            raise NetworkTimeoutError("External HTTPS request timed out") from exc
        except (OSError, http.client.HTTPException, ssl.SSLError, ValueError) as exc:
            if watchdog is not None and watchdog.expired:
                raise NetworkTimeoutError("External HTTPS request timed out") from exc
            raise NetworkRequestError("External HTTPS request failed") from exc
        finally:
            _safe_disarm(watchdog)
            _safe_close(response)
            _safe_close(tls_socket)
            if raw_socket is not None and raw_socket is not tls_socket:
                _safe_close(raw_socket)

    def _resolve_public(self, hostname: str, port: int, timeout: float) -> list[ResolvedAddress]:
        return self._resolve_addresses(hostname, port, timeout, approved_private_networks=())

    def _resolve_addresses(
        self,
        hostname: str,
        port: int,
        timeout: float,
        *,
        approved_private_networks: tuple[ipaddress.IPv4Network | ipaddress.IPv6Network, ...],
    ) -> list[ResolvedAddress]:
        if _is_blocked_hostname(hostname, allow_private_network=bool(approved_private_networks)):
            raise UnsafeNetworkRequestError("Target is not a safe public address")
        try:
            answers = self._resolver_wait(
                lambda: self._resolver(hostname, port, socket.AF_UNSPEC, socket.SOCK_STREAM),
                timeout,
            )
        except TimeoutError as exc:
            raise NetworkTimeoutError("External HTTPS request timed out") from exc
        except OSError as exc:
            raise NetworkRequestError("Public hostname resolution failed") from exc
        validated = []
        for family, kind, proto, _canonical, sockaddr in answers:
            if family not in {socket.AF_INET, socket.AF_INET6} or not sockaddr:
                raise UnsafeNetworkRequestError("Target is not a safe public address")
            address = _parse_ip(str(sockaddr[0]))
            if not _is_allowed_ip(address, approved_private_networks=approved_private_networks):
                raise UnsafeNetworkRequestError("Target is not a safe public address")
            validated.append((family, kind, proto, sockaddr, address))
        if not validated:
            raise NetworkRequestError("Public hostname resolution returned no addresses")
        return validated

    def _remaining(self, started_at: float, total_timeout: float) -> float:
        remaining = total_timeout - (self._monotonic() - started_at)
        if remaining <= 0:
            raise NetworkTimeoutError("External HTTPS request timed out")
        return remaining


def _normalize_hostname(hostname: str) -> str:
    candidate = hostname.casefold()
    try:
        ipaddress.ip_address(candidate)
    except ValueError:
        if candidate.endswith(".") or len(candidate) > 253:
            raise UnsafeNetworkRequestError("Malformed HTTPS hostname rejected") from None
        try:
            candidate = candidate.encode("idna").decode("ascii")
        except UnicodeError as exc:
            raise UnsafeNetworkRequestError("Malformed HTTPS hostname rejected") from exc
        if any(not _DNS_LABEL.fullmatch(label) for label in candidate.split(".")):
            raise UnsafeNetworkRequestError("Malformed HTTPS hostname rejected") from None
    return candidate


def _is_blocked_hostname(hostname: str, *, allow_private_network: bool = False) -> bool:
    lowered = hostname.casefold()
    return (
        lowered in _BLOCKED_HOSTS
        or lowered.endswith(".localhost")
        or (not allow_private_network and lowered.endswith(".internal"))
        or (not allow_private_network and lowered.endswith(".local"))
    )


def _parse_ip(value: str) -> ipaddress.IPv4Address | ipaddress.IPv6Address:
    try:
        return ipaddress.ip_address(value.split("%", 1)[0])
    except ValueError as exc:
        raise UnsafeNetworkRequestError("Target is not a safe public address") from exc


def _is_public_ip(address: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if (
        address in _METADATA_IPS
        or address.is_loopback
        or address.is_private
        or address.is_link_local
        or address.is_multicast
        or address.is_reserved
        or address.is_unspecified
        or not address.is_global
    ):
        return False
    if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped is not None:
        mapped = address.ipv4_mapped
        return mapped.is_global and mapped not in _METADATA_IPS
    return True


def _is_allowed_ip(
    address: ipaddress.IPv4Address | ipaddress.IPv6Address,
    *,
    approved_private_networks: tuple[ipaddress.IPv4Network | ipaddress.IPv6Network, ...],
) -> bool:
    if (
        address in _METADATA_IPS
        or address.is_loopback
        or address.is_link_local
        or address.is_multicast
        or address.is_reserved
        or address.is_unspecified
    ):
        return False
    if isinstance(address, ipaddress.IPv6Address):
        if (
            address.ipv4_mapped is not None
            or address.sixtofour is not None
            or address.teredo is not None
            or address.is_site_local
        ):
            return False
        if address.is_global:
            return True
        if address not in _ULA_NETWORK:
            return False
    elif address.is_global:
        return True
    elif not any(address in network for network in _RFC1918_NETWORKS):
        return False
    return any(
        address.version == network.version and address in network
        for network in approved_private_networks
    )


_RFC1918_NETWORKS = (
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
)
_ULA_NETWORK = ipaddress.ip_network("fc00::/7")


def _parse_private_networks(
    values: Collection[str],
) -> tuple[ipaddress.IPv4Network | ipaddress.IPv6Network, ...]:
    networks: list[ipaddress.IPv4Network | ipaddress.IPv6Network] = []
    for value in values:
        if not isinstance(value, str):
            raise UnsafeNetworkRequestError("Invalid private network approval")
        try:
            network = ipaddress.ip_network(value, strict=True)
        except ValueError:
            raise UnsafeNetworkRequestError("Invalid private network approval") from None
        approved_space = (
            any(network.subnet_of(parent) for parent in _RFC1918_NETWORKS)
            if network.version == 4
            else network.subnet_of(_ULA_NETWORK)
        )
        if not approved_space:
            raise UnsafeNetworkRequestError("Invalid private network approval")
        networks.append(network)
    return tuple(networks)


def _build_request(
    target: _Target,
    caller_headers: Mapping[str, str],
    *,
    method: str = "GET",
    body: bytes | None = None,
    allow_sensitive_headers: bool = False,
) -> bytes:
    output = [
        f"{method} {target.request_target} HTTP/1.1",
        f"Host: {target.host_header}",
        "Accept-Encoding: identity",
        "Connection: close",
    ]
    for name, value in caller_headers.items():
        if not isinstance(name, str) or not isinstance(value, str):
            raise UnsafeNetworkRequestError("Invalid request header rejected")
        if not _HEADER_NAME.fullmatch(name) or any(character in value for character in "\r\n"):
            raise UnsafeNetworkRequestError("Invalid request header rejected")
        if name.casefold() not in _ALLOWED_CALLER_HEADERS:
            continue
        if name.casefold() in _SENSITIVE_CALLER_HEADERS and not allow_sensitive_headers:
            continue
        output.append(f"{name}: {value}")
    if method == "POST":
        assert body is not None
        output.extend(
            [
                "Content-Type: application/json",
                f"Content-Length: {len(body)}",
            ]
        )
    head = ("\r\n".join(output) + "\r\n\r\n").encode("latin-1")
    return head + (body or b"")


def _normalize_response_headers(headers: list[tuple[str, str]]) -> dict[str, str]:
    normalized: dict[str, str] = {}
    for name, value in headers:
        lowered = name.strip().casefold()
        if not _HEADER_NAME.fullmatch(lowered) or any(character in value for character in "\r\n"):
            raise NetworkRequestError("Invalid external response headers")
        cleaned = value.strip()
        normalized[lowered] = (
            f"{normalized[lowered]}, {cleaned}" if lowered in normalized else cleaned
        )
    return normalized


def _read_bounded_body(
    response: _ResponseLike,
    headers: Mapping[str, str],
    max_bytes: int,
    *,
    before_read: Callable[[], None],
) -> bytes:
    media_type = headers.get("content-type", "").split(";", 1)[0].strip().casefold()
    if media_type not in _ALLOWED_MEDIA_TYPES:
        raise NetworkRequestError("External response media type is not allowed")
    encoding = headers.get("content-encoding", "").strip().casefold()
    if encoding not in {"", "identity"}:
        raise NetworkRequestError("External response encoding is not allowed")
    declared_length = headers.get("content-length")
    if declared_length is not None:
        try:
            parsed_length = int(declared_length)
        except ValueError as exc:
            raise NetworkRequestError("Invalid external response length") from exc
        if parsed_length < 0 or parsed_length > max_bytes:
            raise NetworkRequestError("External response exceeded the body limit")

    chunks: list[bytes] = []
    size = 0
    while True:
        before_read()
        chunk = response.read(min(65536, max_bytes - size + 1))
        if not chunk:
            break
        size += len(chunk)
        if size > max_bytes:
            raise NetworkRequestError("External response exceeded the body limit")
        chunks.append(chunk)
    return b"".join(chunks)


def _safe_close(resource: _Closable | None) -> None:
    if resource is None:
        return
    try:
        resource.close()
    except Exception:
        return


def _safe_disarm(watchdog: _WatchdogLike | None) -> None:
    if watchdog is None:
        return
    try:
        watchdog.disarm()
    except Exception:
        return


def _safe_cancel_timer(timer: _TimerLike | None) -> None:
    if timer is None:
        return
    try:
        timer.cancel()
    except Exception:
        return
