# opencv/opencv on Phala Cloud

Deploy a CPU-safe OpenCV verifier behind a public Caddy proxy. The app installs the real `opencv-python-headless` wheel, imports `cv2`, then exposes JSON endpoints that run deterministic local image-processing operations without model downloads, provider calls, credentials, GPU access, or browser authentication.

## Metadata

- Template id: `opencv`
- Display name: `opencv/opencv`
- Category: AI Apps & Workflows
- Upstream repo: `https://github.com/opencv/opencv`
- Upstream docs: `https://docs.opencv.org/4.x/`
- Python package: `opencv-python-headless==4.13.0.92`
- Icon source: upstream `doc/opencv-logo.png` from `opencv/opencv`
- Upstream author: `opencv`

## What This Template Runs

OpenCV is an open source computer vision library, not a standalone hosted service. The upstream OpenCV README points users to the official documentation, and the OpenCV Python wheel documentation recommends headless packages for Docker, cloud, and other server environments that do not need GUI features.

This template therefore runs a small HTTP verifier on `ghcr.io/astral-sh/uv:python3.12-bookworm-slim`. On first startup it installs `opencv-python-headless`, imports `cv2`, verifies package metadata, and serves local smoke-test endpoints.

The `/demo` endpoint creates a synthetic image in memory and exercises real OpenCV APIs including drawing primitives, color conversion, Gaussian blur, Canny edge detection, thresholding, contour detection, corner detection, and PNG encoding. It returns measurements and SHA-256 checksums instead of downloading datasets, model weights, or remote images.

## Services

- `app`: internal Python HTTP service on port `8000`. It installs and imports OpenCV, then serves JSON readiness and demo endpoints.
- `proxy`: public Caddy reverse proxy. It publishes `8080:80` and forwards requests to the internal app.

## Deploy

1. Deploy the `opencv` template on Phala Cloud.
2. Keep the default CPU-only resources for the verifier.
3. Optionally set `OPENCV_PYTHON_HEADLESS_VERSION` to another compatible published wheel version.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first start downloads Python wheels from PyPI. No API keys, tokens, external model providers, GPU resources, privileged mode, host networking, host IPC, Docker socket, `env_file`, or host bind mounts are used.

## Environment Variables

The default template requires no credentials.

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `OPENCV_PYTHON_HEADLESS_VERSION` | `4.13.0.92` | No | Pinned `opencv-python-headless` wheel version installed at container startup. Override only when testing another compatible OpenCV build. |
| `OPENCV_LOG_LEVEL` | `ERROR` | No | Reduces OpenCV runtime log noise in the demo container. |
| `OPENCV_NUM_THREADS` | `1` | No | Limits OpenCV's internal thread pool for small CPU-only deployments. |

## Exposed Endpoints

The public HTTP API is available through Caddy on port `8080`.

- `GET /healthz`: Returns `200 OK` when `cv2` imports successfully and package metadata is available. Returns `503` with the import error if the package check fails.
- `GET /demo`: Runs the deterministic local OpenCV image-processing verifier and returns algorithm names, image measurements, contour and corner counts, and stable checksums.
- `GET /v1/models`: Returns an OpenAI-shaped model list identifying the local CPU verifier. The default template does not host or load an ML model.
- `GET /`: Same readiness payload as `/healthz`.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
```

## Smoke Verification

Run these checks after deployment to verify the Compose file and HTTP endpoints.

Run locally from the parent worktree:

```bash
docker compose -f templates/prebuilt/opencv/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/opencv/docker-compose.yml down
```

Expected `/demo` fields include:

```json
{
  "status": "ok",
  "credentials_required": false,
  "remote_calls": false,
  "model_downloaded": false,
  "demo": {
    "input": {
      "kind": "synthetic_bgr_image"
    },
    "measurements": {
      "contour_count": 1
    }
  }
}
```

Template validation commands from the parent worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/opencv/docker-compose.yml config >/dev/null
```

## Production Notes

- This is a verifier for the OpenCV runtime, not a production computer-vision API. Replace the inline app with your own OpenCV service for real workloads.
- The demo is intentionally headless and does not use `cv2.imshow` or GUI backends. Use a custom image if you need GUI features, camera capture drivers, or non-headless OpenCV builds.
- The default app does not download images, model weights, Haar cascades, DNN files, or external datasets. Add any required assets as explicit deployment-time configuration for production.
- The endpoints are unauthenticated. Add an authenticated reverse proxy or application-level auth before exposing private image-processing workloads.
- Pin `OPENCV_PYTHON_HEADLESS_VERSION` for reproducible deployments and review OpenCV, Python wheel, NumPy, and FFmpeg license requirements for your distribution model.

## Cleanup

For a local test run from the parent worktree, stop and remove the containers with:

```bash
docker compose -f templates/prebuilt/opencv/docker-compose.yml down
```

No named volumes are created by this template.
