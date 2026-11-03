# 08 — Telecom security, privacy and operations

## Protocol families to learn

| Protocol | Context | Study focus |
|---|---|---|
| SS7 / MAP | 2G/3G signalling | Trust model, roaming and signalling security |
| Diameter | LTE core | Authentication, policy and subscriber signalling |
| GTP | Packet core | Tunnelling and control/user-plane separation |
| S1AP | LTE access | eNodeB–MME signalling |
| NGAP | 5G access | gNB–AMF signalling |
| NAS | LTE/5G | Mobility and session procedures |
| HTTP/2 SBI | 5G core | Service-based interfaces and API security |

## Defensive topics

- mutual authentication and identity protection;
- least-privilege access to location services;
- API authentication and authorization;
- roaming and interconnect security;
- segmentation of management and signalling networks;
- logging, alerting and audit trails;
- data minimization and retention limits;
- secure handling of subscriber identifiers.

## Lab hardening checklist

- MongoDB binds only to loopback.
- Open5GS management interfaces are not internet-exposed.
- No public inbound firewall rules are added for telecom lab services.
- Synthetic credentials are used.
- Captures and logs are stored with restricted permissions.
- System packages are updated from trusted repositories.
- Lab services are stopped when not in use.

## Useful operational commands

```bash
sudo systemctl --failed
sudo ss -lntup
sudo journalctl -p warning -b --no-pager
sudo docker ps
```

Before sharing diagnostics, redact IPs if sensitive, subscriber identities, keys, OPc, passwords and tokens.
