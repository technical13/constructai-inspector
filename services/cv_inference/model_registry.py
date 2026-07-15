from dataclasses import dataclass
from threading import BoundedSemaphore, Lock
from typing import Callable


class ModelBusyError(RuntimeError):
    pass


class UnknownModelError(ValueError):
    pass


@dataclass
class ModelAdapter:
    key: str
    label: str
    infer: Callable[[str], dict]
    readiness: Callable[[], dict]
    in_flight: int = 0
    last_error: str | None = None


class ModelRegistry:
    def __init__(
        self,
        *,
        max_concurrency: int = 1,
        max_queue: int = 8,
        queue_timeout_seconds: float = 10.0,
    ):
        if max_concurrency < 1:
            raise ValueError("max_concurrency must be at least 1")
        if max_queue < 0:
            raise ValueError("max_queue must be non-negative")
        if queue_timeout_seconds <= 0:
            raise ValueError("queue_timeout_seconds must be positive")

        self._max_concurrency = max_concurrency
        self._max_queue = max_queue
        self._queue_timeout_seconds = queue_timeout_seconds
        self._capacity = BoundedSemaphore(max_concurrency)
        self._lock = Lock()
        self._adapters: dict[str, ModelAdapter] = {}
        self._active = 0
        self._waiting = 0

    def register(
        self,
        key: str,
        label: str,
        infer: Callable[[str], dict],
        readiness: Callable[[], dict],
    ) -> None:
        normalized_key = key.strip().lower()
        if not normalized_key:
            raise ValueError("model key must not be empty")
        if normalized_key in self._adapters:
            raise ValueError(f"model {normalized_key} is already registered")

        self._adapters[normalized_key] = ModelAdapter(
            key=normalized_key,
            label=label,
            infer=infer,
            readiness=readiness,
        )

    def keys(self) -> list[str]:
        return list(self._adapters.keys())

    def infer(self, model_key: str, image_data_url: str) -> dict:
        normalized_key = (model_key or "").strip().lower()
        adapter = self._adapters.get(normalized_key)
        if adapter is None:
            raise UnknownModelError(f"Неизвестная CV-модель: {normalized_key or 'empty'}.")

        with self._lock:
            if self._active >= self._max_concurrency and self._waiting >= self._max_queue:
                raise ModelBusyError("Очередь CV-service заполнена.")
            self._waiting += 1

        acquired = False
        try:
            acquired = self._capacity.acquire(timeout=self._queue_timeout_seconds)
        finally:
            with self._lock:
                self._waiting -= 1

        if not acquired:
            raise ModelBusyError("CV-service не освободил вычислительный слот вовремя.")

        with self._lock:
            self._active += 1
            adapter.in_flight += 1

        try:
            result = adapter.infer(image_data_url)
            with self._lock:
                adapter.last_error = None
            return result
        except Exception as error:
            with self._lock:
                adapter.last_error = f"{type(error).__name__}: {error}"[:500]
            raise
        finally:
            with self._lock:
                self._active -= 1
                adapter.in_flight -= 1
            self._capacity.release()

    def describe(self) -> list[dict]:
        result = []
        for adapter in self._adapters.values():
            try:
                readiness = adapter.readiness() or {}
            except Exception as error:  # pragma: no cover - defensive status path
                readiness = {
                    "available": False,
                    "loaded": False,
                    "detail": f"Readiness failed: {type(error).__name__}",
                }

            available = bool(readiness.get("available", True))
            loaded = bool(readiness.get("loaded", False))
            if adapter.in_flight > 0:
                status = "running"
            elif adapter.last_error:
                status = "error"
            elif not available:
                status = "unavailable"
            elif loaded:
                status = "loaded"
            else:
                status = "idle"

            result.append(
                {
                    "key": adapter.key,
                    "label": adapter.label,
                    "status": status,
                    "available": available,
                    "loaded": loaded,
                    "inFlight": adapter.in_flight,
                    "detail": readiness.get("detail", ""),
                    "lastError": adapter.last_error,
                }
            )

        return result

    def policy(self) -> dict:
        with self._lock:
            return {
                "maxConcurrency": self._max_concurrency,
                "maxQueue": self._max_queue,
                "queueTimeoutSeconds": self._queue_timeout_seconds,
                "active": self._active,
                "queued": self._waiting,
            }
