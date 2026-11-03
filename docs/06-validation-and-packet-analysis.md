# 06 — Validate registration and analyze lab traffic

## Milestone A: core health

Check:
```bash
sudo systemctl --no-pager --failed
sudo systemctl status open5gs-amfd
sudo systemctl status open5gs-smfd
sudo systemctl status open5gs-upfd
```

A missing service may indicate it was not installed or enabled. Consult the installed package's service list.

## Milestone B: gNB association

Start the gNB according to the UERANSIM README and its example configuration. Confirm:
- process remains running;
- configured PLMN/TAC are consistent;
- AMF address is reachable locally;
- AMF logs show the simulated gNB association.

## Milestone C: UE registration

Start the UE using the matching synthetic subscriber configuration. Look for:
- registration request;
- authentication exchange;
- security mode procedure;
- registration accept;
- PDU session establishment (if configured).

Exact log wording varies by release.

## Milestone D: packet analysis

Capture only your own local lab traffic. Identify the actual interface first:

```bash
ip -brief address
```

For a short, local, lab-only capture, use Wireshark or tcpdump on the interface carrying the simulator traffic. Avoid capturing unrelated host or third-party traffic.

Example: inspect local UDP traffic in Wireshark with a display filter:
```text
udp
```

Useful Wireshark filters depend on protocol decoding and the simulator version. Start with interface and port observations, then inspect decoded NGAP/NAS messages where available.

## Privacy and secrets

Packet captures can contain subscriber identifiers and authentication-related signalling. Keep captures private, use synthetic identities, and remove sensitive files before sharing logs publicly.

## Troubleshooting checklist

### AMF not starting
- Check YAML syntax and indentation.
- Check the AMF bind address and port.
- Check NRF and other required functions.
- Read `journalctl -u open5gs-amfd`.

### gNB cannot reach AMF
- Check AMF NGAP listener address and port.
- Check the gNB AMF target address.
- Check host firewall and local routing.
- Confirm the gNB and AMF are in the same intended lab network.

### UE registration rejected
- Confirm SUPI exists in subscriber data.
- Confirm K and OPc match exactly.
- Confirm PLMN, TAC and slice consistency.
- Check AMF and AUSF logs.

### PDU session fails
- Inspect SMF and UPF logs.
- Check DNN and slice configuration.
- Review the lab's tunnel/interface setup and host routing.
- Avoid changing multiple settings at once; record each change.
