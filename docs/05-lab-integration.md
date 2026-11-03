# 05 — Integrate Open5GS and UERANSIM safely

This section explains the parameters that must agree. Use only fabricated lab identities and a private, loopback-only setup.

## Network identity

A 5G network is identified by a PLMN:
- MCC: Mobile Country Code
- MNC: Mobile Network Code

Other important values:
- TAC: Tracking Area Code
- SST: Slice/Service Type
- SD: Slice Differentiator (optional)
- SUPI: Subscriber Permanent Identifier (in a lab, often an IMSI-form SUPI)
- K and OPc: authentication material for the synthetic subscriber

For an isolated simulator, a test PLMN such as MCC `999`, MNC `70` is commonly used in examples. Confirm the exact accepted values in your installed Open5GS and UERANSIM versions.

## Consistency checklist

Before starting processes, verify:
- UE PLMN matches gNB PLMN.
- gNB PLMN matches AMF served PLMN.
- TAC is consistent.
- Slice SST/SD are consistent across UE, gNB and core configuration.
- gNB's AMF target address and port match the AMF NGAP listener.
- UE's gNB search address matches the simulated gNB address.
- Synthetic SUPI exists in Open5GS subscriber data.
- K, OPc and AMF authentication parameters match exactly in the UE and subscriber database.
- No address is accidentally bound to a public interface.

## Example-only topology

For a same-host simulation, many upstream examples use loopback addresses for the gNB-to-AMF control plane. The exact addresses should be taken from the matching upstream Open5GS/UERANSIM example configuration and your host's interface setup.

Do not paste configuration snippets from an unrelated tutorial over `/etc/open5gs/*.yaml`. Back up files first and edit only the necessary fields.

## Synthetic subscriber provisioning

Use the Open5GS WebUI or the current documented subscriber provisioning method to create a fabricated subscriber. The SUPI/IMSI, K and OPc must match the synthetic UE config.

Do not use:
- a real SIM's IMSI;
- a real SIM's authentication key;
- a real person's phone number or IMEI;
- credentials copied from carrier systems.

Treat lab K and OPc values as secrets even though they are synthetic. Do not publish them in screenshots or repositories.

## Start-up sequence

Once all settings are aligned:
1. Verify MongoDB is healthy.
2. Verify the required Open5GS functions are active.
3. Start the simulated gNB using the command documented by your UERANSIM revision.
4. Confirm the gNB establishes its NGAP association with the AMF.
5. Start the simulated UE using its matching config.
6. Inspect AMF and UE logs for registration and authentication outcomes.
7. If supported by your configuration, inspect PDU-session establishment.

Use upstream command help (`nr-gnb --help`, `nr-ue --help`) and examples to confirm invocation syntax.

## Useful logs

```bash
sudo journalctl -u open5gs-amfd -f
sudo journalctl -u open5gs-smfd -f
sudo journalctl -u open5gs-upfd -f
```

UERANSIM prints its own process logs in the terminal. Save them to `~/telecom-lab/logs/` when troubleshooting.
