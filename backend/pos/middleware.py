"""
Ejercicios 3 y 4 — Middlewares de CORS, Pre-procesamiento (Logging) y Post-procesamiento (Sanitizar IDs internos)
"""
import json
from pos.models import RequestLog

INTERNAL_ID_SUFFIXES = (
    '_interna_id',
    '_internal_id',
    '_record_id',
    '_audit_id',
)


class RequestLoggingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        ip = request.META.get('REMOTE_ADDR', '127.0.0.1') or '127.0.0.1'
        try:
            RequestLog.objects.create(
                method=request.method,
                path=request.path[:255],
                ip=ip,
            )
        except Exception:
            pass
        return self.get_response(request)


class SanitizeIdsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        if response.get('Content-Type', '').startswith('application/json'):
            try:
                data = json.loads(response.content)
                cleaned = self._strip_internal_ids(data)
                response.content = json.dumps(cleaned)
            except (ValueError, TypeError):
                pass

        return response

    def _strip_internal_ids(self, data):
        if isinstance(data, dict):
            return {
                k: self._strip_internal_ids(v)
                for k, v in data.items()
                if not k.endswith(INTERNAL_ID_SUFFIXES)
            }
        if isinstance(data, list):
            return [self._strip_internal_ids(item) for item in data]
        return data
