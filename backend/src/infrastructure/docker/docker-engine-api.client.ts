import http from 'http';

const DOCKER_SOCKET_PATH = '/var/run/docker.sock';
/** Engine API version pinned to what this Docker Desktop host reports (`docker version`). */
const API_VERSION = 'v1.43';

/**
 * Minimal Docker Engine API client over the mounted unix socket. Not `dockerode`: this service
 * only needs list/inspect/create/start/stop/remove containers plus /info -- five endpoints don't
 * justify the dependency, and keeping the request/label payload in our own code keeps the
 * delicate part (compose label stamping, see DockerScalingService) visible and auditable here
 * rather than behind a library abstraction.
 */
export class DockerEngineApiClient {
  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  private request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const payload = body !== undefined ? JSON.stringify(body) : undefined;

    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          socketPath: DOCKER_SOCKET_PATH,
          path: `/${API_VERSION}${path}`,
          method,
          headers: payload
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : undefined,
          timeout: 15000,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            const status = res.statusCode ?? 0;
            if (status < 200 || status >= 300) {
              reject(
                new Error(`Docker Engine API ${method} ${path} -> ${status}: ${text || '(empty body)'}`),
              );
              return;
            }
            if (!text) {
              resolve(undefined as T);
              return;
            }
            try {
              resolve(JSON.parse(text) as T);
            } catch {
              // A handful of endpoints (e.g. container start) return an empty 204 body; anything
              // else non-JSON is unexpected but not worth failing the whole operation over.
              resolve(undefined as T);
            }
          });
        },
      );

      req.on('timeout', () => req.destroy(new Error(`Docker Engine API ${method} ${path} timed out`)));
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }
}
