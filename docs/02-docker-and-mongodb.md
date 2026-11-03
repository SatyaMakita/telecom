# 02 — Docker Engine, Compose and MongoDB

## Install Docker Engine

Follow Docker's current official Ubuntu instructions:
https://docs.docker.com/engine/install/ubuntu/

The general sequence is:
1. Remove conflicting unofficial packages if present (review Docker's current instructions first).
2. Add Docker's official apt repository and signing key.
3. Install `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin` and `docker-compose-plugin`.
4. Enable and start Docker.
5. Validate the installation.

Validation:

```bash
sudo systemctl enable --now docker
sudo docker version
sudo docker compose version
sudo docker run --rm hello-world
```

Security note: membership in the `docker` group is effectively root-level access on the host. For a learning machine, use `sudo docker` unless you understand and accept that implication.

## Start a local MongoDB container

Create `~/telecom-lab/compose.yaml`:

```yaml
services:
  mongodb:
    image: mongo:8.0
    container_name: telecom-mongodb
    restart: unless-stopped
    ports:
      - "127.0.0.1:27017:27017"
    volumes:
      - mongodb_data:/data/db

volumes:
  mongodb_data:
```

Start it:

```bash
cd ~/telecom-lab
sudo docker compose up -d
sudo docker ps
```

Test it:

```bash
sudo docker exec telecom-mongodb \
  mongosh --quiet --eval 'db.adminCommand({ping: 1})'
```

Expected result includes `ok: 1`.

## Important Open5GS database note

Open5GS commonly uses MongoDB for subscriber data. Decide on one MongoDB instance for the lab and configure Open5GS to use it. If Open5GS is installed directly on the host, `127.0.0.1:27017` is the intended local endpoint for the compose mapping above.

Do not expose MongoDB on `0.0.0.0`. Do not add a public firewall rule for port 27017.

## Useful commands

```bash
sudo docker compose ps
sudo docker compose logs -f mongodb
sudo docker compose down
```

`docker compose down` preserves the named volume. To remove the database volume, use `docker compose down -v` only when you intentionally want to erase the lab database.
